"use client";

// M4 — 선생님이 완료된 체험 수업의 고객용 리뷰를 작성·확정하는 패널.
// Smart Notes 원본(Drive 링크/AI 회의록)은 여기서 다루지 않는다 — 세션뷰에서
// 검토한 뒤 그 결과로 만든 텍스트만 이 화면에 입력한다. 초안 저장(비공개)과
// 고객 공개 확정을 명확히 구분하고, 확정 전에 "보호자·학생 화면에는 이렇게
// 보입니다"를 미리 볼 수 있게 한다. 카테고리별 의견 작성은 LessonReviewForm에
// 위임한다(체험/정규 공용, R9에서 정규수업도 재사용).

import { useEffect, useState } from "react";
import {
  listMyTrialSessionsNeedingReview,
  listActiveReviewCategories,
  saveTrialLessonReviewDraft,
  finalizeTrialLessonReview,
  type TrialSessionNeedingReview,
  type ReviewCategoryOption,
} from "./trial-review-actions";
import LessonReviewForm from "./LessonReviewForm";

export default function TrialReviewPanel() {
  const [sessions, setSessions] = useState<TrialSessionNeedingReview[] | null>(null);
  const [categories, setCategories] = useState<ReviewCategoryOption[]>([]);

  async function refresh() {
    try {
      const [sessionsResult, categoriesResult] = await Promise.all([
        listMyTrialSessionsNeedingReview(),
        listActiveReviewCategories(),
      ]);
      setSessions(sessionsResult);
      setCategories(categoriesResult);
    } catch {
      setSessions([]);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  if (!sessions) return null;
  const pending = sessions.filter((s) => s.reviewStatus !== "final");
  if (pending.length === 0) return null;

  return (
    <div className="max-w-[640px] px-8 py-8 border-t border-grey-200 mt-8">
      <h2 className="text-[16px] font-extrabold text-ink mb-1.5">체험 수업 리뷰 작성</h2>
      <p className="text-[13px] text-grey-500 mb-5">
        초안 저장은 비공개입니다(본인만 확인 가능). <b>공개 확정</b>을 눌러야 보호자·학생
        화면에 노출됩니다 — 확정 전에는 아무도 볼 수 없습니다.
      </p>
      {pending.map((s) => (
        <ReviewRow key={s.sessionId} session={s} categories={categories} onSaved={refresh} />
      ))}
    </div>
  );
}

function ReviewRow({
  session,
  categories,
  onSaved,
}: {
  session: TrialSessionNeedingReview;
  categories: ReviewCategoryOption[];
  onSaved: () => void;
}) {
  return (
    <div>
      <div className="text-[12.5px] text-grey-500 mb-1.5 flex items-center gap-1.5">
        <span>{new Date(session.startsAt).toLocaleString("ko-KR")}</span>
        <span
          className={
            "text-[10px] font-bold px-2 py-0.5 rounded-full " +
            (session.reviewStatus === "draft" ? "bg-grey-100 text-grey-500" : "bg-grey-100 text-grey-400")
          }
        >
          {session.reviewStatus === "draft" ? "초안 저장됨 · 비공개" : "미작성"}
        </span>
      </div>
      <LessonReviewForm
        sessionId={session.sessionId}
        categories={categories}
        initial={{
          aiSummary: session.aiSummary,
          draftText: session.draftText ?? "",
          categoryNotes: Object.fromEntries(
            Object.entries(session.categoryNotes).map(([k, v]) => [k, v ?? ""])
          ),
        }}
        onSaveDraft={async (value) => {
          await saveTrialLessonReviewDraft({
            sessionId: session.sessionId,
            aiSummary: value.aiSummary,
            draftText: value.draftText,
            categoryNotes: value.categoryNotes,
          });
          onSaved();
        }}
        onFinalize={async (finalText) => {
          await finalizeTrialLessonReview({ sessionId: session.sessionId, finalText });
          onSaved();
        }}
      />
    </div>
  );
}
