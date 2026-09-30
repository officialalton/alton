"use server";

// 문제 오류 신고 — 관리자 서버 액션. 읽기·판정 모두 관리자 전용 SECURITY DEFINER RPC(is_admin() 검사)이고,
// 요청자(관리자) 세션으로 호출한다. 서비스 클라이언트로 우회하지 않는다.

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import type { ReportType, Verdict } from "@/lib/problem-error-reports/labels";

export type ReportedProblemGroup = {
  problemId: string;
  versionId: string;
  format: string;
  satDomain: string | null;
  skillCode: string | null;
  difficulty: string | null;
  snippet: string;
  reportCount: number;
  openCount: number;
  typeCounts: Record<ReportType, number>;
  sourceCounts: { session_assignment: number; mock_exam: number; homework_batch?: number };
  firstAt: string;
  lastAt: string;
  archived: boolean;
  latestDecision: Verdict | null;
};

export type ReportedProblemDetail = {
  problem: { id: string; format: string; satDomain: string | null; skillCode: string | null; usageScope: string; archived: boolean; archivedReason: string | null; reviewNeeded: boolean };
  version: { id: string; versionNo: number; status: string; passage: string | null; question: string | null; options: string[] | null; correctIndex: number | null; answers: string[] | null; explanation: string | null; difficulty: string | null };
  reports: { id: string; source: string; sessionSource: string | null; reporterRole: string; reporterName: string | null; reportType: ReportType; memo: string | null; createdAt: string; resolved: boolean }[];
  reportTotal: number;
  affected: { mockAttemptsGraded: number; mockAttemptsOpen: number; sessionWorks: number; mockAdjusted: number; sessionAdjusted: number; sessionPending: number; homework?: { items: number; adjusted: number; pending: number } };
  verdicts: { id: string; decision: Verdict; note: string | null; decidedAt: string; decidedByName: string | null }[];
  replacementNeeds: { id: string; status: "open" | "linked"; moduleKey: string | null; route: string | null; difficulty: string | null; satDomain: string | null; skillCode: string | null; usageScope: string; inMockSet: boolean; openReason: string | null; replacementProblemId: string | null }[];
  replacements: { examSetId: string; examSetName: string | null; newProblemId: string; moduleKey: string | null; route: string | null; createdAt: string }[];
};

export type ApplyVerdictResult = {
  alreadyApplied: boolean;
  verdictId: string;
  decision: Verdict;
  resolvedReports: number;
  mockAdjustedAnswers?: number;
  sessionWorksAdjusted?: number;
  homeworkItemsAdjusted?: number;
  replacementNeedsCreated?: number;
  autoReplaced?: number;
  replacementNeedsOpen?: number;
  archived?: boolean;
  restored?: boolean;
  replacementNeedsCancelled?: number;
  replacedSetsKept?: number;
};

export type ReplacementNeedSummary = {
  openTotal: number;
  openInMockSet: number;
  autoReplacedTotal: number;
  cells: { satDomain: string | null; skillCode: string | null; difficulty: string | null; moduleKey: string | null; usageScope: string; inMockSet: boolean; openCount: number }[];
  sets: { examSetId: string; name: string; openCount: number; startedCount: number; noSpareCount: number }[];
  items: { id: string; problemId: string; moduleKey: string | null; route: string | null; difficulty: string | null; satDomain: string | null; skillCode: string | null; usageScope: string; inMockSet: boolean; openReason: string | null; createdAt: string }[];
  replacements: { id: string; examSetId: string; examSetName: string | null; oldProblemId: string; newProblemId: string; moduleKey: string | null; route: string | null; difficulty: string | null; satDomain: string | null; skillCode: string | null; createdAt: string }[];
};

export type ReportFilter = { skill?: string | null; difficulty?: string | null; domain?: string | null; days?: number | null };

export async function listReportedProblemsAction(input: { status?: "open" | "all"; offset?: number; limit?: number } & ReportFilter = {}): Promise<{ total: number; rows: ReportedProblemGroup[] }> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("problem_error_report_groups", {
    p_status: input.status ?? "open",
    p_limit: input.limit ?? 50,
    p_offset: input.offset ?? 0,
    p_skill: input.skill ?? null,
    p_difficulty: input.difficulty ?? null,
    p_domain: input.domain ?? null,
    p_days: input.days ?? null,
  });
  if (error) throw new Error(error.message);
  const d = data as { total: number; rows: ReportedProblemGroup[] };
  return { total: Number(d.total ?? 0), rows: d.rows ?? [] };
}

export async function getReportedProblemDetailAction(problemId: string, versionId: string): Promise<ReportedProblemDetail> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("problem_error_report_detail", { p_problem_id: problemId, p_version_id: versionId });
  if (error) throw new Error(error.message);
  return data as ReportedProblemDetail;
}

export async function applyProblemErrorVerdictAction(input: {
  problemId: string;
  versionId: string;
  decision: Verdict;
  note?: string | null;
}): Promise<{ ok: true; value: ApplyVerdictResult } | { ok: false; error: string }> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("problem_error_apply_verdict", {
    p_problem_id: input.problemId,
    p_version_id: input.versionId,
    p_decision: input.decision,
    p_note: input.note ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true, value: data as ApplyVerdictResult };
}

export async function getReplacementNeedSummaryAction(): Promise<ReplacementNeedSummary> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("problem_replacement_need_summary");
  if (error) throw new Error(error.message);
  return data as ReplacementNeedSummary;
}

export async function retryReplacementAction(): Promise<{ replaced: number; noSpare: number; setStarted: number }> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("problem_replacement_retry_open");
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  return data as { replaced: number; noSpare: number; setStarted: number };
}

export type StatItem = { key: string; reports: number; reportedProblems: number; active: number | null; rate: number | null };
export type ReportStats = {
  days: number | null;
  totals: { reports: number; reportedProblems: number; openReports: number; activeProblems: number; confirmed: number; notError: number };
  axes: Partial<Record<"reportType" | "source" | "verdict" | "difficulty" | "domain" | "skill" | "format" | "batch", StatItem[]>>;
  topCells: { skill: string; difficulty: string; reports: number; reportedProblems: number; active: number | null; rate: number | null }[];
  weekly: { weekStart: string; reports: number }[];
};

/** 오류 신고 통계 — 관리자 전용 집계 RPC 1회(days 생략=전체). */
export async function getReportStatsAction(days: number | null = null): Promise<ReportStats> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("problem_error_report_stats", { p_days: days });
  if (error) throw new Error(error.message);
  return data as ReportStats;
}
