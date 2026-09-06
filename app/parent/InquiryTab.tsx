"use client";

// R11(문의·면담) — 보호자 포털 "문의" 탭. household 메신저(문의)와 면담 일정
// 요청을 한 화면에서 다룬다. 상담(ConsultRequestTab, 신규 자녀 전용)과는 완전히
// 분리된 화면·데이터 — 여기서는 기존 자녀에 대한 일반 문의/면담만 다룬다.

import { useEffect, useRef, useState } from "react";
import ConsultSlotPicker, { type ConsultSlotPickerHandle } from "@/app/components/ConsultSlotPicker";
import {
  listGuardianHouseholdMessages,
  sendGuardianHouseholdMessage,
  listGuardianMeetingRequests,
  listGuardianChildrenForMeeting,
  listOpenGuardianMeetingSlots,
  submitMeetingRequest,
  type HouseholdMessage,
  type MeetingRequest,
} from "./inquiry-actions";

const MEETING_STATUS_LABEL: Record<string, string> = {
  requested: "일정 조율 대기",
  scheduled: "면담 확정",
  completed: "완료",
  cancelled: "취소",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
}

export default function InquiryTab() {
  const [messages, setMessages] = useState<HouseholdMessage[] | null>(null);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const [meetings, setMeetings] = useState<MeetingRequest[] | null>(null);
  const [children, setChildren] = useState<{ id: string; name: string }[]>([]);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [meetingChildId, setMeetingChildId] = useState("");
  const [meetingSubject, setMeetingSubject] = useState("");
  const [meetingSlot, setMeetingSlot] = useState("");
  const [meetingSubmitting, setMeetingSubmitting] = useState(false);
  const [meetingError, setMeetingError] = useState<string | null>(null);
  const pickerRef = useRef<ConsultSlotPickerHandle>(null);

  function loadMessages() {
    listGuardianHouseholdMessages()
      .then(setMessages)
      .catch((e) => setMessagesError(e instanceof Error ? e.message : "문의 내역을 불러오지 못했습니다."));
  }
  function loadMeetings() {
    listGuardianMeetingRequests().then(setMeetings).catch(() => setMeetings([]));
  }

  useEffect(() => {
    loadMessages();
    loadMeetings();
    listGuardianChildrenForMeeting().then(setChildren).catch(() => setChildren([]));
  }, []);

  async function handleSend() {
    if (!draft.trim()) return;
    setSending(true);
    try {
      await sendGuardianHouseholdMessage(draft);
      setDraft("");
      loadMessages();
    } catch (e) {
      setMessagesError(e instanceof Error ? e.message : "전송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  }

  async function handleSubmitMeeting() {
    setMeetingError(null);
    if (!meetingSlot) {
      setMeetingError("면담 희망 시간을 선택해주세요.");
      return;
    }
    setMeetingSubmitting(true);
    const result = await submitMeetingRequest({
      childId: meetingChildId || undefined,
      subject: meetingSubject || undefined,
      slotStartsAtIso: meetingSlot,
    });
    setMeetingSubmitting(false);
    if (!result.ok) {
      setMeetingError(result.error);
      setMeetingSlot("");
      pickerRef.current?.refetch();
      return;
    }
    setShowMeetingForm(false);
    setMeetingChildId("");
    setMeetingSubject("");
    setMeetingSlot("");
    loadMeetings();
  }

  return (
    <div className="max-w-[720px] px-5 py-6">
      <h2 className="text-[16px] font-bold text-ink mb-1">문의</h2>
      <p className="text-[12.5px] text-grey-500 mb-5">
        기존 자녀에 대한 문의는 여기서 관리자에게 메시지로 남길 수 있습니다.
        비동기 메시지만으로 해결되지 않으면 아래에서 면담 일정을 요청할 수 있습니다.
      </p>

      <section className="mb-8 border-[1.5px] border-grey-200 rounded-xl p-4">
        <h3 className="text-[13.5px] font-bold text-ink mb-3">문의 내역</h3>
        {messagesError && <p className="text-[12.5px] text-red mb-2">{messagesError}</p>}
        {messages === null && !messagesError && <p className="text-[13px] text-grey-500">불러오는 중...</p>}
        {messages && messages.length === 0 && <p className="text-[13px] text-grey-500 mb-3">아직 문의 내역이 없습니다.</p>}
        {messages && messages.length > 0 && (
          <div className="space-y-2 mb-3 max-h-[320px] overflow-y-auto">
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  "rounded-lg px-3 py-2 text-[12.5px] max-w-[85%] " +
                  (m.senderRole === "admin" ? "bg-grey-100 text-ink" : "bg-ink text-white ml-auto")
                }
              >
                <div>{m.body}</div>
                <div className={"text-[10.5px] mt-1 " + (m.senderRole === "admin" ? "text-grey-500" : "text-white/70")}>
                  {m.senderRole === "admin" ? "관리자" : "나"} · {formatDateTime(m.createdAt)}
                  {m.status === "resolved" && " · 해결됨"}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            aria-label="문의 내용"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="문의 내용을 입력해주세요"
            className="flex-1 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px] min-h-[54px]"
          />
          <button
            type="button"
            disabled={sending || !draft.trim()}
            onClick={handleSend}
            className="px-4 py-2 rounded-lg bg-ink text-white text-[13px] font-bold disabled:opacity-50 self-end"
          >
            전송
          </button>
        </div>
      </section>

      <section className="border-[1.5px] border-grey-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13.5px] font-bold text-ink">면담 일정</h3>
          <button
            type="button"
            onClick={() => setShowMeetingForm((v) => !v)}
            className="text-[12px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5"
          >
            {showMeetingForm ? "취소" : "+ 면담 요청"}
          </button>
        </div>

        {showMeetingForm && (
          <div className="mb-5 border-b border-grey-200 pb-5">
            {meetingError && <p className="text-[12.5px] text-red mb-2">{meetingError}</p>}
            <label className="block text-[12px] font-bold text-ink mb-1">
              대상 자녀(선택)
              <select
                aria-label="대상 자녀"
                value={meetingChildId}
                onChange={(e) => setMeetingChildId(e.target.value)}
                className="block w-full mt-1 px-2 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
              >
                <option value="">선택 안 함</option>
                {children.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <input
              aria-label="면담 주제"
              value={meetingSubject}
              onChange={(e) => setMeetingSubject(e.target.value)}
              placeholder="면담 주제(선택)"
              className="w-full mt-3 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
            />
            <div className="mt-3 mb-3">
              <span className="block text-[12px] font-bold text-ink mb-1.5">면담 희망 시간(60분)</span>
              <ConsultSlotPicker
                ref={pickerRef}
                fetchSlots={listOpenGuardianMeetingSlots}
                selectedStartsAt={meetingSlot || null}
                onSelect={setMeetingSlot}
              />
            </div>
            <button
              type="button"
              disabled={meetingSubmitting}
              onClick={handleSubmitMeeting}
              className="px-6 py-2.5 rounded-xl bg-red text-white text-[13px] font-bold disabled:opacity-50"
            >
              {meetingSubmitting ? "요청 중..." : "면담 요청하기"}
            </button>
          </div>
        )}

        {meetings === null && <p className="text-[13px] text-grey-500">불러오는 중...</p>}
        {meetings && meetings.length === 0 && <p className="text-[13px] text-grey-500">신청한 면담이 없습니다.</p>}
        {meetings && meetings.length > 0 && (
          <div className="space-y-2">
            {meetings.map((m) => (
              <div key={m.id} className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold text-ink">{MEETING_STATUS_LABEL[m.status] ?? m.status}</span>
                  <span className="text-[11px] text-grey-500">신청일 {formatDateTime(m.createdAt)}</span>
                </div>
                {m.childName && <div className="text-[12px] text-grey-500 mt-1">대상: {m.childName}</div>}
                {m.subject && <div className="text-[12px] text-grey-500 mt-0.5">주제: {m.subject}</div>}
                {m.startsAt && <div className="text-[12px] text-grey-500 mt-0.5">🗓 {formatDateTime(m.startsAt)}</div>}
                {m.googleMeetLink && (
                  <a href={m.googleMeetLink} target="_blank" rel="noreferrer" className="inline-block mt-1 text-[12px] font-semibold text-ink underline">
                    Google Meet 링크
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
