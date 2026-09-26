"use server";

// Phase A 마무리(2026-09-23, 사용자 지시 — "관리자와 컨설턴트의 이슈 보고·
// 업무 지침 대화가 가능한지 확인") — 담당 가족과의 household 메신저와
// 완전히 별개인, 관리자<->컨설턴트 내부 채널. 학생·보호자는 이 테이블을
// 볼 수 없다(RLS에 그 role용 정책 자체가 없음).

import { requireConsultant } from "@/lib/admin-auth";

export type ConsultantAdminInquiry = {
  id: string;
  status: "open" | "closed";
  subject: string | null;
  createdAt: string;
  lastMessageAt: string;
  closedAt: string | null;
};

export type ConsultantAdminMessage = {
  id: string;
  senderId: string;
  senderRole: "consultant" | "admin";
  body: string;
  createdAt: string;
};

export async function listMyStaffInquiriesAction(): Promise<ConsultantAdminInquiry[]> {
  const { user, supabase } = await requireConsultant();
  const { data, error } = await supabase
    .from("consultant_admin_inquiries")
    .select("id, status, subject, created_at, last_message_at, closed_at")
    .eq("consultant_id", user.id)
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

export async function startMyStaffInquiryAction(body: string, subject?: string): Promise<{ inquiryId: string }> {
  const { user, supabase } = await requireConsultant();
  if (!body.trim()) throw new Error("내용을 입력해주세요.");
  const { data: inquiry, error: inquiryError } = await supabase
    .from("consultant_admin_inquiries")
    .insert({ consultant_id: user.id, opened_by: user.id, opened_by_role: "consultant", subject: subject?.trim() || null })
    .select("id")
    .single();
  if (inquiryError) throw new Error(inquiryError.message);
  const { error } = await supabase.from("consultant_admin_messages").insert({
    inquiry_id: inquiry.id,
    sender_id: user.id,
    sender_role: "consultant",
    body: body.trim(),
  });
  if (error) throw new Error(error.message);
  return { inquiryId: inquiry.id as string };
}

export async function listMyStaffMessagesAction(inquiryId: string): Promise<ConsultantAdminMessage[]> {
  const { supabase } = await requireConsultant();
  const { data, error } = await supabase
    .from("consultant_admin_messages")
    .select("id, sender_id, sender_role, body, created_at")
    .eq("inquiry_id", inquiryId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ id: r.id, senderId: r.sender_id, senderRole: r.sender_role, body: r.body, createdAt: r.created_at }));
}

export async function sendMyStaffMessageAction(inquiryId: string, body: string): Promise<void> {
  const { user, supabase } = await requireConsultant();
  if (!body.trim()) throw new Error("내용을 입력해주세요.");
  const { error } = await supabase.from("consultant_admin_messages").insert({
    inquiry_id: inquiryId,
    sender_id: user.id,
    sender_role: "consultant",
    body: body.trim(),
  });
  if (error) throw new Error(error.message.includes("consultant_admin_inquiries") ? "종료된 문의입니다." : error.message);
}

export async function getMyStaffMessengerUnreadCountAction(): Promise<number> {
  const { user, supabase } = await requireConsultant();
  const { data: readRow } = await supabase
    .from("consultant_admin_message_reads")
    .select("last_read_at")
    .eq("consultant_id", user.id)
    .eq("viewer_role", "consultant")
    .maybeSingle();
  const since = readRow?.last_read_at ?? "1970-01-01T00:00:00Z";
  const { data: inquiries } = await supabase.from("consultant_admin_inquiries").select("id").eq("consultant_id", user.id);
  const inquiryIds = (inquiries ?? []).map((i) => i.id);
  if (inquiryIds.length === 0) return 0;
  const { count, error } = await supabase
    .from("consultant_admin_messages")
    .select("id", { count: "exact", head: true })
    .in("inquiry_id", inquiryIds)
    .eq("sender_role", "admin")
    .gt("created_at", since);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function markMyStaffMessengerReadAction(): Promise<void> {
  const { user, supabase } = await requireConsultant();
  const { error } = await supabase
    .from("consultant_admin_message_reads")
    .upsert({ consultant_id: user.id, viewer_role: "consultant", last_read_at: new Date().toISOString() }, { onConflict: "consultant_id,viewer_role" });
  if (error) throw new Error(error.message);
}
