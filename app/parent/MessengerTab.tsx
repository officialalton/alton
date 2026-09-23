"use client";

// R12(메신저) — 보호자 포털 "메신저" 탭. household 단위 비동기 대화만 다룬다.
// 상담 신청(건별 대화)은 MeetingRequestTab.tsx로 분리했다.
//
// 2026-09-22(사용자 지시) — household 전체가 하나로 이어지는 끝없는 대화 대신
// "문의" 단위 스레드로 바꿨다. 문의별로 카드가 있고, 열면 그 문의만의 대화가
// 보인다. 관리자가 종료하면 "지난 문의"로 넘어가 읽기 전용이 된다 — 이어서
// 문의하려면 새 문의를 시작한다.

import { useEffect, useState } from "react";
import {
  listGuardianInquiries,
  listGuardianInquiryMessages,
  startGuardianInquiry,
  sendGuardianInquiryMessage,
  markMessengerRead,
  getAssignedConsultantNameAction,
  type HouseholdInquirySummary,
  type HouseholdMessage,
} from "./inquiry-actions";

function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
}

export default function MessengerTab() {
  const [inquiries, setInquiries] = useState<HouseholdInquirySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<"open" | "closed">("open");
  const [openId, setOpenId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [consultantName, setConsultantName] = useState<string | null>(null);

  function loadInquiries() {
    listGuardianInquiries()
      .then(setInquiries)
      .catch((e) => setError(e instanceof Error ? e.message : "문의 목록을 불러오지 못했습니다."));
  }

  useEffect(() => {
    loadInquiries();
    markMessengerRead().catch(() => {});
    getAssignedConsultantNameAction()
      .then(setConsultantName)
      .catch(() => setConsultantName(null));
  }, []);

  async function handleStart() {
    if (!newBody.trim()) return;
    setStarting(true);
    setError(null);
    try {
      const { inquiryId } = await startGuardianInquiry(newBody, newSubject);
      setNewBody("");
      setNewSubject("");
      loadInquiries();
      setOpenId(inquiryId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "문의를 시작하지 못했습니다.");
    } finally {
      setStarting(false);
    }
  }

  const openInquiry = inquiries?.find((i) => i.id === openId) ?? null;
  if (openInquiry) {
    return (
      <InquiryDetail
        inquiry={openInquiry}
        onBack={() => {
          setOpenId(null);
          loadInquiries();
        }}
      />
    );
  }

  const visible = (inquiries ?? []).filter((i) => i.status === subTab);

  return (
    <div className="max-w-[720px] px-5 py-6">
      <h2 className="text-[16px] font-bold text-ink mb-1">메신저</h2>
      <p className="text-[12.5px] text-grey-500 mb-4">
        기존 자녀에 대한 일반적인 문의는 여기서{" "}
        {consultantName ? (
          <>
            담당 컨설턴트 <b className="text-ink">{consultantName}</b>님 또는 관리자에게
          </>
        ) : (
          "관리자에게"
        )}{" "}
        남길 수 있습니다. 문의마다 별도 대화창으로 관리되고, 답변을 마치고 종료하면 지난 문의로 넘어갑니다.
        구체적인 상담이 필요하면 &ldquo;상담 신청&rdquo; 탭을 이용해주세요.
      </p>

      {error && <p className="text-[12.5px] text-red mb-3">{error}</p>}

      <section className="border-[1.5px] border-grey-200 rounded-xl p-4 mb-5">
        <div className="text-[12.5px] font-bold text-grey-500 mb-2">새 문의 시작하기</div>
        <input
          value={newSubject}
          onChange={(e) => setNewSubject(e.target.value)}
          placeholder="주제(선택)"
          className="w-full mb-2 px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
        />
        <div className="flex gap-2">
          <textarea
            aria-label="새 문의 내용"
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            placeholder="문의 내용을 입력해주세요"
            className="flex-1 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px] min-h-[54px]"
          />
          <button
            type="button"
            disabled={starting || !newBody.trim()}
            onClick={handleStart}
            className="px-4 py-2 rounded-lg bg-ink text-white text-[13px] font-bold disabled:opacity-50 self-end"
          >
            문의하기
          </button>
        </div>
      </section>

      <div className="flex gap-1.5 mb-3">
        {(["open", "closed"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setSubTab(t)}
            aria-pressed={subTab === t}
            className={
              "text-[12px] font-bold px-3 py-1.5 rounded-full " +
              (subTab === t ? "bg-ink text-white" : "bg-grey-100 text-grey-600")
            }
          >
            {t === "open" ? "진행 중 문의" : "지난 문의"}
          </button>
        ))}
      </div>

      {inquiries === null && !error && <p className="text-[13px] text-grey-500">불러오는 중...</p>}
      {inquiries && visible.length === 0 && (
        <p className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          {subTab === "open" ? "진행 중인 문의가 없습니다." : "지난 문의가 없습니다."}
        </p>
      )}
      {inquiries && visible.length > 0 && (
        <ul className="border-[1.5px] border-grey-200 rounded-xl divide-y divide-grey-100">
          {visible.map((i) => (
            <li key={i.id}>
              <button
                type="button"
                onClick={() => setOpenId(i.id)}
                className="w-full text-left px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  {i.subject && <p className="text-[12.5px] font-bold text-ink truncate">{i.subject}</p>}
                  <p className="text-[13px] text-ink truncate">{i.firstMessage}</p>
                  <p className="text-[11px] text-grey-500 mt-0.5">
                    {i.status === "closed" ? `종료됨 · ${formatDateTime(i.closedAt)}` : `최근 메시지 ${formatDateTime(i.lastMessageAt)}`}
                  </p>
                </div>
                <span className="text-[11px] font-bold text-grey-400 shrink-0">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InquiryDetail({ inquiry, onBack }: { inquiry: HouseholdInquirySummary; onBack: () => void }) {
  const [messages, setMessages] = useState<HouseholdMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const readOnly = inquiry.status === "closed";

  function loadMessages() {
    listGuardianInquiryMessages(inquiry.id)
      .then(setMessages)
      .catch((e) => setError(e instanceof Error ? e.message : "메시지를 불러오지 못했습니다."));
  }

  useEffect(() => {
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquiry.id]);

  async function handleSend() {
    if (!draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      await sendGuardianInquiryMessage(inquiry.id, draft);
      setDraft("");
      loadMessages();
    } catch (e) {
      setError(e instanceof Error ? e.message : "전송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-[720px] px-5 py-6">
      <button type="button" onClick={onBack} className="text-[13px] text-grey-600 font-semibold border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 hover:bg-grey-100 active:scale-95 transition-transform mb-4">
        ← 문의 목록으로
      </button>
      {readOnly && (
        <p className="text-[12px] font-bold text-grey-500 bg-grey-100 rounded-lg px-3 py-2 mb-3">
          종료된 문의입니다({formatDateTime(inquiry.closedAt)}) — 읽기 전용이며, 이어서 문의하려면 목록에서 새 문의를 시작해주세요.
        </p>
      )}

      <section className="border-[1.5px] border-grey-200 rounded-xl p-4">
        {error && <p className="text-[12.5px] text-red mb-2">{error}</p>}
        {messages === null && !error && <p className="text-[13px] text-grey-500">불러오는 중...</p>}
        {messages && messages.length > 0 && (
          <div className="space-y-2 mb-3 max-h-[420px] overflow-y-auto">
            {messages.map((m) => {
              const isMine = m.senderRole === "guardian";
              const label =
                m.senderRole === "admin"
                  ? "관리자"
                  : m.senderRole === "consultant"
                    ? "담당 컨설턴트"
                    : m.senderRole === "student"
                      ? "자녀"
                      : "나";
              return (
                <div
                  key={m.id}
                  className={"rounded-lg px-3 py-2 text-[12.5px] max-w-[85%] " + (isMine ? "bg-ink text-white ml-auto" : "bg-grey-100 text-ink")}
                >
                  <div>{m.body}</div>
                  <div className={"text-[10.5px] mt-1 " + (isMine ? "text-white/70" : "text-grey-500")}>
                    {label} · {formatDateTime(m.createdAt)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!readOnly && (
          <div className="flex gap-2">
            <textarea
              aria-label="메시지 내용"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="메시지를 입력해주세요"
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
        )}
      </section>
    </div>
  );
}
