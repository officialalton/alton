"use server";

import { requireUser as requireAuthenticatedUser } from "@/lib/auth";
import { loadLegacyProblemAnswers } from "@/lib/legacy-problem-answers";

// (2026-08-30 R2 정정) 이 로컬 requireUser()는 이름만 같을 뿐 @/lib/auth의
// 실제 requireUser()와 무관하게 auth.getUser()만 확인해왔다 — 계정 상태
// 게이트(R2 §5.7)를 거치지 않는 구멍이었다. 이제 실제 requireUser()에
// 위임하고, 이 파일 전체가 쓰는 {supabase, userId} 인터페이스만 유지한다.
async function requireUser() {
  const { supabase, user } = await requireAuthenticatedUser();
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

  // RLS 로 볼 수 있는 문제인지 확인 뒤 정답·해설은 서버 admin 으로(컬럼 권한 회수, 20261904000000).
  const { data: visible } = await supabase.from("problems").select("id").eq("id", problemId).single();
  if (!visible) throw new Error("문제를 찾을 수 없습니다.");
  const problem = (await loadLegacyProblemAnswers([problemId])).get(problemId);
  if (!problem) throw new Error("문제를 찾을 수 없습니다.");

  const prior = await countRetryAttempts(supabase, userId, problemId);
  const wrongSoFar = prior.filter((a) => a.correct === false).length;
  const alreadyCorrect = prior.some((a) => a.correct === true);
  if (alreadyCorrect || wrongSoFar >= 3) {
    throw new Error("이미 채점이 끝난 문제입니다.");
  }

  const correct = problem.correctIndex === selectedIndex;
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
    correctIndex: done ? problem.correctIndex : null,
    explanation: done ? problem.explanation : null,
  };
}

async function retryOnceGraded(
  problemId: string,
  response: string,
  expectedFormat: "essay" | "math"
) {
  const { supabase, userId } = await requireUser();

  const { data: visible } = await supabase.from("problems").select("id, format").eq("id", problemId).single();
  if (!visible) throw new Error("문제를 찾을 수 없습니다.");
  const answer = (await loadLegacyProblemAnswers([problemId])).get(problemId);

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
      visible.format === expectedFormat ? (answer?.explanation ?? "") : null,
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
