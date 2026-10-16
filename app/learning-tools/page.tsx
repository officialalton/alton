import type { Metadata } from "next";
import { CtaButton, PageHero, Prose, PublicPage } from "@/app/components/public/PublicShell";
import { resolveLandingDestinations } from "@/lib/landing/cta";
import { loadLandingViewer } from "@/lib/landing/viewer";

export const metadata: Metadata = {
  title: "Learning Tools — ALTON",
  description: "Review results, keep a mistake notebook, build your vocabulary and use free study materials, all in one ALTON account.",
  openGraph: { title: "Learning Tools — ALTON", description: "Review results, keep a mistake notebook, build your vocabulary and use free study materials, all in one ALTON account." },
};

export default async function LearningToolsPage() {
  const dest = resolveLandingDestinations(await loadLandingViewer());
  return (
    <PublicPage dest={dest}>
      <PageHero
        eyebrow="LEARNING TOOLS"
        title="Everything you need to learn from every practice test"
        intro="Your free ALTON account keeps your results, mistakes and vocabulary together, so review builds on your own learning history."
      />
      <Prose>
        <h2>Detailed Performance Analysis</h2>
        <p>See how you did by section and question type, and where to focus next.</p>
        <h2>Mistake Notebook</h2>
        <p>Save the questions you missed and retry them later for focused review.</p>
        <h2>Vocabulary Builder</h2>
        <p>Save unfamiliar words, browse the word library, and practice with vocabulary quizzes.</p>
        <h2>Study Materials</h2>
        <p>Browse the SAT study materials ALTON has approved for free access.</p>
        <div className="flex flex-wrap gap-3 pt-2">
          <CtaButton href={dest.freeLearning} ctaName="free_learning" section="learning_tools_page">Start Free</CtaButton>
          <CtaButton href={dest.studyMaterials} ctaName="free_learning" section="learning_tools_materials" variant="secondary">Browse free study materials</CtaButton>
        </div>
      </Prose>
    </PublicPage>
  );
}
