"use server";

import { createClient } from "@/utils/supabase/server";

async function requireStudent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");
  return { supabase, userId: user.id };
}

/**
 * 객관식 채점 — 목업의 gradeMC()와 동일한 규칙: 최대 3번 시도, 정답이거나
 * 3번을 다 쓰면 종료. 시도할 때마다(오답이든 최종 정답이든) 한 행씩 기록한다.
 */
export async function submitMcAttempt(
  sessionId: string,
  problemId: string,
  selectedIndex: number
) {
  const { supabase, userId } = await requireStudent();

  const { data: problem } = await supabase
    .from("problems")
    .select("correct_index")
    .eq("id", problemId)
    .single();
  if (!problem) throw new Error("문제를 찾을 수 없습니다.");

  const { data: priorAttempts } = await supabase
    .from("session_problem_attempts")
    .select("correct")
    .eq("session_id", sessionId)
    .eq("student_id", userId)
    .eq("problem_id", problemId);

  const wrongSoFar = (priorAttempts ?? []).filter(
    (a) => a.correct === false
  ).length;
  const alreadyCorrect = (priorAttempts ?? []).some((a) => a.correct === true);
  if (alreadyCorrect || wrongSoFar >= 3) {
    throw new Error("이미 채점이 끝난 문제입니다.");
  }

  const correct = problem.correct_index === selectedIndex;
  const attemptNumber = wrongSoFar + 1;
  const done = correct || attemptNumber >= 3;

  const { error } = await supabase.from("session_problem_attempts").insert({
    session_id: sessionId,
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
  };
}

async function submitOnceGraded(
  sessionId: string,
  problemId: string,
  response: string
) {
  const { supabase, userId } = await requireStudent();

  const { data: priorAttempts } = await supabase
    .from("session_problem_attempts")
    .select("id")
    .eq("session_id", sessionId)
    .eq("student_id", userId)
    .eq("problem_id", problemId)
    .limit(1);

  if (priorAttempts && priorAttempts.length > 0) {
    throw new Error("이미 제출한 문제입니다.");
  }

  const { error } = await supabase.from("session_problem_attempts").insert({
    session_id: sessionId,
    student_id: userId,
    problem_id: problemId,
    response,
    correct: null,
  });
  if (error) throw new Error(error.message);
}

export async function submitEssayAttempt(
  sessionId: string,
  problemId: string,
  text: string
) {
  if (!text.trim()) throw new Error("답안을 입력해주세요.");
  await submitOnceGraded(sessionId, problemId, text.trim());
}

export async function submitMathAttempt(
  sessionId: string,
  problemId: string,
  dataUrl: string
) {
  await submitOnceGraded(sessionId, problemId, dataUrl);
}
