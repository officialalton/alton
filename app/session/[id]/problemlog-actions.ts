"use server";

import { createClient } from "@/utils/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");
  return { supabase, userId: user.id };
}

export async function toggleSaveAttempt(attemptId: string, saved: boolean) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("session_problem_attempts")
    .update({ saved })
    .eq("id", attemptId);
  if (error) throw new Error(error.message);
}

async function countRetryAttempts(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  problemId: string
) {
  const { data } = await supabase
    .from("session_problem_attempts")
    .select("correct")
    .is("session_id", null)
    .eq("student_id", userId)
    .eq("problem_id", problemId);
  return data ?? [];
}

export async function retryMcAttempt(
  problemId: string,
  selectedIndex: number
) {
  const { supabase, userId } = await requireUser();

  const { data: problem } = await supabase
    .from("problems")
    .select("correct_index, explanation")
    .eq("id", problemId)
    .single();
  if (!problem) throw new Error("문제를 찾을 수 없습니다.");

  const prior = await countRetryAttempts(supabase, userId, problemId);
  const wrongSoFar = prior.filter((a) => a.correct === false).length;
  const alreadyCorrect = prior.some((a) => a.correct === true);
  if (alreadyCorrect || wrongSoFar >= 3) {
    throw new Error("이미 채점이 끝난 문제입니다.");
  }

  const correct = problem.correct_index === selectedIndex;
  const attemptNumber = wrongSoFar + 1;
  const done = correct || attemptNumber >= 3;

  const { error } = await supabase.from("session_problem_attempts").insert({
    session_id: null,
    student_id: userId,
    problem_id: problemId,
    response: selectedIndex,
    correct,
  });
  if (error) throw new Error(error.message);

  return {
    correct,
    attemptNumber,
    done,
    correctIndex: done ? problem.correct_index : null,
    explanation: done ? problem.explanation : null,
  };
}

async function retryOnceGraded(
  problemId: string,
  response: string,
  expectedFormat: "essay" | "math"
) {
  const { supabase, userId } = await requireUser();

  const { data: problem } = await supabase
    .from("problems")
    .select("explanation, format")
    .eq("id", problemId)
    .single();
  if (!problem) throw new Error("문제를 찾을 수 없습니다.");

  const { error } = await supabase.from("session_problem_attempts").insert({
    session_id: null,
    student_id: userId,
    problem_id: problemId,
    response,
    correct: null,
  });
  if (error) throw new Error(error.message);

  return {
    explanation:
      problem.format === expectedFormat ? (problem.explanation as string) : null,
  };
}

export async function retryEssayAttempt(problemId: string, text: string) {
  if (!text.trim()) throw new Error("답안을 입력해주세요.");
  return retryOnceGraded(problemId, text.trim(), "essay");
}

export async function retryMathAttempt(problemId: string, dataUrl: string) {
  return retryOnceGraded(problemId, dataUrl, "math");
}

export async function saveTeacherPick(
  attemptId: string,
  reasons: string[],
  reasonText: string | null
) {
  if (reasons.length === 0) throw new Error("사유를 하나 이상 선택해주세요.");
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("teacher_problem_tags").upsert(
    {
      attempt_id: attemptId,
      teacher_id: userId,
      reason: reasons,
      reason_text: reasonText,
      tagged_at: new Date().toISOString(),
    },
    { onConflict: "attempt_id" }
  );
  if (error) throw new Error(error.message);
}

export async function removeTeacherPick(attemptId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("teacher_problem_tags")
    .delete()
    .eq("attempt_id", attemptId);
  if (error) throw new Error(error.message);
}
