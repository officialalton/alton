import Link from "next/link";
import ConsultForm from "./ConsultForm";
import CalendlyWidget from "./CalendlyWidget";

const PILLARS = [
  {
    number: "01",
    title: "자체 보유 최상위권 튜터진",
    body: "튜터를 소개해드리는 것이 아닙니다. 한국 최상위권 대학원생 중 엄선해 Alton이 직접 선발하고 육성한 튜터진이 직접 가르칩니다.",
    accent: false,
  },
  {
    number: "02",
    title: "자체 교재와 커리큘럼",
    body: "외부 교재를 그대로 쓰지 않습니다. Alton이 자체 제작한 교재와 커리큘럼으로 체계적으로 지도합니다.",
    accent: false,
  },
  {
    number: "03",
    title: "취약점 공략 맞춤 전략",
    body: "정확한 진단을 바탕으로 학생의 취약점을 정확히 짚어내고, 그 지점을 집중적으로 공략하는 맞춤 전략을 세웁니다.",
    accent: true,
  },
];

const STEPS = [
  { title: "상담 신청", body: "홈페이지에서 간단한 정보를 남겨주시면 담당자가 연락드립니다." },
  { title: "진단 상담", body: "학생의 현재 실력과 목표를 정확히 진단합니다." },
  { title: "튜터 추천", body: "진단 결과를 바탕으로 가장 잘 맞는 튜터를 추천해드립니다." },
  {
    title: "무료 체험 수업",
    body: "30분 · 비용 없음 — 계약 전에 실제 튜터와 먼저 만나보세요.",
    highlight: true,
  },
  { title: "정식 시작", body: "체험 수업이 만족스러우면 정식으로 수업을 시작합니다." },
];

const FAQS = [
  {
    q: "어떤 과목을 지원하나요?",
    a: "SAT Math, SAT Reading & Writing과 AP Calculus AB/BC, Statistics, Chemistry, Biology, Physics, Computer Science, Economics, Psychology를 지원합니다.",
  },
  {
    q: "시차는 어떻게 조율하나요?",
    a: "튜터진이 한국에 있어 시차가 있지만, 미국 서부/동부 시간대에 맞춰 저녁·주말 시간대를 중심으로 조율해드립니다.",
  },
  {
    q: "계약 전에 튜터를 먼저 만나볼 수 있나요?",
    a: "네. 정식 계약 전에 30분 무료 체험 수업을 통해 실제 담당 튜터와 먼저 만나보실 수 있습니다.",
  },
  {
    q: "수업권(크레딧)과 환불 정책이 궁금해요.",
    a: "구매한 수업권은 12개월간 유효하며, 수업 24시간 전 취소 시에만 환불(수업권 복원)됩니다. 형제/자매 등 자녀 간 이동도 가능합니다.",
  },
  {
    q: "주당 몇 회 수업을 추천하나요?",
    a: "일반적으로 주 2~3회를 권장하며, 목표 시험 일정에 따라 조정할 수 있습니다.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-ink">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-grey-200">
        <div className="max-w-[1100px] mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-[18px] font-extrabold">
            ALTON <span className="text-red">EDUCATION</span>
          </span>
          <nav className="hidden md:flex items-center gap-7 text-[13.5px] font-semibold text-grey-700">
            <a href="#why-alton" className="hover:text-ink">
              WHY ALTON
            </a>
            <a href="#how-it-works" className="hover:text-ink">
              HOW IT WORKS
            </a>
            <a href="#faq" className="hover:text-ink">
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-[13.5px] font-semibold text-grey-700 hover:text-ink">
              로그인
            </Link>
            <a
              href="#consult"
              className="px-4 py-2 rounded-lg bg-red text-white text-[13.5px] font-bold"
            >
              상담 신청
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="max-w-[900px] mx-auto px-6 pt-20 pb-16 text-center">
          <p className="text-[12.5px] font-bold tracking-widest text-red mb-4">
            PREMIUM · ONLINE-ONLY · SAT / AP
          </p>
          <h1 className="text-[32px] sm:text-[44px] font-extrabold leading-[1.3] mb-5">
            골든타임을 놓치기 전,
            <br />
            정확한 진단과 확실한 결과.
          </h1>
          <p className="text-[15px] sm:text-[16px] text-grey-700 leading-[1.7] max-w-[640px] mx-auto mb-9">
            한국 최상위권 대학원생 튜터와 체계적인 학습 관리 시스템으로, 미국
            명문대 진학을 목표로 하는 학생들의 SAT·AP 점수를 확실하게
            끌어올립니다.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="#consult"
              className="px-7 py-3.5 rounded-xl bg-red text-white text-[14.5px] font-bold w-full sm:w-auto"
            >
              무료 진단 상담 신청
            </a>
            <a
              href="#ot"
              className="px-7 py-3.5 rounded-xl border-[1.5px] border-grey-200 text-ink text-[14.5px] font-bold w-full sm:w-auto"
            >
              무료 체험 수업 알아보기
            </a>
          </div>
        </section>

        <section id="why-alton" className="max-w-[1100px] mx-auto px-6 py-20">
          <h2 className="text-[26px] sm:text-[30px] font-extrabold text-center mb-3">
            자체 보유 튜터진과, 학생 한 명을 위한 커리큘럼
          </h2>
          <p className="text-[14.5px] text-grey-500 text-center max-w-[600px] mx-auto mb-12">
            튜터를 소개해드리는 것이 아닙니다. Alton이 직접 선발하고 육성한
            최상위권 튜터진이, Alton의 자체 교재와 커리큘럼으로 가르칩니다.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {PILLARS.map((p) => (
              <div
                key={p.number}
                className={
                  "rounded-2xl px-6 py-8 border-[1.5px] " +
                  (p.accent ? "border-red" : "border-grey-200")
                }
              >
                <div className="text-[13px] font-extrabold text-red mb-3">{p.number}</div>
                <h3 className="text-[16.5px] font-extrabold mb-2.5">{p.title}</h3>
                <p className="text-[13.5px] text-grey-500 leading-[1.7]">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="bg-ink text-white py-20">
          <div className="max-w-[1100px] mx-auto px-6">
            <h2 className="text-[26px] sm:text-[30px] font-extrabold text-center mb-3">
              시작까지 다섯 단계
            </h2>
            <p className="text-[14.5px] text-white/60 text-center max-w-[560px] mx-auto mb-12">
              계약 전에 실제 튜터와 먼저 만나보는 단계가 포함되어 있습니다.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              {STEPS.map((s, i) => (
                <div
                  key={s.title}
                  className={
                    "rounded-2xl px-5 py-6 " +
                    (s.highlight ? "bg-red" : "bg-white/5 border border-white/10")
                  }
                >
                  <div className="text-[12px] font-bold text-white/50 mb-2">
                    STEP {i + 1}
                  </div>
                  <h3 className="text-[15px] font-extrabold mb-2">{s.title}</h3>
                  <p className="text-[12.5px] leading-[1.6] text-white/75">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="ot" className="max-w-[820px] mx-auto px-6 py-20 text-center">
          <span className="inline-block text-[11.5px] font-extrabold px-3 py-1 rounded-full bg-yellow-bg text-ink mb-4">
            FREE 30 MIN
          </span>
          <h2 className="text-[24px] sm:text-[28px] font-extrabold mb-3">
            계약 전에, 먼저 수업해보세요.
          </h2>
          <p className="text-[14.5px] text-grey-500 leading-[1.7]">
            정식 계약 전, 담당 튜터와 30분 무료 체험 수업을 진행합니다. 학생과
            튜터의 케미스트리, 수업 방식을 직접 확인하신 후 계약 여부를 결정하실
            수 있습니다.
          </p>
        </section>

        <section id="faq" className="max-w-[760px] mx-auto px-6 py-20">
          <h2 className="text-[26px] sm:text-[30px] font-extrabold text-center mb-10">
            자주 묻는 질문
          </h2>
          <div className="flex flex-col gap-3">
            {FAQS.map((f) => (
              <details
                key={f.q}
                className="group rounded-xl border-[1.5px] border-grey-200 px-5 py-4"
              >
                <summary className="text-[14.5px] font-bold cursor-pointer list-none flex items-center justify-between">
                  {f.q}
                  <span className="text-grey-300 group-open:rotate-45 transition-transform">
                    +
                  </span>
                </summary>
                <p className="text-[13.5px] text-grey-500 leading-[1.7] mt-3">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section id="consult" className="max-w-[720px] mx-auto px-6 py-20">
          <h2 className="text-[26px] sm:text-[30px] font-extrabold text-center mb-3">
            1:1 수업 상담 신청
          </h2>

          {process.env.NEXT_PUBLIC_CALENDLY_URL ? (
            <>
              <p className="text-[14.5px] text-grey-500 text-center mb-8">
                아래에서 편한 시간을 바로 선택해 예약하세요. 상담은 Zoom으로 진행됩니다.
              </p>
              <CalendlyWidget url={process.env.NEXT_PUBLIC_CALENDLY_URL} />
            </>
          ) : (
            <>
              <p className="text-[14.5px] text-grey-500 text-center mb-8">
                아래 양식을 남겨주시면 담당자가 연락드립니다.
              </p>
              <ConsultForm />
            </>
          )}
        </section>
      </main>

      <footer className="border-t border-grey-200">
        <div className="max-w-[1100px] mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-[15px] font-extrabold">
            ALTON <span className="text-red">EDUCATION</span>
          </span>
          <nav className="flex items-center gap-6 text-[12.5px] font-semibold text-grey-500">
            <Link href="/login" className="hover:text-ink">
              로그인
            </Link>
          </nav>
        </div>
        <div className="max-w-[1100px] mx-auto px-6 pb-10 text-[12px] text-grey-300 leading-[1.7]">
          <p>Alton Education Inc · 온라인 전용 · 한국/미국 거주 학생 대상 SAT·AP 프리미엄 1:1 코칭</p>
          <p>© 2026 Alton Education Inc.</p>
        </div>
      </footer>
    </div>
  );
}
