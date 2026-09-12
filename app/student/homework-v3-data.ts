import type { SupabaseClient } from "@supabase/supabase-js";

// R9 corrective — v3 과제(session_homework_items, 20261235000000/20261240000000)
// 학생 조회 리더. 기존 app/student/homework-data.ts(legacy homework_items,
// legacy_sessions 경유)와는 완전히 별개의 테이블/경로다 — 절대 합치지 않는다
// (계획서가 명시적으로 구분하라고 요구).
//
// session-content-data.ts(Task 2)와 동일한 "표시 시점 재검증" 정신: 과제로
// 배정된 시점엔 confirmed였던 문제가 이후 unconfirmed가 됐을 수 있으므로,
// 여기서 problems.status를 다시 읽어 confirmed가 아니면 콘텐츠를 숨긴다(항목
// 행 자체, 즉 "배정됐다"는 사실은 계속 보여준다 — 숨김은 콘텐츠에만 적용).

export type StudentHomeworkV3Item = {
  id: string;
  sessionId: string;
  problemId: string;
  position: number;
  composedAt: string;
  contentVisible: boolean;
  problem: {
    passage: string | null;
    options: unknown;
    format: string;
  } | null;
  attempt: {
    id: string;
    response: unknown;
    submitted: boolean;
  } | null;
};

export async function loadStudentHomeworkV3(
  supabase: SupabaseClient,
  studentId: string
): Promise<StudentHomeworkV3Item[]> {
  const { data: items, error } = await supabase
    .from("session_homework_items")
    .select("id, session_id, problem_id, position, composed_at")
    .eq("student_id", studentId)
    .order("composed_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (!items || items.length === 0) return [];

  const problemIds = items.map((i) => i.problem_id as string);
  const { data: problems, error: problemsError } = await supabase
    .from("problems")
    .select("id, status, format, passage, options")
    .in("id", problemIds);
  if (problemsError) throw new Error(problemsError.message);
  const problemById = new Map((problems ?? []).map((p) => [p.id as string, p]));

  const itemIds = items.map((i) => i.id as string);
  const { data: attempts, error: attemptsError } = await supabase
    .from("session_homework_attempts")
    .select("id, homework_item_id, response, submitted")
    .in("homework_item_id", itemIds)
    .eq("student_id", studentId);
  if (attemptsError) throw new Error(attemptsError.message);
  const attemptByItemId = new Map(
    (attempts ?? []).map((a) => [a.homework_item_id as string, a])
  );

  return items.map((item) => {
    const problem = problemById.get(item.problem_id as string);
    // 표시 시점 재검증: 발급 당시 confirmed였어도 지금 아니면 콘텐츠를 숨긴다.
    const contentVisible = !!problem && problem.status === "confirmed";
    const attempt = attemptByItemId.get(item.id as string);
    return {
      id: item.id as string,
      sessionId: item.session_id as string,
      problemId: item.problem_id as string,
      position: item.position as number,
      composedAt: item.composed_at as string,
      contentVisible,
      problem: contentVisible
        ? {
            passage: (problem!.passage as string | null) ?? null,
            options: problem!.options ?? null,
            format: problem!.format as string,
          }
        : null,
      attempt: attempt
        ? {
            id: attempt.id as string,
            response: attempt.response ?? null,
            submitted: attempt.submitted as boolean,
          }
        : null,
    };
  });
}
