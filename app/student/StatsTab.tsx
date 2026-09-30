"use client";

import { useCallback, useEffect, useState } from "react";
import { fmtIntl, fmtDate } from "@/lib/format-datetime";
import { SCORE_DISCLAIMER } from "@/lib/mock-exam/score-estimate";
import { BarRow, Empty, Metric, RangeTrend, Section, Sparkline, StackedWeekBars, StatsSkeleton } from "@/app/components/stats/charts";
import type { ExtendedStats } from "@/lib/student-stats/types";
import type { StatsData } from "./stats-data";

// 학생 통계 탭 — 학생 본인·학부모·컨설턴트·관리자가 같은 컴포넌트를 쓴다. 역할별 차이는 서버가
// 내려주는 데이터의 필드 유무로만 결정된다(만족도·모의고사 강약·선생님 운영 지표는 키가 없으면 그리지 않는다).
const md = (week: string) => fmtIntl(week, { month: "numeric", day: "numeric" });
const ym = (m: string) => `${Number(m.slice(5))}월`;

export default function StatsTab({ data }: { data: StatsData }) {
  const x = data.extended;
  return (
    <div className="max-w-[880px]">
      <div className={"grid gap-3 mb-4 " + (hasSatisfaction(data) ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3")}>
        <StatCard value={data.attendanceRate !== null ? `${data.attendanceRate}%` : "—"} label="수업 참여율" />
        {hasSatisfaction(data) && (
          <StatCard value={data.satisfactionAvg != null ? `${data.satisfactionAvg} / 5` : "—"} label="선생님 피드백 만족도" />
        )}
        {x && <StatCard value={x.skills.overallPct !== null ? `${x.skills.overallPct}%` : "—"} label="문제 정답률" />}
        {x && <StatCard value={`${x.entitlements.remaining}회`} label="수업권 잔여" />}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {x && <LearningSection x={x} />}
        {x && <MockSection x={x} />}
        {x && <HabitSection x={x} />}
        <OpsSection data={data} />
        {x && <EntitlementSection x={x} />}
        {x?.teacherOps && <TeacherSection x={x} />}
      </div>
    </div>
  );
}

function hasSatisfaction(d: StatsData) {
  return "satisfactionAvg" in d;
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-4 py-4 text-center">
      <div className="text-[22px] font-extrabold text-ink">{value}</div>
      <div className="text-[11.5px] font-bold text-grey-500 mt-1">{label}</div>
    </div>
  );
}

function LearningSection({ x }: { x: ExtendedStats }) {
  const { skills, homework: hw } = x;
  const hasHw = hw.assigned > 0;
  return (
    <Section title="학습 성과" hint="채점이 끝난 문제만 집계합니다." wide>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="text-[12.5px] font-bold text-ink mb-2">약점 skill 상위 {skills.weak.length || 5}개</h3>
          {skills.weak.length === 0 ? (
            <Empty>{skills.totalAnswered === 0 ? "아직 채점된 문제가 없습니다." : "비교할 만큼 푼 skill이 아직 없습니다(skill당 3문제 이상)."}</Empty>
          ) : (
            skills.weak.map((s) => (
              <div key={s.code} className="mb-2.5 last:mb-0">
                <BarRow label={s.label} pct={s.pct} right={`${s.pct}% (${s.correct}/${s.total})`} />
                {s.delta !== null && s.delta !== 0 && (
                  <div className="text-[11px] text-grey-500 pl-[142px] -mt-1.5">
                    최근 4주 {s.delta > 0 ? "▲" : "▼"} {Math.abs(s.delta)}%p
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        <div>
          <h3 className="text-[12.5px] font-bold text-ink mb-2">주별 정답률</h3>
          {skills.totalAnswered === 0 ? (
            <Empty>표시할 기록이 없습니다.</Empty>
          ) : (
            <Sparkline label="주별 정답률" points={skills.weekly.map((w) => ({ x: md(w.week), y: w.pct }))} />
          )}
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-grey-100">
        <h3 className="text-[12.5px] font-bold text-ink mb-2">과제</h3>
        {!hasHw ? (
          <Empty>배정된 과제가 없습니다.</Empty>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Metric value={hw.completionPct !== null ? `${hw.completionPct}%` : "—"} label="완료율" sub={`${hw.submitted}/${hw.assigned}문항 제출`} />
              <Metric value={hw.onTimePct !== null ? `${hw.onTimePct}%` : "—"} label="기한 내 제출률" />
              <Metric value={hw.accuracyPct !== null ? `${hw.accuracyPct}%` : "—"} label="과제 정답률" />
              <Metric value={`${hw.overdue.total}건`} label="기한 초과" sub={overdueDetail(hw.overdue)} />
            </div>
            <div>
              <div className="text-[11.5px] font-bold text-grey-500 mb-1">주별 과제 정답률</div>
              <Sparkline label="주별 과제 정답률" points={hw.weekly.map((w) => ({ x: md(w.week), y: w.accuracyPct }))} />
            </div>
          </div>
        )}
        {!hasHw && hw.overdue.total > 0 && <p className="text-[12px] text-grey-500 mt-2">보드 기한 초과 {hw.overdue.total}건 ({overdueDetail(hw.overdue)})</p>}
      </div>
    </Section>
  );
}

function overdueDetail(o: ExtendedStats["homework"]["overdue"]) {
  const parts = [
    o.homework && `과제 ${o.homework}`, o.vocabQuiz && `단어시험 ${o.vocabQuiz}`,
    o.mockExam && `모의고사 ${o.mockExam}`, o.manual && `할 일 ${o.manual}`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "없음";
}

function MockSection({ x }: { x: ExtendedStats }) {
  const { points, strengths } = x.mock;
  const ranged = points.filter((p) => p.total);
  const last = ranged[ranged.length - 1];
  return (
    <Section title="모의고사" hint="채점 완료된 응시 기준, 최근 12회까지." wide>
      {points.length === 0 ? (
        <Empty>채점이 끝난 모의고사가 아직 없습니다.</Empty>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            {ranged.length > 0 ? (
              <>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-[20px] font-extrabold text-ink">{last.total!.low}~{last.total!.high}</span>
                  <span className="text-[11.5px] font-bold text-grey-500">최근 예상 점수 범위</span>
                </div>
                <RangeTrend label="예상 점수 범위 추이" min={Math.max(400, Math.floor(Math.min(...ranged.map((p) => p.total!.low)) / 100) * 100 - 100)} max={Math.min(1600, Math.ceil(Math.max(...ranged.map((p) => p.total!.high)) / 100) * 100 + 100)}
                  items={ranged.map((p) => ({ x: fmtDate(p.gradedAt, { month: "numeric", day: "numeric" }), low: p.total!.low, high: p.total!.high }))} />
                <p className="text-[11px] text-grey-500 mt-1">{SCORE_DISCLAIMER}</p>
              </>
            ) : (
              <Empty>예상 점수 범위는 적응형 모의고사를 채점 완료한 뒤에 표시됩니다.</Empty>
            )}
          </div>
          <div>
            <div className="text-[11.5px] font-bold text-grey-500 mb-1">응시별 정답률</div>
            <Sparkline label="모의고사 응시별 정답률" points={points.map((p) => ({ x: fmtDate(p.gradedAt, { month: "numeric", day: "numeric" }), y: p.accuracyPct }))} />
          </div>
        </div>
      )}
      {strengths && points.length > 0 && (
        <div className="mt-5 pt-4 border-t border-grey-100 grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-[12.5px] font-bold text-ink mb-2">섹션별 정답률</h3>
            {strengths.sections.map((s) => (
              <BarRow key={s.key} label={s.label} pct={s.pct} right={`${s.pct}% (${s.correct}/${s.total})`} />
            ))}
            {x.mock.points.some((p) => p.rw) && (
              <p className="text-[11.5px] text-grey-500 mt-2">
                최근 섹션 범위 — R&W {last?.rw?.low}~{last?.rw?.high} · Math {last?.math?.low}~{last?.math?.high}
              </p>
            )}
          </div>
          <div>
            <h3 className="text-[12.5px] font-bold text-ink mb-2">영역별 강약</h3>
            {strengths.domains.length === 0 ? <Empty>영역 기록이 없습니다.</Empty> :
              strengths.domains.map((d) => <BarRow key={d.label} label={d.label} pct={d.pct} right={`${d.pct}% (${d.correct}/${d.total})`} />)}
          </div>
        </div>
      )}
    </Section>
  );
}

const ACT_LABEL = [
  { key: "homework", name: "과제 풀이", dot: "bg-ink" },
  { key: "lesson", name: "수업 문제 풀이", dot: "bg-grey-500" },
  { key: "vocab", name: "단어 추가", dot: "bg-grey-300" },
] as const;

function HabitSection({ x }: { x: ExtendedStats }) {
  const { weekly, vocabQuizzes } = x.habits;
  const total = weekly.reduce((a, w) => a + w.total, 0);
  const active = weekly.filter((w) => w.total > 0).length;
  return (
    <Section title="학습 습관" hint="최근 12주 활동.">
      {total === 0 && vocabQuizzes.length === 0 ? (
        <Empty>최근 12주 동안 기록된 학습 활동이 없습니다.</Empty>
      ) : (
        <>
          <div className="flex gap-6 mb-3">
            <Metric value={`${total}건`} label="12주 활동" />
            <Metric value={`${active}/12주`} label="활동한 주" />
          </div>
          <StackedWeekBars weeks={weekly.map((w) => ({ label: md(w.week), parts: ACT_LABEL.map((a) => ({ key: a.key, value: w[a.key] })) }))} />
          <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-grey-500">
            {ACT_LABEL.map((a) => (
              <li key={a.key} className="flex items-center gap-1.5">
                <span className={"inline-block w-2 h-2 rounded-sm " + a.dot} aria-hidden /> {a.name} {weekly.reduce((s, w) => s + w[a.key], 0)}
              </li>
            ))}
          </ul>
          <div className="mt-4 pt-3 border-t border-grey-100">
            <div className="text-[11.5px] font-bold text-grey-500 mb-1">단어 시험 성적</div>
            {vocabQuizzes.length === 0 ? <Empty>응시한 단어 시험이 없습니다.</Empty> : (
              <Sparkline label="단어 시험 성적" points={vocabQuizzes.map((q) => ({ x: fmtDate(q.at, { month: "numeric", day: "numeric" }), y: q.pct }))} />
            )}
          </div>
        </>
      )}
    </Section>
  );
}

function OpsSection({ data }: { data: StatsData }) {
  const ops = data.extended?.ops;
  const any = ops && Object.values(ops.totals).some((v) => v > 0);
  return (
    <Section title="수업 운영" hint="최근 6개월(수업 시작 시각 기준).">
      {ops && any && (
        <>
          <div className="grid grid-cols-5 gap-2 mb-3">
            <Metric value={`${ops.totals.completed}`} label="수업" />
            <Metric value={`${ops.totals.noShow}`} label="노쇼" />
            <Metric value={`${ops.totals.late}`} label="지각" />
            <Metric value={`${ops.totals.cancelled}`} label="취소" />
            <Metric value={`${ops.totals.lateCancel}`} label="늦은 취소" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] text-ink">
              <caption className="sr-only">월별 수업 운영 현황</caption>
              <thead>
                <tr className="text-grey-500 text-left">
                  <th scope="col" className="font-bold py-1">월</th>
                  {["수업", "노쇼", "지각", "취소", "늦은 취소"].map((h) => <th key={h} scope="col" className="font-bold py-1 text-right">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {ops.months.map((m) => (
                  <tr key={m.month} className="border-t border-grey-100">
                    <th scope="row" className="font-normal py-1 text-left">{ym(m.month)}</th>
                    <td className="text-right">{m.completed}</td><td className="text-right">{m.noShow}</td>
                    <td className="text-right">{m.late}</td><td className="text-right">{m.cancelled}</td><td className="text-right">{m.lateCancel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {ops && !any && <Empty>최근 6개월 수업 기록이 없습니다.</Empty>}
      <h3 className="text-[12.5px] font-bold text-ink mt-4 mb-2">과목별 참여율</h3>
      {data.bySubject.length === 0 ? (
        <Empty>아직 집계할 수업 기록이 없습니다.</Empty>
      ) : (
        data.bySubject.map((s) => <BarRow key={s.subjectName} label={s.subjectName} pct={s.pct} right={`${s.pct}%`} />)
      )}
    </Section>
  );
}

function EntitlementSection({ x }: { x: ExtendedStats }) {
  const e = x.entitlements;
  return (
    <Section title="수업권" hint="사용 가능한 수업권과 만료 예정.">
      {e.groups.length === 0 ? (
        <Empty>사용 가능한 수업권이 없습니다.</Empty>
      ) : (
        <>
          <div className="flex gap-6 mb-3">
            <Metric value={`${e.remaining}회`} label="잔여" />
            <Metric value={`${e.expiringSoon}회`} label="14일 내 만료" sub={e.nextExpiresAt ? `가장 빠른 만료 ${fmtDate(e.nextExpiresAt)}` : undefined} />
          </div>
          <ul className="text-[12.5px] text-ink">
            {e.groups.map((g, i) => (
              <li key={i} className="flex justify-between gap-3 py-1.5 border-t border-grey-100 first:border-t-0">
                <span>{g.label}{g.isPaid ? "" : " (무료)"}</span>
                <span className="text-grey-500">{g.remaining}회{g.expiresAt ? ` · ~${fmtDate(g.expiresAt)}` : ""}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}

function TeacherSection({ x }: { x: ExtendedStats }) {
  const t = x.teacherOps!;
  return (
    <Section title="선생님 피드백 (관리자)" hint="최근 90일 완료 수업 기준. 관리자에게만 보입니다." wide>
      {t.reviews.length === 0 ? (
        <Empty>최근 90일 완료된 수업이 없습니다.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] text-ink">
            <caption className="sr-only">선생님별 수업 리뷰 작성 현황</caption>
            <thead>
              <tr className="text-grey-500 text-left">
                <th scope="col" className="font-bold py-1">선생님</th>
                {["완료 수업", "리뷰 확정", "초안", "미작성", "확정까지(평균)"].map((h) => <th key={h} scope="col" className="font-bold py-1 text-right">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {t.reviews.map((r) => (
                <tr key={r.teacherName} className="border-t border-grey-100">
                  <th scope="row" className="font-normal py-1 text-left">{r.teacherName}</th>
                  <td className="text-right">{r.sessions}</td><td className="text-right">{r.finalized}</td>
                  <td className="text-right">{r.draft}</td>
                  <td className={"text-right " + (r.missing > 0 ? "font-bold text-red" : "")}>{r.missing}{r.missing > 0 ? " ⚠" : ""}</td>
                  <td className="text-right">{r.avgHoursToFinalize !== null ? `${r.avgHoursToFinalize}시간` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex gap-6 mt-4 pt-3 border-t border-grey-100">
        <Metric value={`${t.grading.pending}건`} label="채점 대기" sub={t.grading.oldestPendingAt ? `가장 오래된 제출 ${fmtDate(t.grading.oldestPendingAt)}` : undefined} />
        <Metric value={t.grading.avgHoursToGrade !== null ? `${t.grading.avgHoursToGrade}시간` : "—"} label="채점까지 평균" />
      </div>
    </Section>
  );
}

// 로딩·오류·재시도를 포함한 지연 로딩 래퍼 — 탭을 열 때 한 번 불러온다(학생이 바뀌면 key 로 다시 마운트).
export function StatsPanel({ load }: { load: () => Promise<StatsData> }) {
  const [state, setState] = useState<{ data: StatsData | null; error: string | null }>({ data: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const run = useCallback(() => {
    let cancelled = false;
    load()
      .then((data) => !cancelled && setState({ data, error: null }))
      .catch((e) => !cancelled && setState({ data: null, error: e instanceof Error ? e.message : "통계를 불러오지 못했습니다." }));
    return () => { cancelled = true; };
  }, [load]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 재시도 시 상태 초기화(관용적 패턴)
    if (attempt > 0) setState({ data: null, error: null });
    return run();
  }, [run, attempt]);
  if (state.error) {
    return (
      <div role="alert" className="py-8 text-[13px]">
        <p className="text-red mb-3">{state.error}</p>
        <button type="button" onClick={() => setAttempt((a) => a + 1)} className="text-[13px] font-bold border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 text-ink">
          다시 시도
        </button>
      </div>
    );
  }
  if (!state.data) return <StatsSkeleton />;
  return <StatsTab data={state.data} />;
}
