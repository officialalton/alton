"use server";

import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { addAttendee, listAttendees, type AdditionalAttendee } from "@/lib/attendees/attendees";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/** The lesson must be the caller's own (sessions.teacher_id); checked with the caller's RLS-scoped client. */
async function assertOwnSession(sessionId: string): Promise<{ userId: string }> {
  const { user, supabase } = await requireUser();
  const { data } = await supabase.from("sessions").select("id").eq("id", sessionId).eq("teacher_id", user.id).maybeSingle();
  if (!data) throw new Error("Lesson not found.");
  return { userId: user.id };
}

export async function listMyLessonAttendeesAction(sessionId: string): Promise<Result<AdditionalAttendee[]>> {
  try {
    await assertOwnSession(sessionId);
    return { ok: true, data: await listAttendees(createAdminClient(), { kind: "session", id: sessionId }) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not load attendees." };
  }
}

/** Teachers can only flag an additional attendee; the admin records notice and consent (never the attendee or teacher). */
export async function addMyLessonAttendeeAction(sessionId: string, input: { displayName: string; relationship?: string }): Promise<Result<AdditionalAttendee[]>> {
  try {
    const { userId } = await assertOwnSession(sessionId);
    return { ok: true, data: await addAttendee(createAdminClient(), { kind: "session", id: sessionId }, input, userId) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not add the attendee." };
  }
}
