import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { isContractAutoDispatchEnabled, processContractDispatchQueue } from "./dispatcher";

// 2026-09-29 — 계약은 이벤트 직후 바로 나가야 한다(Vercel Hobby는 하루 1회 크론만 허용 —
// 더 잦은 크론을 추가하면 배포가 실패한다). 큐잉은 DB 트리거가 이미 한다. 이 모듈은 그
// 트리거를 일으킨 서버 액션이 성공한 직후 워커를 응답 뒤(after)에서 돌린다. 하루 1회
// 크론(/api/cron/dispatch-contracts)은 재시도 백스톱이다.
//
// 규칙: 호출자의 결과·지연에 절대 영향을 주지 않는다 — 어떤 오류도 삼키고 로그만 남긴다.
// fail-closed: 관리자 설정이 꺼져 있거나 env가 "false"(비상 정지)이거나 설정 조회 실패면 아무것도 하지 않는다(claim도 발송도 없음).

export type ContractDispatchScope = {
  /** 이미 아는 자녀 id들 */
  childIds?: string[];
  /** 체험 완료 경로 — 세션 → subject_enrollment → child */
  sessionId?: string;
  /** 상담 결과 경로 — consultations.child_id */
  consultationId?: string;
};

async function resolveChildIds(scope: ContractDispatchScope): Promise<string[]> {
  const admin = createAdminClient();
  const ids = new Set<string>(scope.childIds ?? []);
  if (scope.sessionId) {
    const { data } = await admin
      .from("sessions")
      .select("subject_enrollment:subject_enrollments!sessions_subject_enrollment_id_fkey(child_id)")
      .eq("id", scope.sessionId)
      .maybeSingle();
    const enrollment = (data as { subject_enrollment?: { child_id?: string } | { child_id?: string }[] | null } | null)
      ?.subject_enrollment;
    const childId = Array.isArray(enrollment) ? enrollment[0]?.child_id : enrollment?.child_id;
    if (childId) ids.add(childId);
  }
  if (scope.consultationId) {
    const { data } = await admin.from("consultations").select("child_id").eq("id", scope.consultationId).maybeSingle();
    if (data?.child_id) ids.add(data.child_id as string);
  }
  return [...ids];
}

/** 워커 실행 본체 — 절대 throw하지 않는다. */
export async function runContractDispatchNow(scope: ContractDispatchScope): Promise<void> {
  try {
    if (!(await isContractAutoDispatchEnabled(createAdminClient()))) return;
    const childIds = await resolveChildIds(scope);
    if (childIds.length === 0) return;
    const result = await processContractDispatchQueue(createAdminClient(), { childIds });
    console.log(JSON.stringify({ event: "contract_dispatch_immediate_ran", ...result }));
  } catch (e) {
    console.error(
      JSON.stringify({ event: "contract_dispatch_immediate_failed", error: e instanceof Error ? e.message : String(e) })
    );
  }
}

/** 서버 액션이 성공한 뒤 호출한다. 응답을 막지 않도록 after()로 미루고, 요청 컨텍스트 밖이라
 * after()가 불가능하면 fire-and-forget으로 돌린다. 어떤 경우에도 throw하지 않는다. */
export function scheduleContractDispatch(scope: ContractDispatchScope): void {
  try {
    try {
      after(() => runContractDispatchNow(scope));
    } catch {
      void runContractDispatchNow(scope);
    }
  } catch (e) {
    console.error(
      JSON.stringify({ event: "contract_dispatch_immediate_failed", error: e instanceof Error ? e.message : String(e) })
    );
  }
}
