"use client";

// R12(상담 신청·메신저 V1) — 보호자 포털 "상담 신청" 탭. 구조화된 상담 요청
// (meeting_requests, 구 "면담")만 다룬다. 일반 대화는 MessengerTab에서 다룬다.
// 상담(신규 자녀, ConsultRequestTab)과는 완전히 분리된 화면·데이터.

import { useEffect, useRef, useState } from "react";
import ConsultSlotPicker, { type ConsultSlotPickerHandle } from "@/app/components/ConsultSlotPicker";
import {
  listGuardianMeetingRequests,
  listGuardianChildrenForMeeting,
  listOpenGuardianMeetingSlots,
  submitMeetingRequest,
  listMeetingRequestMessages,
  sendMeetingRequestMessage,
  type MeetingRequest,
  type MeetingRequestMessage,
} from "./inquiry-actions";

const MEETING_STATUS_LABEL: Record<string, string> = {
  requested: "신청됨",
  confirming: "확인 중",
  scheduling: "일정 조율 중",
  scheduled: "일정 확정",
  completed: "완료",
  cancelled: "취소",
};

const CONTACT_PREFERENCE_LABEL: Record<string, string> = {
  phone: "전화",
  message: "메시지",
  either: "둘 다 가능",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
}

function ConsultationThread({ meetingRequestId }: { meetingRequestId: string }) {
  const [messages, setMessages] = useState<MeetingRequestMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  function load() {
    listMeetingRequestMessages(meetingRequestId)
      .then(setMessages)
      .catch((e) => setError(e instanceof Error ? e.message : "대화를 불러오지 못했습니다."));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingRequestId]);

  async function handleSend() {
    if (!draft.trim()) return;
    setSending(true);
    try {
      await sendMeetingRequestMessage(meetingRequestId, draft);
      setDraft("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "전송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-3 border-t border-grey-200 pt-3">
      <h4 className="text-[12px] font-bold text-ink mb-2">관리자 답변·일정 확인</h4>
      {error && <p className="text-[12px] text-red mb-2">{error}</p>}
      {messages === null && !error && <p className="text-[12px] text-grey-500">불러오는 중...</p>}
      {messages && messages.length === 0 && <p className="text-[12px] text-grey-500 mb-2">아직 대화가 없습니다.</p>}
      {messages && messages.length > 0 && (
        <div className="space-y-1.5 mb-2 max-h-[240px] overflow-y-auto">
          {messages.map((m) => (
            <div
              key={m.id}
              className={
                "rounded-lg px-3 py-2 text-[12px] max-w-[90%] " +
                (m.senderRole === "admin" ? "bg-grey-100 text-ink" : "bg-ink text-white ml-auto")
              }
            >
              <div>{m.body}</div>
              <div className={"text-[10px] mt-1 " + (m.senderRole === "admin" ? "text-grey-500" : "text-white/70")}>
                {m.senderRole === "admin" ? "관리자" : "나"} · {formatDateTime(m.createdAt)}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <textarea
          aria-label="상담 신청 메시지"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="추가로 전달할 내용을 입력해주세요"
          className="flex-1 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[12px] min-h-[44px]"
        />
        <button
          type="button"
          disabled={sending || !draft.trim()}
          onClick={handleSend}
          className="px-3 py-2 rounded-lg bg-ink text-white text-[12px] font-bold disabled:opacity-50 self-end"
        >
          전송
        </button>
      </div>
    </div>
  );
}

export default function ConsultationRequestTab() {
  const [meetings, setMeetings] = useState<MeetingRequest[] | null>(null);
  const [children, setChildren] = useState<{ id: string; name: string }[]>([]);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [meetingChildId, setMeetingChildId] = useState("");
  const [meetingSubject, setMeetingSubject] = useState("");
  const [meetingContent, setMeetingContent] = useState("");
  const [meetingContactPreference, setMeetingContactPreference] = useState<"phone" | "message" | "either" | "">("");
  const [meetingContactTime, setMeetingContactTime] = useState("");
  const [meetingSlot, setMeetingSlot] = useState("");
  const [meetingSubmitting, setMeetingSubmitting] = useState(false);
  const [meetingError, setMeetingError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const pickerRef = useRef<ConsultSlotPickerHandle>(null);

  function loadMeetings() {
    listGuardianMeetingRequests().then(setMeetings).catch(() => setMeetings([]));
  }

  useEffect(() => {
    loadMeetings();
    listGuardianChildrenForMeeting().then(setChildren).catch(() => setChildren([]));
  }, []);

  async function handleSubmitMeeting() {
    setMeetingError(null);
    if (!meetingContent.trim()) {
      setMeetingError("상담 내용을 입력해주세요.");
      return;
    }
    setMeetingSubmitting(true);
    const result = await submitMeetingRequest({
      childId: meetingChildId || undefined,
      subject: meetingSubject || undefined,
      content: meetingContent,
      contactPreference: meetingContactPreference || undefined,
      preferredContactTime: meetingContactTime || undefined,
      slotStartsAtIso: meetingSlot || undefined,
    });
    setMeetingSubmitting(false);
    if (!result.ok) {
      setMeetingError(result.error);
      return;
    }
    setShowMeetingForm(false);
    setMeetingChildId("");
    setMeetingSubject("");
    setMeetingContent("");
    setMeetingContactPreference("");
    setMeetingContactTime("");
    setMeetingSlot("");
    loadMeetings();
  }

  return (
    <div className="max-w-[720px] px-5 py-6">
      <h2 className="text-[16px] font-bold text-ink mb-1">상담 신청</h2>
      <p className="text-[12.5px] text-grey-500 mb-5">
        기존 자녀에 대해 구조화된 상담을 신청할 수 있습니다. 일반적인 대화는 메신저를 이용해주세요.
      </p>

      <section className="border-[1.5px] border-grey-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13.5px] font-bold text-ink">상담 신청 내역</h3>
          <button
            type="button"
            onClick={() => setShowMeetingForm((v) => !v)}
            className="text-[12px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5"
          >
            {showMeetingForm ? "취소" : "+ 상담 신청"}
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
              aria-label="상담 주제"
              value={meetingSubject}
              onChange={(e) => setMeetingSubject(e.target.value)}
              placeholder="상담 주제(선택)"
              className="w-full mt-3 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
            />
            <textarea
              aria-label="상담 내용"
              value={meetingContent}
              onChange={(e) => setMeetingContent(e.target.value)}
              placeholder="상담 내용을 입력해주세요"
              className="w-full mt-3 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px] min-h-[70px]"
            />
            <label className="block text-[12px] font-bold text-ink mb-1 mt-3">
              희망 연락 방식(선택)
              <select
                aria-label="희망 연락 방식"
                value={meetingContactPreference}
                onChange={(e) => setMeetingContactPreference(e.target.value as "phone" | "message" | "either" | "")}
                className="block w-full mt-1 px-2 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
              >
                <option value="">선택 안 함</option>
                <option value="phone">전화</option>
                <option value="message">메시지</option>
                <option value="either">둘 다 가능</option>
              </select>
            </label>
            <input
              aria-label="희망 연락 시간대"
              value={meetingContactTime}
              onChange={(e) => setMeetingContactTime(e.target.value)}
              placeholder="희망 연락 시간대(선택, 예: 평일 오후)"
              className="w-full mt-3 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
            />
            <div className="mt-3 mb-3">
              <span className="block text-[12px] font-bold text-ink mb-1.5">면담 일정(선택, 60분)</span>
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
              {meetingSubmitting ? "신청 중..." : "상담 신청하기"}
            </button>
          </div>
        )}

        {meetings === null && <p className="text-[13px] text-grey-500">불러오는 중...</p>}
        {meetings && meetings.length === 0 && <p className="text-[13px] text-grey-500">신청한 상담이 없습니다.</p>}
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
                {m.content && <div className="text-[12px] text-grey-500 mt-0.5">내용: {m.content}</div>}
                {m.contactPreference && (
                  <div className="text-[12px] text-grey-500 mt-0.5">
                    희망 연락: {CONTACT_PREFERENCE_LABEL[m.contactPreference] ?? m.contactPreference}
                    {m.preferredContactTime ? ` · ${m.preferredContactTime}` : ""}
                  </div>
                )}
                {m.startsAt && <div className="text-[12px] text-grey-500 mt-0.5">🗓 {formatDateTime(m.startsAt)}</div>}
                {m.googleMeetLink && (
                  <a href={m.googleMeetLink} target="_blank" rel="noreferrer" className="inline-block mt-1 text-[12px] font-semibold text-ink underline">
                    Google Meet 링크
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
                  className="mt-2 text-[11.5px] font-bold text-ink underline"
                >
                  {expandedId === m.id ? "대화 접기" : "관리자 답변·일정 확인"}
                </button>
                {expandedId === m.id && <ConsultationThread meetingRequestId={m.id} />}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
