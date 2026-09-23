"use server";

// Phase B(3, 2026-09-23) — 컨설턴트 Schedule > Time Off. 등록 전에 기존
// 확정된 일정(meeting_requests.status in scheduled/confirming/scheduling,
// consultations.status='scheduled')과 겹치는지 확인해, 충돌하면 등록을
// 막고 어떤 일정과 겹치는지 알려준다("안내와 처리 경로 제공" — 사용자가
// 먼저 해당 일정을 변경/거절한 뒤 다시 등록하게 유도).

import { requireUser } from "@/lib/auth";

export type ConsultantTimeOff = {
  id: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  reason: string | null;
  createdAt: string;
};

export type TimeOffConflict = {
  kind: "meeting_request" | "consultation";
  label: string;
  startsAt: string | null;
};

async function requireConsultant() {
  const { user, profile, supabase } = await requireUser();
  if (profile?.role !== "consultant") throw new Error("컨설턴트만 접근할 수 있습니다.");
  return { userId: user.id, supabase };
}

export async function listMyTimeOffAction(): Promise<ConsultantTimeOff[]> {
  const { userId, supabase } = await requireConsultant();
  const { data, error } = await supabase
    .from("consultant_time_off")
    .select("id, starts_at, ends_at, all_day, reason, created_at")
    .eq("consultant_id", userId)
    .order("starts_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    allDay: r.all_day,
    reason: r.reason,
    createdAt: r.created_at,
  }));
}

async function findConflicts(
  supabase: Awaited<ReturnType<typeof requireConsultant>>["supabase"],
  userId: string,
  startsAt: string,
  endsAt: string
): Promise<TimeOffConflict[]> {
  const [{ data: meetings, error: meetingsError }, { data: consultations, error: consultationsError }] = await Promise.all([
    supabase
      .from("meeting_requests")
      .select("starts_at, ends_at, status, child:profiles!meeting_requests_child_id_fkey(name)")
      .eq("consultant_id", userId)
      .in("status", ["confirming", "scheduling", "scheduled"])
      .not("starts_at", "is", null)
      .lt("starts_at", endsAt)
      .gt("ends_at", startsAt),
    supabase
      .from("consultations")
      .select("starts_at, contact_name")
      .eq("admissions_consultant_id", userId)
      .eq("status", "scheduled")
      .not("starts_at", "is", null)
      .lt("starts_at", endsAt)
      .gt("starts_at", startsAt),
  ]);
  if (meetingsError) throw new Error(meetingsError.message);
  if (consultationsError) throw new Error(consultationsError.message);

  const conflicts: TimeOffConflict[] = [];
  for (const m of meetings ?? []) {
    const rel = m.child as { name: string | null } | { name: string | null }[] | null;
    const child = Array.isArray(rel) ? rel[0] : rel;
    conflicts.push({ kind: "meeting_request", label: child?.name ?? "학생 일정", startsAt: m.starts_at });
  }
  for (const c of consultations ?? []) {
    conflicts.push({ kind: "consultation", label: c.contact_name ?? "상담", startsAt: c.starts_at });
  }
  return conflicts;
}

export async function createMyTimeOffAction(params: {
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  reason?: string;
}): Promise<{ conflicts: TimeOffConflict[] } | { id: string }> {
  const { userId, supabase } = await requireConsultant();
  if (new Date(params.endsAt) <= new Date(params.startsAt)) {
    throw new Error("종료 시각은 시작 시각보다 나중이어야 합니다.");
  }

  const conflicts = await findConflicts(supabase, userId, params.startsAt, params.endsAt);
  if (conflicts.length > 0) return { conflicts };

  const { data, error } = await supabase
    .from("consultant_time_off")
    .insert({
      consultant_id: userId,
      starts_at: params.startsAt,
      ends_at: params.endsAt,
      all_day: params.allDay,
      reason: params.reason ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

export async function cancelMyTimeOffAction(timeOffId: string): Promise<void> {
  const { userId, supabase } = await requireConsultant();
  const { error } = await supabase.from("consultant_time_off").delete().eq("id", timeOffId).eq("consultant_id", userId);
  if (error) throw new Error(error.message);
}
