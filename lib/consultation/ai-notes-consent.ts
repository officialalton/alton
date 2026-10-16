import type { SupabaseClient } from "@supabase/supabase-js";
import { enableMeetSpaceSmartNotes } from "@/lib/google-meet";

/**
 * First-consultation AI meeting notes run only where the requester consented when requesting the consultation
 * (consultations.ai_notes_consent_version is stamped by the request / scheduling-link consent). Without the stamp nothing is
 * generated and no Smart Notes file is linked to the consultation.
 */
export async function consultationHasAiNotesConsent(admin: SupabaseClient, consultationId: string): Promise<boolean> {
  const { data } = await admin.from("consultations").select("ai_notes_consent_version").eq("id", consultationId).maybeSingle();
  return !!(data as { ai_notes_consent_version?: string | null } | null)?.ai_notes_consent_version;
}

/** Turns Smart Notes on for a consented first consultation's Meet space (best effort; Calendar success is never undone). */
export async function applyConsultationSmartNotesBestEffort(params: {
  admin: SupabaseClient;
  consultationId: string;
  organizerEmail: string;
  meetingCode: string;
}): Promise<void> {
  const attemptedAt = new Date().toISOString();
  try {
    await enableMeetSpaceSmartNotes({ teacherWorkspaceEmail: params.organizerEmail, meetingCode: params.meetingCode });
    await params.admin
      .from("consultations")
      .update({ smart_notes_config_status: "applied", smart_notes_config_error: null, smart_notes_config_attempted_at: attemptedAt })
      .eq("id", params.consultationId);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await params.admin
      .from("consultations")
      .update({ smart_notes_config_status: "failed", smart_notes_config_error: message.slice(0, 500), smart_notes_config_attempted_at: attemptedAt })
      .eq("id", params.consultationId);
    console.error(JSON.stringify({ type: "consultation_smart_notes_config_failed", consultationId: params.consultationId, error: message }));
  }
}
