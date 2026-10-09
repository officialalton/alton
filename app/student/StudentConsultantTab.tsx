"use client";

// 2026-09-22(사용자 지시 — "학생이 컨설턴트랑 일정 잡는 것도 UI 필요하겠다") —
// 학생 포털 "Consultant" 탭을 메신저/일정 잡기/신청 내역 세 서브탭으로 구성한다
// (학부모 포털 Consultations의 메신저/상담 신청/상담 내역과 동일 구조,
// 대상만 담당 컨설턴트 개인 일정으로 좁혔다).

import { useEffect, useState } from "react";
import PillSubTabs from "@/app/components/PillSubTabs";
import ConsultSlotPicker from "@/app/components/ConsultSlotPicker";
import StudentConsultantMessengerTab from "./StudentConsultantMessengerTab";
import {
  getMyAssignedConsultantAction,
  listOpenSlotsForMyConsultantAction,
  submitMyConsultantMeetingRequestAction,
  listMyConsultantMeetingRequestsAction,
  getMyConsultantMeetingRequestReviewAction,
  type MyAssignedConsultant,
} from "./consultant-schedule-actions";
import type { MeetingRequest, GuardianMeetingRequestReview } from "@/app/parent/inquiry-actions";
import { useViewerTimezone } from "@/app/components/ViewerTimezoneProvider";
import { fmtDateTimeEn } from "@/lib/format-datetime-en";

const MEETING_STATUS_LABEL: Record<string, string> = {
  requested: "Requested",
  confirming: "Under review",
  scheduling: "Scheduling",
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

function formatDateTime(iso: string | null, tz: string): string {
  if (!iso) return "";
  return fmtDateTimeEn(iso, { dateStyle: "medium", timeStyle: "short" }, tz);
}

export default function StudentConsultantTab() {
  const [subTab, setSubTab] = useState<"messenger" | "schedule" | "history">("messenger");
  const [consultant, setConsultant] = useState<MyAssignedConsultant | null | undefined>(undefined);

  useEffect(() => {
    getMyAssignedConsultantAction()
      .then(setConsultant)
      .catch(() => setConsultant(null));
  }, []);

  return (
    <div className="max-w-[720px] px-8 py-8">
      <h1 className="text-[18px] font-extrabold text-ink mb-1">Consultant</h1>
      {consultant && <p className="text-[12.5px] text-grey-500 mb-4">Your consultant: {consultant.name ?? "Name not set"}</p>}
      <PillSubTabs
        items={[
          { id: "messenger", label: "Messenger" },
          { id: "schedule", label: "Schedule" },
          { id: "history", label: "Requests" },
        ]}
        activeId={subTab}
        onSelect={setSubTab}
        className="mb-5"
      />

      {subTab === "messenger" ? (
        <StudentConsultantMessengerTab />
      ) : subTab === "schedule" ? (
        <ScheduleRequestPanel consultant={consultant} />
      ) : (
        <MeetingHistoryPanel />
      )}
    </div>
  );
}

function ScheduleRequestPanel({ consultant }: { consultant: MyAssignedConsultant | null | undefined }) {
  const [slotStartsAt, setSlotStartsAt] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (consultant === undefined) return <p className="text-[13px] text-grey-500">Loading...</p>;
  if (consultant === null) {
    return (
      <p className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
        A consultant hasn&apos;t been assigned yet.
      </p>
    );
  }

  async function handleSubmit() {
    setError(null);
    if (!slotStartsAt) {
      setError("Please select a preferred time first.");
      return;
    }
    if (!reason.trim()) {
      setError("Please enter a reason for the consultation.");
      return;
    }
    setSubmitting(true);
    const result = await submitMyConsultantMeetingRequestAction({
      consultantId: consultant!.id,
      reason,
      slotStartsAtIso: slotStartsAt,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSlotStartsAt(null);
    setReason("");
    setSubmitted(true);
  }

  return (
    <div>
      <p className="text-[12.5px] text-grey-500 mb-4">
        Pick one of your consultant&apos;s available times and add a reason. Your consultant will review and
        confirm — until then it shows as pending under &ldquo;Requests&rdquo;.
      </p>

      <section className="border-[1.5px] border-grey-200 rounded-xl p-4 mb-5">
        <h3 className="text-[13.5px] font-bold text-ink mb-3">Preferred time (60 min)</h3>
        <ConsultSlotPicker
          fetchSlots={(fromIso, toIso) => listOpenSlotsForMyConsultantAction(consultant!.id, fromIso, toIso)}
          selectedStartsAt={slotStartsAt}
          onSelect={(iso) => {
            setSlotStartsAt(iso);
            setSubmitted(false);
          }}
        />
      </section>

      <section className="border-[1.5px] border-grey-200 rounded-xl p-4">
        {error && <p className="text-[12.5px] text-red mb-2">{error}</p>}
        {submitted && <p className="text-[12.5px] text-green-600 mb-2">Your request has been submitted.</p>}
        <textarea
          aria-label="Reason for consultation"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setSubmitted(false);
          }}
          placeholder="Enter a reason for the consultation"
          className="w-full px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px] min-h-[120px]"
        />
        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          className="mt-3 px-6 py-2.5 rounded-xl bg-red text-white text-[13px] font-bold disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit request"}
        </button>
      </section>
    </div>
  );
}

function CompletedReview({ meetingRequestId }: { meetingRequestId: string }) {
  const tz = useViewerTimezone();
  const [review, setReview] = useState<GuardianMeetingRequestReview | null | undefined>(undefined);

  useEffect(() => {
    getMyConsultantMeetingRequestReviewAction(meetingRequestId)
      .then(setReview)
      .catch(() => setReview(null));
  }, [meetingRequestId]);

  if (review === undefined) return <p className="text-[12px] text-grey-500 mt-2">Loading review...</p>;
  if (review === null) return <p className="text-[12px] text-grey-500 mt-2">No finalized review yet.</p>;

  return (
    <div className="mt-2 border-t border-grey-200 pt-2">
      <h4 className="text-[12px] font-bold text-ink mb-1">Consultation Review</h4>
      <p className="text-[12.5px] text-ink whitespace-pre-wrap">{review.finalText}</p>
      {review.finalizedAt && <p className="text-[11px] text-grey-500 mt-1">Finalized {formatDateTime(review.finalizedAt, tz)}</p>}
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

function MeetingHistoryPanel() {
  const tz = useViewerTimezone();
  const [meetings, setMeetings] = useState<MeetingRequest[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    listMyConsultantMeetingRequestsAction().then(setMeetings).catch(() => setMeetings([]));
  }, []);

  return (
    <div>
      {meetings === null && <p className="text-[13px] text-grey-500">Loading...</p>}
      {meetings && meetings.length === 0 && (
        <p className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">No requests yet.</p>
      )}
      {meetings && meetings.length > 0 && (
        <div className="space-y-2">
          {meetings.map((m) => (
            <div key={m.id} className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-ink">{MEETING_STATUS_LABEL[m.status] ?? m.status}</span>
                <span className="text-[11px] text-grey-500">Requested {formatDateTime(m.createdAt, tz)}</span>
              </div>
              {m.content && <div className="text-[12px] text-grey-500 mt-0.5">Reason: {m.content}</div>}
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
    </div>
  );
}
