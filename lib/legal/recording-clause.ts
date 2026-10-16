import { GENERATED_LEGAL_DOCUMENTS } from "./documents/generated";
import type { LegalBlock } from "./types";

/**
 * The regular-lesson recording / transcription / AI notes clause. It is identical in the parent
 * agreement, both teacher agreements, the under-13 parental consent, the Terms and the Privacy Policy;
 * the Terms and Privacy pages render this exact constant so the wording cannot diverge between them.
 */
export const RECORDING_CLAUSE_HEADING = "Video Recording, Audio Recording, Transcription, and AI Lesson Notes";

function extractParagraphs(): readonly string[] {
  const section = GENERATED_LEGAL_DOCUMENTS.parentAgreement.sections.find((s) => s.heading?.includes(RECORDING_CLAUSE_HEADING));
  if (!section) throw new Error("recording clause missing from parent agreement source");
  const paragraphs = section.blocks.filter((b): b is Extract<LegalBlock, { t: "p" }> => b.t === "p").map((b) => b.text);
  if (paragraphs.length !== 5) throw new Error("recording clause must have exactly five paragraphs");
  return paragraphs;
}

export const RECORDING_CLAUSE_PARAGRAPHS: readonly string[] = extractParagraphs();

/** The four independent regular-lesson processing scopes a participant consents to. */
export const LESSON_MEDIA_CONSENT_SCOPES = ["video_recording", "audio_recording", "transcription", "ai_lesson_notes"] as const;
export type LessonMediaConsentScope = (typeof LESSON_MEDIA_CONSENT_SCOPES)[number];
