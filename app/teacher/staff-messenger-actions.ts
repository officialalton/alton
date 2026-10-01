"use server";

// 관리자 포털 정리 항목 2(2026-09-23) — 선생님 쪽 관리자<->선생님 내부 채널.
// app/consultant/staff-messenger-actions.ts와 완전히 같은 패턴, 별도 테이블
// (teacher_admin_inquiries/_messages)만 다룬다.

import { requireUser } from "@/lib/auth";

export type TeacherAdminInquiry = {
  id: string;
  status: "open" | "closed";
  subject: string | null;
  createdAt: string;
  lastMessageAt: string;
  closedAt: string | null;
};

export type TeacherAdminMessage = {
  id: string;
  senderId: string;
  senderRole: "teacher" | "admin";
  body: string;
  createdAt: string;
};

export async function listMyTeacherStaffInquiriesAction(): Promise<TeacherAdminInquiry[]> {
  const { user, supabase } = await requireUser();
  const { data, error } = await supabase
    .from("teacher_admin_inquiries")
    .select("id, status, subject, created_at, last_message_at, closed_at")
    .eq("teacher_id", user.id)
    .order("last_message_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    subject: r.subject,
    createdAt: r.created_at,
    lastMessageAt: r.last_message_at,
    closedAt: r.closed_at,
  }));
}

export async function startMyTeacherStaffInquiryAction(body: string, subject?: string): Promise<{ inquiryId: string }> {
  const { user, supabase } = await requireUser();
  if (!body.trim()) throw new Error("내용을 입력해주세요.");
  const { data: inquiry, error: inquiryError } = await supabase
    .from("teacher_admin_inquiries")
    .insert({ teacher_id: user.id, opened_by: user.id, opened_by_role: "teacher", subject: subject?.trim() || null })
    .select("id")
    .single();
  if (inquiryError) throw new Error(inquiryError.message);
  const { error } = await supabase.from("teacher_admin_messages").insert({
    inquiry_id: inquiry.id,
    sender_id: user.id,
    sender_role: "teacher",
    body: body.trim(),
  });
  if (error) throw new Error(error.message);
  return { inquiryId: inquiry.id as string };
}

export async function listMyTeacherStaffMessagesAction(inquiryId: string): Promise<TeacherAdminMessage[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("teacher_admin_messages")
    .select("id, sender_id, sender_role, body, created_at")
    .eq("inquiry_id", inquiryId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ id: r.id, senderId: r.sender_id, senderRole: r.sender_role, body: r.body, createdAt: r.created_at }));
}

export async function sendMyTeacherStaffMessageAction(inquiryId: string, body: string): Promise<void> {
  const { user, supabase } = await requireUser();
  if (!body.trim()) throw new Error("내용을 입력해주세요.");
  const { error } = await supabase.from("teacher_admin_messages").insert({
    inquiry_id: inquiryId,
    sender_id: user.id,
    sender_role: "teacher",
    body: body.trim(),
  });
  if (error) throw new Error(error.message.includes("teacher_admin_inquiries") ? "종료된 문의입니다." : error.message);
}
