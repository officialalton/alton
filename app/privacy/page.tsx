import type { Metadata } from "next";
import { OG_IMAGES } from "@/lib/site-url";
import LegalNotice, { LegalSection } from "@/app/components/public/LegalNotice";
import { LegalBlocks } from "@/app/components/public/LegalContent";
import { PageHero, Prose, PublicPage } from "@/app/components/public/PublicShell";
import { loadPublicDest } from "@/lib/landing/public-dest";
import { PRIVACY_SECTIONS as PRIVACY_CONTENT } from "@/lib/legal/site-documents";

const DESCRIPTION = "How ALTON Education collects, uses, shares and protects personal information.";

export const metadata: Metadata = {
  alternates: { canonical: "/privacy" },
  title: "Privacy Policy — ALTON",
  description: DESCRIPTION,
  openGraph: { images: OG_IMAGES, title: "Privacy Policy — ALTON", description: DESCRIPTION },
};

// Content lives in lib/legal/site-documents.ts (source: docs/contracts/privacy-policy-en.md).
export const PRIVACY_SECTIONS = PRIVACY_CONTENT.map(({ id, title }) => ({ id, title }));

export default async function PrivacyPage() {
  const dest = await loadPublicDest();
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
