import type { Metadata } from "next";
import LegalNotice from "@/app/components/public/LegalNotice";
import { PageHero, Prose, PublicPage } from "@/app/components/public/PublicShell";
import { resolveLandingDestinations } from "@/lib/landing/cta";
import { loadLandingViewer } from "@/lib/landing/viewer";

export const metadata: Metadata = {
  title: "Terms of Use — ALTON",
  description: "Terms for using ALTON Education's free student account.",
  openGraph: { title: "Terms of Use — ALTON", description: "Terms for using ALTON Education's free student account." },
};

export default async function TermsPage() {
  const dest = resolveLandingDestinations(await loadLandingViewer());
  return (
    <PublicPage dest={dest}>
      <PageHero eyebrow="LEGAL" title="Terms of Use" />
      <Prose>
        <LegalNotice />
        <h2>Free student account</h2>
        <p>
          A free ALTON account gives access to practice tests, the mistake notebook, the vocabulary builder, and study materials approved for free access. It does not
          include tutoring or consulting.
        </p>
        <h2>Premium services</h2>
        <p>
          Premium tutoring and educational consulting are separate paid services with their own agreement, signed by a parent or guardian where required.
        </p>
        <h2>Your responsibilities</h2>
        <p>Keep your login private and use ALTON content only for your own study.</p>
        <h2>Questions</h2>
        <p>
          Contact <a href="mailto:hello@altonedu.com">hello@altonedu.com</a>.
        </p>
      </Prose>
    </PublicPage>
  );
}
