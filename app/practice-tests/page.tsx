import type { Metadata } from "next";
import { CtaButton, PageHero, Prose, PublicPage } from "@/app/components/public/PublicShell";
import { PRACTICE_TESTS_PAGE } from "@/lib/landing/copy";
import { resolveLandingDestinations } from "@/lib/landing/cta";
import { loadLandingViewer } from "@/lib/landing/viewer";

export const metadata: Metadata = {
  title: "Free SAT Practice Tests — ALTON",
  description: "Take free, modular and adaptive SAT practice tests and subject-specific AP tests and review detailed results and explanations.",
  openGraph: { title: "Free SAT Practice Tests — ALTON", description: "Take free, modular and adaptive SAT practice tests and subject-specific AP tests and review detailed results and explanations." },
};

export default async function PracticeTestsPage() {
  const dest = resolveLandingDestinations(await loadLandingViewer());
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
        <p>AP practice tests are subject-specific and are listed by subject in your dashboard.</p>
        <div className="flex flex-wrap gap-3 pt-2">
          <CtaButton href={dest.freeLearning} ctaName="free_learning" section="practice_tests_page">Start Practicing for Free</CtaButton>
        </div>
      </Prose>
    </PublicPage>
  );
}
