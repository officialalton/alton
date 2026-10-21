import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaButton, PageHero, Prose, PublicPage } from "@/app/components/public/PublicShell";
import { JsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { loadStaticPublicDest } from "@/lib/landing/public-dest";
import { getSubjectMeta } from "@/lib/landing/subjects";
import { getPublicTests, getTestComposition } from "@/lib/landing/test-pages";
import { OG_IMAGES, SITE_NAME, absoluteUrl } from "@/lib/site-url";

// 공개 시험(세트) 개별 소개: 이름·구성 집계만. 문항 본문·정답·해설은 읽지 않는다. 목록은 요청 시 생성(빌드에 DB 불필요), ISR 1시간.
export const revalidate = 3600;
export const dynamicParams = true;

type Props = { params: Promise<{ subject: string; test: string }> };

export function generateStaticParams() {
  return [];
}

async function load(subject: string, test: string) {
  const m = getSubjectMeta(subject);
  if (!m) return null;
  const tests = await getPublicTests(m.code);
  const idx = tests.findIndex((t) => t.slug === test);
  if (idx < 0) return null;
  return { m, tests, idx, current: tests[idx] };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subject, test } = await params;
  const d = await load(subject, test);
  if (!d) return {};
  const { m, current } = d;
  const title = `${current.name} — Free Online | ALTON Education`;
  const description = `Take ${current.name} online for free: ${m.totalQuestions} questions in about ${m.totalMinutes} minutes, with detailed results and explanations after grading.`;
  const path = `/practice-tests/${m.slug}/${current.slug}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { images: OG_IMAGES, title, description, type: "website", url: path, siteName: SITE_NAME },
    twitter: { card: "summary_large_image", images: OG_IMAGES, title, description },
  };
}

export default async function TestPage({ params }: Props) {
  const { subject, test } = await params;
  const d = await load(subject, test);
  if (!d) notFound();
  const { m, tests, idx, current } = d;
  const [dest, comp] = await Promise.all([loadStaticPublicDest(), getTestComposition(current.id, m.code)]);
  const path = `/practice-tests/${m.slug}/${current.slug}`;
  const prev = tests[idx - 1];
  const next = tests[idx + 1];
  const faq = [
    { q: `Is ${current.name} free?`, a: `Yes. ${current.name} is included with a free ALTON account, along with detailed results and explanations after grading.` },
    { q: `How long does ${current.name} take?`, a: `Plan for about ${m.totalMinutes} minutes of testing time across ${m.rows.length} section${m.rows.length > 1 ? "s" : ""}.` },
  ];

  return (
    <PublicPage dest={dest}>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Course", name: current.name, description: `${current.name} on ALTON Education`, url: absoluteUrl(path), provider: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/") }, isAccessibleForFree: true }} />
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Practice Tests", path: "/practice-tests" }, { name: m.name, path: `/practice-tests/${m.slug}` }, { name: current.name, path }])} />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }} />
      <nav aria-label="Breadcrumb" className="p-wrap pt-8 text-[13px] text-[var(--p-slate)]">
        <Link href="/practice-tests" className="hover:text-[var(--p-red)]">Practice Tests</Link> /{" "}
        <Link href={`/practice-tests/${m.slug}`} className="hover:text-[var(--p-red)]">{m.name}</Link> / <span>{current.name}</span>
      </nav>
      <PageHero eyebrow={m.kind === "ap" ? "AP PRACTICE TEST" : "SAT PRACTICE TEST"} title={current.name} intro={`A free online ${m.name} practice test with detailed results and explanations after grading.`} />
      <Prose>
        <div className="flex flex-wrap gap-3 pb-4">
          <CtaButton href={dest.freeLearning} ctaName="free_learning" section={`test_${current.slug}_hero`}>Start free test</CtaButton>
        </div>
        <h2>What is in this test</h2>
        {comp ? (
          <>
            <p>
              {current.name} contains {comp.total} questions
              {comp.sections.length > 1 ? `: ${comp.sections.map((s) => `${s.count} in ${s.label}`).join(", ")}` : ""}.
              {comp.difficulty.length > 1 ? ` Difficulty is mixed, with ${comp.difficulty.map((x) => `${x.count} ${x.label.toLowerCase()}`).join(", ")} questions.` : ""}
            </p>
            {comp.topics.length > 0 && (
              <>
                <h3>{comp.topicsTitle}</h3>
                <ul>{comp.topics.map((t) => <li key={t.label}>{t.label}: {t.count} questions</li>)}</ul>
              </>
            )}
          </>
        ) : (
          <p>{current.name} follows the standard ALTON {m.name} practice format described below.</p>
        )}

        <h2>Format and timing</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[14px]">
            <thead><tr><th scope="col">Section</th><th scope="col">Time</th><th scope="col">Questions</th><th scope="col">Format</th></tr></thead>
            <tbody>
              {m.rows.map((r) => (
                <tr key={r.label}><th scope="row" className="font-medium">{r.label}</th><td>{r.minutes} min</td><td>{r.count}</td><td>{r.note}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2>After you finish</h2>
        <p>Your results show which skills or units cost you points, and every question has an explanation. You can save missed questions to a Mistake Notebook and come back to them. {m.name} practice questions are written by ALTON and are not official exam questions.</p>
        <div className="flex flex-wrap gap-3 pt-2">
          <CtaButton href={dest.freeLearning} ctaName="free_learning" section={`test_${current.slug}_footer`}>Start free test</CtaButton>
        </div>

        <h2>More {m.name} practice</h2>
        <ul>
          {prev && <li>Previous: <Link href={`/practice-tests/${m.slug}/${prev.slug}`}>{prev.name}</Link></li>}
          {next && <li>Next: <Link href={`/practice-tests/${m.slug}/${next.slug}`}>{next.name}</Link></li>}
          <li><Link href={`/practice-tests/${m.slug}`}>All {m.name} practice tests</Link></li>
        </ul>

        <h2>Frequently asked questions</h2>
        {faq.map((f) => (<div key={f.q}><h3>{f.q}</h3><p>{f.a}</p></div>))}
      </Prose>
    </PublicPage>
  );
}
