"use client";

// M4 (2026-09-05 통합) — 체험/정규 공용 리뷰 작성 폼. AI 미팅록(Smart Notes)
// 기반 자동 요약 붙여넣기 자리 + 카테고리별 선생님 의견(review_categories 참조
// 테이블, 하드코딩 아님) + 종합 의견(고객 노출 final_text)을 함께 다룬다.
// R9에서 정규수업 리뷰도 이 컴포넌트를 그대로 재사용한다(sessionId만 다르게
// 넘기면 됨 — 체험/정규 구분은 서버 함수가 sessions.lesson_type_id로 자동
// 판별한다).

import { useState } from "react";
import type { ReviewCategoryOption } from "./trial-review-actions";

export type LessonReviewFormValue = {
  aiSummary: string | null;
  draftText: string;
  categoryNotes: Record<string, string>;
};

export default function LessonReviewForm({
  sessionId,
  categories,
  initial,
  onSaveDraft,
  onFinalize,
}: {
  sessionId: string;
  categories: ReviewCategoryOption[];
  initial: LessonReviewFormValue;
  onSaveDraft: (value: LessonReviewFormValue) => Promise<void>;
  onFinalize: (finalText: string) => Promise<void>;
}) {
  const [aiSummary, setAiSummary] = useState(initial.aiSummary ?? "");
  const [draftText, setDraftText] = useState(initial.draftText ?? "");
  const [categoryNotes, setCategoryNotes] = useState<Record<string, string>>(
    Object.fromEntries(categories.map((c) => [c.key, initial.categoryNotes[c.key] ?? ""]))
  );
  const [showPreview, setShowPreview] = useState(false);
  const [confirmingFinalize, setConfirmingFinalize] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = `lesson-review-${sessionId}`;

  const currentValue: LessonReviewFormValue = {
    aiSummary: aiSummary.trim() || null,
    draftText,
    categoryNotes,
  };

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5">
      <label htmlFor={`${inputId}-ai`} className="block text-[11.5px] font-semibold text-grey-500 mb-1">
        AI 미팅록 기반 자동 요약(붙여넣기)
      </label>
      <textarea
        id={`${inputId}-ai`}
        className="w-full border border-grey-300 rounded px-2 py-1.5 text-[13px] mb-3"
        rows={3}
        placeholder="Smart Notes 검토 후 요약을 붙여넣으세요(선택 — 고객에게 직접 노출되지 않고 선생님 작성 참고용)"
        value={aiSummary}
        onChange={(e) => setAiSummary(e.target.value)}
      />

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
            onChange={(e) =>
              setCategoryNotes((prev) => ({ ...prev, [c.key]: e.target.value }))
            }
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
        placeholder="예: 기초 개념 이해도가 우수하고, 문제 풀이 속도가 빠릅니다. 정규 진행을 추천합니다."
        value={draftText}
        onChange={(e) => {
          setDraftText(e.target.value);
          setConfirmingFinalize(false);
        }}
      />
      {error && <div className="text-[12px] text-red mt-1" role="alert">{error}</div>}

      <div className="flex items-center gap-2 mt-2">
        <button
          disabled={busy || draftText.trim().length === 0}
          aria-busy={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await onSaveDraft(currentValue);
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
            setBusy(false);
          }}
          className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
        >
          초안 저장(비공개)
        </button>
        <button
          type="button"
          disabled={draftText.trim().length === 0}
          onClick={() => setShowPreview((v) => !v)}
          className="text-[12px] font-semibold px-3 py-1.5 rounded-lg text-ink underline disabled:opacity-50 disabled:no-underline"
        >
          {showPreview ? "미리보기 닫기" : "고객 화면 미리보기"}
        </button>
      </div>

      {showPreview && (
        <div className="mt-2.5 bg-grey-50 rounded-lg px-3 py-2.5 border border-grey-200">
          <div className="text-[11px] font-bold text-grey-500 mb-1">보호자·학생 화면에는 이렇게 보입니다</div>
          {categories.map((c) =>
            categoryNotes[c.key]?.trim() ? (
              <div key={c.key} className="mb-1.5">
                <div className="text-[10.5px] font-bold text-grey-400">{c.label}</div>
                <p className="text-[12.5px] text-ink whitespace-pre-wrap">{categoryNotes[c.key]}</p>
              </div>
            ) : null
          )}
          <p className="text-[12.5px] text-ink whitespace-pre-wrap">{draftText}</p>
        </div>
      )}

      {!confirmingFinalize ? (
        <button
          disabled={busy || draftText.trim().length === 0}
          onClick={() => setConfirmingFinalize(true)}
          className="text-[12px] font-bold px-3 py-1.5 mt-2.5 rounded-lg bg-ink text-white disabled:opacity-50"
        >
          공개 확정
        </button>
      ) : (
        <div className="mt-2.5 bg-grey-50 rounded-lg px-3.5 py-3">
          <p className="text-[12px] text-ink mb-2">
            확정하면 위 내용이 보호자·학생 화면에 바로 공개됩니다. 계속할까요?
          </p>
          <div className="flex gap-2">
            <button
              disabled={busy}
              aria-busy={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  // finalize는 lesson_reviews 행이 먼저 있어야 한다 — 지금 입력된
                  // 내용을 초안으로 먼저 저장한 뒤 바로 확정한다.
                  await onSaveDraft(currentValue);
                  await onFinalize(draftText);
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                  setConfirmingFinalize(false);
                }
                setBusy(false);
              }}
              className="text-[12px] font-bold px-3.5 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
            >
              {busy ? "처리 중..." : "네, 공개합니다"}
            </button>
            <button
              disabled={busy}
              onClick={() => setConfirmingFinalize(false)}
              className="text-[12px] font-semibold px-3.5 py-1.5 rounded-lg text-grey-500"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
