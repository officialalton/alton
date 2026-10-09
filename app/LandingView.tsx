import ConsultForm from "./ConsultForm";
import { Icon } from "./landing-icons";
import { CtaButton, Eyebrow, PublicFooter, PublicHeader, SplitTitle, sentenceCase } from "./components/public/PublicShell";
import { publicFontClass } from "./components/public/fonts";
import { HERO_HEADLINE } from "@/lib/landing/claims";
import AvailabilityCard from "./components/public/AvailabilityCard";
import { EMPTY_AVAILABILITY, type LandingAvailability } from "@/lib/landing/practice-test-count";
import DirectorPortrait from "./components/public/DirectorPortrait";
import { DIRECTOR, DIRECTOR_INTERVIEW } from "@/lib/landing/director";
import { EXPERT, FAQ, FEATURES, FINAL_CTA, HERO, NEXT_STEP } from "@/lib/landing/copy";
import type { LandingDestinations } from "@/lib/landing/cta";

const FEATURE_ICONS = ["goal", "report", "homework", "essay"] as const;
const num = (i: number) => String(i + 1).padStart(2, "0");

export default function LandingView({ dest, availability = EMPTY_AVAILABILITY }: { dest: LandingDestinations; availability?: LandingAvailability }) {
  return (
    <div id="top" className={publicFontClass}>
      <PublicHeader dest={dest} />

      <main>
        {/* Hero (paper) */}
        <section>
          <div className="p-wrap pt-14 md:pt-20 pb-16 md:pb-24 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] gap-14 lg:gap-16 items-center">
            <div className="flex flex-col gap-7">
              <Eyebrow>{sentenceCase(HERO.eyebrow)}</Eyebrow>
              <h1 className="p-h1">
                {HERO_HEADLINE.line1}
                <br />
                <em>{HERO_HEADLINE.line2}</em>
              </h1>
              <p className="p-lede max-w-[560px]">{HERO.supporting}</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <CtaButton href={dest.freeLearning} ctaName="free_learning" section="hero">{HERO.primaryCta}</CtaButton>
                <CtaButton href={dest.premium} ctaName="premium" section="hero" variant="secondary">{HERO.secondaryCta}</CtaButton>
              </div>
              <div className="border-t border-[var(--p-line)] pt-6 flex flex-col gap-4">
                <ul className="p-proof">
                  {HERO.labels.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
                <p className="m-0 text-[13.5px] leading-[1.6] text-[var(--p-mute)] max-w-[520px]">{HERO.freeNote}</p>
              </div>
            </div>
            <AvailabilityCard data={availability} />
          </div>
        </section>

        {/* Features (paper, bordered boxes) */}
        <section id="learning-tools" className="p-section">
          <div className="p-wrap flex flex-col gap-12">
            <div className="max-w-[720px] flex flex-col gap-6">
              <Eyebrow>{sentenceCase(FEATURES.eyebrow)}</Eyebrow>
              <h2 className="p-h2"><SplitTitle text={FEATURES.title} /></h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {FEATURES.items.map((f, i) => (
                <div key={f.title} className="p-box">
                  <div className="flex items-center justify-between">
                    <span className="p-label">{num(i)}</span>
                    <Icon name={FEATURE_ICONS[i]} stroke="#17171a" />
                  </div>
                  <h3 className="p-h3">{f.title}</h3>
                  <p className="p-body">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Next step (forest green) */}
        <section className="p-section p-dark p-green">
          <div className="p-wrap grid grid-cols-1 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] gap-12 lg:gap-16 items-start">
            <div className="flex flex-col gap-7">
              <Eyebrow>{sentenceCase(NEXT_STEP.eyebrow)}</Eyebrow>
              <h2 className="p-h2"><SplitTitle text={NEXT_STEP.title} /></h2>
              <p className="p-body">{NEXT_STEP.body}</p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                <CtaButton href={dest.freeLearning} ctaName="free_learning" section="next_step">{NEXT_STEP.cta}</CtaButton>
                <a href={dest.studyMaterials} className="p-link text-[15px]">{NEXT_STEP.materialsLink} <span aria-hidden="true">→</span></a>
              </div>
            </div>
            <ol className="grid grid-cols-1 sm:grid-cols-2 gap-5 list-none p-0 m-0">
              {NEXT_STEP.steps.map((s, i) => (
                <li key={s} className="p-box">
                  <span className="p-label">Step {num(i)}</span>
                  <strong className="p-h3">{s}</strong>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Expert support (maroon) */}
        <section id="premium" className="p-section p-dark p-maroon">
          <div className="p-wrap flex flex-col gap-12">
            <div className="max-w-[760px] flex flex-col gap-6">
              <Eyebrow>{sentenceCase(EXPERT.eyebrow)}</Eyebrow>
              <h2 className="p-h2"><SplitTitle text={EXPERT.title} /></h2>
              <p className="p-lede">{EXPERT.body}</p>
              <p className="p-body">{EXPERT.experience}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {EXPERT.cards.map((c, i) => (
                <div key={c.title} className="p-box">
                  <span className="p-label">Service {num(i)}</span>
                  <h3 className="p-h3">{c.title}</h3>
                  <p className="p-body">{c.body}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <CtaButton href={dest.premium} ctaName="premium" section="expert">{EXPERT.premiumCta}</CtaButton>
              <CtaButton href={dest.consult} ctaName="consult" section="expert" variant="secondary">{EXPERT.consultCta}</CtaButton>
            </div>
          </div>
        </section>

        {/* Meet Chrisy Kim (paper) */}
        <section id={DIRECTOR.anchor} className="p-section scroll-mt-20">
          <div className="p-wrap grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-12 lg:gap-16 items-start">
            <div className="flex flex-col gap-6 max-w-[380px]">
              <DirectorPortrait />
              <div className="flex flex-col gap-2">
                <strong className="p-h3">{DIRECTOR.name}</strong>
                <span className="p-label">{DIRECTOR.title}</span>
                <p className="p-body">{DIRECTOR.credential}</p>
              </div>
            </div>
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-6">
                <Eyebrow>{DIRECTOR.eyebrow}</Eyebrow>
                <h2 className="p-h2">Meet <em>Chrisy Kim</em></h2>
              </div>
              <div className="p-qa">
                {DIRECTOR_INTERVIEW.map((x) => (
                  <div key={x.q}>
                    <h3>{x.q}</h3>
                    <p className="p-body">{x.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FAQ (paper) */}
        <section id="faq" className="p-section">
          <div className="p-wrap max-w-[860px] flex flex-col gap-10">
            <h2 className="p-h2">Frequently asked <em>questions</em></h2>
            <div className="p-faq">
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>
                    {f.q}
                    <span aria-hidden="true">+</span>
                  </summary>
                  <p className="p-body pb-6 m-0 max-w-[720px]">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA (green) */}
        <section className="p-section p-dark p-green">
          <div className="p-wrap max-w-[860px] flex flex-col gap-7 items-start">
            <h2 className="p-h2"><SplitTitle text={FINAL_CTA.title} /></h2>
            <p className="p-lede" style={{ color: "#e6e2da" }}>{FINAL_CTA.body}</p>
            <CtaButton href={dest.freeLearning} ctaName="free_learning" section="final_cta">{FINAL_CTA.cta}</CtaButton>
          </div>
        </section>

        {/* 공개 상담 신청 폼(기존 흐름 재사용 — 비로그인·기타 방문자의 Request a Consultation 목적지) */}
        <section id="consult" className="p-section scroll-mt-20">
          <div className="p-wrap max-w-[760px] flex flex-col gap-6 mb-10">
            <Eyebrow>Request a consultation</Eyebrow>
            <h2 className="p-h2" style={{ fontSize: "clamp(32px, 7vw, 46px)" }}>
              Request a 1:1 <em>tutoring consultation</em>
            </h2>
            <p className="p-body">Once you submit, we&apos;ll assign a consultant and email you a link to book a time.</p>
          </div>
          <div className="p-wrap max-w-[760px] p-consult">
            <ConsultForm />
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
