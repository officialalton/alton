"use server";

// Phase A 마무리(2026-09-23) — 관리자 쪽 관리자<->컨설턴트 내부 채널.
// household 문의(고객)와 완전히 별도 테이블(consultant_admin_inquiries/
// _messages)만 다룬다.

import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";

export type StaffInquiryListItem = {
  id: string;
  consultantId: string;
  consultantName: string | null;
  status: "open" | "closed";
  subject: string | null;
  createdAt: string;
  lastMessageAt: string;
  closedAt: string | null;
};

export type StaffMessage = {
  id: string;
  senderId: string;
  senderRole: "consultant" | "admin";
  body: string;
  createdAt: string;
};

export async function listAllStaffInquiriesAction(): Promise<StaffInquiryListItem[]> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("consultant_admin_inquiries")
    .select("id, consultant_id, status, subject, created_at, last_message_at, closed_at, consultant:profiles!consultant_admin_inquiries_consultant_id_fkey(name)")
    .order("last_message_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const rel = r.consultant as { name: string | null } | { name: string | null }[] | null;
    const consultant = Array.isArray(rel) ? rel[0] : rel;
    return {
      id: r.id,
      consultantId: r.consultant_id,
      consultantName: consultant?.name ?? null,
      status: r.status,
      subject: r.subject,
      createdAt: r.created_at,
      lastMessageAt: r.last_message_at,
      closedAt: r.closed_at,
    };
  });
}

export async function startStaffInquiryAction(consultantId: string, body: string, subject?: string): Promise<{ inquiryId: string }> {
  const { supabase, adminUserId } = await requireAdmin();
  if (!body.trim()) throw new Error("내용을 입력해주세요.");
  const { data: inquiry, error: inquiryError } = await supabase
    .from("consultant_admin_inquiries")
    .insert({ consultant_id: consultantId, opened_by: adminUserId, opened_by_role: "admin", subject: subject?.trim() || null })
    .select("id")
    .single();
  if (inquiryError) throw new Error(inquiryError.message);
  const { error } = await supabase.from("consultant_admin_messages").insert({
    inquiry_id: inquiry.id,
    sender_id: adminUserId,
    sender_role: "admin",
    body: body.trim(),
  });
  if (error) throw new Error(error.message);
  return { inquiryId: inquiry.id as string };
}

export async function listStaffMessagesAction(inquiryId: string): Promise<StaffMessage[]> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("consultant_admin_messages")
    .select("id, sender_id, sender_role, body, created_at")
    .eq("inquiry_id", inquiryId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ id: r.id, senderId: r.sender_id, senderRole: r.sender_role, body: r.body, createdAt: r.created_at }));
}

export async function sendAdminStaffMessageAction(inquiryId: string, body: string): Promise<void> {
  const { supabase, adminUserId } = await requireAdmin();
  if (!body.trim()) throw new Error("내용을 입력해주세요.");
  const { error } = await supabase.from("consultant_admin_messages").insert({
    inquiry_id: inquiryId,
    sender_id: adminUserId,
    sender_role: "admin",
    body: body.trim(),
  });
  if (error) throw new Error(error.message.includes("consultant_admin_inquiries") ? "종료된 문의입니다." : error.message);
}

export async function closeStaffInquiryAction(inquiryId: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("close_consultant_admin_inquiry", { p_inquiry_id: inquiryId });
  if (error) throw new Error(error.message);
}

/** Phase A 마무리 — 선생님 배정 요청 수락/거절 결과를 컨설턴트-관리자 내부
 * 채널에 시스템 메시지로 남긴다("수락·거절 결과가 메신저에 반영되는지").
 * 스레드가 없으면 새로 연다. service_role로 쓴다 — 이 호출은 사람이 직접
 * 채팅을 치는 게 아니라 다른 RPC/액션이 부수 효과로 남기는 시스템 메시지라
 * 세션 클라이언트(호출자가 컨설턴트/선생님일 수 있음)로는 관리자 role
 * 메시지를 못 남기기 때문이다.
 */
export async function postTeacherAssignmentResultSystemMessage(params: {
  consultantId: string;
  body: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { data: systemActor, error: systemActorError } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .eq("admin_tier", "master")
    .limit(1)
    .maybeSingle();
  if (systemActorError) throw new Error(systemActorError.message);
  if (!systemActor) throw new Error("시스템 메시지를 보낼 관리자 계정을 찾을 수 없습니다.");

  const { data: openInquiry } = await admin
    .from("consultant_admin_inquiries")
    .select("id")
    .eq("consultant_id", params.consultantId)
    .eq("status", "open")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let inquiryId = openInquiry?.id as string | undefined;
  if (!inquiryId) {
    const { data: created, error: createError } = await admin
      .from("consultant_admin_inquiries")
      .insert({ consultant_id: params.consultantId, opened_by: systemActor.id, opened_by_role: "admin", subject: "선생님 배정 요청 알림" })
      .select("id")
      .single();
    if (createError) throw new Error(createError.message);
    inquiryId = created.id;
  }

  const { error } = await admin.from("consultant_admin_messages").insert({
    inquiry_id: inquiryId,
    sender_id: systemActor.id,
    sender_role: "admin",
    body: params.body,
  });
  if (error) throw new Error(error.message);
}
