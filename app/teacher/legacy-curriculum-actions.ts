"use server";

// 2026-09-11(제품 오너 UAT — 첫 진입 지연 재지적) — 학생별 커리큘럼 첫
// 진입이 여전히 느렸던 진짜 이유: 지난 라운드는 "학생 수만큼 개별 쿼리"를
// "고정 쿼리 수"로 바꿨을 뿐, 그 고정 쿼리 자체가 여전히 담당 학생 "전체"의
// 단원별 상세(제목·메모·코멘트·세션 일정 전부)를 매번 읽어들이는 구조였다.
// 실제로 화면에 필요한 건 그 순간 연 학생 1명·과목 1건의 상세뿐이다 —
// "학생별" 목록(요약: 이름·과목·회차 카운트)과 "상세 커리큘럼"(단원별
// 전체 내용)을 분리해, 목록은 요약만(roster-data.ts, 이미 그렇게 동작),
// 상세는 그 enrollment를 실제로 열 때만 이 액션으로 조회한다.

import { createClient } from "@/utils/supabase/server";
import { loadCurricula } from "@/app/student/curriculum-data";
import { loadMemos, type Memo } from "@/app/student/memo-data";
import { loadReviews, loadStudentFeedbackForStudents, type ReviewData, type StudentFeedback } from "@/app/student/review-data";
import type { TeacherCurriculumData } from "./curriculum-data";

async function requireOwnsLegacyEnrollment(enrollmentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const [{ data: profile }, { data: enrollment }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase
      .from("enrollments")
      .select("id, student_id, teacher_id")
      .eq("id", enrollmentId)
      .maybeSingle(),
  ]);
  if (!enrollment) throw new Error("존재하지 않는 수강입니다.");
  if (profile?.role === "admin") return { supabase, user, enrollment };
  if (profile?.role !== "teacher") throw new Error("선생님만 사용할 수 있습니다.");
  if (enrollment.teacher_id !== user.id) throw new Error("담당 학생의 커리큘럼만 조회할 수 있습니다.");
  return { supabase, user, enrollment };
}

// "학생별" 탭에서 레거시 과목 하나를 열 때만 호출된다. loadCurricula()는
// 그 학생의 레거시 enrollment 전체(보통 과목 1~2개)를 배치 조회하므로
// (기존 N+1 방지 구현 그대로 재사용), 여기서 새 쿼리 패턴을 만들지 않는다
// — 다만 "담당 학생 전체"가 아니라 "이 enrollment의 학생 한 명"으로
// 범위가 줄어든다.
export async function loadLegacyCurriculumDetail(
  enrollmentId: string
): Promise<{ curriculum: TeacherCurriculumData; memos: Memo[] } | null> {
  const { supabase, enrollment } = await requireOwnsLegacyEnrollment(enrollmentId);

  const [{ data: studentProfile }, allForStudent, memos] = await Promise.all([
    supabase.from("profiles").select("name").eq("id", enrollment.student_id).maybeSingle(),
    loadCurricula(supabase, enrollment.student_id),
    loadMemos(supabase, enrollmentId),
  ]);

  const match = allForStudent.find((c) => c.enrollmentId === enrollmentId);
  if (!match) return null;

  return {
    curriculum: { ...match, studentId: enrollment.student_id, studentName: studentProfile?.name ?? "" },
    memos,
  };
}

async function requireOwnsLegacySession(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const { data: session } = await supabase
    .from("legacy_sessions")
    .select("id, enrollment_id, enrollment:enrollments(student_id, teacher_id)")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) throw new Error("존재하지 않는 세션입니다.");
  const enrollment = Array.isArray(session.enrollment) ? session.enrollment[0] : session.enrollment;
  if (!enrollment) throw new Error("존재하지 않는 수강입니다.");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    if (profile?.role !== "teacher") throw new Error("선생님만 사용할 수 있습니다.");
    if (enrollment.teacher_id !== user.id) throw new Error("담당 학생의 리뷰만 조회할 수 있습니다.");
  }
  return { supabase, studentId: enrollment.student_id as string };
}

// "지난 수업 → 리뷰 보기"를 열 때만 호출된다(예전에는 담당 학생 전체의
// 리뷰·피드백을 항상 미리 다 읽어뒀었다).
export async function loadReviewDetail(
  sessionId: string
): Promise<{ review: ReviewData | null; myFeedback: StudentFeedback | null }> {
  const { supabase, studentId } = await requireOwnsLegacySession(sessionId);
  const [reviews, feedbackMap] = await Promise.all([
    loadReviews(supabase, [sessionId]),
    loadStudentFeedbackForStudents(supabase, [studentId], [sessionId]),
  ]);
  return { review: reviews[sessionId] ?? null, myFeedback: feedbackMap[sessionId] ?? null };
}
