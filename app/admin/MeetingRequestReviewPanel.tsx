"use client";

// 2026-09-18(상담 마일스톤 2단계) — 완료된(status='completed') 상담 신청에
// 붙는 관리자 리뷰 draft/finalize/edit + 미팅록 Drive 권한 부여 패널.
// meeting-request-review-actions.ts의 RPC 래퍼만 호출한다 — 상태 전이 자체는
// DB 함수(save_meeting_request_review_draft 등)가 검사한다.

import { useEffect, useState } from "react";
import {
  getMeetingRequestReviewForAdmin,
  listMeetingRequestReviewEditsForAdmin,
  saveMeetingRequestReviewDraftAction,
  finalizeMeetingRequestReviewAction,
  editFinalizedMeetingRequestReviewAction,
  attachAndGrantMeetingReviewDriveAccess,
  type MeetingRequestReviewForAdmin,
  type MeetingRequestReviewEdit,
} from "./meeting-request-review-actions";

const DRIVE_STATUS_LABEL: Record<string, string> = {
  pending: "권한 부여 대기/실패(링크 미노출)",
  granted: "권한 부여됨(보호자 열람 가능)",
  failed: "권한 부여 실패",
};

export default function MeetingRequestReviewPanel({ meetingRequestId }: { meetingRequestId: string }) {
  const [review, setReview] = useState<MeetingRequestReviewForAdmin | null>(null);
  const [edits, setEdits] = useState<MeetingRequestReviewEdit[]>([]);
  const [text, setText] = useState("");
  const [driveFileId, setDriveFileId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEdits, setShowEdits] = useState(false);

  function reload() {
    getMeetingRequestReviewForAdmin(meetingRequestId).then((r) => {
      setReview(r);
      setText(r.status === "final" ? r.finalText ?? "" : r.draftText ?? "");
      if (r.driveAccess) setDriveFileId(r.driveAccess.driveFileId);
    });
  }

  useEffect(reload, [meetingRequestId]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  if (!review) return <p className="text-[12px] text-grey-500 mt-2">리뷰를 불러오는 중...</p>;

  const isFinal = review.status === "final";

  return (
    <div className="mt-3 border-t border-grey-200 pt-3">
      <h4 className="text-[12.5px] font-extrabold text-ink mb-1">상담 리뷰</h4>
      {error && <p className="text-[12px] text-red mb-1">{error}</p>}
      <textarea
        aria-label="상담 리뷰 내용"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full px-2.5 py-2 border-[1.5px] border-grey-200 rounded-lg text-[12.5px] min-h-[90px]"
        placeholder="학부모에게 보여줄 상담 리뷰를 작성해주세요"
      />
      <div className="flex gap-2 mt-2">
        {!isFinal && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => saveMeetingRequestReviewDraftAction(meetingRequestId, text))}
            className="text-[11.5px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 disabled:opacity-50"
          >
            초안 저장
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(() =>
              isFinal
                ? editFinalizedMeetingRequestReviewAction(meetingRequestId, text)
                : finalizeMeetingRequestReviewAction(meetingRequestId, text)
            )
          }
          className="text-[11.5px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50"
        >
          {isFinal ? "확정본 수정" : "확정하기"}
        </button>
      </div>
      {isFinal && (
        <p className="text-[11px] text-grey-500 mt-1">
          확정일 {review.finalizedAt ? new Date(review.finalizedAt).toLocaleString("ko-KR") : "-"}
          {review.adminEditedAt && ` · 최종 수정 ${new Date(review.adminEditedAt).toLocaleString("ko-KR")}`}
        </p>
      )}

      {isFinal && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => {
              setShowEdits((v) => !v);
              if (!showEdits) listMeetingRequestReviewEditsForAdmin(meetingRequestId).then(setEdits);
            }}
            className="text-[11px] font-semibold text-grey-500 underline"
          >
            {showEdits ? "수정 이력 접기" : "수정 이력 보기"}
          </button>
          {showEdits && (
            <div className="mt-1 space-y-1">
              {edits.length === 0 && <p className="text-[11px] text-grey-500">수정 이력이 없습니다(아직 확정 후 수정된 적 없음).</p>}
              {edits.map((e) => (
                <div key={e.id} className="text-[11px] text-grey-500 border-l-2 border-grey-200 pl-2">
                  {new Date(e.editedAt).toLocaleString("ko-KR")} · {e.editedByName ?? "관리자"}
                  {e.previousFinalText && <div className="text-grey-700 mt-0.5 whitespace-pre-wrap">이전 내용: {e.previousFinalText}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isFinal && (
        <div className="mt-3 border-t border-grey-200 pt-2">
          <p className="text-[12px] font-bold text-ink mb-1">미팅록(Drive) 링크</p>
          {review.driveAccess && (
            <p className="text-[11px] text-grey-500 mb-1">
              현재 상태: {DRIVE_STATUS_LABEL[review.driveAccess.status] ?? review.driveAccess.status}
              {review.driveAccess.lastError && ` — ${review.driveAccess.lastError}`}
            </p>
          )}
          <div className="flex gap-2">
            <input
              aria-label="Drive 파일 ID"
              value={driveFileId}
              onChange={(e) => setDriveFileId(e.target.value)}
              placeholder="Drive 파일 ID"
              className="flex-1 px-2.5 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12px]"
            />
            <button
              type="button"
              disabled={busy || !driveFileId.trim()}
              onClick={() =>
                run(() => attachAndGrantMeetingReviewDriveAccess({ meetingRequestId, driveFileId: driveFileId.trim() }).then(() => {}))
              }
              className="text-[11.5px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50"
            >
              연결 및 권한 부여
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
