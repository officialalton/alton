"use server";

import { requireStudentFeature } from "@/lib/feature-access";
import type { ChatMessage } from "./chat-data";

export async function sendChatMessage(
  threadId: string,
  text: string
): Promise<ChatMessage> {
  if (!text.trim()) throw new Error("메시지를 입력해주세요.");
  const { supabase } = await requireStudentFeature("teacher_chat");
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ thread_id: threadId, sender_role: "student", text: text.trim() })
    .select("id, sender_role, text, created_at")
    .single();
  if (error) throw new Error(error.message);

  return {
    id: data.id,
    senderRole: data.sender_role,
    text: data.text,
    createdAt: data.created_at,
  };
}
