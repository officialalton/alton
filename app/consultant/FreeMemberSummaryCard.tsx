"use client";

import { useState, useTransition } from "react";
import { loadFreeMemberLearningSummaryAction, type FreeMemberLearningSummary } from "./free-member-summary-actions";

// 2026-10-05 무료 회원 S5 — 상담 상세의 읽기 전용 학습 요약 카드(집계만, 답안·필기·메모 없음). 문구는 영어(컨설턴트 UI).
export default function FreeMemberSummaryCard({ studentId }: { studentId: string }) {
  const [summary, setSummary] = useState<FreeMemberLearningSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mb-3 border-[1.5px] border-grey-200 rounded-lg px-3 py-2.5 bg-white" data-testid="free-member-summary-card">
      <div className="text-[11.5px] font-bold text-ink mb-1">Free member learning summary (read-only)</div>
      {!summary && (
        <>
          <p className="text-[11.5px] text-grey-500 mb-2">Counts and weakest areas only. Each view is logged.</p>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const r = await loadFreeMemberLearningSummaryAction(studentId);
                if (r.ok) setSummary(r.summary);
                else setError(r.error);
              })
            }
            className="text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50"
          >
            {pending ? "Loading…" : "View summary"}
          </button>
        </>
      )}
      {error && <p className="text-[12px] text-red mt-1.5">{error}</p>}
      {summary && (
        <div className="text-[12px] text-ink space-y-1.5">
          <div>
            Mock exams taken: {summary.attemptCount} ({summary.gradedAttemptCount} graded) · Vocabulary words: {summary.vocabWordCount}
          </div>
          {summary.recentAttempts.map((a, i) => (
            <div key={i} className="text-grey-500">
              {a.examSetName} — R&amp;W {a.rw.correct}/{a.rw.total}, Math {a.math.correct}/{a.math.total}
            </div>
          ))}
          {summary.weakestDomains.length > 0 && (
            <div>Weakest domains: {summary.weakestDomains.map((d) => `${d.key} (${d.correct}/${d.total})`).join(", ")}</div>
          )}
          {summary.weakestSkills.length > 0 && (
            <div>Weakest skills: {summary.weakestSkills.map((d) => `${d.key} (${d.correct}/${d.total})`).join(", ")}</div>
          )}
        </div>
      )}
    </div>
  );
}
