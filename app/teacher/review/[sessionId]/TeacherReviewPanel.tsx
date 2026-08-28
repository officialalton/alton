"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateReviewDraft, submitReview } from "./review-actions";
import type { ExistingReview, ReviewCategoryId, SessionReviewContext } from "./review-data";

const CATEGORY_LABEL: Record<ReviewCategoryId, string> = {
  concept: "개념 이해도",
  problemsolving: "문제 해결 능력",
  participation: "수업 참여도",
  homework: "과제 수행도",
};

const CATEGORY_IDS = Object.keys(CATEGORY_LABEL) as ReviewCategoryId[];

type CategoryState = Record<ReviewCategoryId, { text: string; reviewed: boolean }>;

export default function TeacherReviewPanel({
  context,
  existingReview,
}: {
  context: SessionReviewContext;
  existingReview: ExistingReview | null;
}) {
  const router = useRouter();
  const [teacherSummary, setTeacherSummary] = useState(existingReview?.teacherSummary ?? "");
  const [strength, setStrength] = useState(existingReview?.strength ?? "");
  const [improve, setImprove] = useState(existingReview?.improve ?? "");
  const [nextPlan, setNextPlan] = useState(existingReview?.nextPlan ?? "");
  const [categories, setCategories] = useState<CategoryState>(
    Object.fromEntries(
      CATEGORY_IDS.map((id) => [
        id,
        {
          text: existingReview?.categories[id]?.finalText ?? "",
          reviewed: existingReview?.categories[id]?.reviewed ?? false,
        },
      ])
    ) as CategoryState
  );
  const [generating, setGenerating] = useState<"all" | ReviewCategoryId | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleGenerateAll() {
    setGenerating("all");
    try {
      const draft = await generateReviewDraft({
        sessionId: context.sessionId,
        subjectName: context.subjectName,
        unitTitle: context.unitTitle,
        sessionNumber: context.sessionNumber,
        note: context.note,
        teacherComment: context.teacherComment,
        homeworkItems: context.homeworkItems,
      });
      setTeacherSummary(draft.teacherSummary);
      setStrength(draft.strength);
      setImprove(draft.improve);
      setNextPlan(draft.nextPlan);
      setCategories((prev) => {
        const next = { ...prev };
        for (const id of CATEGORY_IDS) {
          next[id] = { ...next[id], text: draft.categories[id] };
        }
        return next;
      });
    } finally {
      setGenerating(null);
    }
  }

  async function handleRegenerateCategory(id: ReviewCategoryId) {
    setGenerating(id);
    try {
      const draft = await generateReviewDraft({
        sessionId: context.sessionId,
        subjectName: context.subjectName,
        unitTitle: context.unitTitle,
        sessionNumber: context.sessionNumber,
        note: context.note,
        teacherComment: context.teacherComment,
        homeworkItems: context.homeworkItems,
      });
      setCategories((prev) => ({
        ...prev,
        [id]: { ...prev[id], text: draft.categories[id], reviewed: false },
      }));
    } finally {
      setGenerating(null);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await submitReview(context.sessionId, {
        teacherSummary,
        strength,
        improve,
        nextPlan,
        categories,
      });
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-[640px] px-8 py-8">
      <button
        onClick={() => router.back()}
        className="text-[13px] text-grey-500 font-semibold mb-4"
      >
        ← 뒤로
      </button>

      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">수업 리뷰 작성</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        {context.studentName} · {context.subjectName} · {context.sessionNumber}회차
        {context.unitTitle ? ` · ${context.unitTitle}` : ""}
      </p>

      <button
        disabled={generating !== null}
        onClick={handleGenerateAll}
        className="text-[12.5px] font-bold px-4 py-2.5 rounded-lg bg-ink text-white disabled:opacity-50 mb-6"
      >
        {generating === "all" ? "AI 초안 생성 중..." : "✨ AI 초안 전체 생성"}
      </button>

      <div className="mb-6">
        <h2 className="text-[14px] font-bold text-ink mb-3">카테고리별 평가</h2>
        {CATEGORY_IDS.map((id) => (
          <div
            key={id}
            className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-bold text-ink">{CATEGORY_LABEL[id]}</span>
              <button
                disabled={generating !== null}
                onClick={() => handleRegenerateCategory(id)}
                className="text-[11.5px] font-semibold text-grey-500 disabled:opacity-50"
              >
                {generating === id ? "생성 중..." : "🔄 AI 다시 생성"}
              </button>
            </div>
            <textarea
              value={categories[id].text}
              onChange={(e) =>
                setCategories((prev) => ({
                  ...prev,
                  [id]: { ...prev[id], text: e.target.value },
                }))
              }
              className="w-full min-h-[70px] px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px] mb-2"
            />
            <label className="flex items-center gap-1.5 text-[12px] text-grey-500 font-semibold">
              <input
                type="checkbox"
                checked={categories[id].reviewed}
                onChange={(e) =>
                  setCategories((prev) => ({
                    ...prev,
                    [id]: { ...prev[id], reviewed: e.target.checked },
                  }))
                }
              />
              검토완료
            </label>
          </div>
        ))}
      </div>

      <div className="mb-6">
        <h2 className="text-[14px] font-bold text-ink mb-3">종합 리뷰</h2>
        <Field label="선생님 총평" value={teacherSummary} onChange={setTeacherSummary} />
        <Field label="잘한 점" value={strength} onChange={setStrength} />
        <Field label="보완할 점" value={improve} onChange={setImprove} />
        <Field label="다음 계획" value={nextPlan} onChange={setNextPlan} />
      </div>

      <button
        disabled={submitting}
        onClick={handleSubmit}
        className="text-[13px] font-bold px-5 py-2.5 rounded-lg bg-green text-white disabled:opacity-50"
      >
        {submitting ? "제출 중..." : "리뷰 제출"}
      </button>
      {submitted && (
        <span className="ml-3 text-[12.5px] font-semibold text-green">
          ✓ 제출되었습니다
        </span>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mb-3">
      <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1">
        {label}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-h-[60px] px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
      />
    </div>
  );
}
