// Documents that can open in the shared legal popup. Content comes from the same constants the
// /terms and /privacy pages render (lib/legal/site-documents.ts) — never duplicate the text here.
import { LEGAL_LAST_UPDATED, STUDENT_TERMS_VERSION } from "@/lib/legal";
import { PRIVACY_SECTIONS, TERMS_SECTIONS, type SiteSection } from "./site-documents";

import type { LegalDocKey } from "./modal-hrefs";
export type { LegalDocKey };

export type ModalLegalDocument = {
  title: string;
  href: string;
  meta: string;
  sections: SiteSection[];
};

const META = `Last updated: ${LEGAL_LAST_UPDATED} · Version ${STUDENT_TERMS_VERSION}`;

export const MODAL_LEGAL_DOCUMENTS: Record<LegalDocKey, ModalLegalDocument> = {
  terms: { title: "Terms of Use", href: "/terms", meta: META, sections: TERMS_SECTIONS },
  privacy: { title: "Privacy Policy", href: "/privacy", meta: META, sections: PRIVACY_SECTIONS },
};
