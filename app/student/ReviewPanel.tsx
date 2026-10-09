"use client";

import { useState } from "react";
import { submitStudentFeedback } from "./review-actions";
import type { ReviewData, StudentFeedback } from "./review-data";

const CATEGORY_LABEL: Record<string, string> = {
  concept: "Concept understanding",
  problemsolving: "Problem solving",
  participation: "Class participation",
  homework: "Homework completion",
};

const RATING_LABEL: Record<string, string> = {
  below: "Below",
  partial: "Partial",
  average: "Average",
  excellent: "Excellent",
  outstanding: "Outstanding",
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
        className="text-[13px] text-grey-600 font-semibold mb-4 border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 hover:bg-grey-100 active:scale-95 transition-transform"
      >
        ← Back
      </button>
      <h1 className="text-[20px] font-extrabold text-ink mb-5">Lesson Review</h1>

      {!review ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center mb-6">
          Your teacher hasn&apos;t written a report yet.
        </div>
      ) : (
        <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4.5 mb-6">
          {review.categories.map((c) => (
            <div key={c.category} className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-grey-300 uppercase tracking-wide">
                  {CATEGORY_LABEL[c.category] ?? c.category}
                </span>
                {c.rating && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-grey-100 text-ink">
                    {RATING_LABEL[c.rating] ?? c.rating}
                  </span>
                )}
              </div>
              {c.finalText && <p className="text-[13px] text-ink leading-[1.6]">{c.finalText}</p>}
            </div>
          ))}
          {review.teacherSummary && (
            <Field label="What we covered" text={review.teacherSummary} />
          )}
          {review.strength && <Field label="Strengths" text={review.strength} />}
          {review.improve && <Field label="Areas to improve" text={review.improve} />}
          {review.nextPlan && (
            <Field label="Wrap-up" text={review.nextPlan} />
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
      <h2 className="text-[14px] font-bold text-ink mb-3">Student Rating</h2>
      {!feedback || feedback.rating === null ? (
        <p className="text-[13px] text-grey-500">
          The student hasn&apos;t left a rating yet.
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
      <h2 className="text-[14px] font-bold text-ink mb-3">How was this lesson?</h2>
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
        placeholder="Share your thoughts about the lesson (optional)"
        className="w-full min-h-[70px] px-3 py-2.5 border-[1.5px] border-grey-200 rounded-lg text-[13px] mb-3"
      />
      <button
        disabled={rating === 0 || saving}
        onClick={handleSubmit}
        className="text-[12px] font-bold px-4 py-2 rounded-lg bg-green text-white disabled:opacity-50"
      >
        {saving ? "Saving..." : "Submit"}
      </button>
      {saved && (
        <span className="ml-3 text-[12px] font-semibold text-green">
          ✓ Submitted
        </span>
      )}
    </div>
  );
}
