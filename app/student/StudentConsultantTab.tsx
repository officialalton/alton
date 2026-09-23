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

const MEETING_STATUS_LABEL: Record<string, string> = {
  requested: "신청됨",
  confirming: "확인 중",
  scheduling: "일정 조율 중",
  scheduled: "일정 확정",
  completed: "완료",
  cancelled: "취소됨",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
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
      {consultant && <p className="text-[12.5px] text-grey-500 mb-4">담당 컨설턴트: {consultant.name ?? "이름 미입력"}</p>}
      <PillSubTabs
        items={[
          { id: "messenger", label: "메신저" },
          { id: "schedule", label: "일정 잡기" },
          { id: "history", label: "신청 내역" },
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

  if (consultant === undefined) return <p className="text-[13px] text-grey-500">불러오는 중...</p>;
  if (consultant === null) {
    return (
      <p className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
        아직 담당 컨설턴트가 배정되지 않았습니다.
      </p>
    );
  }

  async function handleSubmit() {
    setError(null);
    if (!slotStartsAt) {
      setError("희망 시간을 먼저 선택해주세요.");
      return;
    }
    if (!reason.trim()) {
      setError("상담 사유를 입력해주세요.");
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
        담당 컨설턴트의 가능 시간 중 하나를 선택하고 사유를 적어 신청합니다. 신청 후 컨설턴트가 확인하고
        확정해줍니다 — 확정 전까지는 &ldquo;신청 내역&rdquo;에서 대기 상태로 표시됩니다.
      </p>

      <section className="border-[1.5px] border-grey-200 rounded-xl p-4 mb-5">
        <h3 className="text-[13.5px] font-bold text-ink mb-3">희망 시간(60분)</h3>
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
        {submitted && <p className="text-[12.5px] text-green-600 mb-2">신청이 접수되었습니다.</p>}
        <textarea
          aria-label="상담 사유"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setSubmitted(false);
          }}
          placeholder="상담 사유를 입력해주세요"
          className="w-full px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px] min-h-[120px]"
        />
        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          className="mt-3 px-6 py-2.5 rounded-xl bg-red text-white text-[13px] font-bold disabled:opacity-50"
        >
          {submitting ? "신청 중..." : "신청하기"}
        </button>
      </section>
    </div>
  );
}

function CompletedReview({ meetingRequestId }: { meetingRequestId: string }) {
  const [review, setReview] = useState<GuardianMeetingRequestReview | null | undefined>(undefined);

  useEffect(() => {
    getMyConsultantMeetingRequestReviewAction(meetingRequestId)
      .then(setReview)
      .catch(() => setReview(null));
  }, [meetingRequestId]);

  if (review === undefined) return <p className="text-[12px] text-grey-500 mt-2">리뷰를 불러오는 중...</p>;
  if (review === null) return <p className="text-[12px] text-grey-500 mt-2">아직 확정된 리뷰가 없습니다.</p>;

  return (
    <div className="mt-2 border-t border-grey-200 pt-2">
      <h4 className="text-[12px] font-bold text-ink mb-1">상담 리뷰</h4>
      <p className="text-[12.5px] text-ink whitespace-pre-wrap">{review.finalText}</p>
      {review.finalizedAt && <p className="text-[11px] text-grey-500 mt-1">확정일 {formatDateTime(review.finalizedAt)}</p>}
      {review.driveLink && (
        <a
          href={`https://drive.google.com/file/d/${review.driveLink.driveFileId}/view`}
          target="_blank"
          rel="noreferrer"
          className="inline-block mt-2 text-[12px] font-semibold text-ink underline"
        >
          미팅록 보기
        </a>
      )}
    </div>
  );
}

function MeetingHistoryPanel() {
  const [meetings, setMeetings] = useState<MeetingRequest[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    listMyConsultantMeetingRequestsAction().then(setMeetings).catch(() => setMeetings([]));
  }, []);

  return (
    <div>
      {meetings === null && <p className="text-[13px] text-grey-500">불러오는 중...</p>}
      {meetings && meetings.length === 0 && (
        <p className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">신청한 일정이 없습니다.</p>
      )}
      {meetings && meetings.length > 0 && (
        <div className="space-y-2">
          {meetings.map((m) => (
            <div key={m.id} className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-ink">{MEETING_STATUS_LABEL[m.status] ?? m.status}</span>
                <span className="text-[11px] text-grey-500">신청일 {formatDateTime(m.createdAt)}</span>
              </div>
              {m.content && <div className="text-[12px] text-grey-500 mt-0.5">사유: {m.content}</div>}
              {m.startsAt && <div className="text-[12px] text-grey-500 mt-0.5">🗓 {formatDateTime(m.startsAt)}</div>}
              {m.googleMeetLink && (
                <a
                  href={m.googleMeetLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block mt-1 text-[12px] font-semibold text-ink underline"
                >
                  Google Meet 링크
                </a>
              )}
              {m.status === "completed" && (
                <>
                  <button
                    type="button"
                    onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
                    className="mt-2 text-[11.5px] font-bold text-ink underline block"
                  >
                    {expandedId === m.id ? "리뷰 접기" : "리뷰 보기"}
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
