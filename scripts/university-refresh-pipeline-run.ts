// 2026-09-23 — 200개교 확대 세션 Part 3: approved 출처 URL을 가진 학교에 대해 실제
// requestUniversityRefresh -> runRefreshJob 파이프라인을 순차 실행해 변경안을 생성한다.
// requestUniversityRefresh는 로그인 세션(cookies)이 필요해 스크립트에서 직접 호출할 수
// 없으므로, 여기서는 동일한 admin 권한으로 university_refresh_jobs를 직접 큐잉한 뒤
// runRefreshJob(jobId, universityId)을 그대로 재사용한다(크롤링/변경안 로직은 100%
// 기존 코드 재사용, 새로 작성하지 않음). 스크립트가 한 번에 한 학교씩만 처리하므로
// 전역 동시 실행 한도(3)를 넘지 않는다.
//
// 완료 후 universities.data_collection_status를 갱신한다:
//   - 출처가 approved이고 이번 실행에서 no_change/new/changed 중 하나가 하나라도
//     나온 학교 -> 'sources_pending_review'(검토 대기, verified_pilot로는 승격하지 않음)
//   - 그 외(전부 fetch_failed였거나 approved 출처가 아직 없는 학교) -> 'unconfirmed' 유지
//
// 실행: npx tsx scripts/university-refresh-pipeline-run.ts [--limit N]
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg >= 0 ? Number(process.argv[limitArg + 1]) : Infinity;

  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { runRefreshJob } = await import("../lib/universities/refresh-actions");

  // approved 출처 URL을 1개 이상 가진 학교 중, verified_pilot이 아닌 학교(파일럿 10개교는
  // 이미 D/E 세션에서 실 파이프라인을 검증했으므로 이번 대상에서 제외).
  const { data: approvedUrls, error } = await db
    .from("university_source_urls")
    .select("university_id, universities(name, data_collection_status)")
    .eq("status", "approved");
  if (error) throw new Error(`approved 출처 조회 실패: ${error.message}`);

  const targetIds = new Set<string>();
  for (const row of approvedUrls ?? []) {
    const status = (row as unknown as { universities: { data_collection_status: string } }).universities
      ?.data_collection_status;
    if (status === "verified_pilot") continue;
    targetIds.add(row.university_id);
  }
  const allTargets = Array.from(targetIds);
  const targets = allTargets.slice(0, Number.isFinite(limit) ? limit : undefined);
  console.log(`갱신 파이프라인 실행 대상: ${targets.length}개교 (approved 출처 보유, 파일럿 제외, 전체 ${allTargets.length}개교 중)`);

  const summary: { universityId: string; name: string; jobStatus: string; resultTypes: string[] }[] = [];

  for (const [i, universityId] of targets.entries()) {
    const { data: uni } = await db.from("universities").select("name").eq("id", universityId).single();
    const name = uni?.name ?? universityId;
    process.stdout.write(`[${i + 1}/${targets.length}] ${name} ... `);

    const { data: job, error: jobErr } = await db
      .from("university_refresh_jobs")
      .insert({ university_id: universityId, requested_by: null, requested_role: "script:bulk-seed" })
      .select("id")
      .single();
    if (jobErr || !job) {
      console.log(`작업 큐잉 실패 — ${jobErr?.message}`);
      continue;
    }

    try {
      const ran = await runRefreshJob(job.id, universityId);
      const { data: proposals } = await db
        .from("university_update_proposals")
        .select("result_type")
        .eq("refresh_job_id", job.id);
      const resultTypes = (proposals ?? []).map((p) => p.result_type as string);
      console.log(`job=${ran.status} 결과유형=[${resultTypes.join(",")}]`);
      summary.push({ universityId, name, jobStatus: ran.status, resultTypes });

      const hasUsableSignal = resultTypes.some((t) => t === "no_change" || t === "new" || t === "changed");
      if (hasUsableSignal) {
        await db
          .from("universities")
          .update({ data_collection_status: "sources_pending_review", data_collection_status_verified_at: new Date().toISOString() })
          .eq("id", universityId)
          .neq("data_collection_status", "verified_pilot");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`예외 — ${message}`);
      summary.push({ universityId, name, jobStatus: "error", resultTypes: [message] });
    }
  }

  const logPath = path.resolve(process.cwd(), "scripts/.university-refresh-pipeline-run.log.json");
  writeFileSync(logPath, JSON.stringify(summary, null, 2));
  console.log(`\n완료: ${summary.length}개교 처리. 상세 로그: ${logPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
