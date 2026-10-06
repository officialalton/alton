import type { Metadata } from "next";
import { LegalBlocks } from "@/app/components/public/LegalContent";
import { PageHero, Prose, PublicPage } from "@/app/components/public/PublicShell";
import { UNDER_13_CONSENT_TITLE, UNDER_13_CONSENT_VERSION, under13NoticeSections } from "@/lib/contracts/under13-notice";
import { resolveLandingDestinations } from "@/lib/landing/cta";
import { loadLandingViewer } from "@/lib/landing/viewer";

const DESCRIPTION = "The notice a parent or guardian receives before consenting to ALTON collecting a child under 13's information.";

export const metadata: Metadata = {
  title: `${UNDER_13_CONSENT_TITLE} — ALTON`,
  description: DESCRIPTION,
};

export default async function Under13NoticePage() {
  const dest = resolveLandingDestinations(await loadLandingViewer());
  return (
    <PublicPage dest={dest}>
      <PageHero eyebrow="LEGAL" title={UNDER_13_CONSENT_TITLE} />
      <Prose>
        {under13NoticeSections().map((s, i) => (
          <section key={i}>
            {s.heading && <h2>{s.heading}</h2>}
            <LegalBlocks blocks={s.blocks} />
          </section>
        ))}
        <p>Consent version: {UNDER_13_CONSENT_VERSION}</p>
      </Prose>
    </PublicPage>
  );
}
