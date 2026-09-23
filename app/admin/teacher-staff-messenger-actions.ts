"use server";

// 관리자 포털 정리 항목 2(2026-09-23) — 관리자 쪽 관리자<->선생님 내부 채널.
// staff-messenger-actions.ts(컨설턴트용)와 완전히 같은 패턴, 별도 테이블
// (teacher_admin_inquiries/_messages)만 다룬다.

import { requireAdmin } from "@/lib/admin-auth";

export type TeacherStaffInquiryListItem = {
  id: string;
  teacherId: string;
  teacherName: string | null;
  status: "open" | "closed";
  subject: string | null;
  createdAt: string;
  lastMessageAt: string;
  closedAt: string | null;
};

export type TeacherStaffMessage = {
  id: string;
  senderId: string;
  senderRole: "teacher" | "admin";
  body: string;
  createdAt: string;
};

export async function listAllTeacherStaffInquiriesAction(): Promise<TeacherStaffInquiryListItem[]> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("teacher_admin_inquiries")
    .select("id, teacher_id, status, subject, created_at, last_message_at, closed_at, teacher:profiles!teacher_admin_inquiries_teacher_id_fkey(name)")
    .order("last_message_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const rel = r.teacher as { name: string | null } | { name: string | null }[] | null;
    const teacher = Array.isArray(rel) ? rel[0] : rel;
    return {
      id: r.id,
      teacherId: r.teacher_id,
      teacherName: teacher?.name ?? null,
      status: r.status,
      subject: r.subject,
      createdAt: r.created_at,
      lastMessageAt: r.last_message_at,
      closedAt: r.closed_at,
    };
  });
}

export async function startTeacherStaffInquiryAction(teacherId: string, body: string, subject?: string): Promise<{ inquiryId: string }> {
  const { supabase, adminUserId } = await requireAdmin();
  if (!body.trim()) throw new Error("내용을 입력해주세요.");
  const { data: inquiry, error: inquiryError } = await supabase
    .from("teacher_admin_inquiries")
    .insert({ teacher_id: teacherId, opened_by: adminUserId, opened_by_role: "admin", subject: subject?.trim() || null })
    .select("id")
    .single();
  if (inquiryError) throw new Error(inquiryError.message);
  const { error } = await supabase.from("teacher_admin_messages").insert({
    inquiry_id: inquiry.id,
    sender_id: adminUserId,
    sender_role: "admin",
    body: body.trim(),
  });
  if (error) throw new Error(error.message);
  return { inquiryId: inquiry.id as string };
}

export async function listTeacherStaffMessagesAction(inquiryId: string): Promise<TeacherStaffMessage[]> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("teacher_admin_messages")
    .select("id, sender_id, sender_role, body, created_at")
    .eq("inquiry_id", inquiryId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ id: r.id, senderId: r.sender_id, senderRole: r.sender_role, body: r.body, createdAt: r.created_at }));
}

export async function sendAdminTeacherStaffMessageAction(inquiryId: string, body: string): Promise<void> {
  const { supabase, adminUserId } = await requireAdmin();
  if (!body.trim()) throw new Error("내용을 입력해주세요.");
  const { error } = await supabase.from("teacher_admin_messages").insert({
    inquiry_id: inquiryId,
    sender_id: adminUserId,
    sender_role: "admin",
    body: body.trim(),
  });
  if (error) throw new Error(error.message.includes("teacher_admin_inquiries") ? "종료된 문의입니다." : error.message);
}

export async function closeTeacherStaffInquiryAction(inquiryId: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("close_teacher_admin_inquiry", { p_inquiry_id: inquiryId });
  if (error) throw new Error(error.message);
}
