"use client";

import { useState } from "react";
import { submitStudentFeedback } from "./review-actions";
import type { ReviewData, StudentFeedback } from "./review-data";

const CATEGORY_LABEL: Record<string, string> = {
  concept: "개념 이해",
  problemsolving: "문제 해결력",
  participation: "수업 참여도",
  homework: "과제 수행",
};

export default function ReviewPanel({
  sessionId,
  review,
  myFeedback,
  onBack,
  readOnly = false,
}: {
  sessionId: string;
  review: ReviewData | null;
  myFeedback: StudentFeedback | null;
  onBack: () => void;
  readOnly?: boolean;
}) {
  return (
    <div className="max-w-[640px] px-8 py-8">
      <button
        onClick={onBack}
        className="text-[13px] text-grey-500 font-semibold mb-4"
      >
        ← 뒤로
      </button>
      <h1 className="text-[20px] font-extrabold text-ink mb-5">수업 리뷰</h1>

      {!review ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center mb-6">
          아직 선생님이 리포트를 작성하지 않았습니다.
        </div>
      ) : (
        <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4.5 mb-6">
          {review.teacherSummary && (
            <p className="text-[13.5px] text-ink leading-[1.6] mb-3">
              {review.teacherSummary}
            </p>
          )}
          {review.strength && (
            <Field label="잘한 점" text={review.strength} />
          )}
          {review.improve && (
            <Field label="보완할 점" text={review.improve} />
          )}
          {review.nextPlan && (
            <Field label="다음 계획" text={review.nextPlan} />
          )}
          {review.categories.map((c) =>
            c.finalText ? (
              <Field
                key={c.category}
                label={CATEGORY_LABEL[c.category] ?? c.category}
                text={c.finalText}
              />
            ) : null
          )}
        </div>
      )}

      {readOnly ? (
        <FeedbackReadOnly feedback={myFeedback} />
      ) : (
        <FeedbackForm sessionId={sessionId} initial={myFeedback} />
      )}
    </div>
  );
}

function FeedbackReadOnly({ feedback }: { feedback: StudentFeedback | null }) {
  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4.5">
      <h2 className="text-[14px] font-bold text-ink mb-3">학생 만족도</h2>
      {!feedback || feedback.rating === null ? (
        <p className="text-[13px] text-grey-500">
          학생이 아직 평가를 남기지 않았습니다.
        </p>
      ) : (
        <>
          <div className="text-[18px] mb-2">
            {"⭐".repeat(feedback.rating)}
            <span className="opacity-25">
              {"⭐".repeat(5 - feedback.rating)}
            </span>
          </div>
          {feedback.comment && (
            <p className="text-[13px] text-ink leading-[1.6]">
              {feedback.comment}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Field({ label, text }: { label: string; text: string }) {
  return (
    <div className="mt-3">
      <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1">
        {label}
      </div>
      <p className="text-[13px] text-ink leading-[1.6]">{text}</p>
    </div>
  );
}

function FeedbackForm({
  sessionId,
  initial,
}: {
  sessionId: string;
  initial: StudentFeedback | null;
}) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit() {
    if (rating === 0 || saving) return;
    setSaving(true);
    try {
      await submitStudentFeedback(sessionId, rating, comment);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4.5">
      <h2 className="text-[14px] font-bold text-ink mb-3">이 수업은 어떠셨나요?</h2>
      <div className="flex gap-1.5 mb-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setRating(n)}
            className={"text-[22px] " + (n <= rating ? "" : "opacity-25")}
          >
            ⭐
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="수업에 대한 의견을 남겨주세요 (선택)"
        className="w-full min-h-[70px] px-3 py-2.5 border-[1.5px] border-grey-200 rounded-lg text-[13px] mb-3"
      />
      <button
        disabled={rating === 0 || saving}
        onClick={handleSubmit}
        className="text-[12px] font-bold px-4 py-2 rounded-lg bg-green text-white disabled:opacity-50"
      >
        {saving ? "저장 중..." : "제출하기"}
      </button>
      {saved && (
        <span className="ml-3 text-[12px] font-semibold text-green">
          ✓ 제출되었습니다
        </span>
      )}
    </div>
  );
}
