"use client";

import Link from "next/link";
import PageFrame from "@/app/components/PageFrame";
import type { MockExamOverview } from "@/lib/mock-exam/attempt-data";
import type { BreakdownRow } from "@/lib/mock-exam/report";

// 2026-10-05 무료 회원 S2 — 무료 학습 회원 홈(브리프 §3.6): 다음 모의고사, 최근 결과 점수, 약점 상위 3,
// Practice/Vocabulary 바로가기, "선생님과 이야기하기" 카드(S4 전까지 '상담 준비 중' 상태).
// 데이터는 모두 서버(app/student/page.tsx 무료 분기)에서 받는다 — 이 컴포넌트는 추가 요청을 만들지 않는다.
export type FreeMemberHomeProps = {
  studentName: string;
  overview: MockExamOverview | undefined;
  /** topWeaknesses(lib/mock-exam/weakness.ts) 결과. 채점 확정 응시가 없으면 빈 배열. */
  weaknesses: BreakdownRow[];
  gradedAttemptCount: number;
  onSelectTab: (id: "mock-exam" | "problemlog" | "vocab") => void;
};

const pct = (r: BreakdownRow) => Math.round((r.correct / r.total) * 100);

export default function FreeMemberHome({ studentName, overview, weaknesses, gradedAttemptCount, onSelectTab }: FreeMemberHomeProps) {
  const catalog = overview?.catalog ?? [];
  const attempts = overview?.attempts ?? [];
  const inProgress = catalog.find((c) => c.attemptStatus === "assigned" || c.attemptStatus === "in_progress");
  const nextExam = inProgress ?? catalog.find((c) => c.attemptId === null) ?? null;
  const latestGraded = attempts.find((a) => a.status === "graded" && a.correctCount !== null) ?? null;

  return (
    <PageFrame title="Home">
      <div className="rounded-xl bg-white border border-brand-border p-6 mb-4">
        <p className="text-[12px] font-bold text-brand-red mb-1">무료 학습 회원</p>
        <h2 className="text-[20px] font-extrabold text-navy mb-2">{studentName} 학생님, 환영합니다</h2>
        <p className="text-[13.5px] text-grey-500 leading-[1.7]">
          무료 모의고사를 풀고 결과·해설을 확인해 보세요. 틀린 문제는 Practice에, 모르는 단어는 Vocabulary에 모아 복습할 수 있습니다.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mb-4">
        <section className="rounded-xl bg-white border border-brand-border p-5" data-testid="free-home-next-exam">
          <h3 className="text-[13px] font-bold text-navy mb-2">다음 모의고사</h3>
          {nextExam ? (
            <>
              <p className="text-[15px] font-extrabold text-ink">{nextExam.name}</p>
              <p className="text-[12px] text-grey-500 mt-0.5">
                {inProgress ? "응시 중 — 이어서 풀기" : nextExam.format === "mst" ? "적응형 4모듈" : "고정형"}
              </p>
              <button type="button" onClick={() => onSelectTab("mock-exam")} className="mt-3 px-4 py-2.5 rounded-lg bg-brand-red text-white text-[13px] font-bold">
                {inProgress ? "이어서 풀기" : "모의고사 시작"}
              </button>
            </>
          ) : (
            <p className="text-[13px] text-grey-500">
              {catalog.length === 0 ? "지금 공개된 무료 모의고사가 없습니다." : "공개된 무료 모의고사를 모두 응시했습니다."}
            </p>
          )}
        </section>

        <section className="rounded-xl bg-white border border-brand-border p-5" data-testid="free-home-latest-result">
          <h3 className="text-[13px] font-bold text-navy mb-2">최근 결과</h3>
          {latestGraded ? (
            <>
              <p className="text-[15px] font-extrabold text-ink">
                {latestGraded.correctCount} / {latestGraded.totalCount} 정답
              </p>
              <p className="text-[12px] text-grey-500 mt-0.5">{latestGraded.examSetName}</p>
              <Link href={`/student/mock-exam/${latestGraded.id}`} className="inline-block mt-3 px-4 py-2.5 rounded-lg border border-brand-border text-navy text-[13px] font-bold">
                결과 보기
              </Link>
            </>
          ) : (
            <p className="text-[13px] text-grey-500">아직 채점된 응시가 없습니다. 첫 모의고사를 풀어 보세요.</p>
          )}
        </section>
      </div>

      <section className="rounded-xl bg-white border border-brand-border p-5 mb-4" data-testid="free-home-weaknesses">
        <h3 className="text-[13px] font-bold text-navy mb-2">약점 영역 TOP 3</h3>
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
            {gradedAttemptCount === 0 ? "채점된 응시가 쌓이면 자주 틀리는 영역이 여기에 보입니다." : "아직 뚜렷한 약점 영역이 없습니다. 좋아요!"}
          </p>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2 mb-4">
        <button type="button" onClick={() => onSelectTab("problemlog")} className="rounded-xl bg-white border border-brand-border p-5 text-left">
          <p className="text-[13px] font-bold text-navy">Practice</p>
          <p className="text-[12px] text-grey-500 mt-0.5">모의고사에서 저장한 문제를 다시 풀어 봅니다.</p>
        </button>
        <button type="button" onClick={() => onSelectTab("vocab")} className="rounded-xl bg-white border border-brand-border p-5 text-left">
          <p className="text-[13px] font-bold text-navy">Vocabulary</p>
          <p className="text-[12px] text-grey-500 mt-0.5">내 단어장과 단어 라이브러리, 단어 퀴즈.</p>
        </button>
      </div>

      <section className="rounded-xl bg-navy p-6 text-white" data-testid="free-home-tutoring-card">
        <p className="text-[12px] font-bold text-[#97A9C8] mb-1">1:1 Tutoring</p>
        <h3 className="text-[17px] font-extrabold mb-1">선생님과 이야기하기</h3>
        <p className="text-[13px] text-[#C9D3E6] leading-[1.7] mb-3">
          모의고사 결과를 바탕으로 맞춤 수업을 받고 싶다면 상담을 신청해 보세요. 상담 신청 기능은 준비 중입니다.
        </p>
        <Link href="/student/tutoring" className="inline-block px-4 py-2.5 rounded-lg bg-white text-navy text-[13px] font-bold">
          과외 안내 보기
        </Link>
      </section>
    </PageFrame>
  );
}
