"use server";

// R11(문의·면담) — 관리자 서버 액션. household_messages(문의)와 meeting_requests
// (면담)를 다룬다. consultations(상담)와는 완전히 분리된 테이블이라 이 파일도
// app/admin/consultation-actions.ts와 별도로 둔다.

import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";

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
      thread = { householdId: row.household_id, householdLabel: label, messages: [], hasOpen: false };
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

export type AdminMeetingRequest = {
  id: string;
  householdLabel: string;
  childName: string | null;
  subject: string | null;
  status: "requested" | "scheduled" | "completed" | "cancelled";
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
      "id, subject, status, starts_at, ends_at, google_meet_link, created_at, household:households(guardian:profiles!households_primary_guardian_id_fkey(name)), child:profiles!meeting_requests_child_id_fkey(name)"
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
      householdLabel: guardian?.name ? `${guardian.name} 가족` : "-",
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

export async function updateMeetingRequestStatus(
  meetingRequestId: string,
  status: "scheduled" | "completed" | "cancelled"
): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("meeting_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", meetingRequestId);
  if (error) throw new Error(error.message);
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
