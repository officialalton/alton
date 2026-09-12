"use client";

// M4(2026-09-05 통합) — 관리자가 확정된 체험/정규 리뷰를 검수하고, 필요하면
// 운영상 정정한다(finalized_at은 보존, admin_edited_at만 갱신). 확정 전
// 초안은 다루지 않는다 — 선생님만 작성/확정한다.

import { useEffect, useState } from "react";
import {
  getFinalLessonReviewForAdmin,
  adminEditLessonReview,
  type FinalLessonReviewForAdmin,
} from "./lesson-review-actions";

export default function LessonReviewAdminEditor({ subjectEnrollmentId }: { subjectEnrollmentId: string }) {
  const [review, setReview] = useState<FinalLessonReviewForAdmin | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [categoryNotes, setCategoryNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function refresh() {
    try {
      const r = await getFinalLessonReviewForAdmin(subjectEnrollmentId);
      setReview(r);
      if (r) {
        setFinalText(r.finalText);
        setCategoryNotes(Object.fromEntries(r.categoryNotes.map((c) => [c.key, c.note ?? ""])));
      }
    } catch {
      setReview(null);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectEnrollmentId]);

  if (!review) return null;

  return (
    <div className="mt-2.5 bg-grey-50 rounded-lg px-3 py-2.5 border border-grey-200">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[11.5px] font-bold text-grey-500">
          확정된 {review.lessonType === "trial" ? "체험" : "정규"} 리뷰(검수)
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[11.5px] font-semibold text-blue"
          >
            정정
          </button>
        )}
      </div>

      {!editing ? (
        <>
          {review.categoryNotes.map((c) =>
            c.note ? (
              <div key={c.key} className="mb-1.5">
                <div className="text-[10.5px] font-bold text-grey-400">{c.label}</div>
                <p className="text-[12.5px] text-ink whitespace-pre-wrap">{c.note}</p>
              </div>
            ) : null
          )}
          <p className="text-[12.5px] text-ink whitespace-pre-wrap">{review.finalText}</p>
        </>
      ) : (
        <>
          {review.categoryNotes.map((c) => (
            <div key={c.key} className="mb-2">
              <label htmlFor={`admin-review-cat-${c.key}`} className="block text-[10.5px] font-bold text-grey-400 mb-0.5">
                {c.label}
              </label>
              <textarea
                id={`admin-review-cat-${c.key}`}
                className="w-full border border-grey-300 rounded px-2 py-1.5 text-[12.5px]"
                rows={2}
                value={categoryNotes[c.key] ?? ""}
                onChange={(e) => setCategoryNotes((prev) => ({ ...prev, [c.key]: e.target.value }))}
              />
            </div>
          ))}
          <label htmlFor="admin-review-final" className="block text-[10.5px] font-bold text-grey-400 mb-0.5">
            종합 의견
          </label>
          <textarea
            id="admin-review-final"
            className="w-full border border-grey-300 rounded px-2 py-1.5 text-[12.5px] mb-2"
            rows={3}
            value={finalText}
            onChange={(e) => setFinalText(e.target.value)}
          />
          {error && <div className="text-[12px] text-red mb-1" role="alert">{error}</div>}
          <div className="flex items-center gap-2">
            <button
              disabled={busy || finalText.trim().length === 0}
              aria-busy={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await adminEditLessonReview({
                    sessionId: review.sessionId,
                    finalText,
                    categoryNotes,
                  });
                  setEditing(false);
                  setSaved(true);
                  await refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
                setBusy(false);
              }}
              className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
            >
              {busy ? "저장 중..." : "정정 저장"}
            </button>
            <button
              disabled={busy}
              onClick={() => setEditing(false)}
              className="text-[12px] font-semibold text-grey-500"
            >
              취소
            </button>
          </div>
        </>
      )}
      {saved && !editing && (
        <div className="text-[11.5px] text-green mt-1.5">✓ 정정 저장됨</div>
      )}
    </div>
  );
}
