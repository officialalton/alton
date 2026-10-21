import type { Metadata } from "next";
import { OG_IMAGES } from "@/lib/site-url";
import { CtaButton, PageHero, Prose, PublicPage } from "@/app/components/public/PublicShell";
import { loadPublicDest } from "@/lib/landing/public-dest";

export const metadata: Metadata = {
  alternates: { canonical: "/about" },
  title: "About ALTON Education",
  description: "ALTON Education helps students in the US and Korea prepare for the SAT and AP with free practice tools and premium online tutoring.",
  openGraph: { images: OG_IMAGES, title: "About ALTON Education", description: "ALTON Education helps students in the US and Korea prepare for the SAT and AP with free practice tools and premium online tutoring." },
};

export default async function AboutPage() {
  const dest = await loadPublicDest();
  return (
    <PublicPage dest={dest}>
      <PageHero eyebrow="ABOUT ALTON" title="One brand, one login, one learning history" />
      <Prose>
        <p>
          Alton Education LLC (ALTON Education) supports students in the US and Korea who are preparing for the SAT and AP and aiming for top US universities.
        </p>
        <p>
          You can start with free practice tests and learning tools. If you later want a more personal approach, ALTON&apos;s premium online tutoring and educational
          consulting continue from the same account, with your learning history as a starting point.
        </p>
        <p>
          ALTON Education is operated by Alton Education LLC, a company based in California, United States. Questions about the service can go to{" "}
          <a href="mailto:official@alton.education">official@alton.education</a>.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <CtaButton href={dest.freeLearning} ctaName="free_learning" section="about_page">Start Free</CtaButton>
          <CtaButton href="/contact" ctaName="contact" section="about_page" variant="secondary">Contact us</CtaButton>
        </div>
      </Prose>
    </PublicPage>
  );
}
