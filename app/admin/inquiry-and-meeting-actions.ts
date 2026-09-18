"use server";

// R11(문의·면담) — 관리자 서버 액션. household_messages(문의)와 meeting_requests
// (면담)를 다룬다. consultations(상담)와는 완전히 분리된 테이블이라 이 파일도
// app/admin/consultation-actions.ts와 별도로 둔다.

import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { createCalendarEventWithMeet, patchCalendarEventTime } from "@/lib/google-calendar";
import { extractMeetingCodeFromLink } from "@/lib/google-meet";

export type AdminInquiryThread = {
  householdId: string;
  householdLabel: string;
  messages: {
    id: string;
    senderRole: "guardian" | "admin";
    body: string;
    status: "open" | "resolved";
    createdAt: string;
  }[];
  hasOpen: boolean;
  unreadForAdmin: boolean;
};

// 2026-09-10(P1-2) — 데이터가 늘어나도 이 화면이 계속 느려지지 않도록 최근
// 90일 + 상한을 둔다(지금은 데이터가 거의 없어 체감되지 않지만, 그게 이 화면이
// 빠른 이유는 아니라는 게 P1-2 조사 결론이었다). 열린(open) 문의는 오래됐어도
// 놓치면 안 되므로 기간 제한과 별개로 항상 포함한다.
const INQUIRY_LOOKBACK_DAYS = 90;
const INQUIRY_MESSAGE_LIMIT = 500;

export async function listInquiryThreadsForAdmin(): Promise<AdminInquiryThread[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const since = new Date(Date.now() - INQUIRY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: recent, error }, { data: openOlder, error: openError }] = await Promise.all([
    admin
      .from("household_messages")
      .select("id, household_id, sender_role, body, status, created_at, household:households(primary_guardian_id, guardian:profiles!households_primary_guardian_id_fkey(name))")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(INQUIRY_MESSAGE_LIMIT),
    admin
      .from("household_messages")
      .select("id, household_id, sender_role, body, status, created_at, household:households(primary_guardian_id, guardian:profiles!households_primary_guardian_id_fkey(name))")
      .lt("created_at", since)
      .eq("status", "open")
      .order("created_at", { ascending: true }),
  ]);
  if (error) throw new Error(error.message);
  if (openError) throw new Error(openError.message);
  const data = [...(openOlder ?? []), ...(recent ?? [])];

  const { data: readRows } = await admin.from("household_message_reads").select("household_id, last_read_at").eq("viewer_role", "admin");
  const readByHousehold = new Map<string, string>((readRows ?? []).map((r) => [r.household_id as string, r.last_read_at as string]));

  const byHousehold = new Map<string, AdminInquiryThread>();
  for (const row of data ?? []) {
    const householdRel = row.household as
      | { primary_guardian_id?: string; guardian?: { name?: string } | { name?: string }[] }
      | { primary_guardian_id?: string; guardian?: { name?: string } | { name?: string }[] }[]
      | null;
    const household = Array.isArray(householdRel) ? householdRel[0] : householdRel;
    const guardianRel = household?.guardian;
    const guardian = Array.isArray(guardianRel) ? guardianRel[0] : guardianRel;
    const label = guardian?.name ? `${guardian.name} 가족` : row.household_id;

    let thread = byHousehold.get(row.household_id);
    if (!thread) {
      thread = { householdId: row.household_id, householdLabel: label, messages: [], hasOpen: false, unreadForAdmin: false };
      byHousehold.set(row.household_id, thread);
    }
    thread.messages.push({
      id: row.id,
      senderRole: row.sender_role,
      body: row.body,
      status: row.status,
      createdAt: row.created_at,
    });
    if (row.status === "open") thread.hasOpen = true;
    const lastReadAt = readByHousehold.get(row.household_id) ?? null;
    if (row.sender_role === "guardian" && (!lastReadAt || row.created_at > lastReadAt)) {
      thread.unreadForAdmin = true;
    }
  }
  return Array.from(byHousehold.values()).sort((a, b) => {
    if (a.hasOpen !== b.hasOpen) return a.hasOpen ? -1 : 1;
    return (b.messages.at(-1)?.createdAt ?? "").localeCompare(a.messages.at(-1)?.createdAt ?? "");
  });
}

export async function sendAdminHouseholdMessage(householdId: string, body: string): Promise<void> {
  const { adminUserId, supabase } = await requireAdmin();
  if (!body.trim()) throw new Error("내용을 입력해주세요.");
  const { error } = await supabase.from("household_messages").insert({
    household_id: householdId,
    sender_id: adminUserId,
    sender_role: "admin",
    body: body.trim(),
  });
  if (error) throw new Error(error.message);
}

export async function resolveHouseholdInquiryThread(householdId: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("household_messages")
    .update({ status: "resolved" })
    .eq("household_id", householdId)
    .eq("status", "open");
  if (error) throw new Error(error.message);
}

export async function markHouseholdMessengerReadByAdmin(householdId: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("household_message_reads")
    .upsert(
      { household_id: householdId, viewer_role: "admin", last_read_at: new Date().toISOString() },
      { onConflict: "household_id,viewer_role" }
    );
  if (error) throw new Error(error.message);
}

export type AdminMeetingRequest = {
  id: string;
  householdId: string;
  householdLabel: string;
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

export async function listMeetingRequestsForAdmin(): Promise<AdminMeetingRequest[]> {
  await requireAdmin();
  const admin = createAdminClient();
  return loadMeetingRequestsForAdmin(admin);
}

async function loadMeetingRequestsForAdmin(
  admin: ReturnType<typeof createAdminClient>
): Promise<AdminMeetingRequest[]> {
  const { data, error } = await admin
    .from("meeting_requests")
    .select(
      "id, household_id, subject, content, contact_preference, preferred_contact_time, status, starts_at, ends_at, google_meet_link, created_at, household:households(guardian:profiles!households_primary_guardian_id_fkey(name)), child:profiles!meeting_requests_child_id_fkey(name)"
    )
    .order("created_at", { ascending: false })
    // 2026-09-10(P1-2) — 미래 데이터 증가 대비 상한. 최신순 정렬이라 최근 건이
    // 먼저 나온다.
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const householdRel = r.household as { guardian?: { name?: string } | { name?: string }[] } | { guardian?: { name?: string } | { name?: string }[] }[] | null;
    const household = Array.isArray(householdRel) ? householdRel[0] : householdRel;
    const guardianRel = household?.guardian;
    const guardian = Array.isArray(guardianRel) ? guardianRel[0] : guardianRel;
    const childRel = r.child as { name?: string } | { name?: string }[] | null;
    const child = Array.isArray(childRel) ? childRel[0] : childRel;
    return {
      id: r.id,
      householdId: r.household_id,
      householdLabel: guardian?.name ? `${guardian.name} 가족` : "-",
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

export async function updateMeetingRequestStatus(
  meetingRequestId: string,
  // 2026-09-17(상담 마일스톤) — 'scheduled'는 유효한 시간+Calendar 이벤트 생성이
  // 전제라 이 함수로는 만들 수 없다. scheduleMeetingRequest()를 거쳐야 한다.
  status: "confirming" | "scheduling" | "completed" | "cancelled"
): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("meeting_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", meetingRequestId);
  if (error) throw new Error(error.message);
}

// 2026-09-17(상담 마일스톤) — meeting_requests를 'scheduled'로 전이할 때 반드시
// 거쳐야 하는 관문. 요구사항:
//  1. starts_at/ends_at이 둘 다 있고 ends_at > starts_at이어야만 진행(그렇지
//     않으면 상태 전이 자체를 거부 — "시간 없이 조용히 scheduled로 넘어가는" 회귀
//     방지).
//  2. 멱등: 이미 google_event_id가 있으면 새로 만들지 않고 시간이 바뀐 경우에만
//     patchCalendarEventTime으로 갱신한다(같은 이벤트 유지).
//  3. 실패 안전: Calendar API 호출이 실패하면 DB 상태를 전혀 건드리지 않는다(트
//     랜잭션 없이도 "호출 성공 후에만 쓰기" 순서로 같은 효과를 낸다) — 실패 응답을
//     그대로 호출부(관리자 UI)에 올려보낸다.
const CONSULT_ORGANIZER_EMAIL = process.env.CONSULT_ORGANIZER_EMAIL ?? "official@alton.education";

export async function scheduleMeetingRequest(params: {
  meetingRequestId: string;
  startsAt: string; // ISO
  endsAt: string; // ISO
}): Promise<{ googleMeetLink: string }> {
  const { supabase } = await requireAdmin();
  const admin = createAdminClient();

  const startsAtDate = new Date(params.startsAt);
  const endsAtDate = new Date(params.endsAt);
  if (Number.isNaN(startsAtDate.getTime()) || Number.isNaN(endsAtDate.getTime())) {
    throw new Error("일정 시간이 올바르지 않습니다.");
  }
  if (endsAtDate.getTime() <= startsAtDate.getTime()) {
    throw new Error("종료 시각은 시작 시각보다 뒤여야 합니다.");
  }

  const { data: row, error: loadError } = await admin
    .from("meeting_requests")
    .select("id, subject, google_event_id, google_meet_link, household:households(guardian:profiles!households_primary_guardian_id_fkey(name, email))")
    .eq("id", params.meetingRequestId)
    .single();
  if (loadError) throw new Error(loadError.message);

  const householdRel = row.household as
    | { guardian?: { name?: string; email?: string } | { name?: string; email?: string }[] }
    | { guardian?: { name?: string; email?: string } | { name?: string; email?: string }[] }[]
    | null;
  const household = Array.isArray(householdRel) ? householdRel[0] : householdRel;
  const guardianRel = household?.guardian;
  const guardian = Array.isArray(guardianRel) ? guardianRel[0] : guardianRel;

  let googleEventId = row.google_event_id as string | null;
  let googleMeetLink = row.google_meet_link as string | null;

  try {
    if (googleEventId) {
      // 이미 이벤트가 있으면 같은 이벤트의 시간만 갱신한다(새로 만들지 않음).
      await patchCalendarEventTime({
        teacherWorkspaceEmail: CONSULT_ORGANIZER_EMAIL,
        googleEventId,
        startsAt: startsAtDate,
        endsAt: endsAtDate,
        timezone: "Asia/Seoul",
        sendUpdates: "all",
      });
    } else {
      const created = await createCalendarEventWithMeet({
        teacherWorkspaceEmail: CONSULT_ORGANIZER_EMAIL,
        reservationId: params.meetingRequestId,
        startsAt: startsAtDate,
        endsAt: endsAtDate,
        summary: `[Alton] 상담 — ${guardian?.name ?? "학부모"}`,
        timezone: "Asia/Seoul",
        attendeeEmail: guardian?.email,
        sendUpdates: "all",
      });
      googleEventId = created.googleEventId;
      googleMeetLink = created.meetLink;
    }
  } catch (e) {
    // 실패 시 DB는 전혀 쓰지 않는다 — status는 이전 값(scheduling 등) 그대로
    // 남고, 관리자는 재시도할 수 있다.
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(`Calendar 일정 생성/갱신에 실패했습니다: ${message}`);
  }

  const meetingCode = googleMeetLink ? extractMeetingCodeFromLink(googleMeetLink) : null;

  const { error: updateError } = await supabase
    .from("meeting_requests")
    .update({
      status: "scheduled",
      starts_at: params.startsAt,
      ends_at: params.endsAt,
      google_event_id: googleEventId,
      google_meet_link: googleMeetLink,
      google_meeting_code: meetingCode,
      google_sync_status: "succeeded",
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.meetingRequestId);
  if (updateError) throw new Error(updateError.message);

  return { googleMeetLink: googleMeetLink as string };
}

// 면담 전용 가용시간 CRUD — consult_availability_rules/exceptions와 동일 패턴,
// 별도 테이블(meeting_availability_rules/exceptions)만 다룬다.
export type MeetingAvailabilityRule = { id: string; weekday: number; start_time: string; end_time: string; active: boolean };
export type MeetingAvailabilityException = {
  id: string;
  exception_date: string;
  is_closed: boolean;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
};

export async function listMeetingAvailabilityRules(): Promise<MeetingAvailabilityRule[]> {
  await requireAdmin();
  const admin = createAdminClient();
  return loadMeetingAvailabilityRules(admin);
}

async function loadMeetingAvailabilityRules(
  admin: ReturnType<typeof createAdminClient>
): Promise<MeetingAvailabilityRule[]> {
  const { data, error } = await admin
    .from("meeting_availability_rules")
    .select("id, weekday, start_time, end_time, active")
    .order("weekday", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as MeetingAvailabilityRule[];
}

export async function addMeetingAvailabilityRule(params: { weekday: number; startTime: string; endTime: string }): Promise<void> {
  const { adminUserId, supabase } = await requireAdmin();
  const { error } = await supabase.from("meeting_availability_rules").insert({
    weekday: params.weekday,
    start_time: params.startTime,
    end_time: params.endTime,
    created_by: adminUserId,
  });
  if (error) {
    if (error.code === "23P01") throw new Error("같은 요일에 겹치는 시간대가 이미 등록되어 있습니다.");
    throw new Error(error.message);
  }
}

export async function deactivateMeetingAvailabilityRule(ruleId: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("meeting_availability_rules").update({ active: false }).eq("id", ruleId);
  if (error) throw new Error(error.message);
}

export async function listMeetingAvailabilityExceptions(): Promise<MeetingAvailabilityException[]> {
  await requireAdmin();
  const admin = createAdminClient();
  return loadMeetingAvailabilityExceptions(admin);
}

async function loadMeetingAvailabilityExceptions(
  admin: ReturnType<typeof createAdminClient>
): Promise<MeetingAvailabilityException[]> {
  const { data, error } = await admin
    .from("meeting_availability_exceptions")
    .select("id, exception_date, is_closed, start_time, end_time, reason")
    .order("exception_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as MeetingAvailabilityException[];
}

export type MeetingOperationsDashboard = {
  requests: AdminMeetingRequest[];
  rules: MeetingAvailabilityRule[];
  exceptions: MeetingAvailabilityException[];
};

/**
 * 2026-09-10(P1-2) — "면담 운영" 서브탭이 마운트 시 호출하던 3개 서버 액션을
 * 하나로 합친다. 인증(requireAdmin)도 이 함수 안에서 한 번만 수행한다.
 */
export async function loadMeetingOperationsDashboardAction(): Promise<MeetingOperationsDashboard> {
  await requireAdmin();
  const admin = createAdminClient();
  const [requests, rules, exceptions] = await Promise.all([
    loadMeetingRequestsForAdmin(admin),
    loadMeetingAvailabilityRules(admin),
    loadMeetingAvailabilityExceptions(admin),
  ]);
  return { requests, rules, exceptions };
}

export async function addMeetingAvailabilityException(params: {
  date: string;
  isClosed: boolean;
  startTime?: string;
  endTime?: string;
  reason?: string;
}): Promise<void> {
  const { adminUserId, supabase } = await requireAdmin();
  const { error } = await supabase.from("meeting_availability_exceptions").insert({
    exception_date: params.date,
    is_closed: params.isClosed,
    start_time: params.isClosed ? null : params.startTime,
    end_time: params.isClosed ? null : params.endTime,
    reason: params.reason ?? null,
    created_by: adminUserId,
  });
  if (error) throw new Error(error.message);
}

export async function removeMeetingAvailabilityException(exceptionId: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("meeting_availability_exceptions").delete().eq("id", exceptionId);
  if (error) throw new Error(error.message);
}

// R12.1: meeting_request_messages 스레드는 더 이상 관리자 UI에도 노출하지
// 않는다 — 상담 신청과 관련된 관리자↔보호자 대화는 이제 household_messages
// (메신저)로만 처리한다. listMeetingRequestMessagesForAdmin/
// sendAdminMeetingRequestMessage는 여기서 제거했다(테이블은 추가 전용 원칙에
// 따라 그대로 유지).
