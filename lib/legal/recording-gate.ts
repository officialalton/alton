// Whether recording / transcription / AI lesson notes capture may begin for ONE session. This module is the gate only:
// it consumes records that already exist (signed agreements and consents) and returns a structured verdict. It does not
// start or enable any capture, and there is no per-lesson consent click for ordinary participants — consent comes from the
// signed customer agreement, the signed teacher/consultant agreement, and (for under-13) the verified guardian consent.
// A customer's signature is NOT treated as the consent of every attendee: additional attendees are checked separately.
//
// Scope: this gate covers REGULAR LESSONS and FOLLOW-UP CONSULTATIONS (video/audio recording, transcription, AI notes).
// Trial lessons are always excluded. A FIRST consultation is excluded from video/audio recording and retained transcripts; its
// AI meeting notes are NOT decided here but by the single consent given when the consultation was requested
// (consultations.ai_notes_consent_version, see lib/consultation/ai-notes-consent.ts), visible to ALTON staff only.
// Future capture code must call this first; nothing in the app calls it to switch capture on today.
import { agreementCoversFourItems, type AgreementKind } from "./recording-scope";

export type CaptureSessionKind = "first_consultation" | "follow_up_consultation" | "trial_lesson" | "regular_lesson";

export type SignedAgreementEvidence = { signed: boolean; templateVersion: string | null };

export type CaptureBlockReason =
  | "first_consultation_excluded"
  | "trial_lesson_excluded"
  | "customer_agreement_not_signed"
  | "customer_agreement_scope_outdated"
  | "provider_agreement_not_signed"
  | "provider_agreement_scope_outdated"
  | "under13_guardian_relationship_unverified"
  | "under13_guardian_consent_missing"
  | "under13_guardian_consent_outdated"
  | "additional_attendee_consent_incomplete";

export type AdditionalAttendeeEvidence = { label?: string; noticeGiven: boolean; consentRecorded: boolean };

export type RecordingGateInput = {
  sessionKind: CaptureSessionKind;
  customerAgreement: SignedAgreementEvidence;
  /** the teacher (lessons) or consultant (consultations) who runs the session */
  providerAgreement: SignedAgreementEvidence;
  providerKind: Extract<AgreementKind, "teacher" | "consultant">;
  under13: {
    isUnder13: boolean;
    /** verified guardian relationship behind the recorded consent */
    guardianRelationshipVerified: boolean;
    /** a non-revoked guardian consent exists */
    consentRecorded: boolean;
    /** the recorded consent is valid for the current under-13 policy version (no newer re-consent version) */
    consentCurrent: boolean;
  };
  /** every extra attendee flagged on the session; none flagged = empty list */
  additionalAttendees: AdditionalAttendeeEvidence[];
};

export type CaptureVerdict = {
  allowed: boolean;
  reasons: { code: CaptureBlockReason; message: string }[];
  /** first reason message, kept for older callers */
  reason?: string;
};

const MESSAGE: Record<CaptureBlockReason, string> = {
  first_consultation_excluded: "A first consultation is excluded from video and audio recording and retained transcripts; its AI meeting notes depend only on the consent given when the consultation was requested.",
  trial_lesson_excluded: "A trial lesson is always excluded from recording, transcription, and AI meeting notes, including after a contract is signed.",
  customer_agreement_not_signed: "The customer agreement is not signed.",
  customer_agreement_scope_outdated: "The signed customer agreement predates the four-item recording scope; an amended agreement is required.",
  provider_agreement_not_signed: "The teacher or consultant agreement is not signed.",
  provider_agreement_scope_outdated: "The signed teacher or consultant agreement predates the four-item recording scope; an amended agreement is required.",
  under13_guardian_relationship_unverified: "The guardian relationship behind the under-13 consent is not verified.",
  under13_guardian_consent_missing: "Verified guardian consent for a child under 13 is missing.",
  under13_guardian_consent_outdated: "The guardian consent is not valid for the current under-13 consent version; re-consent is required.",
  additional_attendee_consent_incomplete: "An additional attendee has not received notice or has not given the required consent.",
};

export function evaluateLessonCapture(i: RecordingGateInput): CaptureVerdict {
  const codes: CaptureBlockReason[] = [];
  // Execution exclusions come first and are independent of any consent.
  if (i.sessionKind === "first_consultation") codes.push("first_consultation_excluded");
  if (i.sessionKind === "trial_lesson") codes.push("trial_lesson_excluded");

  if (!i.customerAgreement.signed) codes.push("customer_agreement_not_signed");
  else if (!agreementCoversFourItems("family", i.customerAgreement.templateVersion)) codes.push("customer_agreement_scope_outdated");

  if (!i.providerAgreement.signed) codes.push("provider_agreement_not_signed");
  else if (!agreementCoversFourItems(i.providerKind, i.providerAgreement.templateVersion)) codes.push("provider_agreement_scope_outdated");

  if (i.under13.isUnder13) {
    if (!i.under13.consentRecorded) codes.push("under13_guardian_consent_missing");
    else {
      if (!i.under13.guardianRelationshipVerified) codes.push("under13_guardian_relationship_unverified");
      if (!i.under13.consentCurrent) codes.push("under13_guardian_consent_outdated");
    }
  }
  if (i.additionalAttendees.some((a) => !a.noticeGiven || !a.consentRecorded)) codes.push("additional_attendee_consent_incomplete");

  const reasons = codes.map((code) => ({ code, message: MESSAGE[code] }));
  return { allowed: reasons.length === 0, reasons, reason: reasons[0]?.message };
}

/** Back-compat wrapper for the earlier flat input shape (kept so existing callers/tests keep working). */
export type LegacyRecordingGateInput = {
  lessonKind: "consultation" | "trial" | "regular";
  customerAgreementSigned: boolean;
  teacherAgreementSigned: boolean;
  under13ConsentMissing: boolean;
};

export function canStartLessonCapture(i: LegacyRecordingGateInput): { allowed: boolean; reason?: string } {
  const v = evaluateLessonCapture({
    sessionKind: i.lessonKind === "consultation" ? "first_consultation" : i.lessonKind === "trial" ? "trial_lesson" : "regular_lesson",
    customerAgreement: { signed: i.customerAgreementSigned, templateVersion: "0.3-EN-CA" },
    providerAgreement: { signed: i.teacherAgreementSigned, templateVersion: "0.2-EN" },
    providerKind: "teacher",
    under13: { isUnder13: i.under13ConsentMissing, guardianRelationshipVerified: false, consentRecorded: false, consentCurrent: false },
    additionalAttendees: [],
  });
  return { allowed: v.allowed, reason: v.reason };
}
