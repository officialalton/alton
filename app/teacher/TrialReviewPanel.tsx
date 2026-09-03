"use client";

// M4 (2/N) — 선생님이 완료된 체험 수업의 고객용 리뷰를 작성·확정하는 패널.
// Smart Notes 원본(Drive 링크/AI 회의록)은 여기서 다루지 않는다 — 세션뷰에서
// 검토한 뒤 그 결과로 만든 텍스트만 이 화면에 입력한다.

import { useEffect, useState } from "react";
import {
  listMyTrialSessionsNeedingReview,
  saveTrialLessonReviewDraft,
  finalizeTrialLessonReview,
  type TrialSessionNeedingReview,
} from "./trial-review-actions";

export default function TrialReviewPanel() {
  const [sessions, setSessions] = useState<TrialSessionNeedingReview[] | null>(null);

  async function refresh() {
    try {
      setSessions(await listMyTrialSessionsNeedingReview());
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
        확정하면 보호자·학생 화면에 바로 공개됩니다. 확정 전에는 아무도 볼 수 없습니다.
      </p>
      {pending.map((s) => (
        <ReviewRow key={s.sessionId} session={s} onSaved={refresh} />
      ))}
    </div>
  );
}

function ReviewRow({
  session,
  onSaved,
}: {
  session: TrialSessionNeedingReview;
  onSaved: () => void;
}) {
  const [text, setText] = useState(session.draftText ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5">
      <div className="text-[12.5px] text-grey-500 mb-1.5">
        {new Date(session.startsAt).toLocaleString("ko-KR")} · {session.reviewStatus === "draft" ? "초안 저장됨" : "미작성"}
      </div>
      <textarea
        className="w-full border border-grey-300 rounded px-2 py-1.5 text-[13px]"
        rows={4}
        placeholder="고객에게 보여줄 체험 리뷰"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {error && <div className="text-[12px] text-red-600 mt-1">{error}</div>}
      <div className="flex gap-2 mt-2">
        <button
          disabled={busy || text.trim().length === 0}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await saveTrialLessonReviewDraft({ sessionId: session.sessionId, draftText: text });
              onSaved();
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
            setBusy(false);
          }}
          className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
        >
          초안 저장
        </button>
        <button
          disabled={busy || text.trim().length === 0}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await finalizeTrialLessonReview({ sessionId: session.sessionId, finalText: text });
              onSaved();
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
            setBusy(false);
          }}
          className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
        >
          {busy ? "처리 중..." : "리뷰 확정"}
        </button>
      </div>
    </div>
  );
}
