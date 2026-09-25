import { Fragment } from "react";
import Link from "next/link";
import ConsultForm from "./ConsultForm";
import LandingCtaLink from "./LandingCtaLink";

const PILLARS = [
  {
    title: "일관된 커리큘럼",
    before: "좋은 선생님 개인기에 기대는 운영",
    after: "자체 교재와 커리큘럼으로 어떤 선생님이든 같은 기준의 수업을 진행합니다. 학습 현황은 시스템이 중립적으로 정리해 학생, 학부모, 선생님이 같은 내용을 함께 확인합니다.",
  },
  {
    title: "합리적인 컨설팅과 완결성 있는 기록",
    before: "정보 비대칭에 기대는 컨설팅과 따로 계약하는 관리",
    after: "학생의 현재 위치와 목표 사이의 간극을 시스템이 먼저 정리하고, 판단이 필요한 시점에만 전문가의 검수를 받습니다. 학생의 프로필과 수업 이력을 바탕으로 목표 대학에 맞는 로드맵을 세우고, 지원 시점에는 그동안 쌓인 기록과 이야기가 에세이로 이어집니다.",
    vision: "입시 로드맵·에세이 연결은 ALTON이 만들어가고 있는 영역입니다.",
  },
  {
    title: "학부모와의 투명한 공유",
    before: "결과만 통보받는 학부모 커뮤니케이션",
    after: "Progress Report로 최근 수업 내용, 잘하는 부분, 보완점, 과제 진행과 다음 계획을 정리해 제공합니다. Parent Chatbot은 그 학생에게 축적된 데이터를 근거로 학부모의 질문에 즉시 답합니다.",
  },
];

const FAQS: { q: string; a: string[] }[] = [
  {
    q: "담당 선생님이 바뀌면 처음부터 다시 설명해야 하나요?",
    a: [
      "아니요.",
      "학생의 학습 기록과 기준은 선생님 개인이 아니라 시스템에 남습니다.",
      "담당 선생님이 바뀌더라도 그동안의 진단, 취약점, 진행 상황을 새 선생님이 그대로 이어받아 수업을 시작합니다.",
    ],
  },
  {
    q: "왜 ALTON은 비대면 수업을 중심으로 운영하나요?",
    a: [
      "비대면 수업은 단순히 거리의 제약을 없애기 위한 방식이 아닙니다.",
      "대면 수업에서는 학생의 반응과 수업 태도, 선생님의 설명과 피드백이 수업이 끝난 뒤 기록되지 않고 사라지기 쉽습니다.",
      "비대면 환경에서는 이러한 수업의 맥락을 기록하고 분석해 다음 수업과 학습 관리에 다시 활용할 수 있습니다.",
    ],
  },
  {
    q: "어떤 과목을 지원하나요?",
    a: ["SAT Math, SAT Reading & Writing과 AP Calculus AB/BC, Statistics, Chemistry, Biology, Physics, Computer Science, Economics, Psychology를 지원합니다."],
  },
  {
    q: "시차는 어떻게 조율하나요?",
    a: ["튜터진이 한국에 있어 시차가 있지만, 미국 서부/동부 시간대에 맞춰 저녁·주말 시간대를 중심으로 조율해드립니다."],
  },
  {
    q: "계약 전에 튜터를 먼저 만나볼 수 있나요?",
    a: [
      "네.",
      "정식 계약 전에 무료 체험 수업을 통해 실제 담당 튜터와 먼저 만나보실 수 있습니다.",
    ],
  },
  {
    q: "수업권(크레딧)과 환불 정책이 궁금해요.",
    a: [
      "구매한 수업권은 12개월간 유효하며, 수업 24시간 전 취소 시에만 환불(수업권 복원)됩니다.",
      "형제/자매 등 자녀 간 이동도 가능합니다.",
    ],
  },
  {
    q: "주당 몇 회 수업을 추천하나요?",
    a: ["일반적으로 주 2~3회를 권장하며, 목표 시험 일정에 따라 조정할 수 있습니다."],
  },
];

export default function LandingPage() {
  return (
    <div id="top" className="min-h-screen bg-white text-ink">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-grey-200">
        <div className="max-w-[1100px] mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-[18px] font-extrabold">
            <span className="text-red">ALTON</span> EDUCATION
          </span>
          <nav className="hidden md:flex items-center gap-7 text-[13.5px] font-semibold text-grey-700">
            <a href="#top" className="hover:text-ink">
              HOME
            </a>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-[13.5px] font-semibold text-grey-700 hover:text-ink">
              로그인
            </Link>
            <LandingCtaLink
              href="#consult"
              ctaName="consult_signup"
              section="header"
              className="px-4 py-2 rounded-lg bg-red text-white text-[13.5px] font-bold"
            >
              상담 신청
            </LandingCtaLink>
          </div>
        </div>
      </header>

      <main>
        {/* 01 — 선언: 학원의 본질 */}
        <section className="bg-ink text-white">
          <div className="max-w-[720px] mx-auto px-6 pt-28 pb-28 text-center">
            <h1 className="sr-only">자녀를 학교와 별개로 학원에 보내는 이유는 무엇인가</h1>
            <div className="flex flex-col items-center gap-2 text-[19px] sm:text-[24px] leading-[1.6]">
              <p>자녀를</p>
              <p>학교와 별개로</p>
              <p>학원에 보내는 이유는 무엇인가?</p>
            </div>

            <div className="my-8 text-white/25 text-[20px]">↓</div>

            <div className="flex flex-col items-center gap-2 text-[19px] sm:text-[24px] leading-[1.6]">
              <p>그것은 학원의 본질이</p>
              <p className="font-extrabold">자녀의 구체적인 학습 필요에 맞게 설계된</p>
              <p>집중적인 관심이기 때문입니다.</p>
            </div>

            <div className="mt-16 flex flex-col items-center gap-2 text-[17px] sm:text-[20px] text-white/70">
              <p>그러나,</p>
              <p>학원에 다니면, 정말 점수가 오를까?</p>
            </div>
          </div>
        </section>

        {/* 02 — 진짜 질문 */}
        <section className="max-w-[900px] mx-auto px-6 py-24 text-center">
          <p className="text-[14.5px] text-grey-700 leading-[1.9] mb-6">
            많은 학원의 답은 비슷합니다.
            <br />
            뛰어난 선생님이 있고, 이미 많은 학생을 좋은 대학에 보냈다는 것.
          </p>
          <p className="text-[14.5px] text-grey-500 leading-[1.9]">
            하지만 그것만으로는, 제 아이의 점수가 오를 거라고 확신하기 어렵습니다.
            <br />
            같은 학원에 다녀도 결과가 다른 이유는,
            <br />
            <span className="font-extrabold text-ink">
              어떤 학원이냐 여부와 무관하게 어떤 선생님을 만났는지에 달려 있기 때문입니다.
            </span>
          </p>
        </section>

        {/* 04 — Founder's Story */}
        <section id="founder" className="max-w-[680px] mx-auto px-6 py-24">
          <p className="text-[12px] font-extrabold text-red tracking-widest text-center mb-10">
            FOUNDER&rsquo;S STORY
          </p>
          <h2 className="text-[17px] sm:text-[19px] font-extrabold leading-[1.6] text-center mb-10">
            10년을 가르친 끝에,
            <br />
            좋은 강사만으로는 부족하다는 결론을 내렸습니다.
          </h2>
          <div className="text-[14.5px] text-grey-700 leading-[2] flex flex-col gap-5">
            <p>
              교육은 저희 가족에게 낯선 일이 아니었습니다. 교수인 아버지를 따라
              미국과 영국에서 10여 년의 학창 시절을 보냈고, 한국으로 돌아와
              서울대학교에서 석·박사 과정을 밟았습니다. 그동안 10년 넘게
              SAT를 가르치며 수많은 학생과 부모님을 만났습니다.
            </p>
            <p>
              오래 가르칠수록 한 가지가 분명해졌습니다. 많은 학원이 좋은
              선생님을 이야기하지만, 실제 교육의 품질은 시스템보다 담당
              선생님의 개인기에 의존하고 있었습니다. 좋은 선생님을 만나면
              좋은 결과를 얻고, 그렇지 않으면 같은 학원에서도 전혀 다른
              경험을 하게 됩니다.
            </p>
            <p>
              부모님이 맡겨주신 믿음과 학생의 중요한 시간을 그런 우연에
              맡겨서는 안 된다고 생각했습니다.
            </p>
            <p className="font-bold text-ink">그래서 ALTON을 만들었습니다.</p>
            <p>
              한 명의 에이스 강사에게 의존하는 학원이 아니라, 에이스 강사의
              진단과 판단을 커리큘럼으로 만들고 모든 수업의 품질을 회사가
              책임지는 학원.
            </p>
            <p>
              학생마다 다른 목표와 학교 일정, 현재 실력과 학습 습관을
              바탕으로 계획을 세우고, 매 수업의 결과에 따라 다시 조정합니다.
              담당 선생님 혼자가 아니라 ALTON이 그 과정을 함께 관리합니다.
            </p>
            <p className="font-bold text-ink">좋은 교육이 우연이 되지 않도록.</p>
            <p>한 학생이 얻을 수 있는 최선의 결과를 끝까지 설계하겠습니다.</p>
          </div>
        </section>

        {/* 05 — What: 3 pillars */}
        <section id="platform" className="bg-grey-100 py-24">
          <div className="max-w-[1100px] mx-auto px-6">
            <h2 className="text-[26px] sm:text-[32px] font-extrabold text-center mb-14">
              우리가 다르게 만든 것
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {PILLARS.map((p, i) => (
                <div key={p.title} className="rounded-3xl bg-white shadow-[0_2px_24px_rgba(0,0,0,0.06)] px-7 py-9">
                  <div className="w-9 h-9 rounded-full bg-red text-white text-[14px] font-extrabold flex items-center justify-center mb-5">
                    {i + 1}
                  </div>
                  <h3 className="text-[17px] sm:text-[18px] font-extrabold mb-4 leading-[1.4]">
                    {p.title}
                  </h3>
                  <span className="inline-block text-[11px] font-bold text-grey-500 bg-grey-100 px-3 py-1 rounded-full mb-4">
                    기존 방식: {p.before}
                  </span>
                  <p className="text-[13.5px] text-grey-700 leading-[1.85]">{p.after}</p>
                  {p.vision && (
                    <span className="inline-block mt-4 text-[11px] font-extrabold px-3 py-1 rounded-full bg-blue-bg text-blue">
                      {p.vision}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 무료 체험 수업 (기존 기능 유지) */}
        <section id="ot" className="bg-grey-100 py-20">
          <div className="max-w-[720px] mx-auto px-6 text-center">
            <span className="inline-block text-[11.5px] font-extrabold px-3 py-1 rounded-full bg-yellow-bg text-ink mb-4">
              FREE TRIAL
            </span>
            <h3 className="text-[20px] sm:text-[22px] font-extrabold mb-3">
              계약 전에, 먼저 수업해보세요.
            </h3>
            <p className="text-[14px] text-grey-500 leading-[1.9]">
              정식 계약 전, 담당 튜터와 무료 체험 수업을 진행합니다.
              <br />
              학생과 튜터의 케미스트리, 수업 방식을 직접 확인하신 후 계약 여부를 결정하실 수 있습니다.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-20">
          <div className="max-w-[760px] mx-auto px-6">
            <h2 className="text-[24px] sm:text-[28px] font-extrabold text-center mb-10">
              자주 묻는 질문
            </h2>
            <div className="flex flex-col gap-3">
              {FAQS.map((f) => (
                <details
                  key={f.q}
                  className="group rounded-xl border-[1.5px] border-grey-200 bg-white px-5 py-4"
                >
                  <summary className="text-[14.5px] font-bold cursor-pointer list-none flex items-center justify-between gap-4">
                    <span>{f.q}</span>
                    <span className="shrink-0 text-grey-300 group-open:rotate-45 transition-transform">
                      +
                    </span>
                  </summary>
                  <p className="text-[13.5px] text-grey-500 leading-[1.9] mt-3">
                    {f.a.map((line, i) => (
                      <Fragment key={i}>
                        {line}
                        {i < f.a.length - 1 && <br />}
                      </Fragment>
                    ))}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 최종 CTA / 상담 신청 */}
        <section id="consult" className="max-w-[720px] mx-auto px-6 py-20">
          <h2 className="text-[26px] sm:text-[30px] font-extrabold text-center mb-3">
            1:1 수업 상담 신청
          </h2>
          <p className="text-[14.5px] text-grey-500 text-center mb-8 leading-[1.7]">
            신청해 주시면 담당 컨설턴트를 배정하고, 예약 링크를 이메일로
            보내드립니다.
          </p>
          <ConsultForm />
        </section>
      </main>

      <footer className="border-t border-grey-200">
        <div className="max-w-[1100px] mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-[15px] font-extrabold">
            <span className="text-red">ALTON</span> EDUCATION
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
