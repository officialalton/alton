import type { Metadata } from "next";
import { CtaButton, PageHero, Prose, PublicPage } from "@/app/components/public/PublicShell";
import { EXPERT } from "@/lib/landing/copy";
import { resolveLandingDestinations } from "@/lib/landing/cta";
import { loadLandingViewer } from "@/lib/landing/viewer";

export const metadata: Metadata = {
  title: "Premium Tutoring & Educational Consulting — ALTON",
  description: "Personalized 1:1 online tutoring and educational consulting from ALTON, available when you need more personal support.",
  openGraph: { title: "Premium Tutoring & Educational Consulting — ALTON", description: "Personalized 1:1 online tutoring and educational consulting from ALTON, available when you need more personal support." },
};

export default async function PremiumTutoringPage() {
  const dest = resolveLandingDestinations(await loadLandingViewer());
  return (
    <PublicPage dest={dest}>
      <PageHero eyebrow="PREMIUM TUTORING" title="Expert support when you need it" intro={EXPERT.body} />
      <Prose>
        {EXPERT.cards.map((c) => (
          <div key={c.title}>
            <h2>{c.title}</h2>
            <p>{c.body}</p>
          </div>
        ))}
        <h2>How it works with your free account</h2>
        <p>
          Free practice tests and learning tools stay free. Premium tutoring and educational consulting are separate paid services, and nothing in your free account
          starts a contract or a charge. If you are interested, request a consultation and we will guide you and your family through the next steps.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <CtaButton href={dest.consult} ctaName="consult" section="premium_page">{EXPERT.consultCta}</CtaButton>
          <CtaButton href={dest.freeLearning} ctaName="free_learning" section="premium_page" variant="secondary">Start Practicing for Free</CtaButton>
        </div>
      </Prose>
    </PublicPage>
  );
}
