"use client";

import Link from "next/link";
import PageFrame from "@/app/components/PageFrame";
import type { MockExamOverview } from "@/lib/mock-exam/attempt-data";
import type { BreakdownRow } from "@/lib/mock-exam/report";
import { buildMockExamListRows, pickNextPracticeTest } from "@/lib/mock-exam/open-list";
import { ctaLabelFor, type InterestStatus } from "./tutoring-state";

// 2026-10-05 무료 회원 S2 — 무료 학습 회원 홈(브리프 §3.6): 다음 모의고사, 최근 결과 점수, 약점 상위 3,
// Practice/Vocabulary 바로가기, "선생님과 이야기하기" 카드(S4 전까지 '상담 준비 중' 상태).
// 데이터는 모두 서버(app/student/page.tsx 무료 분기)에서 받는다 — 이 컴포넌트는 추가 요청을 만들지 않는다.
export type FreeMemberHomeProps = {
  studentName: string;
  overview: MockExamOverview | undefined;
  /** topWeaknesses(lib/mock-exam/weakness.ts) 결과. 채점 확정 응시가 없으면 빈 배열. */
  weaknesses: BreakdownRow[];
  gradedAttemptCount: number;
  /** S4 — 관심 등록 상태(없으면 null). 카드 문구가 상태별로 바뀐다. */
  interestStatus?: InterestStatus | null;
  onSelectTab: (id: "mock-exam" | "problemlog" | "vocab") => void;
};

const pct = (r: BreakdownRow) => Math.round((r.correct / r.total) * 100);

export default function FreeMemberHome({ studentName, overview, weaknesses, gradedAttemptCount, interestStatus = null, onSelectTab }: FreeMemberHomeProps) {
  const cta = ctaLabelFor(interestStatus ? { kind: "interest", status: interestStatus, invites: [] } : { kind: "none", invites: [] });
  const catalog = overview?.catalog ?? [];
  const attempts = overview?.attempts ?? [];
  // 2026-10-08 — 다음 모의고사는 끝내지 않은 세트 중 번호가 가장 낮은 것(최신 세트가 아니다). 진행 중이어도 번호순.
  const nextRow = pickNextPracticeTest(buildMockExamListRows(catalog, attempts));
  const nextExam = nextRow ? { name: nextRow.name, format: catalog.find((c) => c.examSetId === nextRow.examSetId)?.format ?? "fixed" } : null;
  const inProgress = nextRow?.state === "in_progress";
  const latestGraded = attempts.find((a) => a.status === "graded" && a.correctCount !== null) ?? null;

  return (
    <PageFrame title="Home">
      <div className="rounded-xl bg-white border border-brand-border p-6 mb-4">
        <p className="text-[12px] font-bold text-brand-red mb-1">Free member</p>
        <h2 className="text-[20px] font-extrabold text-navy mb-2">Welcome, {studentName}</h2>
        <p className="text-[13.5px] text-grey-500 leading-[1.7]">
          Take a free practice test and review your results and explanations. Save missed questions to My Notebook and unfamiliar words to your Vocabulary Builder for review.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mb-4">
        <section className="rounded-xl bg-white border border-brand-border p-5" data-testid="free-home-next-exam">
          <h3 className="text-[13px] font-bold text-navy mb-2">Next Practice Test</h3>
          {nextExam ? (
            <>
              <p className="text-[15px] font-extrabold text-ink">{nextExam.name}</p>
              <p className="text-[12px] text-grey-500 mt-0.5">
                {inProgress ? "In progress — continue" : nextExam.format === "mst" ? "Adaptive, 4 modules" : "Fixed form"}
              </p>
              <button type="button" onClick={() => onSelectTab("mock-exam")} className="mt-3 px-4 py-2.5 rounded-lg bg-brand-red text-white text-[13px] font-bold">
                {inProgress ? "Continue" : "Start practice test"}
              </button>
            </>
          ) : (
            <p className="text-[13px] text-grey-500">
              {catalog.length === 0 ? "No free practice tests are available right now." : "You have taken all available free practice tests."}
            </p>
          )}
        </section>

        <section className="rounded-xl bg-white border border-brand-border p-5" data-testid="free-home-latest-result">
          <h3 className="text-[13px] font-bold text-navy mb-2">Latest Result</h3>
          {latestGraded ? (
            <>
              <p className="text-[15px] font-extrabold text-ink">
                {latestGraded.correctCount} / {latestGraded.totalCount} correct
              </p>
              <p className="text-[12px] text-grey-500 mt-0.5">{latestGraded.examSetName}</p>
              <Link href={`/student/mock-exam/${latestGraded.id}`} className="inline-block mt-3 px-4 py-2.5 rounded-lg border border-brand-border text-navy text-[13px] font-bold">
                View results
              </Link>
            </>
          ) : (
            <p className="text-[13px] text-grey-500">No graded attempts yet. Take your first practice test.</p>
          )}
        </section>
      </div>

      <section className="rounded-xl bg-white border border-brand-border p-5 mb-4" data-testid="free-home-weaknesses">
        <h3 className="text-[13px] font-bold text-navy mb-2">Top 3 Weak Areas</h3>
        {weaknesses.length > 0 ? (
          <ul className="divide-y divide-brand-border">
            {weaknesses.map((w) => (
              <li key={w.key} className="flex items-center justify-between py-2">
                <span className="text-[13px] text-ink">
                  <span className="text-[11px] font-bold text-grey-500 mr-2">{w.section === "rw" ? "R&W" : "Math"}</span>
                  {w.label}
                </span>
                <span className="text-[12px] font-bold text-brand-red">
                  {pct(w)}% <span className="text-grey-500 font-normal">({w.correct}/{w.total})</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-grey-500">
            {gradedAttemptCount === 0 ? "Once you have graded attempts, your most-missed areas will appear here." : "No clear weak areas yet. Nice work!"}
          </p>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2 mb-4">
        <button type="button" onClick={() => onSelectTab("problemlog")} className="rounded-xl bg-white border border-brand-border p-5 text-left">
          <p className="text-[13px] font-bold text-navy">My Notebook</p>
          <p className="text-[12px] text-grey-500 mt-0.5">Retry questions you missed or saved from your practice tests.</p>
        </button>
        <button type="button" onClick={() => onSelectTab("vocab")} className="rounded-xl bg-white border border-brand-border p-5 text-left">
          <p className="text-[13px] font-bold text-navy">Vocabulary Builder</p>
          <p className="text-[12px] text-grey-500 mt-0.5">Your word list, the word library, and vocabulary quizzes.</p>
        </button>
      </div>

      <section className="rounded-xl bg-navy p-6 text-white" data-testid="free-home-tutoring-card">
        <p className="text-[12px] font-bold text-[#97A9C8] mb-1">1:1 Tutoring</p>
        <h3 className="text-[17px] font-extrabold mb-1">{cta.title}</h3>
        <p className="text-[13px] text-[#C9D3E6] leading-[1.7] mb-3">{cta.body}</p>
        <Link href="/student/tutoring?from=home" className="inline-block px-4 py-2.5 rounded-lg bg-white text-navy text-[13px] font-bold">
          {cta.button}
        </Link>
      </section>
    </PageFrame>
  );
}
