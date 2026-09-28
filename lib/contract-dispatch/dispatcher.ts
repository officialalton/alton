import type { SupabaseClient } from "@supabase/supabase-js";
import { sendRegularContractForSubjectEnrollment } from "@/lib/regular-contract-send";

// 2026-09-28 — 초기 고객 절차 단순화 4단계: contract_dispatch_jobs 워커.
// (docs/2026-09-26-consent-contract-simplification-implementation-plan.md)
//
// 실제 DocuSign 발송은 이 세션 범위에서 기본 비활성이다 — 사용자 지시:
// "실제 고객에게 계약서·이메일을 보내는 기능 활성화만 보류". 환경변수
// CONTRACT_AUTO_DISPATCH_ENABLED가 정확히 "true"일 때만 실제 발송을 시도한다.
// 꺼져 있으면 큐는 계속 쌓이되(트리거가 이미 큐잉함) 아무것도 발송하지 않고
// 그 사실을 결과에 명시한다 — 관리자 화면이 이 값을 보고 "자동 발송
// 비활성화됨" 배너를 보여준다.
export function isContractAutoDispatchEnabled(): boolean {
  return process.env.CONTRACT_AUTO_DISPATCH_ENABLED === "true";
}

// 승인자 표시는 기존 수동/자동 발송 경로(app/parent/trial-conversion-actions.ts,
// 삭제됨 — app/admin/trial-onboarding-actions.ts의 원클릭 발송)와 동일한
// 고정값을 그대로 쓴다.
const AUTO_APPROVER_NAME = "Do Kyung Kim";
const AUTO_APPROVER_TITLE = "CEO, Do Kyung Kim";
const MAX_ATTEMPTS_BEFORE_PERMANENT_FAILURE = 5;

export type ContractDispatchJobRow = {
  id: string;
  child_id: string;
  subject_enrollment_id: string | null;
  trigger_type: "completed_trial" | "direct_account_created";
  status: "queued" | "processing" | "sent" | "retryable_failed" | "permanent_failed";
  attempt_count: number;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
};

async function resolveGuardianForChild(
  admin: SupabaseClient,
  childId: string
): Promise<{ guardianUserId: string; guardianEmail: string; guardianName: string; childName: string } | null> {
  const { data: childProfile } = await admin.from("profiles").select("name").eq("id", childId).maybeSingle();

  const { data: householdLink } = await admin
    .from("household_members")
    .select("household_id")
    .eq("profile_id", childId)
    .eq("role", "child")
    .limit(1)
    .maybeSingle();
  if (!householdLink) return null;

  const { data: guardianLink } = await admin
    .from("household_members")
    .select("profile_id, is_primary")
    .eq("household_id", householdLink.household_id)
    .eq("role", "guardian")
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!guardianLink) return null;

  const { data: guardianAuth } = await admin.auth.admin.getUserById(guardianLink.profile_id);
  const { data: guardianProfile } = await admin
    .from("profiles")
    .select("name")
    .eq("id", guardianLink.profile_id)
    .maybeSingle();

  if (!guardianAuth.user?.email) return null;

  return {
    guardianUserId: guardianLink.profile_id,
    guardianEmail: guardianAuth.user.email,
    guardianName: guardianProfile?.name ?? "",
    childName: childProfile?.name ?? "",
  };
}

export type DispatchOneResult =
  | { outcome: "disabled" }
  | { outcome: "skipped_no_guardian" }
  | { outcome: "sent" }
  | { outcome: "already_sent" }
  | { outcome: "failed"; error: string };

/** 작업 하나를 처리한다 — 관리자 승인 실행(단건 재시도)과 배치 워커가 공유한다. */
export async function dispatchOneContractJob(
  admin: SupabaseClient,
  job: Pick<ContractDispatchJobRow, "id" | "child_id" | "subject_enrollment_id">
): Promise<DispatchOneResult> {
  if (!isContractAutoDispatchEnabled()) {
    return { outcome: "disabled" };
  }

  await admin
    .from("contract_dispatch_jobs")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", job.id);

  const guardian = await resolveGuardianForChild(admin, job.child_id);
  if (!guardian) {
    await admin
      .from("contract_dispatch_jobs")
      .update({
        status: "retryable_failed",
        last_error: "보호자 정보를 찾을 수 없습니다(household/guardian 미연결).",
        attempt_count: 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    return { outcome: "skipped_no_guardian" };
  }

  try {
    const result = await sendRegularContractForSubjectEnrollment(admin, {
      childId: job.child_id,
      subjectEnrollmentId: job.subject_enrollment_id ?? "",
      guardianEmail: guardian.guardianEmail,
      guardianName: guardian.guardianName,
      childName: guardian.childName,
      approverName: AUTO_APPROVER_NAME,
      approverTitle: AUTO_APPROVER_TITLE,
      triggeredByUserId: guardian.guardianUserId,
    });

    if (result.status === "failed") {
      const { data: current } = await admin
        .from("contract_dispatch_jobs")
        .select("attempt_count")
        .eq("id", job.id)
        .single();
      const nextAttempt = (current?.attempt_count ?? 0) + 1;
      await admin
        .from("contract_dispatch_jobs")
        .update({
          status: nextAttempt >= MAX_ATTEMPTS_BEFORE_PERMANENT_FAILURE ? "permanent_failed" : "retryable_failed",
          attempt_count: nextAttempt,
          last_error: result.error,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      return { outcome: "failed", error: result.error };
    }

    await admin
      .from("contract_dispatch_jobs")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    return { outcome: result.status === "already_sent" ? "already_sent" : "sent" };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const { data: current } = await admin
      .from("contract_dispatch_jobs")
      .select("attempt_count")
      .eq("id", job.id)
      .single();
    const nextAttempt = (current?.attempt_count ?? 0) + 1;
    await admin
      .from("contract_dispatch_jobs")
      .update({
        status: nextAttempt >= MAX_ATTEMPTS_BEFORE_PERMANENT_FAILURE ? "permanent_failed" : "retryable_failed",
        attempt_count: nextAttempt,
        last_error: message.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    return { outcome: "failed", error: message };
  }
}

/** 배치 워커 — 관리자 "발송 실행" 버튼 또는 향후 cron이 호출. 비활성 상태면
 * 아무 것도 처리하지 않고 그 사실만 반환한다(큐는 계속 쌓이게 둔다). */
export async function processContractDispatchQueue(
  admin: SupabaseClient
): Promise<{ enabled: boolean; processed: number; sent: number; failed: number }> {
  if (!isContractAutoDispatchEnabled()) {
    return { enabled: false, processed: 0, sent: 0, failed: 0 };
  }

  const { data: jobs } = await admin
    .from("contract_dispatch_jobs")
    .select("id, child_id, subject_enrollment_id")
    .in("status", ["queued", "retryable_failed"])
    .limit(50);

  let sent = 0;
  let failed = 0;
  for (const job of jobs ?? []) {
    const result = await dispatchOneContractJob(admin, job);
    if (result.outcome === "sent" || result.outcome === "already_sent") sent += 1;
    else if (result.outcome === "failed" || result.outcome === "skipped_no_guardian") failed += 1;
  }

  return { enabled: true, processed: (jobs ?? []).length, sent, failed };
}
