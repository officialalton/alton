// Parent Notice and Consent for a Child Under 13 (version U13-EN-2026-10-06).
// Source: docs/contracts/under-13-parental-notice-and-consent-en.md. The text is shown to the guardian on the
// consent screen; the signature/date/blank lines of the paper form are replaced by the in-app verified
// consent action (consent_as_guardian), which still requires an active guardian relationship.
import { GENERATED_LEGAL_DOCUMENTS } from "@/lib/legal/documents/generated";
import type { LegalBlock } from "@/lib/legal/types";

export const UNDER_13_CONSENT_VERSION = "U13-EN-2026-10-06";
export const UNDER_13_CONSENT_TITLE = "Parent Notice and Consent for a Child Under 13";

const FORM_ONLY = /_{4,}|^Consent version:/;

export type Under13Section = { heading: string | null; blocks: readonly LegalBlock[] };

/** Notice sections without the paper form's blank lines (child/parent entry lines, signature line, version line). */
export function under13NoticeSections(): Under13Section[] {
  return GENERATED_LEGAL_DOCUMENTS.under13Notice.sections.map((s) => ({
    heading: s.heading,
    blocks: s.blocks
      .map((b): LegalBlock | null => {
        if (b.t === "ul") return b;
        return FORM_ONLY.test(b.text) ? null : b;
      })
      .filter((b): b is LegalBlock => b !== null),
  }));
}
