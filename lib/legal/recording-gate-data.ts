import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateLessonCapture, type CaptureSessionKind, type CaptureVerdict, type RecordingGateInput } from "./recording-gate";
import { MAIN_TEACHER_FORMS } from "@/lib/teacher-agreements/status";

/**
 * Builds the gate input for one lesson session from EXISTING records only (no new consent step):
 *  - lesson type (regular / trial) from lesson_types
 *  - customer agreement: the family contract of the subject enrollment (active) and its latest completed version's template_version
 *  - teacher agreement: the teacher's latest signed main agreement and its template_version
 *  - under-13: is_under_13, the latest non-revoked guardian consent, and has_valid_guardian_consent (current policy version)
 *  - additional attendees flagged on the session
 * Service-role client expected. Consultation sessions (first / follow-up) are not rows in `sessions`; callers pass the
 * kind through evaluateLessonCapture() directly.
 */
export async function loadLessonCaptureGateInput(admin: SupabaseClient, sessionId: string): Promise<RecordingGateInput | null> {
  const { data: session } = await admin.from("sessions").select("id, teacher_id, subject_enrollment_id, lesson_type_id").eq("id", sessionId).maybeSingle();
  if (!session) return null;

  const [{ data: lessonType }, { data: enrollment }] = await Promise.all([
    admin.from("lesson_types").select("code").eq("id", session.lesson_type_id).maybeSingle(),
    admin.from("subject_enrollments").select("child_id, contract_id").eq("id", session.subject_enrollment_id).maybeSingle(),
  ]);
  const code = (lessonType?.code as string | undefined) ?? "";
  const sessionKind: CaptureSessionKind = code === "trial" ? "trial_lesson" : "regular_lesson";
  const childId = enrollment?.child_id as string | undefined;

  const [{ data: contract }, { data: versions }, { data: teacherRows }, attendees, under13, consents] = await Promise.all([
    enrollment?.contract_id ? admin.from("contracts").select("status").eq("id", enrollment.contract_id).maybeSingle() : Promise.resolve({ data: null }),
    enrollment?.contract_id
      ? admin.from("contract_versions").select("template_version, docusign_envelope_status, version_number").eq("contract_id", enrollment.contract_id).order("version_number", { ascending: false })
      : Promise.resolve({ data: [] as { template_version: string | null; docusign_envelope_status: string | null }[] }),
    admin
      .from("teacher_contracts")
      .select("template_version, signed_at")
      .eq("teacher_id", session.teacher_id)
      .eq("status", "signed")
      .in("agreement_form", [...MAIN_TEACHER_FORMS])
      .order("signed_at", { ascending: false })
      .limit(1),
    admin.from("lesson_additional_attendees").select("display_name, notice_given_at, consent_recorded_at").eq("session_id", sessionId),
    childId ? admin.rpc("is_under_13", { p_student_id: childId }) : Promise.resolve({ data: false }),
    childId
      ? admin.from("guardian_consents").select("verification_method, consented_by, revoked_at").eq("student_id", childId).is("revoked_at", null).limit(1)
      : Promise.resolve({ data: [] as { verification_method: string | null }[] }),
  ]);

  const signedVersion = (versions ?? []).find((v) => v.docusign_envelope_status === "completed") ?? null;
  const isUnder13 = Boolean(under13.data);
  const consentRow = (consents.data ?? [])[0] as { verification_method: string | null; consented_by: string | null } | undefined;
  const validRpc = isUnder13 && childId ? await admin.rpc("has_valid_guardian_consent", { p_student_id: childId }) : { data: false };

  return {
    sessionKind,
    customerAgreement: { signed: contract?.status === "active" && !!signedVersion, templateVersion: (signedVersion?.template_version as string | null | undefined) ?? null },
    providerAgreement: { signed: !!teacherRows?.[0], templateVersion: (teacherRows?.[0]?.template_version as string | null | undefined) ?? null },
    providerKind: "teacher",
    under13: {
      isUnder13,
      consentRecorded: !!consentRow,
      guardianRelationshipVerified: !!consentRow?.verification_method && !!consentRow?.consented_by,
      consentCurrent: Boolean(validRpc.data),
    },
    additionalAttendees: (attendees.data ?? []).map((a) => ({ label: a.display_name as string, noticeGiven: !!a.notice_given_at, consentRecorded: !!a.consent_recorded_at })),
  };
}

export async function evaluateSessionCapture(admin: SupabaseClient, sessionId: string): Promise<CaptureVerdict> {
  const input = await loadLessonCaptureGateInput(admin, sessionId);
  if (!input) return { allowed: false, reasons: [], reason: "Session not found." };
  return evaluateLessonCapture(input);
}
