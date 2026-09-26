"use server";

// 2026-09-18 — 학부모 홈 재설계("종합 리뷰"/"수업 리뷰"/"상담 리뷰" 서브탭)의
// 데이터 레이어. 기존 lesson-review-family-actions.ts(subjectEnrollment 단위
// 조회)를 자녀의 모든 수강 과목에 대해 병렬 호출해 하나로 합친다 — 새 RPC를
// 만들지 않는다.

import { getLessonReviewsForFamily, type FamilyLessonReview } from "./lesson-review-family-actions";
import { listGuardianMeetingRequests, getGuardianMeetingRequestReview } from "./inquiry-actions";

export async function getAllFamilyLessonReviews(
  subjectEnrollmentIds: string[]
): Promise<FamilyLessonReview[]> {
  const results = await Promise.all(
    subjectEnrollmentIds.map((id) => getLessonReviewsForFamily(id).catch(() => [] as FamilyLessonReview[]))
  );
  return results.flat().sort((a, b) => (a.finalizedAt < b.finalizedAt ? 1 : -1));
}

// 2026-09-18(사용자 결정) — "상담 리뷰"는 종합 리뷰에 합치지 않고 홈의 별도
// 서브탭으로 둔다. 상담 담당자 소유 로직(inquiry-actions.ts의
// listGuardianMeetingRequests/getGuardianMeetingRequestReview — 둘 다 이미
// household RLS·"확정된 것만" 규칙을 강제한다)을 그대로 재사용하는 읽기 전용
// wrapper만 여기 추가한다. 상담 신청/내역 탭과 동일한 권한 범위 — 새 RPC 없음.
export type HomeConsultationReview = {
  meetingRequestId: string;
  startsAt: string | null;
  endsAt: string | null;
  finalText: string;
  finalizedAt: string | null;
  meetingRecordLink: string | null;
};

export async function getHomeConsultationReviews(): Promise<HomeConsultationReview[]> {
  const meetings = await listGuardianMeetingRequests();
  const completed = meetings.filter((m) => m.status === "completed");
  const reviews = await Promise.all(
    completed.map(async (m) => {
      const review = await getGuardianMeetingRequestReview(m.id).catch(() => null);
      if (!review) return null;
      return {
        meetingRequestId: m.id,
        startsAt: m.startsAt,
        endsAt: m.endsAt,
        finalText: review.finalText,
        finalizedAt: review.finalizedAt,
        meetingRecordLink: review.driveLink
          ? `https://drive.google.com/file/d/${review.driveLink.driveFileId}/view`
          : null,
      };
    })
  );
  return reviews
    .filter((r): r is HomeConsultationReview => r !== null)
    .sort((a, b) => (a.finalizedAt ?? "").localeCompare(b.finalizedAt ?? "") * -1);
}
