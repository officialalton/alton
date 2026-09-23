"use server";

// 2026-09-22(사용자 지시 + docs/superpowers/specs/2026-09-22-consultant-role-and-intake-design.md) —
// 담당 컨설턴트의 household 메신저 접근("Read and reply"). 학생 화면(studentId)에서
// 진입하지만 실제 대화는 household 단위(app/parent/inquiry-actions.ts와 동일 테이블)다.
// 새 문의를 여는 건 보호자/관리자만 유지 — 컨설턴트는 열린 문의에 답장만 한다.
// RLS(is_assigned_consultant_of_household, 20261464000000)가 이미 담당 학생의
// household인지 강제하므로 여기서는 추가 소유권 검증을 하지 않는다.

import { requireUser } from "@/lib/auth";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { HouseholdInquirySummary, HouseholdMessage } from "@/app/parent/inquiry-actions";

async function requireStudentHouseholdId(supabase: SupabaseClient, studentId: string): Promise<string> {
  const { data } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("profile_id", studentId)
    .eq("role", "child")
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error("이 학생이 속한 household를 찾을 수 없습니다.");
  return data.household_id as string;
}

async function requireConsultant(): Promise<{ supabase: SupabaseClient; userId: string }> {
  const { user, profile, supabase } = await requireUser();
  if (profile?.role !== "consultant") throw new Error("컨설턴트만 접근할 수 있습니다.");
  return { supabase, userId: user.id };
}

export async function listConsultantInquiriesAction(studentId: string): Promise<HouseholdInquirySummary[]> {
  const { supabase } = await requireConsultant();
  const householdId = await requireStudentHouseholdId(supabase, studentId);
  const { data, error } = await supabase
    .from("household_inquiries")
    .select("id, status, created_at, last_message_at, closed_at, household_messages(body, created_at)")
    .eq("household_id", householdId)
    .order("last_message_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const msgs = (r.household_messages as { body: string; created_at: string }[] | null) ?? [];
    const first = [...msgs].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
    return {
      id: r.id,
      status: r.status,
      createdAt: r.created_at,
      lastMessageAt: r.last_message_at,
      closedAt: r.closed_at,
      firstMessage: first?.body ?? "",
    };
  });
}

export async function listConsultantInquiryMessagesAction(inquiryId: string): Promise<HouseholdMessage[]> {
  const { supabase } = await requireConsultant();
  const { data, error } = await supabase
    .from("household_messages")
    .select("id, sender_id, sender_role, body, created_at")
    .eq("inquiry_id", inquiryId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    senderId: r.sender_id,
    senderRole: r.sender_role,
    body: r.body,
    createdAt: r.created_at,
  }));
}

export async function sendConsultantInquiryMessageAction(
  studentId: string,
  inquiryId: string,
  body: string
): Promise<void> {
  const { supabase, userId } = await requireConsultant();
  if (!body.trim()) throw new Error("내용을 입력해주세요.");
  const householdId = await requireStudentHouseholdId(supabase, studentId);
  const { error } = await supabase.from("household_messages").insert({
    household_id: householdId,
    inquiry_id: inquiryId,
    sender_id: userId,
    sender_role: "consultant",
    body: body.trim(),
  });
  if (error) throw new Error(error.message.includes("household_inquiries") ? "종료된 문의입니다." : error.message);
}

export async function getConsultantMessengerUnreadCountAction(studentId: string): Promise<number> {
  const { supabase } = await requireConsultant();
  const householdId = await requireStudentHouseholdId(supabase, studentId);
  const { data: readRow } = await supabase
    .from("household_message_reads")
    .select("last_read_at")
    .eq("household_id", householdId)
    .eq("viewer_role", "consultant")
    .maybeSingle();
  const since = readRow?.last_read_at ?? "1970-01-01T00:00:00Z";
  const { count, error } = await supabase
    .from("household_messages")
    .select("id", { count: "exact", head: true })
    .eq("household_id", householdId)
    .in("sender_role", ["guardian", "admin"])
    .gt("created_at", since);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function markConsultantMessengerReadAction(studentId: string): Promise<void> {
  const { supabase } = await requireConsultant();
  const householdId = await requireStudentHouseholdId(supabase, studentId);
  const { error } = await supabase
    .from("household_message_reads")
    .upsert(
      { household_id: householdId, viewer_role: "consultant", last_read_at: new Date().toISOString() },
      { onConflict: "household_id,viewer_role" }
    );
  if (error) throw new Error(error.message);
}
