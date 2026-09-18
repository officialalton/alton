"use client";

// R12(메신저) — 보호자 포털 "메신저" 탭. household 단위 비동기 대화만 다룬다.
// 상담 신청(건별 대화)은 MeetingRequestTab.tsx로 분리했다.

import { useEffect, useState } from "react";
import {
  listGuardianHouseholdMessages,
  sendGuardianHouseholdMessage,
  markMessengerRead,
  type HouseholdMessage,
} from "./inquiry-actions";

function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
}

export default function MessengerTab() {
  const [messages, setMessages] = useState<HouseholdMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  function loadMessages() {
    listGuardianHouseholdMessages()
      .then(setMessages)
      .catch((e) => setError(e instanceof Error ? e.message : "메시지를 불러오지 못했습니다."));
  }

  useEffect(() => {
    loadMessages();
    // 탭을 열면 읽음으로 표시한다(실패해도 화면 표시에는 영향 없음).
    markMessengerRead().catch(() => {});
  }, []);

  async function handleSend() {
    if (!draft.trim()) return;
    setSending(true);
    try {
      await sendGuardianHouseholdMessage(draft);
      setDraft("");
      loadMessages();
      markMessengerRead().catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "전송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-[720px] px-5 py-6">
      <h2 className="text-[16px] font-bold text-ink mb-1">메신저</h2>
      <p className="text-[12.5px] text-grey-500 mb-5">
        기존 자녀에 대한 일반적인 문의는 여기서 관리자에게 메시지로 남길 수 있습니다.
        구체적인 상담이 필요하면 &ldquo;상담 신청&rdquo; 탭을 이용해주세요.
      </p>

      <section className="border-[1.5px] border-grey-200 rounded-xl p-4">
        {error && <p className="text-[12.5px] text-red mb-2">{error}</p>}
        {messages === null && !error && <p className="text-[13px] text-grey-500">불러오는 중...</p>}
        {messages && messages.length === 0 && <p className="text-[13px] text-grey-500 mb-3">아직 메시지가 없습니다.</p>}
        {messages && messages.length > 0 && (
          <div className="space-y-2 mb-3 max-h-[420px] overflow-y-auto">
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
      </section>
    </div>
  );
}
