"use server";

// 2026-09-22(사용자 지시 — "학생이 컨설턴트랑 일정 잡는 것도 UI 필요하겠다,
// 수업 예약하는거랑 똑같이", "신청만 하고 컨설턴트/관리자가 최종 확인 후
// 확정") — 학생 본인이 담당 컨설턴트와 개인 단위로 일정을 신청한다(household
// 전체 참여 불필요 — meeting_requests.requested_by/child_id = 본인).
// list_open_consultant_meeting_slots RPC와 RLS(20261470000000)가 이미
// "본인 담당 컨설턴트인지"를 강제하므로 여기서는 추가 검증을 하지 않는다.

import { requireUser } from "@/lib/auth";
import type { MeetingRequest, GuardianMeetingRequestReview } from "@/app/parent/inquiry-actions";

export type MyAssignedConsultant = { id: string; name: string | null };

export async function getMyAssignedConsultantAction(): Promise<MyAssignedConsultant | null> {
  const { user, profile, supabase } = await requireUser();
  if (profile?.role !== "student") throw new Error("학생만 접근할 수 있습니다.");
  const { data, error } = await supabase
    .from("consultant_assignments")
    .select("consultant_id, consultant:profiles!consultant_assignments_consultant_id_fkey(name)")
    .eq("student_id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const rel = data.consultant as { name: string | null } | { name: string | null }[] | null;
  const consultant = Array.isArray(rel) ? rel[0] : rel;
  return { id: data.consultant_id as string, name: consultant?.name ?? null };
}

export type ConsultantSlot = { startsAt: string };

export async function listOpenSlotsForMyConsultantAction(
  consultantId: string,
  fromIso: string,
  toIso: string
): Promise<ConsultantSlot[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("list_open_consultant_meeting_slots", {
    p_consultant_id: consultantId,
    p_from: fromIso,
    p_to: toIso,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ slot_starts_at: string }>).map((r) => ({ startsAt: r.slot_starts_at }));
}

export type SubmitConsultantMeetingRequestResult = { ok: true } | { ok: false; error: string };

export async function submitMyConsultantMeetingRequestAction(params: {
  consultantId: string;
  reason: string;
  slotStartsAtIso: string;
}): Promise<SubmitConsultantMeetingRequestResult> {
  try {
    const { user, profile, supabase } = await requireUser();
    if (profile?.role !== "student") throw new Error("학생만 신청할 수 있습니다.");
    if (!params.reason?.trim()) throw new Error("상담 사유를 입력해주세요.");
    if (!params.slotStartsAtIso) throw new Error("희망 시간을 선택해주세요.");

    const { data: household } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("profile_id", user.id)
      .eq("role", "child")
      .maybeSingle();
    if (!household) throw new Error("소속된 household를 찾을 수 없습니다.");

    const startsAt = new Date(params.slotStartsAtIso);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);

    const { error } = await supabase.from("meeting_requests").insert({
      household_id: household.household_id,
      child_id: user.id,
      subject: null,
      content: params.reason.trim(),
      contact_preference: null,
      preferred_contact_time: null,
      requested_by: user.id,
      consultant_id: params.consultantId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      source_message_id: null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "신청에 실패했습니다." };
  }
}

export async function listMyConsultantMeetingRequestsAction(): Promise<MeetingRequest[]> {
  const { user, profile, supabase } = await requireUser();
  if (profile?.role !== "student") throw new Error("학생만 접근할 수 있습니다.");
  const { data, error } = await supabase
    .from("meeting_requests")
    .select(
      "id, child_id, subject, content, contact_preference, preferred_contact_time, status, starts_at, ends_at, google_meet_link, created_at, child:profiles!meeting_requests_child_id_fkey(name)"
    )
    .eq("child_id", user.id)
    .not("consultant_id", "is", null)
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

export async function getMyConsultantMeetingRequestReviewAction(
  meetingRequestId: string
): Promise<GuardianMeetingRequestReview | null> {
  const { user, profile, supabase } = await requireUser();
  if (profile?.role !== "student") throw new Error("학생만 접근할 수 있습니다.");
  const { data: owns } = await supabase
    .from("meeting_requests")
    .select("id")
    .eq("id", meetingRequestId)
    .eq("child_id", user.id)
    .maybeSingle();
  if (!owns) throw new Error("본인이 신청한 일정만 조회할 수 있습니다.");

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
