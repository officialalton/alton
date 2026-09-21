"use server";

import { requireUser } from "@/lib/auth";
import { loadHomeworkBatch, type HomeworkBatchItem } from "./homework-batch-data";

type ActionResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

/** 교사가 학생에게 즉시 과제를 발급한다(수업과 무관 — 단어장 즉석 시험과 같은 구조). 발급마다 새
 * 배치가 생기고, 이름은 "발급 날짜 과목 선생님명"으로 자동으로 붙는다(2026-09-16 제품 오너 지시).
 * 과목은 고른 키워드들이 속한 과목에서 가져온다 — 키워드가 여러 과목에 걸쳐 있으면 첫 키워드의
 * 과목을 대표로 쓴다(교사가 한 번에 한 과목 위주로 키워드를 고르는 게 일반적인 사용 형태). */
export async function issueHomeworkBatchAction(
  studentId: string,
  requests: { keywordId: string; count: number }[]
): Promise<ActionResult<{ id: string; problemCount: number }>> {
  const wanted = requests.filter((r) => Number.isFinite(r.count) && r.count > 0);
  if (wanted.length === 0) return { ok: false, error: "키워드별로 낼 개수를 적으세요." };
  const { user, supabase } = await requireUser();

  const [{ data: teacherProfile }, { data: keywordRow }] = await Promise.all([
    supabase.from("profiles").select("name").eq("id", user.id).maybeSingle(),
    supabase.from("subject_keywords").select("subject_id, subjects(name)").eq("id", wanted[0].keywordId).maybeSingle(),
  ]);
  const subjectId = (keywordRow?.subject_id as string | undefined) ?? null;
  const subjectsField = keywordRow?.subjects as unknown as { name: string } | { name: string }[] | null | undefined;
  const subjectName = (Array.isArray(subjectsField) ? subjectsField[0]?.name : subjectsField?.name) ?? null;
  const dateLabel = new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
  const label = [dateLabel, subjectName, teacherProfile?.name].filter(Boolean).join(" ") || `${dateLabel} 과제`;

  const { data, error } = await supabase.rpc("issue_homework_batch_v2", {
    p_student_id: studentId, p_label: label,
    p_requests: wanted.map((r) => ({ keyword_id: r.keywordId, count: Math.floor(r.count) })),
  });
  if (error) return { ok: false, error: error.message.replace(/^[A-Z0-9]{5}:\s*/, "") };
  const batchId = data as string;
  if (subjectId) await supabase.from("homework_batches").update({ subject_id: subjectId }).eq("id", batchId);
  const { data: row } = await supabase.from("homework_batches").select("items").eq("id", batchId).maybeSingle();
  const problemCount = Array.isArray(row?.items) ? row.items.length : 0;
  return { ok: true, value: { id: batchId, problemCount } };
}

/** 학생이 문항 하나에 답한다 — mc/spr 은 즉시 서버가 정오를 계산해 두지만(autoCorrect),
 * 교사가 "채점 완료"를 눌러야 학생에게 정답 여부·해설이 열린다(채점 전 재답변 가능).
 * 2026-09-21(P0 보안 차단) — 학생은 homework_batches 를 직접 UPDATE 할 수 없다(예전엔 행 전체
 * UPDATE 가 열려 있어 graded/grade 를 REST API 로 직접 바꿀 수 있었다). SECURITY DEFINER RPC 가
 * 본인·미채점 검사를 하고 response/submittedAt/autoCorrect 세 키만 갱신한다(정오 계산도 DB 안에서). */
export async function submitHomeworkAnswerAction(batchId: string, problemId: string, response: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("homework_submit_answer", { p_batch_id: batchId, p_problem_id: problemId, p_response: response });
  if (error) return { ok: false, error: error.message.replace(/^[A-Z0-9]{5}:\s*/, "") || "답을 저장하지 못했습니다." };
  return { ok: true, value: undefined };
}

/** 교사가 배치 전체를 채점 완료 처리한다 — mc/spr 은 자동 계산된 정오를 그대로 확정하고,
 * essay/math 등 수동 채점이 필요한 항목은 overrides 로 정오·코멘트를 받는다. */
export async function gradeHomeworkBatchAction(
  batchId: string,
  overrides: { problemId: string; grade: "correct" | "incorrect"; comment?: string }[]
): Promise<ActionResult> {
  const { user, supabase } = await requireUser();
  const batch = await loadHomeworkBatch(supabase, batchId);
  if (!batch) return { ok: false, error: "과제를 찾을 수 없습니다." };
  if (batch.teacherId !== user.id) return { ok: false, error: "발급한 교사만 채점할 수 있습니다." };
  const overrideByProblem = new Map(overrides.map((o) => [o.problemId, o]));
  const now = new Date().toISOString();
  const nextItems: HomeworkBatchItem[] = batch.items.map((i) => {
    const override = overrideByProblem.get(i.problemId);
    const grade = override ? override.grade : i.autoCorrect === null ? null : i.autoCorrect ? "correct" : "incorrect";
    return { ...i, graded: true, gradedAt: now, grade, gradeComment: override?.comment ?? i.gradeComment };
  });
  const { error } = await supabase.from("homework_batches").update({ items: nextItems }).eq("id", batchId);
  if (error) return { ok: false, error: "채점을 저장하지 못했습니다." };
  return { ok: true, value: undefined };
}
