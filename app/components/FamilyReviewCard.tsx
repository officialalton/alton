"use client";

import type { FamilyLessonReview } from "@/app/parent/lesson-review-family-actions";

// 2026-09-18 — 홈 "종합 리뷰"/"수업 리뷰" 서브탭 공용 카드. 확정된 텍스트만
// 보여준다(초안은 애초에 이 데이터 소스에 없음 — home-reviews-actions.ts 참고).
// 2026-09-22 — 학생 포털 Review 탭에서도 그대로 재사용하려고 공용 컴포넌트로 분리.
export default function FamilyReviewCard({ review }: { review: FamilyLessonReview }) {
  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold text-ink">
          {review.lessonType === "trial" ? "체험 수업" : "정규 수업"} 리뷰
        </span>
        <span className="text-[11px] text-grey-500">
          {new Date(review.finalizedAt).toLocaleDateString("ko-KR")}
        </span>
      </div>
      <p className="text-[12.5px] text-ink whitespace-pre-wrap mt-1.5">{review.finalText}</p>
      {review.categoryNotes.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {review.categoryNotes.map((c) => (
            <p key={c.key} className="text-[11.5px] text-grey-500">
              <span className="font-semibold text-grey-700">{c.label}</span> — {c.note}
            </p>
          ))}
        </div>
      )}
      {review.meetingRecordLink && (
        <a
          href={review.meetingRecordLink}
          target="_blank"
          rel="noreferrer"
          className="inline-block mt-2 text-[12px] font-semibold text-ink underline"
        >
          미팅록 보기
        </a>
      )}
    </div>
  );
}
