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
  { href: "#how", label: "수업 방식" },
  { href: "#roles", label: "학생" },
  { href: "#roles", label: "학부모" },
  { href: "#roles", label: "선생님" },
  { href: "#college", label: "대학 진학" },
];

const SUBJECT_PILLS = ["AP Chemistry", "SAT Math", "에세이 작문", "SAT Reading & Writing"];

const HOW_IT_WORKS = [
  {
    n: "01",
    icon: "match" as const,
    title: "매칭",
    kr: "학생에게 맞는 선생님",
    body: "과목·목표·일정을 기준으로 매칭하고, 이후에는 같은 선생님과 계속 함께합니다.",
  },
  {
    n: "02",
    icon: "lesson" as const,
    title: "수업",
    kr: "1:1 수업",
    body: "교재, 노트, 연습 문제를 한 곳에서 공유하는 실시간 1:1 수업.",
  },
  {
    n: "03",
    icon: "feedback" as const,
    title: "피드백",
    kr: "매 수업 피드백",
    body: "매 수업 후 학생과 가족에게 구체적인 서면 피드백을 전달합니다.",
  },
  {
    n: "04",
    icon: "growth" as const,
    title: "성장",
    kr: "눈에 보이는 성장",
    body: "매주 목표와 함께, 수업이 쌓일수록 눈에 보이는 성장 기록.",
  },
];

const COLLEGE_POINTS = [
  { icon: "explore" as const, t: "대학 탐색", d: "합격 동향, 지원 규정, 비용까지 근거를 갖춰 정리한 대학 프로필." },
  { icon: "essay" as const, t: "이어지는 에세이 지도", d: "학생의 글쓰기를 아는 선생님이 직접 에세이를 지도합니다." },
  { icon: "goal" as const, t: "추측이 아닌 전략", d: "대학 어드바이저와 함께 세우는 균형 잡힌 지원 리스트와 일정." },
];

const COLLEGE_FACTS = [
  { k: "합격률", v: "5.7%" },
  { k: "평균 SAT", v: "1500–1570" },
  { k: "얼리 디시전", v: "11월 1일" },
  { k: "니드 블라인드 지원", v: "가능" },
];

const TRUST_CARDS = [
  { icon: "feedback" as const, t: "매 수업 후 피드백", d: "월간 리포트를 기다리지 않아도 진행 상황을 알 수 있습니다." },
  { icon: "match" as const, t: "한 선생님과의 연속성", d: "학기마다 선생님이 바뀌지 않고 계속 이어집니다." },
  { icon: "report" as const, t: "학부모도 따라갈 수 있는 진행 기록", d: "전문가가 아니어도 이해할 수 있게 정리된 하나의 기록." },
  { icon: "lock" as const, t: "설계 단계부터 지켜지는 개인정보", d: "학생의 기록은 해당 가족과 담당 선생님만 볼 수 있습니다." },
];

const FOOTER_COLS = [
  { h: "과목", items: ["AP Chemistry", "AP Calculus", "SAT Math", "SAT Reading & Writing", "에세이 작문"] },
  { h: "대상", items: ["학생", "학부모", "선생님", "대학 진학"] },
  { h: "회사", items: ["수업 방식", "로그인"] },
  { h: "문의", items: ["hello@altonedu.com"] },
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
              로그인
            </Link>
            <LandingCtaLink
              href="#book"
              ctaName="consult_signup"
              section="header"
              className="h-10 px-4 rounded-xl bg-[#C8102E] hover:bg-[#8F0B20] text-white text-[14px] font-semibold flex items-center transition-colors"
            >
              상담 신청
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
                프리미엄 1:1 수업 &amp; 코칭
              </span>
              <h1 className="m-0 font-[family-name:var(--font-bricolage)] font-semibold text-[46px] leading-[1.22] tracking-[-0.02em] text-[#142240]" style={{ wordBreak: "keep-all" }}>
                더 나은 학습,
                <br />
                <span className="relative inline-block">
                  너
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
                에게 맞춰서.
              </h1>
              <p className="text-[16px] font-medium text-[#3F6B5E]" style={{ wordBreak: "keep-all" }}>
                학생에게 맞춘 수업과 코칭으로 매주 더 분명한 성장을 만듭니다.
              </p>
              <p className="text-[16px] leading-[1.7] text-[#4F5A6B] max-w-[460px]" style={{ wordBreak: "keep-all" }}>
                ALTON은 학생마다 전담 선생님 한 명을 배정하고, 매 수업 후 피드백을 남기며,
                온 가족이 함께 볼 수 있는 학습 기록을 만들어 갑니다.
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <LandingCtaLink
                  href="#book"
                  ctaName="start_learning"
                  section="hero"
                  className="h-12 px-5 rounded-xl bg-[#C8102E] hover:bg-[#8F0B20] text-white text-[15px] font-semibold flex items-center transition-colors"
                >
                  학습 시작하기
                </LandingCtaLink>
                <a
                  href="#how"
                  className="h-12 px-5 rounded-xl border border-[#DDD7CC] bg-white text-[#142240] text-[15px] font-semibold flex items-center hover:border-[#142240] transition-colors"
                >
                  수업 방식 살펴보기
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
                대학 진학도 준비하고 계신가요? <span aria-hidden="true">→</span>
              </a>
            </div>

            <div className="relative min-h-[520px]">
              <div className="ml-auto w-full max-w-[560px] bg-white border border-[#E6E1D8] rounded-3xl shadow-[0_32px_64px_-20px_rgba(20,34,64,0.2)] overflow-hidden">
                <div className="h-[56px] px-6 flex items-center justify-between border-b border-[#F1EDE6]">
                  <strong className="text-[14px] text-[#142240]">지우의 이번 주</strong>
                  <span className="text-[11px] font-mono text-[#5F6778]">학생 화면</span>
                </div>
                <div className="p-5 flex flex-col gap-3.5">
                  <div className="flex gap-3 items-center py-3 px-3.5 rounded-2xl bg-[#FCEBEB]">
                    <div className="flex flex-col items-center w-9 shrink-0">
                      <span className="text-[10px] text-[#5F6778]">화</span>
                      <strong className="text-[16px] text-[#142240]">14</strong>
                    </div>
                    <div className="flex flex-col gap-px flex-grow">
                      <span className="text-[13px] font-semibold text-[#1B2536]">AP Chemistry · 최 선생님</span>
                      <span className="text-[12px] text-[#5F6778]">오후 4:30 · 12분 후</span>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-[#C8102E]" />
                  </div>
                  <div className="flex justify-between items-center py-2 px-1 text-[13px]">
                    <span className="text-[#4F5A6B]">다음: 에세이 작문 · 이 선생님</span>
                    <span className="text-[#5F6778]">목 오후 5:00</span>
                  </div>
                  <div className="border border-[#E6E1D8] rounded-2xl p-4 flex gap-3">
                    <span className="w-8 h-8 rounded-full bg-[#DCE6FC] text-[#284DB0] text-[11px] font-semibold flex items-center justify-center shrink-0">
                      이샘
                    </span>
                    <span className="text-[13px] leading-[1.5] text-[#1B2536]">
                      이제 논지가 네 목소리처럼 들려 — 1단락은 그대로 두고, 2단락을 다시 써보자.
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {["화학", "작문", "수학"].map((s, i) => (
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
                    {["임의의 평형 반응 균형 맞추기", "논지 확정하기"].map((g) => (
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
                  학부모용 주간 리포트
                </span>
                <div className="mt-2 flex items-center justify-between">
                  <strong className="text-[13px] text-[#142240]">출석한 수업</strong>
                  <strong className="text-[15px] text-[#142240]">3 / 3</strong>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-[13px] text-[#4F5A6B]">달성한 목표</span>
                  <span className="text-[13px] text-[#1B2536]">3개 중 2개</span>
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
                ALTON 수업이 진행되는 방식
              </span>
              <h2 className="m-0 font-[family-name:var(--font-bricolage)] font-semibold text-[36px] leading-[1.2] tracking-[-0.02em] text-[#142240]" style={{ wordBreak: "keep-all" }}>
                매주, 한 걸음씩 더 나아갑니다.
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
                눈에 보이는 성장
              </span>
              <h2 className="m-0 font-[family-name:var(--font-bricolage)] font-semibold text-[36px] leading-[1.2] tracking-[-0.02em] text-[#142240]" style={{ wordBreak: "keep-all" }}>
                작은 성취도 눈으로 확인할 수 있습니다.
              </h2>
              <p className="text-[16px] leading-[1.7] text-[#4F5A6B]" style={{ wordBreak: "keep-all" }}>
                매 수업과 연습 점수가 하나의 차트로 쌓이기 때문에, 성장이 막연한 느낌으로만 남지 않습니다.
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
                때가 되면 · 대학 진학
              </span>
              <h2 className="m-0 font-[family-name:var(--font-bricolage)] font-semibold text-[32px] leading-[1.25] tracking-[-0.02em] text-[#142240]" style={{ wordBreak: "keep-all" }}>
                담당 선생님이 이미 알고 있는 것에서 시작하는 진학 지도.
              </h2>
              <p className="text-[15px] leading-[1.7] text-[#4F5A6B]" style={{ wordBreak: "keep-all" }}>
                대학 진학 지도는 별도의 컨설팅이 아니라, 이미 쌓여 있는 학습 기록을 바탕으로 이어집니다.
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
                대학 탐색하기 <span aria-hidden="true">→</span>
              </a>
            </div>

            <div className="bg-white border border-[#E6E1D8] rounded-3xl shadow-[0_24px_48px_-16px_rgba(20,34,64,0.14)] overflow-hidden">
              <div className="h-[60px] px-6 flex items-center justify-between border-b border-[#F1EDE6]">
                <strong className="text-[15px] text-[#142240]">프린스턴대학교</strong>
                <span className="py-0.5 px-2.5 rounded-full text-[11px] font-semibold bg-[#F1F4F9] text-[#283C62]">
                  지우에게는 도전 지원
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
                    이샘
                  </span>
                  <span className="text-[13px] leading-[1.5] text-[#1B2536]">
                    지우의 작문 선생님인 이 선생님이 에세이 작업을 지원서까지 그대로 이어갑니다.
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
                가족들이 계속 함께하는 이유
              </span>
              <h2 className="m-0 font-[family-name:var(--font-bricolage)] font-semibold text-[36px] leading-[1.2] tracking-[-0.02em] text-[#142240]" style={{ wordBreak: "keep-all" }}>
                매 수업에서 확인할 수 있는 신뢰.
              </h2>
            </div>

            <svg viewBox="0 0 720 200" className="w-full max-w-[720px]" aria-hidden="true">
              {[
                { x: 90, label: "학생" },
                { x: 260, label: "선생님" },
                { x: 460, label: "학부모" },
                { x: 630, label: "대학 어드바이저" },
              ].map((n) => (
                <line key={n.x} x1={n.x} y1={40} x2={360} y2={140} stroke="#E6E1D8" strokeWidth={1.5} />
              ))}
              <circle cx="360" cy="140" r="42" fill="#142240" />
              <text x="360" y="136" textAnchor="middle" fill="#fff" fontSize="11" fontWeight={600}>
                지우의
              </text>
              <text x="360" y="150" textAnchor="middle" fill="#fff" fontSize="11" fontWeight={600}>
                학습 기록
              </text>
              {[
                { x: 90, label: "학생" },
                { x: 260, label: "선생님" },
                { x: 460, label: "학부모" },
                { x: 630, label: "대학 어드바이저" },
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
              <h2 className="m-0 font-[family-name:var(--font-bricolage)] font-semibold text-[36px] leading-[1.25] tracking-[-0.02em] text-white" style={{ wordBreak: "keep-all" }}>
                좋은 수업 한 번으로 시작하세요.
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
                  상담 신청하기
                </LandingCtaLink>
                <a
                  href="#how"
                  className="h-12 px-5 rounded-xl border border-white/25 text-white text-[15px] font-semibold flex items-center hover:border-white/60 transition-colors"
                >
                  수업 방식 보기
                </a>
              </div>
            </div>

            <div className="bg-white/[0.06] border border-white/15 rounded-3xl p-6 backdrop-blur-sm">
              <span className="font-mono text-[11px] tracking-[0.08em] text-[#97A9C8]">
                첫 상담 진행 순서
              </span>
              <ol className="mt-3 flex flex-col gap-3 list-none p-0 m-0">
                {[
                  "학생의 목표와 현재 실력을 알려주세요",
                  "선생님을 매칭하고 무료 체험 수업을 준비합니다",
                  "선생님을 직접 만나본 뒤 함께 결정합니다",
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
              상담 신청
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
              <p className="text-[13.5px] leading-[1.7] text-[#97A9C8] max-w-[320px]" style={{ wordBreak: "keep-all" }}>
                한국·미국 거주 학생을 위한 프리미엄 1:1 수업과 대학 진학 지도.
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
              <span>개인정보처리방침</span>
              <span>이용약관</span>
              <Link href="/login" className="hover:text-white">
                로그인
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
