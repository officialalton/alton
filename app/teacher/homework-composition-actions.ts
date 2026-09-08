"use server";

import { createClient } from "@/utils/supabase/server";

// R9(레슨 준비 Task 4) — session_homework_items(supabase/migrations/
// 20261235000000_r9_homework_composition.sql)에 대한 유일한 쓰기 경로.
// 후보 풀은 problem_keywords_selectable을 이 함수가 호출되는 "이 순간" 다시
// 조회한다 — Task 2의 pin 시점 재검증과는 별개의, 계획서가 요구하는 두 번째
// 재검증 지점이다. 태깅 시점(또는 이전 used-in-lesson 처리 시점)엔 confirmed
// 였지만 호출 시점에 unconfirmed가 된 문제는 조용히 후보에서 빠진다. 실제
// 방어선은 problems.status='confirmed'를 강제하는 DB 트리거
// (check_homework_item_problem_confirmed)다 — 이 함수의 필터링은 그 위에 얹는
// 앱 레벨 편의일 뿐이다.

type ComposeOptions = {
  includeUsedInLesson: boolean;
  includeAlreadyAttempted: boolean;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// app/teacher/student-curriculum-actions.ts의 requireAssignedTeacherOrAdmin과
// 정확히 같은 판정(관리자면 통과, 아니면 teacher_assignments에 active/planned로
// 배정돼 있는지)을 재사용한다. 그 함수는 subjectEnrollmentId를 직접 받고 이
// 함수는 sessionId만 받으므로, session → subject_enrollment_id를 먼저 찾은 뒤
// 동일한 검사를 적용한다 — 그 함수가 export되어 있지 않아 그대로 import할 수는
// 없지만 새 인가 프리미티브를 발명하지 않았다: 같은 predicate, 같은 메시지
// 스타일, 그리고 실제 방어선은 여전히 RLS(is_session_teacher_v3/is_admin, 이
// 파일의 마이그레이션 참고)다.
async function requireAssignedTeacherOrAdminForSession(sessionId: string): Promise<{
  supabase: SupabaseServerClient;
  userId: string;
  subjectEnrollmentId: string;
  studentId: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, subject_enrollment_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError) throw new Error(sessionError.message);
  if (!session) throw new Error("세션을 찾을 수 없습니다.");

  const { data: enrollment, error: enrollmentError } = await supabase
    .from("subject_enrollments")
    .select("id, child_id")
    .eq("id", session.subject_enrollment_id as string)
    .maybeSingle();
  if (enrollmentError) throw new Error(enrollmentError.message);
  if (!enrollment) throw new Error("수강 정보를 찾을 수 없습니다.");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (profile?.role !== "admin") {
    if (profile?.role !== "teacher") throw new Error("선생님만 사용할 수 있습니다.");
    // 앱 레벨 선인가 — 실제 방어선은 RLS(is_session_teacher_v3)다.
    const { data: assignment } = await supabase
      .from("teacher_assignments")
      .select("id")
      .eq("subject_enrollment_id", session.subject_enrollment_id as string)
      .eq("teacher_id", user.id)
      .in("status", ["planned", "active"])
      .maybeSingle();
    if (!assignment) throw new Error("담당 학생의 세션에만 과제를 구성할 수 있습니다.");
  }

  return {
    supabase,
    userId: user.id,
    subjectEnrollmentId: session.subject_enrollment_id as string,
    studentId: enrollment.child_id as string,
  };
}

export async function composeHomeworkFromSession(
  sessionId: string,
  keywordIds: string[],
  count: number,
  options: ComposeOptions
): Promise<string[]> {
  if (keywordIds.length === 0 || count <= 0) return [];

  const { supabase, userId, studentId } = await requireAssignedTeacherOrAdminForSession(sessionId);

  // 1) 후보 풀: 주어진 키워드로 태깅되어 있으면서 이 순간
  //    problem_keywords_selectable(=confirmed)을 통과하는 문제.
  const { data: selectableRows, error: selectableError } = await supabase
    .from("problem_keywords_selectable")
    .select("problem_id")
    .in("keyword_id", keywordIds);
  if (selectableError) throw new Error(selectableError.message);

  const candidateIds = Array.from(new Set((selectableRows ?? []).map((r) => r.problem_id as string)));
  if (candidateIds.length === 0) return [];

  // 2) 두 토글은 서로 독립적으로 적용한다 — 켬/끔 4가지 조합 모두 명시적으로
  //    다른 후보 풀을 만든다.
  const { data: usedRows, error: usedError } = await supabase
    .from("session_content_use_events")
    .select("content_id")
    .eq("session_id", sessionId)
    .eq("content_type", "problem")
    .in("content_id", candidateIds);
  if (usedError) throw new Error(usedError.message);
  const usedIds = new Set((usedRows ?? []).map((r) => r.content_id as string));

  const { data: attemptedRows, error: attemptedError } = await supabase
    .from("session_problem_attempts")
    .select("problem_id")
    .eq("student_id", studentId)
    .in("problem_id", candidateIds);
  if (attemptedError) throw new Error(attemptedError.message);
  const attemptedIds = new Set((attemptedRows ?? []).map((r) => r.problem_id as string));

  const pool = candidateIds.filter((id) => {
    if (!options.includeUsedInLesson && usedIds.has(id)) return false;
    if (!options.includeAlreadyAttempted && attemptedIds.has(id)) return false;
    return true;
  });
  if (pool.length === 0) return [];

  const selected = pool.slice(0, count);

  // 3) 이미 이 세션에 발급된 문제(session_id, problem_id 유니크)와 겹치지 않게
  //    이번에 새로 매기는 position은 기존 최대값 다음부터 시작한다.
  const { data: existingRows, error: existingError } = await supabase
    .from("session_homework_items")
    .select("position")
    .eq("session_id", sessionId)
    .order("position", { ascending: false })
    .limit(1);
  if (existingError) throw new Error(existingError.message);
  const startPosition = existingRows && existingRows.length > 0 ? (existingRows[0].position as number) + 1 : 1;

  const rows = selected.map((problemId, index) => ({
    session_id: sessionId,
    problem_id: problemId,
    student_id: studentId,
    position: startPosition + index,
    was_used_in_lesson: usedIds.has(problemId),
    was_already_attempted: attemptedIds.has(problemId),
    composed_by: userId,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("session_homework_items")
    .insert(rows)
    .select("problem_id");
  if (insertError) throw new Error(insertError.message);

  return (inserted ?? []).map((r) => r.problem_id as string);
}
