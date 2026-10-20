import type { Metadata } from "next";
import { OG_IMAGES } from "@/lib/site-url";
import Link from "next/link";
import { AP_SUBJECT_NAME } from "@/lib/ap-exam/layouts";
import { SAT_SLUG, apSlug } from "@/lib/landing/subjects";
import { CtaButton, PageHero, Prose, PublicPage } from "@/app/components/public/PublicShell";
import { PRACTICE_TESTS_PAGE } from "@/lib/landing/copy";
import { loadPublicDest } from "@/lib/landing/public-dest";

export const metadata: Metadata = {
  alternates: { canonical: "/practice-tests" },
  title: "Free SAT Practice Tests — ALTON",
  description: "Take free, modular and adaptive SAT practice tests and subject-specific AP tests and review detailed results and explanations.",
  openGraph: { images: OG_IMAGES, title: "Free SAT Practice Tests — ALTON", description: "Take free, modular and adaptive SAT practice tests and subject-specific AP tests and review detailed results and explanations." },
};

export default async function PracticeTestsPage() {
  const dest = await loadPublicDest();
  return (
    <PublicPage dest={dest}>
      <PageHero eyebrow="PRACTICE TESTS" title="Free SAT Practice Tests" intro={PRACTICE_TESTS_PAGE.intro} />
      <Prose>
        <h2>What you get with each test</h2>
        <ul>
          <li>Reading &amp; Writing and Math sections, each with two modules.</li>
          <li>Adaptive routing: your first-module performance shapes the second module.</li>
          <li>Detailed results and explanations after grading, with the question types that need more attention.</li>
          <li>One-click saving of missed questions to your Mistake Notebook.</li>
        </ul>
        <h2>AP practice tests</h2>
        <p>AP practice tests are subject-specific. Pick a subject to see its exam format and units.</p>
        <ul>
          <li><Link href={`/practice-tests/${SAT_SLUG}`}>SAT</Link></li>
          {Object.entries(AP_SUBJECT_NAME).map(([code, name]) => (
            <li key={code}><Link href={`/practice-tests/${apSlug(code)}`}>{name}</Link></li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-3 pt-2">
          <CtaButton href={dest.freeLearning} ctaName="free_learning" section="practice_tests_page">Start Practicing for Free</CtaButton>
        </div>
      </Prose>
    </PublicPage>
  );
}
