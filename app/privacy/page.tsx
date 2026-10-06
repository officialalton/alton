import type { Metadata } from "next";
import LegalNotice from "@/app/components/public/LegalNotice";
import { PageHero, Prose, PublicPage } from "@/app/components/public/PublicShell";
import { resolveLandingDestinations } from "@/lib/landing/cta";
import { loadLandingViewer } from "@/lib/landing/viewer";

export const metadata: Metadata = {
  title: "Privacy Policy — ALTON",
  description: "How ALTON Education collects and uses information for free student accounts.",
  openGraph: { title: "Privacy Policy — ALTON", description: "How ALTON Education collects and uses information for free student accounts." },
};

export default async function PrivacyPage() {
  const dest = resolveLandingDestinations(await loadLandingViewer());
  return (
    <PublicPage dest={dest}>
      <PageHero eyebrow="LEGAL" title="Privacy Policy" />
      <Prose>
        <LegalNotice />
        <h2>Information we collect</h2>
        <p>
          When you create a free student account we collect your name, email address, date of birth, grade, and school, along with the practice test answers, saved
          questions and vocabulary you create while using ALTON.
        </p>
        <h2>How we use it</h2>
        <p>
          We use this information to run your account, grade your practice tests, show your results, and keep your mistake notebook and vocabulary builder. A free
          account does not start tutoring, a contract, or any payment.
        </p>
        <h2>Students under 13</h2>
        <p>Students must be 13 or older to create a free account on their own.</p>
        <h2>Questions</h2>
        <p>
          Contact <a href="mailto:hello@altonedu.com">hello@altonedu.com</a> about your information.
        </p>
      </Prose>
    </PublicPage>
  );
}
