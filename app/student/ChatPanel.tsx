"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { sendChatMessage } from "./chat-actions";
import type { ChatMessage } from "./chat-data";

export default function ChatPanel({
  threadId,
  teacherName,
  initialMessages,
  onBack,
}: {
  threadId: string;
  teacherName: string;
  initialMessages: ChatMessage[];
  onBack: () => void;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`chat:${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            sender_role: "teacher" | "student";
            text: string;
            created_at: string;
          };
          setMessages((prev) =>
            prev.some((m) => m.id === row.id)
              ? prev
              : [
                  ...prev,
                  {
                    id: row.id,
                    senderRole: row.sender_role,
                    text: row.text,
                    createdAt: row.created_at,
                  },
                ]
          );
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const sent = await sendChatMessage(threadId, text.trim());
      setMessages((prev) =>
        prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]
      );
      setText("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-[560px] px-8 py-8 flex flex-col h-screen">
      <button onClick={onBack} className="text-[13px] text-grey-500 font-semibold mb-4">
        ← 뒤로
      </button>
      <h1 className="text-[16px] font-extrabold text-ink mb-1">
        {teacherName}과의 메시지
      </h1>
      <p className="text-[11.5px] text-grey-500 mb-4">
        이 대화는 학부모님과 관리자가 항상 열람할 수 있습니다.
      </p>

      <div className="flex-1 overflow-y-auto mb-4 min-h-0">
        {messages.length === 0 ? (
          <p className="text-[13px] text-grey-500 text-center py-8">
            아직 주고받은 메시지가 없습니다.
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={
                "mb-2.5 flex " +
                (m.senderRole === "student" ? "justify-end" : "justify-start")
              }
            >
              <div
                className={
                  "max-w-[75%] px-3.5 py-2.5 rounded-2xl text-[13px] " +
                  (m.senderRole === "student"
                    ? "bg-ink text-white"
                    : "bg-grey-100 text-ink")
                }
              >
                <div className="text-[10px] font-bold opacity-60 mb-0.5">
                  {m.senderRole === "student" ? "나" : "선생님"}
                </div>
                {m.text}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          placeholder="메시지를 입력하세요"
          className="flex-1 px-3.5 py-2.5 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
        />
        <button
          disabled={!text.trim() || sending}
          onClick={handleSend}
          className="text-[13px] font-bold px-4 py-2.5 rounded-lg bg-ink text-white disabled:opacity-50"
        >
          전송
        </button>
      </div>
    </div>
  );
}
