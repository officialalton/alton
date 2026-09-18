"use server";

// R11(문의·면담) — 보호자 포털의 household 메신저(문의) + 면담 일정 요청.
// consultations(신규 자녀 상담)와 완전히 분리된 별도 테이블(household_messages,
// meeting_requests)만 다룬다 — 기존 자녀 면담은 가입·체험·정규 전환 파이프라인
// 카드를 만들지 않는다(별도 테이블이므로 자연히 그렇게 됨).
//
// 신규 자녀 상담 신청(구 app/parent/consult-request-actions.ts, R13에서 폐기)과
// 같은 원칙: 보호자 household/이름은 세션에서만 가져오고 클라이언트 입력을 받지
// 않는다. 쓰기는 보호자 본인의 regular
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
  content: string | null;
  contactPreference: "phone" | "message" | "either" | null;
  preferredContactTime: string | null;
  status: "requested" | "confirming" | "scheduling" | "scheduled" | "completed" | "cancelled";
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
    .select(
      "id, child_id, subject, content, contact_preference, preferred_contact_time, status, starts_at, ends_at, google_meet_link, created_at, child:profiles!meeting_requests_child_id_fkey(name)"
    )
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
      content: r.content,
      contactPreference: r.contact_preference,
      preferredContactTime: r.preferred_contact_time,
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
/** R12.1: 상담 신청 폼은 "상담 사유" 단일 입력만 받는다. child_id/subject/
 * contact_preference/preferred_contact_time 컬럼은 DB에 그대로 두지만(추가 전용
 * 마이그레이션 원칙), 이 폼에서는 값을 넣지 않고 null로 남긴다. */
export async function submitMeetingRequest(params: { reason: string }): Promise<SubmitMeetingRequestResult> {
  try {
    const { user, profile, supabase } = await requireUser();
    if (profile?.role !== "parent") throw new Error("보호자만 상담을 신청할 수 있습니다.");
    if (!params.reason?.trim()) throw new Error("상담 사유를 입력해주세요.");
    const householdId = await requireGuardianHouseholdId(supabase, user.id);

    const { error } = await supabase.from("meeting_requests").insert({
      household_id: householdId,
      child_id: null,
      subject: null,
      content: params.reason.trim(),
      contact_preference: null,
      preferred_contact_time: null,
      requested_by: user.id,
      starts_at: null,
      ends_at: null,
      source_message_id: null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "상담 신청에 실패했습니다." };
  }
}

// R12.1: meeting_request_messages 스레드는 더 이상 UI로 노출하지 않는다("상담
// 신청 내부 메시지 스레드는 노출하지 않고, 대화는 메신저로만 처리"). 테이블 자체는
// 추가 전용 원칙에 따라 유지하되, listMeetingRequestMessages/
// sendMeetingRequestMessage는 여기서 제거했다 — 대화는 household_messages(메신저)로.

async function assertGuardianOwnsMeetingRequest(
  supabase: SupabaseClient,
  householdId: string,
  meetingRequestId: string
): Promise<void> {
  const { data } = await supabase
    .from("meeting_requests")
    .select("id")
    .eq("id", meetingRequestId)
    .eq("household_id", householdId)
    .maybeSingle();
  if (!data) throw new Error("본인 household의 상담 신청만 조회할 수 있습니다.");
}

export type GuardianMeetingRequestReview = {
  finalText: string;
  finalizedAt: string | null;
  driveLink: { driveFileId: string } | null;
};

/** status='final'인 리뷰만 반환한다(RLS도 동일하게 강제하지만, 의도를 명시적으로
 * 요청한다). 미팅록 링크는 meeting_request_review_drive_access.status='granted'일
 * 때만 채워준다 — 그 외(행 없음/pending/failed)에는 null을 반환해 앱이 링크를
 * 아예 렌더링하지 않게 한다. */
export async function getGuardianMeetingRequestReview(
  meetingRequestId: string
): Promise<GuardianMeetingRequestReview | null> {
  const { user, profile, supabase } = await requireUser();
  if (profile?.role !== "parent") throw new Error("보호자만 접근할 수 있습니다.");
  const householdId = await requireGuardianHouseholdId(supabase, user.id);
  await assertGuardianOwnsMeetingRequest(supabase, householdId, meetingRequestId);

  const { data: review, error } = await supabase
    .from("meeting_request_reviews")
    .select("id, final_text, finalized_at, status")
    .eq("meeting_request_id", meetingRequestId)
    .eq("status", "final")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!review || !review.final_text) return null;

  const { data: access } = await supabase
    .from("meeting_request_review_drive_access")
    .select("drive_file_id, status")
    .eq("meeting_request_review_id", review.id)
    .eq("status", "granted")
    .maybeSingle();

  return {
    finalText: review.final_text,
    finalizedAt: review.finalized_at,
    driveLink: access ? { driveFileId: access.drive_file_id } : null,
  };
}

export async function getMessengerUnreadCount(): Promise<number> {
  const { user, profile, supabase } = await requireUser();
  if (profile?.role !== "parent") throw new Error("보호자만 접근할 수 있습니다.");
  const householdId = await requireGuardianHouseholdId(supabase, user.id);
  const { data: readRow } = await supabase
    .from("household_message_reads")
    .select("last_read_at")
    .eq("household_id", householdId)
    .eq("viewer_role", "guardian")
    .maybeSingle();
  const since = readRow?.last_read_at ?? "1970-01-01T00:00:00Z";
  const { count, error } = await supabase
    .from("household_messages")
    .select("id", { count: "exact", head: true })
    .eq("household_id", householdId)
    .eq("sender_role", "admin")
    .gt("created_at", since);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function markMessengerRead(): Promise<void> {
  const { user, profile, supabase } = await requireUser();
  if (profile?.role !== "parent") throw new Error("보호자만 접근할 수 있습니다.");
  const householdId = await requireGuardianHouseholdId(supabase, user.id);
  const { error } = await supabase
    .from("household_message_reads")
    .upsert(
      { household_id: householdId, viewer_role: "guardian", last_read_at: new Date().toISOString() },
      { onConflict: "household_id,viewer_role" }
    );
  if (error) throw new Error(error.message);
}
