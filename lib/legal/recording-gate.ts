// Whether regular-lesson capture (video, audio, transcript, AI notes) may begin. Consent comes only from the
// signed customer agreement and the teacher's signed agreement — there is no per-lesson consent step.
// Capture itself is not implemented/activated by this module; any future capture code must call it first.
export type RecordingGateInput = {
  lessonKind: "consultation" | "trial" | "regular";
  customerAgreementSigned: boolean;
  teacherAgreementSigned: boolean;
  /** true when the student is under 13 and verified guardian consent is not on record */
  under13ConsentMissing: boolean;
};

export function canStartLessonCapture(i: RecordingGateInput): { allowed: boolean; reason?: string } {
  if (i.lessonKind !== "regular") return { allowed: false, reason: "Consultations and trial lessons are never recorded." };
  if (!i.customerAgreementSigned) return { allowed: false, reason: "The customer agreement is not signed." };
  if (!i.teacherAgreementSigned) return { allowed: false, reason: "The teacher agreement is not signed." };
  if (i.under13ConsentMissing) return { allowed: false, reason: "Verified parental consent for a child under 13 is missing." };
  return { allowed: true };
}
