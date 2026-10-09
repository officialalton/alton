"use server";

import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { addAttendee, listAttendees, recordAttendeeStatus, type AdditionalAttendee, type AttendeeTarget } from "@/lib/attendees/attendees";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function parseTarget(kind: string, id: string): AttendeeTarget {
  if ((kind !== "session" && kind !== "meeting_request") || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error("잘못된 대상입니다.");
  return { kind, id };
}

export async function listAttendeesAction(kind: string, id: string): Promise<Result<AdditionalAttendee[]>> {
  try {
    await requireAdmin();
    return { ok: true, data: await listAttendees(createAdminClient(), parseTarget(kind, id)) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "불러오지 못했습니다." };
  }
}

export async function addAttendeeAction(kind: string, id: string, input: { displayName: string; relationship?: string }): Promise<Result<AdditionalAttendee[]>> {
  try {
    const { adminUserId } = await requireAdmin();
    return { ok: true, data: await addAttendee(createAdminClient(), parseTarget(kind, id), input, adminUserId) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "추가하지 못했습니다." };
  }
}

/** 관리자만 안내·동의를 기록한다. 참석자 본인이나 선생님은 기록할 수 없다. */
export async function recordAttendeeStatusAction(
  kind: string,
  id: string,
  attendeeId: string,
  status: { notice?: boolean; consent?: boolean }
): Promise<Result<AdditionalAttendee[]>> {
  try {
    const { adminUserId } = await requireAdmin();
    const admin = createAdminClient();
    const target = parseTarget(kind, id);
    await recordAttendeeStatus(admin, attendeeId, status, adminUserId);
    return { ok: true, data: await listAttendees(admin, target) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "기록하지 못했습니다." };
  }
}
