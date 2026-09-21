"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitReview } from "./review-actions";
import type { ExistingReview, ReviewCategoryId, ReviewRating, SessionReviewContext } from "./review-data";

const CATEGORY_LABEL: Record<ReviewCategoryId, string> = {
  concept: "개념 이해도",
  problemsolving: "문제 해결 능력",
  participation: "수업 참여도",
  homework: "과제 수행도",
};

const CATEGORY_IDS = Object.keys(CATEGORY_LABEL) as ReviewCategoryId[];

const RATING_LABEL: Record<ReviewRating, string> = {
  below: "Below",
  partial: "Partial",
  average: "Average",
  excellent: "Excellent",
  outstanding: "Outstanding",
};
const RATING_IDS = Object.keys(RATING_LABEL) as ReviewRating[];

type CategoryState = Record<ReviewCategoryId, { text: string; reviewed: boolean; rating: ReviewRating | null }>;

/** 2026-09-16(제품 오너 지시) — 카테고리별 5단계 버튼 평가 중심으로 재구성. 텍스트는 선택,
 * "오늘 배운 것"·"최종 정리"만 필수 — 리뷰 작성 자체를 빠르게 남길 수 있게 한다. AI 초안
 * 자동 생성(기존 "✨ AI 초안 전체 생성")은 리뷰에 AI 문장을 그대로 넣는 게 무겁다는 지적으로
 * 제거했다. */
export default function TeacherReviewPanel({
  context,
  existingReview,
}: {
  context: SessionReviewContext;
  existingReview: ExistingReview | null;
}) {
  const router = useRouter();
  const [teacherSummary, setTeacherSummary] = useState(existingReview?.teacherSummary ?? "");
  const [nextPlan, setNextPlan] = useState(existingReview?.nextPlan ?? "");
  const [categories, setCategories] = useState<CategoryState>(
    Object.fromEntries(
      CATEGORY_IDS.map((id) => [
        id,
        {
          text: existingReview?.categories[id]?.finalText ?? "",
          reviewed: existingReview?.categories[id]?.reviewed ?? false,
          rating: existingReview?.categories[id]?.rating ?? null,
        },
      ])
    ) as CategoryState
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allRated = CATEGORY_IDS.every((id) => categories[id].rating !== null);
  const canSubmit = allRated && teacherSummary.trim().length > 0 && nextPlan.trim().length > 0;

  function setRating(id: ReviewCategoryId, rating: ReviewRating) {
    setCategories((prev) => ({ ...prev, [id]: { ...prev[id], rating } }));
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitReview(context.sessionId, { teacherSummary, nextPlan, categories });
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-[640px] px-8 py-8">
      {/* 2026-09-21(전수 점검 지적) — router.back()은 브라우저 히스토리에 의존해, 새로고침이나
          딥링크(URL 직접 접속)로 들어오면 히스토리가 없어 엉뚱한 곳(또는 아예 안 움직임)으로
          갈 수 있었다. 이 화면의 유일한 진입점(app/teacher/ScheduleTab.tsx)이 TeacherShell의
          "Schedule" 탭이므로, 항상 그 탭으로 돌아가는 명시적 목적지를 쓴다. */}
      <button
        onClick={() => router.push("/teacher?tab=lesson-schedule")}
        className="text-[13px] text-grey-500 font-semibold mb-4"
      >
        ← 뒤로
      </button>

      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">수업 리뷰 작성</h1>
      <p className="text-[13px] text-grey-500 mb-6">
        {context.studentName} · {context.subjectName} · {context.sessionNumber}회차
        {context.unitTitle ? ` · ${context.unitTitle}` : ""}
      </p>

      <div className="mb-6">
        <h2 className="text-[14px] font-bold text-ink mb-3">카테고리별 평가</h2>
        {CATEGORY_IDS.map((id) => (
          <div
            key={id}
            className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5"
          >
            <div className="text-[13px] font-bold text-ink mb-2">{CATEGORY_LABEL[id]}</div>
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {RATING_IDS.map((r) => (
                <button
                  key={r}
                  onClick={() => setRating(id, r)}
                  className={
                    "text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] " +
                    (categories[id].rating === r ? "border-ink bg-ink text-white" : "border-grey-200 text-ink")
                  }
                >
                  {RATING_LABEL[r]}
                </button>
              ))}
            </div>
            <textarea
              value={categories[id].text}
              onChange={(e) =>
                setCategories((prev) => ({
                  ...prev,
                  [id]: { ...prev[id], text: e.target.value },
                }))
              }
              placeholder="코멘트(선택)"
              className="w-full min-h-[56px] px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
            />
          </div>
        ))}
      </div>

      <div className="mb-6">
        <h2 className="text-[14px] font-bold text-ink mb-3">종합 정리</h2>
        <Field label="오늘 배운 것" value={teacherSummary} onChange={setTeacherSummary} required />
        <Field label="최종 정리" value={nextPlan} onChange={setNextPlan} required />
      </div>

      {error && <p className="text-[12.5px] text-red mb-3">{error}</p>}
      <button
        disabled={submitting || !canSubmit}
        onClick={() => void handleSubmit()}
        className="text-[13px] font-bold px-5 py-2.5 rounded-lg bg-green text-white disabled:opacity-50"
      >
        {submitting ? "제출 중..." : "리뷰 제출"}
      </button>
      {!canSubmit && !submitted && (
        <p className="text-[12px] text-grey-500 mt-2">
          모든 카테고리 평가 선택, "오늘 배운 것"·"최종 정리" 작성 후 제출할 수 있습니다.
        </p>
      )}
      {submitted && (
        <span className="ml-3 text-[12.5px] font-semibold text-green">
          ✓ 제출되었습니다
        </span>
      )}
    </div>
  );
}

function Field({
  label, value, onChange, required,
}: {
  label: string; value: string; onChange: (value: string) => void; required?: boolean;
}) {
  return (
    <div className="mb-3">
      <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1">
        {label}{required && <span className="text-red"> *</span>}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-h-[60px] px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
      />
    </div>
  );
}
