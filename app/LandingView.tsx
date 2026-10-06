import ConsultForm from "./ConsultForm";
import { Icon } from "./landing-icons";
import { CtaButton, PublicFooter, PublicHeader } from "./components/public/PublicShell";
import { publicFontClass } from "./components/public/fonts";
import { heroHeadline } from "@/lib/landing/claims";
import { EXPERT, FAQ, FEATURES, FINAL_CTA, HERO, NEXT_STEP } from "@/lib/landing/copy";
import type { LandingDestinations } from "@/lib/landing/cta";

const SECTION = "px-5 md:px-12 lg:px-20 py-20 md:py-24 border-t border-[#E6E1D8]";
const INNER = "max-w-[1440px] mx-auto";
const EYEBROW = "font-mono text-[12px] font-medium tracking-[0.08em] text-[#C8102E]";
const H2 = "m-0 font-[family-name:var(--font-bricolage)] font-semibold text-[28px] md:text-[36px] leading-[1.2] tracking-[-0.02em] text-[#142240]";

const FEATURE_ICONS = ["goal", "report", "homework", "essay"] as const;

/** 히어로 미리보기 — 실제 학생 화면의 구조(결과·약점 영역·오답 노트·단어장)를 보여주는 도식. 점수 수치는 싣지 않는다. */
function ProductPreview() {
  return (
    <div role="img" aria-label="Illustrative preview of practice test results, weak areas, mistake notebook and vocabulary builder" className="relative">
      <div className="ml-auto w-full max-w-[560px] bg-white border border-[#E6E1D8] rounded-3xl shadow-[0_32px_64px_-20px_rgba(20,34,64,0.2)] overflow-hidden">
        <div className="h-[52px] px-5 flex items-center justify-between border-b border-[#F1EDE6]">
          <strong className="text-[14px] text-[#142240]">Practice Test Results</strong>
          <span className="text-[11px] font-mono text-[#5F6778]">Illustrative preview</span>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { name: "Reading & Writing", note: "Module 1 → Module 2" },
              { name: "Math", note: "Module 1 → Module 2" },
            ].map((s) => (
              <div key={s.name} className="p-3.5 rounded-2xl bg-[#F8F5EF] flex flex-col gap-1">
                <strong className="text-[13px] text-[#142240]">{s.name}</strong>
                <span className="text-[11.5px] text-[#5F6778]">{s.note}</span>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-[#E6E1D8] p-4">
            <span className="font-mono text-[10px] tracking-[0.06em] text-[#5F6778]">WHERE TO FOCUS NEXT</span>
            <div className="mt-3 flex flex-col gap-2.5">
              {[
                { label: "Question types to review", w: "70%" },
                { label: "Topics to strengthen", w: "45%" },
              ].map((r) => (
                <div key={r.label} className="flex flex-col gap-1.5">
                  <span className="text-[12px] text-[#4F5A6B]">{r.label}</span>
                  <div className="h-[6px] rounded-full bg-[#EBE6DD]">
                    <div className="h-[6px] rounded-full bg-[#C8102E]" style={{ width: r.w }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[#E6E1D8] p-3.5 flex flex-col gap-1">
              <span className="font-mono text-[10px] tracking-[0.06em] text-[#5F6778]">MISTAKE NOTEBOOK</span>
              <span className="text-[12.5px] text-[#1B2536]">Saved questions, ready to retry</span>
            </div>
            <div className="rounded-2xl border border-[#E6E1D8] p-3.5 flex flex-col gap-1">
              <span className="font-mono text-[10px] tracking-[0.06em] text-[#5F6778]">VOCABULARY BUILDER</span>
              <span className="text-[12.5px] text-[#1B2536]">Your saved words, with quizzes</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingView({ dest }: { dest: LandingDestinations }) {
  const headline = heroHeadline();
  return (
    <div
      id="top"
      className={`${publicFontClass} bg-[#F8F5EF]`}
      style={{ fontFamily: "var(--font-instrument), system-ui, sans-serif" }}
    >
      <PublicHeader dest={dest} />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className={`${INNER} px-5 md:px-12 lg:px-20 pt-14 md:pt-20 pb-20 md:pb-28 grid grid-cols-1 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] gap-12 lg:gap-16 items-center`}>
            <div className="flex flex-col gap-6">
              <span className={EYEBROW}>{HERO.eyebrow}</span>
              <h1 className="m-0 font-[family-name:var(--font-bricolage)] font-semibold text-[36px] md:text-[46px] leading-[1.18] tracking-[-0.02em] text-[#142240]">
                {headline.line1}
                <br />
                {headline.line2}
              </h1>
              <p className="text-[16px] leading-[1.7] text-[#4F5A6B] max-w-[500px] m-0">{HERO.supporting}</p>
              <div className="flex flex-wrap items-center gap-3">
                <CtaButton href={dest.freeLearning} ctaName="free_learning" section="hero">{HERO.primaryCta}</CtaButton>
                <CtaButton href={dest.premium} ctaName="premium" section="hero" variant="secondary">{HERO.secondaryCta}</CtaButton>
              </div>
              <ul className="flex flex-wrap gap-2 list-none p-0 m-0">
                {HERO.labels.map((s) => (
                  <li key={s} className="py-1.5 px-3.5 rounded-full bg-white border border-[#E6E1D8] text-[13px] font-medium text-[#4F5A6B]">{s}</li>
                ))}
              </ul>
              <p className="text-[13px] leading-[1.6] text-[#5F6778] m-0 max-w-[500px]">{HERO.freeNote}</p>
            </div>
            <ProductPreview />
          </div>
        </section>

        {/* Features */}
        <section id="learning-tools" className={`bg-white ${SECTION}`}>
          <div className={`${INNER} flex flex-col gap-12`}>
            <div className="max-w-[640px] flex flex-col gap-4">
              <span className={EYEBROW}>{FEATURES.eyebrow}</span>
              <h2 className={H2}>{FEATURES.title}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {FEATURES.items.map((f, i) => (
                <div key={f.title} className="border border-[#E6E1D8] rounded-3xl p-6 flex flex-col gap-4 bg-[#F8F5EF]/40">
                  <span className="w-10 h-10 rounded-xl bg-white border border-[#E6E1D8] flex items-center justify-center">
                    <Icon name={FEATURE_ICONS[i]} />
                  </span>
                  <strong className="text-[18px] text-[#142240]">{f.title}</strong>
                  <p className="text-[14px] leading-[1.6] text-[#4F5A6B] m-0">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Next step */}
        <section className={`bg-[#F8F5EF] ${SECTION}`}>
          <div className={`${INNER} grid grid-cols-1 lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)] gap-12 items-center`}>
            <div className="flex flex-col gap-5">
              <span className={EYEBROW}>{NEXT_STEP.eyebrow}</span>
              <h2 className={H2}>{NEXT_STEP.title}</h2>
              <p className="text-[16px] leading-[1.7] text-[#4F5A6B] m-0">{NEXT_STEP.body}</p>
              <div className="flex flex-wrap items-center gap-4">
                <CtaButton href={dest.freeLearning} ctaName="free_learning" section="next_step">{NEXT_STEP.cta}</CtaButton>
                <a href={dest.studyMaterials} className="text-[14px] font-semibold text-[#284DB0]">{NEXT_STEP.materialsLink} <span aria-hidden="true">→</span></a>
              </div>
            </div>
            <ol className="grid grid-cols-1 sm:grid-cols-2 gap-4 list-none p-0 m-0">
              {NEXT_STEP.steps.map((s, i) => (
                <li key={s} className="bg-white border border-[#E6E1D8] rounded-3xl p-6 flex items-center gap-4">
                  <span className="w-9 h-9 rounded-full bg-[#142240] text-white text-[14px] font-semibold flex items-center justify-center shrink-0">{i + 1}</span>
                  <strong className="text-[16px] text-[#142240]">{s}</strong>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Expert support */}
        <section id="premium" className={`bg-white ${SECTION}`}>
          <div className={`${INNER} flex flex-col gap-12`}>
            <div className="max-w-[720px] flex flex-col gap-4">
              <span className={EYEBROW}>{EXPERT.eyebrow}</span>
              <h2 className={H2}>{EXPERT.title}</h2>
              <p className="text-[16px] leading-[1.7] text-[#4F5A6B] m-0">{EXPERT.body}</p>
              <p className="text-[15px] leading-[1.7] text-[#4F5A6B] m-0">{EXPERT.experience}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {EXPERT.cards.map((c) => (
                <div key={c.title} className="border border-[#E6E1D8] rounded-3xl p-6 flex flex-col gap-3 bg-[#F8F5EF]/40">
                  <strong className="text-[18px] text-[#142240]">{c.title}</strong>
                  <p className="text-[14px] leading-[1.6] text-[#4F5A6B] m-0">{c.body}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <CtaButton href={dest.premium} ctaName="premium" section="expert">{EXPERT.premiumCta}</CtaButton>
              <CtaButton href={dest.consult} ctaName="consult" section="expert" variant="secondary">{EXPERT.consultCta}</CtaButton>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className={`bg-[#F8F5EF] ${SECTION}`}>
          <div className="max-w-[820px] mx-auto flex flex-col gap-8">
            <h2 className={H2}>Frequently Asked Questions</h2>
            <div className="flex flex-col gap-3">
              {FAQ.map((f) => (
                <details key={f.q} className="group bg-white border border-[#E6E1D8] rounded-2xl px-5 py-4">
                  <summary className="cursor-pointer list-none flex items-center justify-between gap-4 text-[15.5px] font-semibold text-[#142240] [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span aria-hidden="true" className="text-[#C8102E] group-open:rotate-45 transition-transform text-[20px] leading-none">+</span>
                  </summary>
                  <p className="mt-3 mb-0 text-[14.5px] leading-[1.7] text-[#4F5A6B]">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-[#142240] px-5 md:px-12 lg:px-20 py-20 md:py-24">
          <div className={`${INNER} max-w-[760px] flex flex-col gap-5 items-start`}>
            <h2 className="m-0 font-[family-name:var(--font-bricolage)] font-semibold text-[30px] md:text-[38px] leading-[1.2] tracking-[-0.02em] text-white">{FINAL_CTA.title}</h2>
            <p className="text-[16px] leading-[1.7] text-[#C3CFE2] m-0">{FINAL_CTA.body}</p>
            <CtaButton href={dest.freeLearning} ctaName="free_learning" section="final_cta">{FINAL_CTA.cta}</CtaButton>
          </div>
        </section>

        {/* 공개 상담 신청 폼(기존 흐름 재사용 — 비로그인·기타 방문자의 Request a Consultation 목적지) */}
        <section id="consult" className="bg-[#F8F5EF] px-5 md:px-12 lg:px-20 py-20 md:py-24 scroll-mt-20">
          <div className="max-w-[640px] mx-auto flex flex-col gap-3 text-center mb-10">
            <span className={EYEBROW}>REQUEST A CONSULTATION</span>
            <h2 className="m-0 font-[family-name:var(--font-bricolage)] font-semibold text-[28px] md:text-[32px] leading-[1.15] tracking-[-0.02em] text-[#142240]">
              Request a 1:1 tutoring consultation
            </h2>
            <p className="text-[14.5px] text-[#4F5A6B] leading-[1.7]">
              Once you submit, we&apos;ll assign a consultant and email you a link to book a time.
            </p>
          </div>
          <ConsultForm />
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
