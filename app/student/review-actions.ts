"use server";

import { requireUser } from "@/lib/auth";
import { getAllFamilyLessonReviews } from "@/app/parent/home-reviews-actions";
import type { FamilyLessonReview } from "@/app/parent/lesson-review-family-actions";

export async function submitStudentFeedback(
  sessionId: string,
  rating: number,
  comment: string
) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase.from("session_student_feedback").upsert(
    {
      session_id: sessionId,
      student_id: user.id,
      rating,
      comment: comment.trim() || null,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "session_id" }
  );
  if (error) throw new Error(error.message);
}

// 2026-09-22(사용자 지시 — "학부모랑 똑같이 Review 탭 만들어줘") — 학생 포털
// Home의 "Review" 서브탭 데이터. app/parent/lesson-review-family-actions.ts의
// getLessonReviewsForFamily는 RLS(get_lesson_reviews_for_family RPC)가 이미
// "child_id 본인·보호자·배정 교사·관리자"로 범위를 제한하므로 학생 본인이
// 호출해도 그대로 안전하다(역할 제한 없음, 주석 참고) — 새 RPC 없이 그대로
// 재사용한다. "상담 리뷰"는 household(보호자) 단위 개념이라 학생 화면에는
// 넣지 않는다(listGuardianMeetingRequests는 role='parent' 전용).
export async function getMyLessonReviewsAction(): Promise<FamilyLessonReview[]> {
  const { user, profile, supabase } = await requireUser();
  if (profile?.role !== "student") throw new Error("학생만 접근할 수 있습니다.");
  const { data: enrollments, error } = await supabase
    .from("subject_enrollments")
    .select("id")
    .eq("child_id", user.id);
  if (error) throw new Error(error.message);
  const enrollmentIds = (enrollments ?? []).map((e) => e.id as string);
  return getAllFamilyLessonReviews(enrollmentIds);
}
