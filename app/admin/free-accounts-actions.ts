"use server";

// 2026-10-06 Free Accounts — 관리자 전용 서버 액션. 전부 requireAdminOrCapability("학생관리") 후 사용자 세션 클라이언트로
// RPC 호출(서비스 롤 우회 없음). DB RPC가 _free_accounts_staff()로 한 번 더 검사한다(이중 방어).
import { requireAdminOrCapability } from "@/lib/admin-auth";
import { factsFromRpcRows, type FactsRpcRow } from "@/lib/free-accounts/facts";
import type {
  AttemptHistoryRow, FreeAccountProfile, FreeAccountRow, FreeAccountsAnalytics, FreeAccountsListParams, FreeAccountsPage, LearningUsage,
} from "@/lib/free-accounts/types";
import { loadMockExamAttemptDetail, type MockExamAttemptDetail } from "@/lib/mock-exam/attempt-data";
import { loadEssayScores, type EssayScoreView } from "@/lib/essay-grading/view";
import { essayGradingSubject } from "@/lib/essay-grading/subject";
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

export type AdminApAttemptView = {
  detail: MockExamAttemptDetail; essayScores: EssayScoreView[]; essayAi: boolean; isTestAccount: boolean | null;
  /** 채점에 쓰인 구성(점수 행에서 읽은 값). 행이 없으면 빈 배열 → 화면은 "No scoring version recorded" 로 표시한다. */
  versions: { rubricVersion: string; model: string | null; rows: number }[];
  /** 모델 채점이 아닌 행(건너뜀·대기·실패)을 사유별로 묶은 것. 채점 구성(versions)에 세지 않는다. */
  unscored?: { label: string; rows: number }[];
};

const SKIP_LABEL: Record<string, string> = {
  empty: "submitted blank response → 0 points (no model call)",
  too_short: "response too short → not scored (no model call)",
  too_long: "response too long → not scored (no model call)",
  daily_cap: "daily scoring limit reached → not scored",
  monthly_budget: "monthly scoring budget reached → not scored",
  no_reference_answers: "scoring unavailable (no reference answers)",
  bad_rubric: "scoring unavailable (unknown rubric)",
};
/** 점수 행 하나가 모델 채점인지, 아니라면 어떤 사유로 표시할지. done(또는 status 미기재 레거시 행)만 채점 구성에 센다. */
export function unscoredLabel(status: string | undefined, lastError: string | null | undefined): string | null {
  if (!status || status === "done") return null;
  if (status === "skipped") return SKIP_LABEL[lastError ?? ""] ?? `skipped (${lastError ?? "no reason recorded"}) → not scored (no model call)`;
  if (status === "pending" || status === "processing") return "waiting to be scored";
  if (status === "failed" && (lastError === "daily_cap" || lastError === "monthly_budget")) return "waiting for scoring limit reset";
  if (status === "failed") return "scoring failed, will retry";
  if (status === "dead") return "scoring failed (no more retries)";
  return `${status} → not scored`;
}

/** AP 응시 상세(관리자, 읽기 전용): 학생·학부모 화면과 같은 계산(result-score)에 쓸 입력 + 테스트 계정 여부 + 적용된 채점 구성. 쓰기 없음. */
export async function getApAttemptViewForAdminAction(attemptId: string): Promise<AdminApAttemptView | null> {
  const { supabase } = await requireAdminOrCapability(CAP);
  const detail = await loadMockExamAttemptDetail(supabase, attemptId);
  if (!detail || detail.examProgram !== "ap") return null;
  const [essayScores, student, versionRows] = await Promise.all([
    loadEssayScores(supabase, attemptId),
    supabase.from("students").select("is_test_account").eq("id", detail.studentId).maybeSingle(),
    supabase.from("mock_exam_essay_scores").select("rubric_version, model, status, last_error").eq("attempt_id", attemptId),
  ]);
  const unscored = new Map<string, number>();
  const byKey = new Map<string, { rubricVersion: string; model: string | null; rows: number }>();
  for (const r of ((versionRows as { data: { rubric_version: string; model: string | null; status?: string; last_error?: string | null }[] | null }).data ?? [])) {
    const u = unscoredLabel(r.status, r.last_error);
    if (u) { unscored.set(u, (unscored.get(u) ?? 0) + 1); continue; }
    const k = `${r.rubric_version}|${r.model ?? ""}`;
    const e = byKey.get(k) ?? { rubricVersion: r.rubric_version, model: r.model ?? null, rows: 0 };
    e.rows += 1; byKey.set(k, e);
  }
  const flag = (student as { data: { is_test_account: boolean } | null }).data?.is_test_account;
  return { detail, essayScores, essayAi: essayGradingSubject(detail.apSubject) || essayScores.length > 0, isTestAccount: typeof flag === "boolean" ? flag : null, versions: [...byKey.values()], unscored: [...unscored].map(([label, rows]) => ({ label, rows })) };
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
