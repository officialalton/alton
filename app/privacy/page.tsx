import type { Metadata } from "next";
import LegalNotice, { LegalSection } from "@/app/components/public/LegalNotice";
import { LegalBlocks } from "@/app/components/public/LegalContent";
import { PageHero, Prose, PublicPage } from "@/app/components/public/PublicShell";
import { resolveLandingDestinations } from "@/lib/landing/cta";
import { loadLandingViewer } from "@/lib/landing/viewer";
import { PRIVACY_SECTIONS as PRIVACY_CONTENT } from "@/lib/legal/site-documents";

const DESCRIPTION = "How ALTON Education collects, uses, shares and protects personal information.";

export const metadata: Metadata = {
  title: "Privacy Policy — ALTON",
  description: DESCRIPTION,
  openGraph: { title: "Privacy Policy — ALTON", description: DESCRIPTION },
};

// Content lives in lib/legal/site-documents.ts (source: docs/contracts/privacy-policy-en.md).
export const PRIVACY_SECTIONS = PRIVACY_CONTENT.map(({ id, title }) => ({ id, title }));

export default async function PrivacyPage() {
  const dest = resolveLandingDestinations(await loadLandingViewer());
  return (
    <PublicPage dest={dest}>
      <PageHero eyebrow="LEGAL" title="Privacy Policy" />
      <Prose>
        <LegalNotice sections={PRIVACY_SECTIONS} />
        {PRIVACY_CONTENT.map((s, i) => (
          <LegalSection key={s.id} id={s.id} n={i + 1} title={s.title}>
            <LegalBlocks blocks={s.blocks} />
          </LegalSection>
        ))}
      </Prose>
    </PublicPage>
  );
}
