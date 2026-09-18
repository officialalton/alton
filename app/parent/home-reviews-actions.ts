"use server";

// 2026-09-18 — 학부모 홈 재설계("종합 리뷰"/"수업 리뷰" 서브탭)의 데이터 레이어.
// 기존 lesson-review-family-actions.ts(subjectEnrollment 단위 조회)를 자녀의
// 모든 수강 과목에 대해 병렬 호출해 하나로 합친다 — 새 RPC를 만들지 않는다.

import { getLessonReviewsForFamily, type FamilyLessonReview } from "./lesson-review-family-actions";

export async function getAllFamilyLessonReviews(
  subjectEnrollmentIds: string[]
): Promise<FamilyLessonReview[]> {
  const results = await Promise.all(
    subjectEnrollmentIds.map((id) => getLessonReviewsForFamily(id).catch(() => [] as FamilyLessonReview[]))
  );
  return results.flat().sort((a, b) => (a.finalizedAt < b.finalizedAt ? 1 : -1));
}
