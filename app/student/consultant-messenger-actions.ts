"use server";

// 2026-09-22(사용자 지시 — "컨설턴트는 학생이랑도 메신저 필요하긴 하겠네") —
// 학생 본인의 household 메신저 접근. app/parent/inquiry-actions.ts와 완전히
// 같은 테이블·스레드 구조를 공유한다(household는 보호자·학생이 같이 보는
// 하나의 대화). household_members RLS가 이미 "profile_id = auth.uid()"로
// 학생 본인 행을 허용하므로 컨설턴트 쪽과 달리 SECURITY DEFINER 없이 직접
// 조회한다(20261468000000).

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
  if (!data) throw new Error("소속된 household가 없습니다. 관리자에게 문의해주세요.");
  return data.household_id as string;
}

async function requireStudent(): Promise<{ supabase: SupabaseClient; userId: string }> {
  const { user, profile, supabase } = await requireUser();
  if (profile?.role !== "student") throw new Error("학생만 접근할 수 있습니다.");
  return { supabase, userId: user.id };
}

export async function listMyHouseholdInquiriesAction(): Promise<HouseholdInquirySummary[]> {
  const { supabase, userId } = await requireStudent();
  const householdId = await requireStudentHouseholdId(supabase, userId);
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

export async function listMyHouseholdInquiryMessagesAction(inquiryId: string): Promise<HouseholdMessage[]> {
  const { supabase } = await requireStudent();
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

export async function startMyHouseholdInquiryAction(body: string): Promise<{ inquiryId: string }> {
  const { supabase, userId } = await requireStudent();
  if (!body.trim()) throw new Error("내용을 입력해주세요.");
  const householdId = await requireStudentHouseholdId(supabase, userId);
  const { data: inquiry, error: inquiryError } = await supabase
    .from("household_inquiries")
    .insert({ household_id: householdId, opened_by: userId, opened_by_role: "student" })
    .select("id")
    .single();
  if (inquiryError) throw new Error(inquiryError.message);
  const { error } = await supabase.from("household_messages").insert({
    household_id: householdId,
    inquiry_id: inquiry.id,
    sender_id: userId,
    sender_role: "student",
    body: body.trim(),
  });
  if (error) throw new Error(error.message);
  return { inquiryId: inquiry.id as string };
}

export async function sendMyHouseholdInquiryMessageAction(inquiryId: string, body: string): Promise<void> {
  const { supabase, userId } = await requireStudent();
  if (!body.trim()) throw new Error("내용을 입력해주세요.");
  const householdId = await requireStudentHouseholdId(supabase, userId);
  const { error } = await supabase.from("household_messages").insert({
    household_id: householdId,
    inquiry_id: inquiryId,
    sender_id: userId,
    sender_role: "student",
    body: body.trim(),
  });
  if (error) throw new Error(error.message.includes("household_inquiries") ? "종료된 문의입니다. 새 문의를 시작해주세요." : error.message);
}

export async function getMyHouseholdMessengerUnreadCountAction(): Promise<number> {
  const { supabase, userId } = await requireStudent();
  const householdId = await requireStudentHouseholdId(supabase, userId);
  const { data: readRow } = await supabase
    .from("household_message_reads")
    .select("last_read_at")
    .eq("household_id", householdId)
    .eq("viewer_role", "student")
    .maybeSingle();
  const since = readRow?.last_read_at ?? "1970-01-01T00:00:00Z";
  const { count, error } = await supabase
    .from("household_messages")
    .select("id", { count: "exact", head: true })
    .eq("household_id", householdId)
    .in("sender_role", ["guardian", "admin", "consultant"])
    .gt("created_at", since);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function markMyHouseholdMessengerReadAction(): Promise<void> {
  const { supabase, userId } = await requireStudent();
  const householdId = await requireStudentHouseholdId(supabase, userId);
  const { error } = await supabase
    .from("household_message_reads")
    .upsert(
      { household_id: householdId, viewer_role: "student", last_read_at: new Date().toISOString() },
      { onConflict: "household_id,viewer_role" }
    );
  if (error) throw new Error(error.message);
}
