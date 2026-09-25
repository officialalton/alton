import {
  Bricolage_Grotesque,
  IBM_Plex_Mono,
  IBM_Plex_Sans_KR,
  Instrument_Sans,
} from "next/font/google";
import Link from "next/link";
import ConsultForm from "./ConsultForm";
import LandingCtaLink from "./LandingCtaLink";
import RolesPanel from "./RolesPanel";
import { Icon } from "./landing-icons";
import GrowthChart from "./GrowthChart";

// 랜딩 페이지 리디자인(2026-09-25) — 디자인 목업(Landing.dc.html / Hero.dc.html)을
// 그대로 이식. 목업 전용 폰트라 루트 레이아웃이 아니라 이 파일에서만 로드한다.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-bricolage",
});
const instrument = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-instrument",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});
const plexKr = IBM_Plex_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-kr",
});

const NAV_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#roles", label: "For Students" },
  { href: "#roles", label: "For Parents" },
  { href: "#roles", label: "For Tutors" },
  { href: "#college", label: "College Guidance" },
];

const SUBJECT_PILLS = ["AP Chemistry", "SAT Math", "Essay writing", "SAT Reading & Writing"];

const HOW_IT_WORKS = [
  {
    n: "01",
    icon: "match" as const,
    title: "Match",
    kr: "학생에게 맞는 선생님",
    body: "We match on subject, goals and schedule — then keep the same tutor for continuity.",
  },
  {
    n: "02",
    icon: "lesson" as const,
    title: "Learn",
    kr: "1:1 수업",
    body: "Live 1:1 lessons with shared materials, notes and practice — all in one place.",
  },
  {
    n: "03",
    icon: "feedback" as const,
    title: "Feedback",
    kr: "매 수업 피드백",
    body: "Specific, written feedback after every lesson — for the student and the family.",
  },
  {
    n: "04",
    icon: "growth" as const,
    title: "Grow",
    kr: "눈에 보이는 성장",
    body: "Weekly goals and a visible record of progress, lesson after lesson.",
  },
];

const COLLEGE_POINTS = [
  { icon: "explore" as const, t: "Explore colleges", d: "Structured, sourced profiles — admission outlook, program rules, cost." },
  { icon: "essay" as const, t: "Essays, with continuity", d: "The tutor who knows the student's writing helps write the essay." },
  { icon: "goal" as const, t: "A strategy, not a guess", d: "A balanced list and timeline set with a college advisor." },
];

const COLLEGE_FACTS = [
  { k: "Admit rate", v: "5.7%" },
  { k: "Avg. SAT", v: "1500–1570" },
  { k: "Early decision", v: "Nov 1" },
  { k: "Need-blind aid", v: "Yes" },
];

const TRUST_CARDS = [
  { icon: "feedback" as const, t: "Feedback after every lesson", d: "No waiting for a monthly report to know how it's going." },
  { icon: "match" as const, t: "Continuity with one tutor", d: "The same tutor, term after term — not a rotating roster." },
  { icon: "report" as const, t: "Progress families can follow", d: "One record, written for a parent, not a specialist." },
  { icon: "lock" as const, t: "Private by design", d: "A student's record is visible only to their own family and tutor." },
];

const FOOTER_COLS = [
  { h: "TUTORING", items: ["AP Chemistry", "AP Calculus", "SAT Math", "SAT Reading & Writing", "Essay writing"] },
  { h: "FOR", items: ["Students", "Parents", "Tutors", "College guidance"] },
  { h: "COMPANY", items: ["How it works", "Sign in"] },
  { h: "CONTACT", items: ["hello@altonedu.com"] },
];

export default function LandingPage() {
  return (
    <div
      id="top"
      className={`${bricolage.variable} ${instrument.variable} ${plexMono.variable} ${plexKr.variable} bg-[#F8F5EF]`}
      style={{ fontFamily: "var(--font-instrument), var(--font-plex-kr), sans-serif" }}
    >
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#F8F5EF]/90 backdrop-blur border-b border-[#E6E1D8]">
        <div className="max-w-[1440px] mx-auto px-10 md:px-20 h-[76px] flex items-center justify-between">
          <a href="#top" className="flex items-center gap-2.5 no-underline">
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
              <rect x="3" y="15" width="24" height="9" rx="2.5" fill="#142240" />
              <rect x="6" y="7" width="18" height="9" rx="2.5" fill="#142240" opacity="0.65" />
              <rect x="9" y="1" width="12" height="7.5" rx="2.5" fill="#C8102E" />
            </svg>
            <span className="font-[family-name:var(--font-bricolage)] text-[19px] font-bold tracking-[-0.01em] text-[#142240]">
              ALTON
            </span>
          </a>
          <nav className="hidden lg:flex items-center gap-8 text-[14px] font-medium text-[#4F5A6B]">
            {NAV_LINKS.map((l, i) => (
              <a key={l.label + i} href={l.href} className="hover:text-[#142240] transition-colors">
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-5">
            <Link href="/login" className="text-[14px] font-medium text-[#4F5A6B] hover:text-[#142240]">
              Sign in
            </Link>
            <LandingCtaLink
              href="#book"
              ctaName="consult_signup"
              section="header"
              className="h-10 px-4 rounded-xl bg-[#C8102E] hover:bg-[#8F0B20] text-white text-[14px] font-semibold flex items-center transition-colors"
            >
              Book a consultation
            </LandingCtaLink>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="max-w-[1440px] mx-auto px-10 md:px-20 pt-20 pb-28 grid grid-cols-1 lg:grid-cols-[560px_minmax(0,1fr)] gap-16 items-start">
            <div className="flex flex-col gap-6">
              <span className="font-mono text-[12px] font-medium tracking-[0.08em] text-[#C8102E]">
                PREMIUM 1:1 TUTORING &amp; COACHING
              </span>
              <h1 className="m-0 font-[family-name:var(--font-bricolage)] font-semibold text-[52px] leading-[1.06] tracking-[-0.02em] text-[#142240]">
                Better learning,
                <br />
                built around{" "}
                <span className="relative inline-block">
                  you.
                  <svg
                    className="absolute left-0 -bottom-1.5 w-full"
                    height="8"
                    viewBox="0 0 140 8"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <path d="M2 6 C 40 1, 100 1, 138 6" stroke="#C8102E" strokeWidth="3" fill="none" strokeLinecap="round" />
                  </svg>
                </span>
              </h1>
              <p className="text-[16px] font-medium text-[#3F6B5E]" style={{ wordBreak: "keep-all" }}>
                학생에게 맞춘 수업과 코칭으로 매주 더 분명한 성장을 만듭니다.
              </p>
              <p className="text-[16px] leading-[1.7] text-[#4F5A6B] max-w-[460px]">
                Alton pairs each student with one dedicated tutor, feedback after every lesson,
                and a learning record the whole family can follow.
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <LandingCtaLink
                  href="#book"
                  ctaName="start_learning"
                  section="hero"
                  className="h-12 px-5 rounded-xl bg-[#C8102E] hover:bg-[#8F0B20] text-white text-[15px] font-semibold flex items-center transition-colors"
                >
                  Start learning
                </LandingCtaLink>
                <a
                  href="#how"
                  className="h-12 px-5 rounded-xl border border-[#DDD7CC] bg-white text-[#142240] text-[15px] font-semibold flex items-center hover:border-[#142240] transition-colors"
                >
                  See how lessons work
                </a>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {SUBJECT_PILLS.map((s) => (
                  <span
                    key={s}
                    className="py-1.5 px-3.5 rounded-full bg-white border border-[#E6E1D8] text-[13px] font-medium text-[#4F5A6B]"
                  >
                    {s}
                  </span>
                ))}
              </div>
              <a href="#college" className="mt-2 text-[14px] font-semibold text-[#284DB0] inline-flex items-center gap-1.5">
                Planning for college? <span aria-hidden="true">→</span>
              </a>
            </div>

            <div className="relative min-h-[520px]">
              <div className="ml-auto w-full max-w-[560px] bg-white border border-[#E6E1D8] rounded-3xl shadow-[0_32px_64px_-20px_rgba(20,34,64,0.2)] overflow-hidden">
                <div className="h-[56px] px-6 flex items-center justify-between border-b border-[#F1EDE6]">
                  <strong className="text-[14px] text-[#142240]">Jiwoo&rsquo;s week</strong>
                  <span className="text-[11px] font-mono text-[#5F6778]">Student view</span>
                </div>
                <div className="p-5 flex flex-col gap-3.5">
                  <div className="flex gap-3 items-center py-3 px-3.5 rounded-2xl bg-[#FCEBEB]">
                    <div className="flex flex-col items-center w-9 shrink-0">
                      <span className="text-[10px] text-[#5F6778]">TUE</span>
                      <strong className="text-[16px] text-[#142240]">14</strong>
                    </div>
                    <div className="flex flex-col gap-px flex-grow">
                      <span className="text-[13px] font-semibold text-[#1B2536]">AP Chemistry · Ms. Choi</span>
                      <span className="text-[12px] text-[#5F6778]">4:30 PM · in 12 min</span>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-[#C8102E]" />
                  </div>
                  <div className="flex justify-between items-center py-2 px-1 text-[13px]">
                    <span className="text-[#4F5A6B]">Next: Essay writing · Sarah Lee</span>
                    <span className="text-[#5F6778]">Thu 5:00 PM</span>
                  </div>
                  <div className="border border-[#E6E1D8] rounded-2xl p-4 flex gap-3">
                    <span className="w-8 h-8 rounded-full bg-[#DCE6FC] text-[#284DB0] text-[11px] font-semibold flex items-center justify-center shrink-0">
                      SL
                    </span>
                    <span className="text-[13px] leading-[1.5] text-[#1B2536]">
                      Your thesis finally sounds like you — keep paragraph 1, rewrite paragraph 2.
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {["Chemistry", "Writing", "Math"].map((s, i) => (
                      <div key={s} className="p-3 rounded-2xl bg-[#F8F5EF] flex flex-col gap-1.5">
                        <span className="text-[11px] text-[#4F5A6B]">{s}</span>
                        <div className="h-[5px] rounded-full bg-[#EBE6DD]">
                          <div
                            className="h-[5px] rounded-full bg-[#5E8C7E]"
                            style={{ width: ["78%", "62%", "54%"][i] }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {["Balance any equilibrium", "Lock the thesis"].map((g) => (
                      <div key={g} className="flex items-center gap-2 text-[13px] text-[#1B2536]">
                        <span className="w-4 h-4 rounded-full bg-[#5E8C7E] flex items-center justify-center text-white text-[10px]">
                          ✓
                        </span>
                        {g}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="hidden md:block absolute -left-6 -bottom-10 w-[280px] bg-white border border-[#E6E1D8] rounded-2xl shadow-[0_20px_40px_-14px_rgba(20,34,64,0.22)] p-4">
                <span className="font-mono text-[10px] tracking-[0.06em] text-[#5F6778]">
                  WEEKLY REPORT TO PARENTS
                </span>
                <div className="mt-2 flex items-center justify-between">
                  <strong className="text-[13px] text-[#142240]">Lessons attended</strong>
                  <strong className="text-[15px] text-[#142240]">3 / 3</strong>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-[13px] text-[#4F5A6B]">Goals met</span>
                  <span className="text-[13px] text-[#1B2536]">2 of 3</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="bg-white px-10 md:px-20 py-24 border-t border-[#E6E1D8]">
          <div className="max-w-[1440px] mx-auto">
            <div className="max-w-[640px] mb-14 flex flex-col gap-4">
              <span className="font-mono text-[12px] font-medium tracking-[0.08em] text-[#C8102E]">
                HOW ALTON TUTORING WORKS
              </span>
              <h2 className="m-0 font-[family-name:var(--font-bricolage)] font-semibold text-[38px] leading-[1.15] tracking-[-0.02em] text-[#142240]">
                Every week, a little further.
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {HOW_IT_WORKS.map((c) => (
                <div key={c.n} className="border border-[#E6E1D8] rounded-3xl p-6 flex flex-col gap-4 bg-[#F8F5EF]/40">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[12px] text-[#9A9284]">{c.n}</span>
                    <span className="w-10 h-10 rounded-xl bg-white border border-[#E6E1D8] flex items-center justify-center">
                      <Icon name={c.icon} />
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <strong className="text-[18px] text-[#142240]">{c.title}</strong>
                    <span className="text-[13px] font-medium text-[#3F6B5E]">{c.kr}</span>
                  </div>
                  <p className="text-[14px] leading-[1.6] text-[#4F5A6B] m-0">{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Roles */}
        <RolesPanel />

        {/* Growth made visible */}
        <section className="bg-white px-10 md:px-20 py-24 border-t border-[#E6E1D8]">
          <div className="max-w-[1440px] mx-auto flex flex-col gap-14">
            <div className="max-w-[640px] flex flex-col gap-4">
              <span className="font-mono text-[12px] font-medium tracking-[0.08em] text-[#C8102E]">
                GROWTH MADE VISIBLE
              </span>
              <h2 className="m-0 font-[family-name:var(--font-bricolage)] font-semibold text-[38px] leading-[1.15] tracking-[-0.02em] text-[#142240]">
                Small wins you can actually see.
              </h2>
              <p className="text-[16px] leading-[1.7] text-[#4F5A6B]">
                Every lesson and practice score feeds one chart, so progress is never just a feeling.
              </p>
              <p className="text-[15px] font-medium text-[#3F6B5E]" style={{ wordBreak: "keep-all" }}>
                작은 성장도 눈에 보이게 기록합니다.
              </p>
            </div>
            <GrowthChart />
          </div>
        </section>

        {/* College guidance */}
        <section id="college" className="bg-[#F8F5EF] px-10 md:px-20 py-24 border-t border-[#E6E1D8]">
          <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-[520px_minmax(0,1fr)] gap-16 items-center">
            <div className="flex flex-col gap-5">
              <span className="font-mono text-[12px] font-medium tracking-[0.08em] text-[#C8102E]">
                WHEN IT&rsquo;S TIME · COLLEGE GUIDANCE
              </span>
              <h2 className="m-0 font-[family-name:var(--font-bricolage)] font-semibold text-[36px] leading-[1.15] tracking-[-0.02em] text-[#142240]">
                Guidance that starts from what your tutor already knows.
              </h2>
              <p className="text-[15px] leading-[1.7] text-[#4F5A6B]">
                College guidance builds on the learning record already in place — not a separate consulting engagement.
              </p>
              <div className="flex flex-col gap-3.5 mt-1">
                {COLLEGE_POINTS.map((p) => (
                  <div key={p.t} className="flex gap-3.5 items-start">
                    <span className="w-9 h-9 rounded-xl bg-white border border-[#E6E1D8] flex items-center justify-center shrink-0">
                      <Icon name={p.icon} />
                    </span>
                    <div className="flex flex-col gap-0.5 pt-px">
                      <strong className="text-[14.5px] text-[#1B2536]">{p.t}</strong>
                      <span className="text-[13.5px] leading-[1.5] text-[#4F5A6B]">{p.d}</span>
                    </div>
                  </div>
                ))}
              </div>
              <a href="#roles" className="mt-1 text-[14px] font-semibold text-[#284DB0] inline-flex items-center gap-1.5 w-fit">
                Explore colleges <span aria-hidden="true">→</span>
              </a>
            </div>

            <div className="bg-white border border-[#E6E1D8] rounded-3xl shadow-[0_24px_48px_-16px_rgba(20,34,64,0.14)] overflow-hidden">
              <div className="h-[60px] px-6 flex items-center justify-between border-b border-[#F1EDE6]">
                <strong className="text-[15px] text-[#142240]">Princeton University</strong>
                <span className="py-0.5 px-2.5 rounded-full text-[11px] font-semibold bg-[#F1F4F9] text-[#283C62]">
                  Reach for Jiwoo
                </span>
              </div>
              <div className="p-6 grid grid-cols-2 gap-4">
                {COLLEGE_FACTS.map((f) => (
                  <div key={f.k} className="p-4 rounded-2xl bg-[#F8F5EF] flex flex-col gap-1">
                    <span className="text-[12px] text-[#4F5A6B]">{f.k}</span>
                    <strong className="text-[20px] text-[#142240]">{f.v}</strong>
                  </div>
                ))}
                <div className="col-span-2 border border-[#E6E1D8] rounded-2xl p-4 flex gap-3">
                  <span className="w-8 h-8 rounded-full bg-[#E3EEEA] text-[#3F6B5E] text-[11px] font-semibold flex items-center justify-center shrink-0">
                    SL
                  </span>
                  <span className="text-[13px] leading-[1.5] text-[#1B2536]">
                    Sarah, Jiwoo&rsquo;s writing tutor, will carry her essay work directly into the application.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust */}
        <section className="bg-white px-10 md:px-20 py-24 border-t border-[#E6E1D8]">
          <div className="max-w-[1440px] mx-auto flex flex-col gap-14 items-center text-center">
            <div className="max-w-[640px] flex flex-col gap-4 items-center">
              <span className="font-mono text-[12px] font-medium tracking-[0.08em] text-[#C8102E]">
                WHY FAMILIES STAY
              </span>
              <h2 className="m-0 font-[family-name:var(--font-bricolage)] font-semibold text-[38px] leading-[1.15] tracking-[-0.02em] text-[#142240]">
                Trust you can see in every lesson.
              </h2>
            </div>

            <svg viewBox="0 0 720 200" className="w-full max-w-[720px]" aria-hidden="true">
              {[
                { x: 90, label: "Student" },
                { x: 260, label: "Tutor" },
                { x: 460, label: "Parents" },
                { x: 630, label: "College advisor" },
              ].map((n) => (
                <line key={n.x} x1={n.x} y1={40} x2={360} y2={140} stroke="#E6E1D8" strokeWidth={1.5} />
              ))}
              <circle cx="360" cy="140" r="42" fill="#142240" />
              <text x="360" y="136" textAnchor="middle" fill="#fff" fontSize="11" fontWeight={600}>
                Jiwoo&rsquo;s
              </text>
              <text x="360" y="150" textAnchor="middle" fill="#fff" fontSize="11" fontWeight={600}>
                learning record
              </text>
              {[
                { x: 90, label: "Student" },
                { x: 260, label: "Tutor" },
                { x: 460, label: "Parents" },
                { x: 630, label: "College advisor" },
              ].map((n) => (
                <g key={n.label}>
                  <circle cx={n.x} cy={40} r="30" fill="#F8F5EF" stroke="#E6E1D8" strokeWidth={1.5} />
                  <text x={n.x} y="44" textAnchor="middle" fill="#142240" fontSize="11" fontWeight={600}>
                    {n.label}
                  </text>
                </g>
              ))}
            </svg>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-[820px] text-left">
              {TRUST_CARDS.map((c) => (
                <div key={c.t} className="border border-[#E6E1D8] rounded-3xl p-6 flex gap-4 items-start">
                  <span className="w-10 h-10 rounded-xl bg-[#F8F5EF] border border-[#E6E1D8] flex items-center justify-center shrink-0">
                    <Icon name={c.icon} />
                  </span>
                  <div className="flex flex-col gap-1">
                    <strong className="text-[15px] text-[#142240]">{c.t}</strong>
                    <span className="text-[13.5px] leading-[1.6] text-[#4F5A6B]">{c.d}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA (decorative, per mockup) */}
        <section className="bg-[#142240] px-10 md:px-20 py-24 relative overflow-hidden">
          <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-14 items-center relative z-10">
            <div className="flex flex-col gap-5">
              <svg width="52" height="52" viewBox="0 0 30 30" fill="none" aria-hidden="true">
                <rect x="3" y="15" width="24" height="9" rx="2.5" fill="#fff" opacity="0.9" />
                <rect x="6" y="7" width="18" height="9" rx="2.5" fill="#fff" opacity="0.55" />
                <rect x="9" y="1" width="12" height="7.5" rx="2.5" fill="#C8102E" />
              </svg>
              <h2 className="m-0 font-[family-name:var(--font-bricolage)] font-semibold text-[42px] leading-[1.12] tracking-[-0.02em] text-white">
                Start with one good lesson.
              </h2>
              <p className="text-[15px] font-medium text-[#C3CFE2]" style={{ wordBreak: "keep-all" }}>
                첫 수업부터, 학생에게 맞게.
              </p>
              <div className="flex flex-wrap gap-3 mt-1">
                <LandingCtaLink
                  href="#book"
                  ctaName="book_consultation"
                  section="final_cta"
                  className="h-12 px-5 rounded-xl bg-[#C8102E] hover:bg-[#8F0B20] text-white text-[15px] font-semibold flex items-center transition-colors"
                >
                  Book a consultation
                </LandingCtaLink>
                <a
                  href="#how"
                  className="h-12 px-5 rounded-xl border border-white/25 text-white text-[15px] font-semibold flex items-center hover:border-white/60 transition-colors"
                >
                  See how it works
                </a>
              </div>
            </div>

            <div className="bg-white/[0.06] border border-white/15 rounded-3xl p-6 backdrop-blur-sm">
              <span className="font-mono text-[11px] tracking-[0.08em] text-[#97A9C8]">
                YOUR FIRST CONSULTATION
              </span>
              <ol className="mt-3 flex flex-col gap-3 list-none p-0 m-0">
                {[
                  "Tell us the student's goals and current level",
                  "We match a tutor and set up a free trial lesson",
                  "Meet the tutor, then decide together",
                ].map((s, i) => (
                  <li key={s} className="flex gap-3 items-start">
                    <span className="w-6 h-6 rounded-full bg-white/10 text-white text-[12px] font-semibold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-[13.5px] leading-[1.5] text-[#E1E7F1]">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* 실제 상담 신청 폼 — 목업의 최종 CTA는 장식용이라 기능은 이 아래에 유지 */}
        <section id="book" className="bg-[#F8F5EF] px-10 md:px-20 py-24 border-t border-[#E6E1D8]">
          <div className="max-w-[640px] mx-auto flex flex-col gap-3 text-center mb-10">
            <span className="font-mono text-[12px] font-medium tracking-[0.08em] text-[#C8102E]">
              BOOK A CONSULTATION
            </span>
            <h2 className="m-0 font-[family-name:var(--font-bricolage)] font-semibold text-[32px] leading-[1.15] tracking-[-0.02em] text-[#142240]">
              1:1 수업 상담 신청
            </h2>
            <p className="text-[14.5px] text-[#4F5A6B] leading-[1.7]">
              신청해 주시면 담당 컨설턴트를 배정하고, 예약 링크를 이메일로 보내드립니다.
            </p>
          </div>
          <ConsultForm />
        </section>
      </main>

      <footer className="bg-[#0C1628] text-[#C3CFE2] px-10 md:px-20 pt-16 pb-10">
        <div className="max-w-[1440px] mx-auto flex flex-col gap-12">
          <div className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-12">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <svg width="26" height="26" viewBox="0 0 30 30" fill="none" aria-hidden="true">
                  <rect x="3" y="15" width="24" height="9" rx="2.5" fill="#fff" opacity="0.9" />
                  <rect x="6" y="7" width="18" height="9" rx="2.5" fill="#fff" opacity="0.55" />
                  <rect x="9" y="1" width="12" height="7.5" rx="2.5" fill="#C8102E" />
                </svg>
                <span className="font-[family-name:var(--font-bricolage)] text-[17px] font-bold text-white">
                  ALTON
                </span>
              </div>
              <p className="text-[13.5px] leading-[1.7] text-[#97A9C8] max-w-[320px]">
                Premium 1:1 tutoring and college guidance for students in Korea and the US.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
              {FOOTER_COLS.map((col) => (
                <div key={col.h} className="flex flex-col gap-3">
                  <span className="font-mono text-[11px] tracking-[0.08em] text-[#97A9C8]">{col.h}</span>
                  <div className="flex flex-col gap-2">
                    {col.items.map((it) => (
                      <span key={it} className="text-[13.5px] text-[#C3CFE2]">
                        {it}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-[12.5px] text-[#97A9C8]">© 2026 Alton Education Inc.</span>
            <div className="flex items-center gap-6 text-[12.5px] text-[#97A9C8]">
              <span>Privacy</span>
              <span>Terms</span>
              <Link href="/login" className="hover:text-white">
                Sign in
              </Link>
            </div>
            <div className="flex items-center gap-2.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className="w-8 h-8 rounded-full bg-white/10" />
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
