// The single consent given when a first consultation is requested (landing form, or the scheduling-link page when the request
// was created internally and carries no stamp yet): collection and use of personal information AND AI-generated meeting
// notes of the first consultation. There is no separate checkbox: this extends the existing privacy consent wording.
// The accepted wording VERSION and a timestamp are stored on the consultation (consultations.ai_notes_consent_version /
// ai_notes_consent_at); first-consultation Smart Notes are generated and linked only when that stamp exists. Change the
// text => bump the version. The shared legal text states the same rule (see docs/contracts).
export const FIRST_CONSULTATION_CONSENT_VERSION = "FC-AI-EN-2026-10-07";

export const FIRST_CONSULTATION_CONSENT_TEXT =
  "I agree to the collection and use of my personal information for this consultation, and to AI-generated meeting notes of the first consultation. " +
  "The notes are visible only to ALTON staff and are eligible for deletion one year after the consultation ends. " +
  "The first consultation is not video or audio recorded, and no transcript is kept. " +
  "If this request is for a child under 13, I am the child's parent or legal guardian and I give this consent as the guardian. " +
  "(Name, phone, and email are used only for the consultation and deleted after a retention period once it ends.)";

export const FIRST_CONSULTATION_CONSENT_REQUIRED_MESSAGE =
  "Please agree to the collection and use of your personal information and to AI-generated meeting notes of the first consultation.";
