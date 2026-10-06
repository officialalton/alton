import type { SupabaseClient } from "@supabase/supabase-js";
import { CONTRACT_SEND_IN_PROGRESS_ERROR, sendRegularContractForSubjectEnrollment } from "@/lib/regular-contract-send";

// 2026-10-06 오너 결정: 자동 발송은 기본 ON이며 관리자가 contract_dispatch_settings로 켜고 끈다.
// 환경변수 CONTRACT_AUTO_DISPATCH_ENABLED가 정확히 "false"면 DB와 무관하게 강제 정지(비상 스위치).
// DB 조회가 실패하면 fail-safe로 비활성 취급하고 로그를 남긴다.
export async function isContractAutoDispatchEnabled(admin: SupabaseClient): Promise<boolean> {
  if (process.env.CONTRACT_AUTO_DISPATCH_ENABLED === "false") return false;
  try {
    const { data, error } = await admin
      .from("contract_dispatch_settings")
      .select("auto_dispatch_enabled")
      .eq("id", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data?.auto_dispatch_enabled === true;
  } catch (e) {
    console.error(
      JSON.stringify({ event: "contract_dispatch_setting_read_failed", error: e instanceof Error ? e.message : String(e) })
    );
    return false;
  }
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
  trigger_type: "completed_trial" | "direct_account_created" | "regular_recommended";
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
  | { outcome: "busy" }
  | { outcome: "failed"; error: string };

/** 작업 하나를 처리한다 — 관리자 승인 실행(단건 재시도)과 배치 워커가 공유한다. */
export async function dispatchOneContractJob(
  admin: SupabaseClient,
  job: Pick<ContractDispatchJobRow, "id" | "child_id" | "subject_enrollment_id">
): Promise<DispatchOneResult> {
  if (!(await isContractAutoDispatchEnabled(admin))) {
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

    if (result.status === "failed" && result.error === CONTRACT_SEND_IN_PROGRESS_ERROR) {
      // 같은 자녀의 다른 발송이 진행 중 — 시도 횟수는 올리지 않고 다음 실행에서 다시 본다
      // (그 발송이 끝나면 다음 호출은 already_sent 로 흡수된다).
      await admin
        .from("contract_dispatch_jobs")
        .update({ status: "retryable_failed", last_error: result.error, updated_at: new Date().toISOString() })
        .eq("id", job.id);
      return { outcome: "busy" };
    }

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

/** 특정 자녀들의 대기 작업만 원자적으로 집는다 — 이벤트 직후 즉시 발송(immediate.ts)용.
 * 전역 claim RPC와 같은 원칙: 단일 UPDATE ... WHERE status in (queued, retryable_failed)라
 * 동시에 도는 크론·다른 즉시 호출이 같은 행을 두 번 집을 수 없다(READ COMMITTED에서
 * 이미 processing으로 바뀐 행은 재평가에서 제외된다). */
async function claimJobsForChildren(admin: SupabaseClient, childIds: string[]): Promise<ContractDispatchJobRow[]> {
  const { data, error } = await admin
    .from("contract_dispatch_jobs")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .in("child_id", childIds)
    .in("status", ["queued", "retryable_failed"])
    .select("*");
  if (error) throw new Error(error.message);
  return (data ?? []) as ContractDispatchJobRow[];
}

/** 배치 워커 — 관리자 "발송 실행" 버튼·일 1회 크론(재시도 백스톱)·이벤트 직후 즉시 호출이
 * 공유한다. 비활성 상태면 아무 것도 처리하지 않고 그 사실만 반환한다(큐는 계속 쌓이게 둔다).
 * opts.childIds가 있으면 그 자녀들의 작업만 집는다. */
export async function processContractDispatchQueue(
  admin: SupabaseClient,
  opts?: { childIds?: string[] }
): Promise<{ enabled: boolean; processed: number; sent: number; failed: number }> {
  if (!(await isContractAutoDispatchEnabled(admin))) {
    return { enabled: false, processed: 0, sent: 0, failed: 0 };
  }

  let jobs: ContractDispatchJobRow[];
  if (opts?.childIds) {
    if (opts.childIds.length === 0) return { enabled: true, processed: 0, sent: 0, failed: 0 };
    jobs = await claimJobsForChildren(admin, opts.childIds);
  } else {
    // 원자적 claim(for update skip locked) — 크론·관리자 버튼이 동시에 돌아도 같은 작업을 두 번 집지 않는다.
    const { data, error } = await admin.rpc("claim_contract_dispatch_jobs", { p_limit: 50 });
    if (error) throw new Error(error.message);
    jobs = (data ?? []) as ContractDispatchJobRow[];
  }

  let sent = 0;
  let failed = 0;
  for (const job of jobs) {
    const result = await dispatchOneContractJob(admin, job);
    if (result.outcome === "sent" || result.outcome === "already_sent") sent += 1;
    else if (result.outcome === "failed" || result.outcome === "skipped_no_guardian") failed += 1;
  }

  return { enabled: true, processed: jobs.length, sent, failed };
}
