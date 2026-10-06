import type { Metadata } from "next";
import { PageHero, Prose, PublicPage } from "@/app/components/public/PublicShell";
import { resolveLandingDestinations } from "@/lib/landing/cta";
import { loadLandingViewer } from "@/lib/landing/viewer";

export const metadata: Metadata = {
  title: "Contact — ALTON",
  description: "Contact ALTON Education by email or request a tutoring consultation.",
  openGraph: { title: "Contact — ALTON", description: "Contact ALTON Education by email or request a tutoring consultation." },
};

export default async function ContactPage() {
  const dest = resolveLandingDestinations(await loadLandingViewer());
  return (
    <PublicPage dest={dest}>
      <PageHero eyebrow="CONTACT" title="Get in touch" />
      <Prose>
        <p>
          Questions about your account or ALTON? Email <a href="mailto:hello@altonedu.com">hello@altonedu.com</a>.
        </p>
        <p>
          Interested in tutoring or educational consulting? <a href={dest.consult}>Request a consultation</a>.
        </p>
      </Prose>
    </PublicPage>
  );
}
