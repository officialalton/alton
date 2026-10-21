import type { Metadata } from "next";
import Link from "next/link";
import { CtaButton, PageHero, Prose, PublicPage } from "@/app/components/public/PublicShell";
import { SampleQuestions } from "@/app/components/public/SampleQuestions";
import { JsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { loadStaticPublicDest } from "@/lib/landing/public-dest";
import { getPublicTests } from "@/lib/landing/test-pages";
import { SAT_TOPICS, type SatTopic } from "@/lib/landing/sat-topics";
import { OG_IMAGES, SITE_NAME } from "@/lib/site-url";

export const satTopic = (path: string): SatTopic => SAT_TOPICS.find((t) => t.path === path)!;

export function satTopicMetadata(path: string): Metadata {
  const t = satTopic(path);
  return {
    title: t.title,
    description: t.description,
    alternates: { canonical: path },
    openGraph: { images: OG_IMAGES, title: t.title, description: t.description, type: "website", url: path, siteName: SITE_NAME },
    twitter: { card: "summary_large_image", images: OG_IMAGES, title: t.title, description: t.description },
  };
}

export async function SatTopicView({ path }: { path: string }) {
  const t = satTopic(path);
  const [dest, tests] = await Promise.all([loadStaticPublicDest(), getPublicTests("sat")]);
  return (
    <PublicPage dest={dest}>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "SAT Practice Tests", path: "/practice-tests/sat" }, { name: t.h1, path }])} />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: t.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }} />
      <nav aria-label="Breadcrumb" className="p-wrap pt-8 text-[13px] text-[var(--p-slate)]">
        <Link href="/practice-tests/sat" className="hover:text-[var(--p-red)]">SAT Practice Tests</Link> / <span>{t.h1}</span>
      </nav>
      <PageHero eyebrow="SAT PRACTICE" title={t.h1} intro={t.description} />
      <Prose>
        <p>{t.intro}</p>
        <div className="flex flex-wrap gap-3 pb-4">
          <CtaButton href={dest.freeLearning} ctaName="free_learning" section={`topic_${path.slice(1)}_hero`}>Start free test</CtaButton>
        </div>
        <h2>Content domains</h2>
        {t.domains.map((d) => (
          <div key={d.name}><h3>{d.name} (about {d.share}% of the section)</h3><p>{d.text}</p></div>
        ))}
        <SampleQuestions samples={t.samples} />
        <h2>Full-length practice tests</h2>
        <p>
          {tests.length > 0 ? `${tests.length} free full-length SAT practice tests are available, each with both sections. ` : "Full-length SAT practice tests are available with a free account. "}
          See <Link href="/practice-tests/sat">all SAT practice tests</Link>
          {tests[0] ? <>, or start with <Link href={`/practice-tests/sat/${tests[0].slug}`}>{tests[0].name}</Link></> : null}. For the other section, see{" "}
          {path === "/sat-math-practice" ? <Link href="/sat-reading-and-writing-practice">SAT Reading and Writing practice</Link> : <Link href="/sat-math-practice">SAT Math practice</Link>}.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <CtaButton href={dest.freeLearning} ctaName="free_learning" section={`topic_${path.slice(1)}_footer`}>Start free test</CtaButton>
        </div>
        <h2>Frequently asked questions</h2>
        {t.faq.map((f) => (
          <div key={f.q}><h3>{f.q}</h3><p>{f.a}</p></div>
        ))}
      </Prose>
    </PublicPage>
  );
}
