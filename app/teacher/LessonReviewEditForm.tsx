"use client";

// 확정된 리뷰 정정 전용 — LessonReviewForm(초안→확정 2단계)과 달리 이미 확정된
// 값만 다루고 단일 "정정 저장"만 있다. 정정할 때마다 이전 버전이
// lesson_review_edit_history에 남는다(teacher_edit_finalized_lesson_review).

import { useState } from "react";
import type { ReviewCategoryOption } from "./trial-review-actions";

export default function LessonReviewEditForm({
  sessionId,
  categories,
  initial,
  onSave,
}: {
  sessionId: string;
  categories: ReviewCategoryOption[];
  initial: { finalText: string; categoryNotes: Record<string, string> };
  onSave: (value: { finalText: string; categoryNotes: Record<string, string> }) => Promise<void>;
}) {
  const [finalText, setFinalText] = useState(initial.finalText);
  const [categoryNotes, setCategoryNotes] = useState<Record<string, string>>(
    Object.fromEntries(categories.map((c) => [c.key, initial.categoryNotes[c.key] ?? ""]))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = `lesson-review-edit-${sessionId}`;

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5">
      <div className="text-[11.5px] font-semibold text-grey-500 mb-3 bg-grey-50 rounded px-2.5 py-2">
        이미 보호자·학생 화면에 공개된 리뷰입니다. 정정하면 이전 내용은 수정 이력으로 보관되고, 지금
        입력한 내용으로 바로 교체됩니다.
      </div>

      {categories.map((c) => (
        <div key={c.key} className="mb-3">
          <label
            htmlFor={`${inputId}-cat-${c.key}`}
            className="block text-[11.5px] font-semibold text-grey-500 mb-1"
          >
            {c.label}
          </label>
          <textarea
            id={`${inputId}-cat-${c.key}`}
            className="w-full border border-grey-300 rounded px-2 py-1.5 text-[13px]"
            rows={2}
            value={categoryNotes[c.key] ?? ""}
            onChange={(e) => setCategoryNotes((prev) => ({ ...prev, [c.key]: e.target.value }))}
          />
        </div>
      ))}

      <label htmlFor={inputId} className="block text-[11.5px] font-semibold text-grey-500 mb-1">
        고객에게 보여줄 종합 의견
      </label>
      <textarea
        id={inputId}
        className="w-full border border-grey-300 rounded px-2 py-1.5 text-[13px]"
        rows={4}
        value={finalText}
        onChange={(e) => setFinalText(e.target.value)}
      />
      {error && <div className="text-[12px] text-red mt-1" role="alert">{error}</div>}

      <div className="flex items-center gap-2 mt-2.5">
        <button
          disabled={busy || finalText.trim().length === 0}
          aria-busy={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await onSave({ finalText, categoryNotes });
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
            setBusy(false);
          }}
          className="text-[12px] font-bold px-3.5 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
        >
          {busy ? "정정 중..." : "정정 저장"}
        </button>
      </div>
    </div>
  );
}
