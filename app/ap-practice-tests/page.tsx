import type { Metadata } from "next";
import Link from "next/link";
import { AP_SUBJECT_NAME, isApPublicSubject } from "@/lib/ap-exam/layouts";
import { apSlug } from "@/lib/landing/subjects";
import { SUBJECT_ABOUT } from "@/lib/landing/samples";
import { CtaButton, PageHero, Prose, PublicPage } from "@/app/components/public/PublicShell";
import { JsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { loadStaticPublicDest } from "@/lib/landing/public-dest";
import { OG_IMAGES, SITE_NAME } from "@/lib/site-url";

export const revalidate = 3600;

const TITLE = "Free AP Practice Tests Online by Subject | ALTON Education";
const DESCRIPTION = "Free AP practice tests by subject, including Calculus, Statistics, Biology, Chemistry, Physics, Economics, Psychology, History and English, with detailed results and explanations.";
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/ap-practice-tests" },
  openGraph: { images: OG_IMAGES, title: TITLE, description: DESCRIPTION, type: "website", url: "/ap-practice-tests", siteName: SITE_NAME },
  twitter: { card: "summary_large_image", images: OG_IMAGES, title: TITLE, description: DESCRIPTION },
};

const firstSentence = (s: string) => s.split(/(?<=\.)\s/)[0];

export default async function ApHubPage() {
  const dest = await loadStaticPublicDest();
  const subjects = Object.entries(AP_SUBJECT_NAME).filter(([code]) => isApPublicSubject(code));
  return (
    <PublicPage dest={dest}>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "AP Practice Tests", path: "/ap-practice-tests" }])} />
      <PageHero eyebrow="AP PRACTICE TESTS" title="Free AP Practice Tests by Subject" intro={DESCRIPTION} />
      <Prose>
        <p>
          Choose your AP course to see its exam format, units and the free practice tests available now. Each subject page lists the sections, timing and calculator rules we use, and
          the practice questions are written by ALTON rather than copied from past exams. Looking for the SAT instead? See the <Link href="/practice-tests/sat">free SAT practice tests</Link>.
        </p>
        <div className="flex flex-wrap gap-3 pb-4">
          <CtaButton href={dest.freeLearning} ctaName="free_learning" section="ap_hub_hero">Start free test</CtaButton>
        </div>
        <h2>{subjects.length} AP subjects</h2>
        {subjects.map(([code, name]) => (
          <div key={code}>
            <h3><Link href={`/practice-tests/${apSlug(code)}`}>{name} practice tests</Link></h3>
            {SUBJECT_ABOUT[code] && <p>{firstSentence(SUBJECT_ABOUT[code])}</p>}
          </div>
        ))}
      </Prose>
    </PublicPage>
  );
}
