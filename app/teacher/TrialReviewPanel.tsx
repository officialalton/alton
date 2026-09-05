"use client";

// M4 — 선생님이 완료된 체험 수업의 고객용 리뷰를 작성·확정하는 패널.
// Smart Notes 원본(Drive 링크/AI 회의록)은 여기서 다루지 않는다 — 세션뷰에서
// 검토한 뒤 그 결과로 만든 텍스트만 이 화면에 입력한다. 초안 저장(비공개)과
// 고객 공개 확정을 명확히 구분하고, 확정 전에 "보호자·학생 화면에는 이렇게
// 보입니다"를 미리 볼 수 있게 한다.

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
        초안 저장은 비공개입니다(본인만 확인 가능). <b>공개 확정</b>을 눌러야 보호자·학생
        화면에 노출됩니다 — 확정 전에는 아무도 볼 수 없습니다.
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
  const [showPreview, setShowPreview] = useState(false);
  const [confirmingFinalize, setConfirmingFinalize] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = `trial-review-${session.sessionId}`;

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5">
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

      <label htmlFor={inputId} className="block text-[11.5px] font-semibold text-grey-500 mb-1">
        고객에게 보여줄 체험 리뷰
      </label>
      <textarea
        id={inputId}
        className="w-full border border-grey-300 rounded px-2 py-1.5 text-[13px]"
        rows={4}
        placeholder="예: 기초 개념 이해도가 우수하고, 문제 풀이 속도가 빠릅니다. 정규 진행을 추천합니다."
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setConfirmingFinalize(false);
        }}
      />
      {error && <div className="text-[12px] text-red mt-1" role="alert">{error}</div>}

      <div className="flex items-center gap-2 mt-2">
        <button
          disabled={busy || text.trim().length === 0}
          aria-busy={busy}
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
          초안 저장(비공개)
        </button>
        <button
          type="button"
          disabled={text.trim().length === 0}
          onClick={() => setShowPreview((v) => !v)}
          className="text-[12px] font-semibold px-3 py-1.5 rounded-lg text-ink underline disabled:opacity-50 disabled:no-underline"
        >
          {showPreview ? "미리보기 닫기" : "고객 화면 미리보기"}
        </button>
      </div>

      {showPreview && (
        <div className="mt-2.5 bg-grey-50 rounded-lg px-3 py-2.5 border border-grey-200">
          <div className="text-[11px] font-bold text-grey-500 mb-1">보호자·학생 화면에는 이렇게 보입니다</div>
          <p className="text-[12.5px] text-ink whitespace-pre-wrap">{text}</p>
        </div>
      )}

      {!confirmingFinalize ? (
        <button
          disabled={busy || text.trim().length === 0}
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
                  // finalize_trial_lesson_review()는 trial_lesson_reviews 행이 먼저
                  // 있어야 한다("먼저 초안을 저장해야 합니다") — "공개 확정"을 누르기
                  // 전에 반드시 "초안 저장"을 따로 눌러야 했던 게 불필요한 2단계였다.
                  // 지금 입력된 텍스트를 초안으로 먼저 저장한 뒤 바로 확정한다.
                  await saveTrialLessonReviewDraft({ sessionId: session.sessionId, draftText: text });
                  await finalizeTrialLessonReview({ sessionId: session.sessionId, finalText: text });
                  onSaved();
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
