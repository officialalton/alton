"use server";

import { requireUser } from "@/lib/auth";
import { loadHomeworkBatch, type HomeworkBatchItem } from "./homework-batch-data";

type ActionResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

/** 교사가 학생에게 즉시 과제를 발급한다(수업과 무관 — 단어장 즉석 시험과 같은 구조). 발급마다 새
 * 배치가 생기고, 이름은 발급 날짜로 자동으로 붙는다. */
export async function issueHomeworkBatchAction(
  studentId: string,
  requests: { keywordId: string; count: number }[]
): Promise<ActionResult<{ id: string; problemCount: number }>> {
  const wanted = requests.filter((r) => Number.isFinite(r.count) && r.count > 0);
  if (wanted.length === 0) return { ok: false, error: "키워드별로 낼 개수를 적으세요." };
  const { supabase } = await requireUser();
  const label = `${new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} 과제`;
  const { data, error } = await supabase.rpc("issue_homework_batch_v2", {
    p_student_id: studentId, p_label: label,
    p_requests: wanted.map((r) => ({ keyword_id: r.keywordId, count: Math.floor(r.count) })),
  });
  if (error) return { ok: false, error: error.message.replace(/^[A-Z0-9]{5}:\s*/, "") };
  const batchId = data as string;
  const { data: row } = await supabase.from("homework_batches").select("items").eq("id", batchId).maybeSingle();
  const problemCount = Array.isArray(row?.items) ? row.items.length : 0;
  return { ok: true, value: { id: batchId, problemCount } };
}

function normalizeSprAnswer(text: string): string {
  return text.trim().replace(/\s+/g, "");
}
function sprMatches(response: string, answers: string[]): boolean {
  const r = normalizeSprAnswer(response);
  if (!r) return false;
  return answers.some((a) => {
    const na = normalizeSprAnswer(a);
    if (na === r) return true;
    const rn = Number(r);
    const an = Number(na);
    return Number.isFinite(rn) && Number.isFinite(an) && Math.abs(rn - an) < 1e-9;
  });
}

/** 학생이 문항 하나에 답한다 — mc/spr 은 즉시 서버가 정오를 계산해 두지만(autoCorrect),
 * 교사가 "채점 완료"를 눌러야 학생에게 정답 여부·해설이 열린다(채점 전 재답변 가능). */
export async function submitHomeworkAnswerAction(batchId: string, problemId: string, response: string): Promise<ActionResult> {
  const { user, supabase } = await requireUser();
  const batch = await loadHomeworkBatch(supabase, batchId);
  if (!batch) return { ok: false, error: "과제를 찾을 수 없습니다." };
  if (batch.studentId !== user.id) return { ok: false, error: "본인 과제만 답할 수 있습니다." };
  const item = batch.items.find((i) => i.problemId === problemId);
  if (!item) return { ok: false, error: "문항을 찾을 수 없습니다." };
  if (item.graded) return { ok: false, error: "이미 채점된 과제는 답을 바꿀 수 없습니다." };

  let autoCorrect: boolean | null = null;
  if (item.format === "mc" && item.correctIndex !== null) autoCorrect = response === String(item.correctIndex);
  else if (item.format === "spr" && item.answers) autoCorrect = sprMatches(response, item.answers);

  const nextItems = batch.items.map((i) => (i.problemId === problemId ? { ...i, response, submittedAt: new Date().toISOString(), autoCorrect } : i));
  const { error } = await supabase.from("homework_batches").update({ items: nextItems }).eq("id", batchId);
  if (error) return { ok: false, error: "답을 저장하지 못했습니다." };
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
