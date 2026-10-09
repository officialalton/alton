import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { deleteDriveFile, processDeletionQueue } from "@/lib/retention/drive-deletion";

// R12(Section 2, 2026-09-24) — 자료 유형별 보존기간 자동 삭제·비식별화 배치.
// 다른 크론과 같은 fail-closed 규칙: CRON_SECRET이 없으면 아무것도 하지
// 않는다. 정산 크론(PAYOUT_CRON_ENABLED)과 같은 패턴으로, CRON_SECRET을
// 설정한 뒤에도 RETENTION_BATCH_ENABLED=true가 아니면 실행하지 않는다 —
// 실제 삭제·비식별화는 스케줄 등록과 별개로 명시적으로 켜야 한다.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "disabled: CRON_SECRET이 설정되지 않았습니다." },
      { status: 503 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (process.env.RETENTION_BATCH_ENABLED !== "true") {
    return NextResponse.json(
      { ok: false, error: "disabled: RETENTION_BATCH_ENABLED=true가 아니면 보존 배치는 실행하지 않습니다." },
      { status: 503 }
    );
  }

  // ?dryRun=true — 지우지 않고 대상 건수만 센다(run_data_retention_batch의 p_dry_run,
  // retention_batch_runs에 dry_run=true로 기록). 스케줄 호출(쿼리 없음)은 항상 실제 실행.
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "true";

  // TODO(5·7단계, GW-14 — 회의록 자동 수집 구현 뒤): Smart Notes/전사(session_ai_artifacts·
  // session_smart_notes) 행과 Drive 파일 삭제를 이 오케스트레이터에 추가한다. 기준은
  // product-architecture-v3.md §4.13 "Gemini 회의록·전사·수업자료: 마지막 수업 후 1년"이고,
  // Drive 삭제 실패는 관리자 재처리 대상으로 남겨야 한다(§4.13). 해당 테이블·Drive 삭제
  // 워크플로우가 아직 없어 지금은 추가하지 않는다(테이블을 미리 만들지 않는다).
  // 스케줄은 하루 1회를 넘기지 않는다 — Vercel Hobby는 더 잦은 크론이 있으면 배포가 실패한다.
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("run_data_retention_batch", { p_limit: 500, p_dry_run: dryRun });
  if (error) {
    console.error(JSON.stringify({ event: "data_retention_batch_failed", error: error.message }));
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Drive 파일 삭제 워커는 별도 플래그(RETENTION_DRIVE_DELETION_ENABLED=true)가 있을 때만, 그리고 dryRun이 아닐 때만 돈다.
  let drive: unknown = null;
  if (!dryRun && process.env.RETENTION_DRIVE_DELETION_ENABLED === "true") {
    drive = await processDeletionQueue({
      claim: async (limit) => {
        const { data: rows, error: e } = await admin.rpc("retention_claim_deletion_targets", { p_limit: limit });
        if (e) throw new Error(e.message);
        return rows ?? [];
      },
      markResult: async (id, ok, err) => {
        await admin.rpc("retention_mark_deletion_result", { p_id: id, p_ok: ok, p_error: err ?? null });
      },
      deleteFile: deleteDriveFile,
    });
  }

  console.log(JSON.stringify({ event: "data_retention_batch_ran", dryRun, result: data, drive }));
  return NextResponse.json({ ok: true, dryRun, result: data, drive });
}
