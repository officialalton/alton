import type { SupabaseClient } from "@supabase/supabase-js";

/** A lesson (sessions row) or a follow-up consultation (meeting_requests row). */
export type AttendeeTarget = { kind: "session"; id: string } | { kind: "meeting_request"; id: string };

export type AdditionalAttendee = {
  id: string;
  displayName: string;
  relationship: string | null;
  noticeGivenAt: string | null;
  consentRecordedAt: string | null;
};

const column = (t: AttendeeTarget) => (t.kind === "session" ? "session_id" : "meeting_request_id");

/** One query per opened panel (the schedule lists themselves are not touched). */
export async function listAttendees(admin: SupabaseClient, target: AttendeeTarget): Promise<AdditionalAttendee[]> {
  const { data, error } = await admin
    .from("lesson_additional_attendees")
    .select("id, display_name, relationship, notice_given_at, consent_recorded_at")
    .eq(column(target), target.id)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    displayName: r.display_name as string,
    relationship: (r.relationship as string | null) ?? null,
    noticeGivenAt: (r.notice_given_at as string | null) ?? null,
    consentRecordedAt: (r.consent_recorded_at as string | null) ?? null,
  }));
}

export function validateAttendeeInput(displayName: string, relationship: string | null | undefined): { ok: true; displayName: string; relationship: string | null } | { ok: false; error: string } {
  const name = displayName.trim();
  if (name.length < 1 || name.length > 120) return { ok: false, error: "참석자 이름은 1~120자로 입력하세요." };
  const rel = (relationship ?? "").trim();
  if (rel.length > 120) return { ok: false, error: "관계는 120자 이하로 입력하세요." };
  return { ok: true, displayName: name, relationship: rel || null };
}

/** Flags an additional attendee. Never records notice or consent: that is the admin's step (recordAttendeeStatus). */
export async function addAttendee(
  admin: SupabaseClient,
  target: AttendeeTarget,
  input: { displayName: string; relationship?: string | null },
  actorId: string
): Promise<AdditionalAttendee[]> {
  const v = validateAttendeeInput(input.displayName, input.relationship);
  if (!v.ok) throw new Error(v.error);
  const { error } = await admin.from("lesson_additional_attendees").insert({
    [column(target)]: target.id,
    display_name: v.displayName,
    relationship: v.relationship,
    recorded_by: actorId,
  });
  if (error) throw new Error(error.message);
  return listAttendees(admin, target);
}

/**
 * Admin records that notice was given and/or consent was obtained for one attendee. The timestamps are set by the server
 * (now) and never cleared by this function; the attendee cannot record their own consent.
 */
export async function recordAttendeeStatus(
  admin: SupabaseClient,
  attendeeId: string,
  status: { notice?: boolean; consent?: boolean },
  actorId: string
): Promise<void> {
  const now = new Date().toISOString();
  if (status.notice) {
    const { error } = await admin
      .from("lesson_additional_attendees")
      .update({ notice_given_at: now, recorded_by: actorId })
      .eq("id", attendeeId)
      .is("notice_given_at", null);
    if (error) throw new Error(error.message);
  }
  if (status.consent) {
    // notice comes first: consent can only be recorded for an attendee who already has a notice time
    const { data, error } = await admin
      .from("lesson_additional_attendees")
      .update({ consent_recorded_at: now, recorded_by: actorId })
      .eq("id", attendeeId)
      .is("consent_recorded_at", null)
      .not("notice_given_at", "is", null)
      .select("id");
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      const { data: row } = await admin.from("lesson_additional_attendees").select("notice_given_at, consent_recorded_at").eq("id", attendeeId).maybeSingle();
      if (row && !row.notice_given_at) throw new Error("동의는 안내를 먼저 기록한 뒤에만 기록할 수 있습니다.");
    }
  }
}
