"use server";

// 문제 오류 신고 — 학생·선생님 서버 액션. 쓰기는 전부 SECURITY DEFINER RPC(problem_error_report_submit) 한 곳이고,
// 권한(학생=본인 수업·응시, 선생님=담당 수업·학생)·중복·유형 규칙은 DB 가 강제한다. 여기서는 요청자 세션으로만 호출한다.

import { requireStudentFeature } from "@/lib/feature-access";
import { MEMO_MAX, type MyReportStatus, type ReportContext, type ReportType } from "./labels";

type Result<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

function toErr(e: unknown, fallback: string): string {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  return msg.replace(/^[A-Z0-9]{5}:\s*/, "") || fallback;
}

export async function submitProblemErrorReportAction(input: {
  context: ReportContext;
  reportType: ReportType;
  memo?: string | null;
}): Promise<Result<{ duplicate: boolean }>> {
  const memo = (input.memo ?? "").trim();
  if (memo.length > MEMO_MAX) return { ok: false, error: `Please keep your note within ${MEMO_MAX} characters.` };
  if (input.reportType === "other" && !memo) return { ok: false, error: "Please describe the issue when choosing Other." };
  const { supabase } = await requireStudentFeature("problem_report");
  const c = input.context;
  const { data, error } = await supabase.rpc("problem_error_report_submit", {
    p_source: c.source,
    p_report_type: input.reportType,
    p_memo: memo || null,
    p_session_id: c.source === "session_assignment" ? c.sessionId : null,
    p_session_source: c.source === "session_assignment" ? c.sessionSource : null,
    p_problem_id: c.source === "session_assignment" || c.source === "homework_batch" ? c.problemId : null,
    p_homework_batch_id: c.source === "homework_batch" ? c.batchId : null,
    p_attempt_id: c.source === "mock_exam" ? c.attemptId : null,
    p_set_item_id: c.source === "mock_exam" ? c.setItemId : null,
  });
  if (error) return { ok: false, error: toErr(error, "We couldn't save your report.") };
  return { ok: true, value: { duplicate: Boolean((data as { duplicate?: boolean } | null)?.duplicate) } };
}

/** 내가 신고한 문항의 진행 상태(한 번의 호출로 여러 문항). */
export async function loadMyProblemErrorReportsAction(problemIds: string[]): Promise<Result<Record<string, MyReportStatus>>> {
  const ids = [...new Set(problemIds)].filter(Boolean).slice(0, 500);
  if (ids.length === 0) return { ok: true, value: {} };
  const { supabase } = await requireStudentFeature("problem_report");
  const { data, error } = await supabase.rpc("problem_error_report_mine", { p_problem_ids: ids });
  if (error) return { ok: false, error: toErr(error, "We couldn't load your report status.") };
  const out: Record<string, MyReportStatus> = {};
  // 같은 문항에 버전별 신고가 여럿이면 최신(목록이 최신순) 것을 쓴다.
  for (const r of (data ?? []) as { problemId: string; status: MyReportStatus }[]) if (!(r.problemId in out)) out[r.problemId] = r.status;
  return { ok: true, value: out };
}
