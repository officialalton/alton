"use server";

// R11(문의·면담) — 보호자 포털의 household 메신저(문의) + 면담 일정 요청.
// consultations(신규 자녀 상담)와 완전히 분리된 별도 테이블(household_messages,
// meeting_requests)만 다룬다 — 기존 자녀 면담은 가입·체험·정규 전환 파이프라인
// 카드를 만들지 않는다(별도 테이블이므로 자연히 그렇게 됨).
//
// app/parent/consult-request-actions.ts와 동일한 원칙: 보호자 household/이름은
// 세션에서만 가져오고 클라이언트 입력을 받지 않는다. 쓰기는 보호자 본인의 regular
// supabase 클라이언트(auth.uid()가 실제로 채워짐)로 RLS를 그대로 태워서 하고,
// service_role 어드민 클라이언트는 쓰지 않는다 — 2026-09-06에 실제로 발견된
// "service_role 호출인데 SQL이 auth.uid()/is_admin()을 다시 확인해 항상 거부되는"
// 버그 클래스를 이 새 기능에서는 애초에 만들지 않기 위함.

import { requireUser } from "@/lib/auth";
import type { SupabaseClient } from "@supabase/supabase-js";

export type HouseholdMessage = {
  id: string;
  senderId: string;
  senderRole: "guardian" | "admin";
  body: string;
  status: "open" | "resolved";
  createdAt: string;
};

export type MeetingRequest = {
  id: string;
  childId: string | null;
  childName: string | null;
  subject: string | null;
  status: "requested" | "scheduled" | "completed" | "cancelled";
  startsAt: string | null;
  endsAt: string | null;
  googleMeetLink: string | null;
  createdAt: string;
};

async function requireGuardianHouseholdId(supabase: SupabaseClient, guardianId: string): Promise<string> {
  const { data } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("profile_id", guardianId)
    .eq("role", "guardian")
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error("소속된 household가 없습니다. 관리자에게 문의해주세요.");
  return data.household_id as string;
}

export async function listGuardianHouseholdMessages(): Promise<HouseholdMessage[]> {
  const { user, profile, supabase } = await requireUser();
  if (profile?.role !== "parent") throw new Error("보호자만 접근할 수 있습니다.");
  const householdId = await requireGuardianHouseholdId(supabase, user.id);
  const { data, error } = await supabase
    .from("household_messages")
    .select("id, sender_id, sender_role, body, status, created_at")
    .eq("household_id", householdId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    senderId: r.sender_id,
    senderRole: r.sender_role,
    body: r.body,
    status: r.status,
    createdAt: r.created_at,
  }));
}

export async function sendGuardianHouseholdMessage(body: string): Promise<void> {
  const { user, profile, supabase } = await requireUser();
  if (profile?.role !== "parent") throw new Error("보호자만 접근할 수 있습니다.");
  if (!body.trim()) throw new Error("내용을 입력해주세요.");
  const householdId = await requireGuardianHouseholdId(supabase, user.id);
  const { error } = await supabase.from("household_messages").insert({
    household_id: householdId,
    sender_id: user.id,
    sender_role: "guardian",
    body: body.trim(),
  });
  if (error) throw new Error(error.message);
}

export async function listGuardianMeetingRequests(): Promise<MeetingRequest[]> {
  const { user, profile, supabase } = await requireUser();
  if (profile?.role !== "parent") throw new Error("보호자만 접근할 수 있습니다.");
  const householdId = await requireGuardianHouseholdId(supabase, user.id);
  const { data, error } = await supabase
    .from("meeting_requests")
    .select("id, child_id, subject, status, starts_at, ends_at, google_meet_link, created_at, child:profiles!meeting_requests_child_id_fkey(name)")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const childRel = r.child as { name?: string } | { name?: string }[] | null;
    const child = Array.isArray(childRel) ? childRel[0] : childRel;
    return {
      id: r.id,
      childId: r.child_id,
      childName: child?.name ?? null,
      subject: r.subject,
      status: r.status,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      googleMeetLink: r.google_meet_link,
      createdAt: r.created_at,
    };
  });
}

export async function listGuardianChildrenForMeeting(): Promise<{ id: string; name: string }[]> {
  const { user, profile, supabase } = await requireUser();
  if (profile?.role !== "parent") throw new Error("보호자만 접근할 수 있습니다.");
  const householdId = await requireGuardianHouseholdId(supabase, user.id);
  const { data, error } = await supabase
    .from("household_members")
    .select("profile_id, profile:profiles(name)")
    .eq("household_id", householdId)
    .eq("role", "child");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const rel = r.profile as { name?: string } | { name?: string }[] | null;
    const p = Array.isArray(rel) ? rel[0] : rel;
    return { id: r.profile_id, name: p?.name ?? "" };
  });
}

export type OpenMeetingSlot = { startsAt: string };

export async function listOpenGuardianMeetingSlots(fromIso: string, toIso: string): Promise<OpenMeetingSlot[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("list_open_meeting_slots", { p_from: fromIso, p_to: toIso });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ slot_starts_at: string }>).map((r) => ({ startsAt: r.slot_starts_at }));
}

export type SubmitMeetingRequestResult =
  | { ok: true }
  | { ok: false; error: string };

/** 예외를 던지지 않고 { ok, error }로 반환한다(Next.js Server Action의 production
 * 예외 마스킹 재발 방지 — app/admin/trial-onboarding-actions.ts와 동일 규칙). */
export async function submitMeetingRequest(params: {
  childId?: string;
  subject?: string;
  slotStartsAtIso: string;
  sourceMessageId?: string;
}): Promise<SubmitMeetingRequestResult> {
  try {
    const { user, profile, supabase } = await requireUser();
    if (profile?.role !== "parent") throw new Error("보호자만 면담을 신청할 수 있습니다.");
    if (!params.slotStartsAtIso) throw new Error("면담 희망 시간을 선택해주세요.");
    const householdId = await requireGuardianHouseholdId(supabase, user.id);

    const startsAt = new Date(params.slotStartsAtIso);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);

    const { error } = await supabase.from("meeting_requests").insert({
      household_id: householdId,
      child_id: params.childId || null,
      subject: params.subject?.trim() || null,
      requested_by: user.id,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      source_message_id: params.sourceMessageId || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "면담 신청에 실패했습니다." };
  }
}
