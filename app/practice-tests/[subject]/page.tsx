import type { Metadata } from "next";
import { OG_IMAGES } from "@/lib/site-url";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaButton, PageHero, Prose, PublicPage } from "@/app/components/public/PublicShell";
import { JsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { loadStaticPublicDest } from "@/lib/landing/public-dest";
import { allSubjectSlugs, getSubjectMeta } from "@/lib/landing/subjects";
import { getPublicTests } from "@/lib/landing/test-pages";
import { AP_SAMPLES, SAT_SAMPLES, SUBJECT_ABOUT } from "@/lib/landing/samples";
import { SampleQuestions } from "@/app/components/public/SampleQuestions";
import { SITE_NAME, absoluteUrl } from "@/lib/site-url";

// 공개 과목 소개: 정적 메타 + 공개 세트 이름만. 문항 본문·정답·해설은 읽지 않는다. ISR 1시간.
export const revalidate = 3600;
export const dynamicParams = false;

type Props = { params: Promise<{ subject: string }> };

export function generateStaticParams() {
  return allSubjectSlugs().map((subject) => ({ subject }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subject } = await params;
  const m = getSubjectMeta(subject);
  if (!m) return {};
  const title = m.kind === "sat" ? "Free SAT Practice Tests Online with Answers & Explanations | ALTON Education" : `Free ${m.name} Practice Test Online — Exam Format & Units | ALTON Education`;
  return {
    title,
    description: m.description,
    alternates: { canonical: `/practice-tests/${m.slug}` },
    openGraph: { images: OG_IMAGES, title, description: m.description, type: "website", url: `/practice-tests/${m.slug}`, siteName: SITE_NAME },
    twitter: { card: "summary_large_image", images: OG_IMAGES, title, description: m.description },
  };
}

export default async function SubjectPage({ params }: Props) {
  const { subject } = await params;
  const m = getSubjectMeta(subject);
  if (!m) notFound();
  const [dest, published] = await Promise.all([loadStaticPublicDest(), getPublicTests(m.code)]);
  const samples = m.kind === "sat" ? [...SAT_SAMPLES.math.slice(0, 1), ...SAT_SAMPLES.rw.slice(0, 1)] : AP_SAMPLES[m.code] ? [AP_SAMPLES[m.code]] : [];
  const about = SUBJECT_ABOUT[m.code];
  const path = `/practice-tests/${m.slug}`;

  const course = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: `${m.name} Practice Tests`,
    description: m.description,
    url: absoluteUrl(path),
    provider: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/") },
    isAccessibleForFree: true,
  };

  return (
    <PublicPage dest={dest}>
      <JsonLd data={course} />
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Practice Tests", path: "/practice-tests" }, { name: m.name, path }])} />
      <nav aria-label="Breadcrumb" className="p-wrap pt-8 text-[13px] text-[var(--p-slate)]">
        <Link href="/practice-tests" className="hover:text-[var(--p-red)]">Practice Tests</Link> / <span>{m.name}</span>
      </nav>
      <PageHero eyebrow={m.kind === "ap" ? "AP PRACTICE TESTS" : "SAT PRACTICE TESTS"} title={m.kind === "sat" ? "Free SAT Practice Tests Online" : `Free ${m.name} Practice Tests`} intro={m.description} />
      <Prose>
        <div className="flex flex-wrap gap-3 pb-4">
          <CtaButton href={dest.freeLearning} ctaName="free_learning" section={`subject_${m.slug}_hero`}>Start free practice</CtaButton>
        </div>

        {about && <p>{about}</p>}

        <h2>Exam format</h2>
        <p>About {m.totalMinutes} minutes and {m.totalQuestions} {m.kind === "ap" ? "questions and prompts" : "questions"} in total.</p>
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-[14px]">
            <thead>
              <tr><th scope="col">Section</th><th scope="col">Time</th><th scope="col">Questions</th><th scope="col">Format</th></tr>
            </thead>
            <tbody>
              {m.rows.map((r) => (
                <tr key={r.label}><th scope="row" className="font-medium">{r.label}</th><td>{r.minutes} min</td><td>{r.count}</td><td>{r.note}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="sm:hidden list-none flex flex-col gap-3" style={{ margin: 0, padding: 0 }} aria-label="Exam format by section">
          {m.rows.map((r) => (
            <li key={r.label} className="border border-[var(--p-line)] p-4 flex flex-col gap-1">
              <strong className="text-[15px]">{r.label}</strong>
              <span className="text-[13.5px]">{r.minutes} min · {r.count} {r.count === 1 ? "question" : "questions"}</span>
              <span className="text-[13.5px] text-[var(--p-slate)]">{r.note}</span>
            </li>
          ))}
        </ul>

        {m.units.length > 0 && (
          <>
            <h2>{m.unitsTitle}</h2>
            <ol>
              {m.units.map((u) => (
                <li key={u.code}>{u.title}{u.mc ? ` — ${u.mc[0]}–${u.mc[1]}% of multiple-choice questions` : ""}</li>
              ))}
            </ol>
          </>
        )}

        <SampleQuestions samples={samples} />

        {m.kind === "sat" && (
          <p>
            Prefer to focus on one section? See <Link href="/sat-math-practice">SAT Math practice</Link> and{" "}
            <Link href="/sat-reading-and-writing-practice">SAT Reading and Writing practice</Link>.
          </p>
        )}

        <h2>Free practice sets</h2>
        {published.length > 0 ? (
          <>
            <p>{published.length} published {published.length === 1 ? "set" : "sets"} so far. Create a free account to take them.</p>
            <ul>{published.map((s) => <li key={s.slug}><Link href={`/practice-tests/${m.slug}/${s.slug}`}>{s.name}</Link></li>)}</ul>
          </>
        ) : (
          <p>New {m.name} practice sets are added regularly. Create a free account to be ready when they are published.</p>
        )}
        <div className="flex flex-wrap gap-3 pt-2">
          <CtaButton href={dest.freeLearning} ctaName="free_learning" section={`subject_${m.slug}_sets`}>Start free practice</CtaButton>
        </div>

        <h2>Frequently asked questions</h2>
        {m.faq.map((f) => (
          <div key={f.q}><h3>{f.q}</h3><p>{f.a}</p></div>
        ))}
      </Prose>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: m.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        }}
      />
    </PublicPage>
  );
}
