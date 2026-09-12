"use server";

import { createClient } from "@/utils/supabase/server";

// R9(레슨 준비 Task 4, corrective 20261250000000) — session_homework_items
// (supabase/migrations/20261235000000_r9_homework_composition.sql)에 대한
// 유일한 쓰기 경로는 이제 DB 함수 compose_homework_from_session()이다.
// 후보 조회부터 삽입까지를 그 함수 하나의 트랜잭션으로 묶어야만
// (1) 이미 이 세션에 발급된 문제를 후보에서 빼는 로직과 (2) 동시 호출 간
// 원자성/직렬화를 둘 다 보장할 수 있다 — 앱 레이어에서 여러 왕복 요청으로
// "조회 후 삽입"을 흉내 내면 그 사이 gap에 다른 요청이 끼어들 수 있다
// (corrective 마이그레이션의 헤더 주석 참고). 이 함수는 그 RPC를 부르는
// 얇은 서버 액션일 뿐이며, 앱 레벨 사전 인가 검사(아래
// requireAssignedTeacherOrAdminForSession)는 오직 더 빠르고 친절한 에러
// 메시지를 위한 것이고 실제 방어선은 여전히 RPC 내부의
// is_active_teacher_for_enrollment()/is_admin() 재검사다.
// problem_keywords_selectable 재조회(Task 2 pin 시점과 별개의, 계획서가
// 요구하는 두 번째 재검증 지점)와 "이미 풀어봄"(legacy + v3 제출 완료) 판정도
// 전부 그 RPC 내부에서 이뤄진다.

type ComposeOptions = {
  includeUsedInLesson: boolean;
  includeAlreadyAttempted: boolean;
};

export type ComposeHomeworkResult = {
  issuedProblemIds: string[];
  requestedCount: number;
  issuedCount: number;
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
): Promise<ComposeHomeworkResult> {
  if (keywordIds.length === 0 || count <= 0) {
    return { issuedProblemIds: [], requestedCount: count, issuedCount: 0 };
  }

  // 앱 레벨 사전 인가(빠른 에러 메시지용) — 실제 방어선은 RPC 내부.
  const { supabase } = await requireAssignedTeacherOrAdminForSession(sessionId);

  const { data, error } = await supabase
    .rpc("compose_homework_from_session", {
      p_session_id: sessionId,
      p_keyword_ids: keywordIds,
      p_count: count,
      p_include_used_in_lesson: options.includeUsedInLesson,
      p_include_already_attempted: options.includeAlreadyAttempted,
    })
    .single();
  if (error) throw new Error(error.message);

  const row = data as { issued_problem_ids: string[] | null; requested_count: number; issued_count: number };
  return {
    issuedProblemIds: row.issued_problem_ids ?? [],
    requestedCount: row.requested_count,
    issuedCount: row.issued_count,
  };
}
