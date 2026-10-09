"use client";

// R12.1 — 보호자 포털 "상담 내역" 서브탭. 신청 목록/상태 + 완료된 상담의 확정
// 리뷰와(권한이 실제로 확인된 경우에만) 미팅록 링크를 보여준다. 대화는
// household_messages(메신저)에서만 다룬다 — 여기서 meeting_request_messages를
// 노출하지 않는다.

import { useEffect, useState } from "react";
import {
  listGuardianMeetingRequests,
  getGuardianMeetingRequestReview,
  type MeetingRequest,
  type GuardianMeetingRequestReview,
} from "./inquiry-actions";
import { useViewerTimezone } from "@/app/components/ViewerTimezoneProvider";
import { fmtDateTimeEn as fmtDateTime } from "@/lib/format-datetime-en";

const MEETING_STATUS_LABEL: Record<string, string> = {
  requested: "Requested",
  confirming: "Confirming",
  scheduling: "Scheduling",
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

function formatDateTime(iso: string | null, tz: string): string {
  if (!iso) return "";
  return fmtDateTime(iso, { dateStyle: "medium", timeStyle: "short" }, tz);
}

function CompletedReview({ meetingRequestId }: { meetingRequestId: string }) {
  const tz = useViewerTimezone();
  const [review, setReview] = useState<GuardianMeetingRequestReview | null | undefined>(undefined);

  useEffect(() => {
    getGuardianMeetingRequestReview(meetingRequestId)
      .then(setReview)
      .catch(() => setReview(null));
  }, [meetingRequestId]);

  if (review === undefined) return <p className="text-[12px] text-grey-500 mt-2">Loading review...</p>;
  if (review === null) return <p className="text-[12px] text-grey-500 mt-2">No finalized review yet.</p>;

  return (
    <div className="mt-2 border-t border-grey-200 pt-2">
      <h4 className="text-[12px] font-bold text-ink mb-1">Consultation Review</h4>
      <p className="text-[12.5px] text-ink whitespace-pre-wrap">{review.finalText}</p>
      {review.finalizedAt && (
        <p className="text-[11px] text-grey-500 mt-1">Finalized {formatDateTime(review.finalizedAt, tz)}</p>
      )}
      {/* 미팅록 링크는 권한 부여가 실제로 granted로 확인된 경우에만 노출한다.
          없거나 pending/failed면 아무것도 표시하지 않는다(스펙 요구사항). */}
      {review.driveLink && (
        <a
          href={`https://drive.google.com/file/d/${review.driveLink.driveFileId}/view`}
          target="_blank"
          rel="noreferrer"
          className="inline-block mt-2 text-[12px] font-semibold text-ink underline"
        >
          View meeting record
        </a>
      )}
    </div>
  );
}

export default function ConsultationHistoryTab() {
  const tz = useViewerTimezone();
  const [meetings, setMeetings] = useState<MeetingRequest[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    listGuardianMeetingRequests().then(setMeetings).catch(() => setMeetings([]));
  }, []);

  return (
    <div className="max-w-[720px] px-5 py-6">
      <h2 className="text-[16px] font-bold text-ink mb-1">Consultation History</h2>
      <p className="text-[12.5px] text-grey-500 mb-5">
        Track the status of your consultation requests. Completed consultations include the finalized review.
      </p>

      <section className="border-[1.5px] border-grey-200 rounded-xl p-4">
        {meetings === null && <p className="text-[13px] text-grey-500">Loading...</p>}
        {meetings && meetings.length === 0 && <p className="text-[13px] text-grey-500">No consultation requests yet.</p>}
        {meetings && meetings.length > 0 && (
          <div className="space-y-2">
            {meetings.map((m) => (
              <div key={m.id} className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold text-ink">{MEETING_STATUS_LABEL[m.status] ?? m.status}</span>
                  <span className="text-[11px] text-grey-500">Requested {formatDateTime(m.createdAt, tz)}</span>
                </div>
                {m.content && <div className="text-[12px] text-grey-500 mt-0.5">Topic: {m.content}</div>}
                {m.startsAt && <div className="text-[12px] text-grey-500 mt-0.5">🗓 {formatDateTime(m.startsAt, tz)}</div>}
                {m.googleMeetLink && (
                  <a
                    href={m.googleMeetLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block mt-1 text-[12px] font-semibold text-ink underline"
                  >
                    Google Meet link
                  </a>
                )}
                {m.status === "completed" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
                      className="mt-2 text-[11.5px] font-bold text-ink underline block"
                    >
                      {expandedId === m.id ? "Hide review" : "View review"}
                    </button>
                    {expandedId === m.id && <CompletedReview meetingRequestId={m.id} />}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
