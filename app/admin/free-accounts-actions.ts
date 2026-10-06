"use server";

// 2026-10-06 Free Accounts — 관리자 전용 서버 액션. 전부 requireAdminOrCapability("학생관리") 후 사용자 세션 클라이언트로
// RPC 호출(서비스 롤 우회 없음). DB RPC가 _free_accounts_staff()로 한 번 더 검사한다(이중 방어).
import { requireAdminOrCapability } from "@/lib/admin-auth";
import { factsFromRpcRows, type FactsRpcRow } from "@/lib/free-accounts/facts";
import type {
  AttemptHistoryRow, FreeAccountProfile, FreeAccountRow, FreeAccountsAnalytics, FreeAccountsListParams, FreeAccountsPage, LearningUsage,
} from "@/lib/free-accounts/types";
import { loadMockExamAttemptDetail, type MockExamAttemptDetail } from "@/lib/mock-exam/attempt-data";
import { setStudentStatus, type AccountStatusTarget } from "./users-actions";

const CAP = "학생관리";

type ListRow = {
  student_id: string; name: string | null; email: string | null; joined_at: string; last_active_at: string | null;
  completed_tests: number; in_progress_tests: number; consult_stage: string; consult_flags: string[] | null;
  account_status: string; member_type: string; converted_at: string | null; is_test_account: boolean; total_count: number | string;
};

export async function listFreeAccountsAction(p: FreeAccountsListParams): Promise<FreeAccountsPage> {
  const { supabase } = await requireAdminOrCapability(CAP);
  const { data, error } = await supabase.rpc("admin_free_accounts_list", {
    p_search: p.search?.trim() || null,
    p_joined_from: p.joinedFrom || null, p_joined_to: p.joinedTo || null,
    p_active_from: p.activeFrom || null, p_active_to: p.activeTo || null,
    p_has_attempts: p.hasAttempts ?? null,
    p_consult_stage: p.consultStage || null,
    p_account_status: p.accountStatus || null,
    p_scope: p.scope ?? "free",
    p_include_test: p.includeTest ?? false,
    p_sort: p.sort ?? "joined_at", p_dir: p.dir ?? "desc",
    p_limit: p.limit ?? 25, p_offset: p.offset ?? 0,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as ListRow[];
  return {
    total: rows.length ? Number(rows[0].total_count) : 0,
    rows: rows.map((r): FreeAccountRow => ({
      studentId: r.student_id, name: r.name ?? "", email: r.email ?? "", joinedAt: r.joined_at, lastActiveAt: r.last_active_at,
      completedTests: r.completed_tests, inProgressTests: r.in_progress_tests, consultStage: r.consult_stage, consultFlags: r.consult_flags ?? [],
      accountStatus: r.account_status, memberType: r.member_type, convertedAt: r.converted_at, isTestAccount: r.is_test_account,
    })),
  };
}

/** 프로필 1회 + 열람 감사(record_staff_student_view 'free_profile', 10분 디듀프). */
export async function getFreeAccountProfileAction(studentId: string): Promise<FreeAccountProfile> {
  const { supabase } = await requireAdminOrCapability(CAP);
  const { data, error } = await supabase.rpc("admin_free_account_profile", { p_student_id: studentId });
  if (error) throw new Error(error.message);
  await supabase.rpc("record_staff_student_view", { p_student_id: studentId, p_view_kind: "free_profile" });
  return data as FreeAccountProfile;
}

/** 응시 원자료(정답·문항·경로) — 점수 환산은 클라이언트의 공유 모듈. 학생 상세·Free Accounts 공용. */
export async function getStudentAttemptFactsAction(studentId: string): Promise<AttemptHistoryRow[]> {
  const { supabase } = await requireAdminOrCapability(CAP);
  const { data, error } = await supabase.rpc("admin_student_mock_attempt_facts", { p_student_id: studentId });
  if (error) throw new Error(error.message);
  return factsFromRpcRows((data ?? []) as FactsRpcRow[]);
}

export async function getFreeAccountLearningUsageAction(studentId: string): Promise<LearningUsage> {
  const { supabase } = await requireAdminOrCapability(CAP);
  const { data, error } = await supabase.rpc("admin_free_account_learning_usage", { p_student_id: studentId });
  if (error) throw new Error(error.message);
  return data as LearningUsage;
}

export async function getFreeAccountsAnalyticsAction(from: string, to: string, includeTest: boolean): Promise<FreeAccountsAnalytics> {
  const { supabase } = await requireAdminOrCapability(CAP);
  const { data, error } = await supabase.rpc("admin_free_accounts_analytics", { p_from: from, p_to: to, p_include_test: includeTest });
  if (error) throw new Error(error.message);
  return data as FreeAccountsAnalytics;
}

/** 응시 결과 상세(문항별 답·해설). 기존 결과 화면(MockExamResultView readOnly)이 쓰는 로더 그대로. */
export async function getAttemptDetailForAdminAction(attemptId: string): Promise<MockExamAttemptDetail | null> {
  const { supabase } = await requireAdminOrCapability(CAP);
  return loadMockExamAttemptDetail(supabase, attemptId);
}

/** 정지·재활성·종료 — 기존 transition_account_status(감사 account_status_events). 사유 필수. */
export async function changeFreeAccountStatusAction(studentId: string, status: AccountStatusTarget, reason: string): Promise<void> {
  await requireAdminOrCapability(CAP);
  if (!reason.trim()) throw new Error("A reason is required.");
  await setStudentStatus(studentId, status, reason.trim());
}

export async function setTestAccountAction(studentId: string, flag: boolean, reason: string): Promise<void> {
  const { supabase } = await requireAdminOrCapability(CAP);
  const { error } = await supabase.rpc("admin_set_test_account", { p_student_id: studentId, p_flag: flag, p_reason: reason });
  if (error) throw new Error(error.message);
}
