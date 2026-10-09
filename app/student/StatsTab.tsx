"use client";

import { useCallback, useEffect, useState } from "react";
import { fmtIntlEn as fmtIntl, fmtDateEn as fmtDate } from "@/lib/format-datetime-en";
import { SCORE_DISCLAIMER } from "@/lib/mock-exam/score-estimate";
import { BarRow, Empty, Metric, RangeTrend, Section, Sparkline, StackedWeekBars, StatsSkeleton } from "@/app/components/stats/charts";
import type { ExtendedStats } from "@/lib/student-stats/types";
import type { StatsData } from "./stats-data";

// 학생 통계 탭 — 학생 본인·학부모·컨설턴트·관리자가 같은 컴포넌트를 쓴다. 역할별 차이는 서버가
// 내려주는 데이터의 필드 유무로만 결정된다(만족도·모의고사 강약·선생님 운영 지표는 키가 없으면 그리지 않는다).
const md = (week: string) => fmtIntl(week, { month: "numeric", day: "numeric" });
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ym = (m: string) => MONTH_SHORT[Number(m.slice(5)) - 1] ?? m;

export default function StatsTab({ data }: { data: StatsData }) {
  const x = data.extended;
  return (
    <div className="max-w-[880px]">
      <div className={"grid gap-3 mb-4 " + (hasSatisfaction(data) ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3")}>
        <StatCard value={data.attendanceRate !== null ? `${data.attendanceRate}%` : "—"} label="Attendance" />
        {hasSatisfaction(data) && (
          <StatCard value={data.satisfactionAvg != null ? `${data.satisfactionAvg} / 5` : "—"} label="Teacher feedback rating" />
        )}
        {x && <StatCard value={x.skills.overallPct !== null ? `${x.skills.overallPct}%` : "—"} label="Problem accuracy" />}
        {x && <StatCard value={`${x.entitlements.remaining}`} label="Lesson credits left" />}
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
    <Section title="Learning Progress" hint="Only graded problems are counted." wide>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="text-[12.5px] font-bold text-ink mb-2">Top {skills.weak.length || 5} weakest skills</h3>
          {skills.weak.length === 0 ? (
            <Empty>{skills.totalAnswered === 0 ? "No graded problems yet." : "Not enough problems per skill to compare yet (3 or more per skill)."}</Empty>
          ) : (
            skills.weak.map((s) => (
              <div key={s.code} className="mb-2.5 last:mb-0">
                <BarRow label={s.label} pct={s.pct} right={`${s.pct}% (${s.correct}/${s.total})`} />
                {s.delta !== null && s.delta !== 0 && (
                  <div className="text-[11px] text-grey-500 pl-[142px] -mt-1.5">
                    Last 4 weeks {s.delta > 0 ? "▲" : "▼"} {Math.abs(s.delta)} pts
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        <div>
          <h3 className="text-[12.5px] font-bold text-ink mb-2">Weekly accuracy</h3>
          {skills.totalAnswered === 0 ? (
            <Empty>Nothing to show yet.</Empty>
          ) : (
            <Sparkline label="Weekly accuracy" points={skills.weekly.map((w) => ({ x: md(w.week), y: w.pct }))} />
          )}
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-grey-100">
        <h3 className="text-[12.5px] font-bold text-ink mb-2">Assignments</h3>
        {!hasHw ? (
          <Empty>No assignments yet.</Empty>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Metric value={hw.completionPct !== null ? `${hw.completionPct}%` : "—"} label="Completion" sub={`${hw.submitted}/${hw.assigned} submitted`} />
              <Metric value={hw.onTimePct !== null ? `${hw.onTimePct}%` : "—"} label="On-time rate" />
              <Metric value={hw.accuracyPct !== null ? `${hw.accuracyPct}%` : "—"} label="Assignment accuracy" />
              <Metric value={`${hw.overdue.total}`} label="Overdue" sub={overdueDetail(hw.overdue)} />
            </div>
            <div>
              <div className="text-[11.5px] font-bold text-grey-500 mb-1">Weekly assignment accuracy</div>
              <Sparkline label="Weekly assignment accuracy" points={hw.weekly.map((w) => ({ x: md(w.week), y: w.accuracyPct }))} />
            </div>
          </div>
        )}
        {!hasHw && hw.overdue.total > 0 && <p className="text-[12px] text-grey-500 mt-2">Overdue board items: {hw.overdue.total} ({overdueDetail(hw.overdue)})</p>}
      </div>
    </Section>
  );
}

function overdueDetail(o: ExtendedStats["homework"]["overdue"]) {
  const parts = [
    o.homework && `Assignments ${o.homework}`, o.vocabQuiz && `Vocabulary quizzes ${o.vocabQuiz}`,
    o.mockExam && `Mock exams ${o.mockExam}`, o.manual && `To-dos ${o.manual}`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "None";
}

function MockSection({ x }: { x: ExtendedStats }) {
  const { points, strengths } = x.mock;
  const ranged = points.filter((p) => p.total);
  const last = ranged[ranged.length - 1];
  return (
    <Section title="Practice Tests" hint="Graded attempts only, up to the last 12." wide>
      {points.length === 0 ? (
        <Empty>No graded practice tests yet.</Empty>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            {ranged.length > 0 ? (
              <>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-[20px] font-extrabold text-ink">{last.total!.low}~{last.total!.high}</span>
                  <span className="text-[11.5px] font-bold text-grey-500">Latest estimated score range</span>
                </div>
                <RangeTrend label="Estimated score range trend" min={Math.max(400, Math.floor(Math.min(...ranged.map((p) => p.total!.low)) / 100) * 100 - 100)} max={Math.min(1600, Math.ceil(Math.max(...ranged.map((p) => p.total!.high)) / 100) * 100 + 100)}
                  items={ranged.map((p) => ({ x: fmtDate(p.gradedAt, { month: "numeric", day: "numeric" }), low: p.total!.low, high: p.total!.high }))} />
                <p className="text-[11px] text-grey-500 mt-1">{SCORE_DISCLAIMER}</p>
              </>
            ) : (
              <Empty>The estimated score range appears once an adaptive practice test has been graded.</Empty>
            )}
          </div>
          <div>
            <div className="text-[11.5px] font-bold text-grey-500 mb-1">Accuracy by attempt</div>
            <Sparkline label="Mock exam accuracy by attempt" points={points.map((p) => ({ x: fmtDate(p.gradedAt, { month: "numeric", day: "numeric" }), y: p.accuracyPct }))} />
          </div>
        </div>
      )}
      {strengths && points.length > 0 && (
        <div className="mt-5 pt-4 border-t border-grey-100 grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-[12.5px] font-bold text-ink mb-2">Accuracy by section</h3>
            {strengths.sections.map((s) => (
              <BarRow key={s.key} label={s.label} pct={s.pct} right={`${s.pct}% (${s.correct}/${s.total})`} />
            ))}
            {x.mock.points.some((p) => p.rw) && (
              <p className="text-[11.5px] text-grey-500 mt-2">
                Latest section ranges — R&W {last?.rw?.low}~{last?.rw?.high} · Math {last?.math?.low}~{last?.math?.high}
              </p>
            )}
          </div>
          <div>
            <h3 className="text-[12.5px] font-bold text-ink mb-2">Strengths by domain</h3>
            {strengths.domains.length === 0 ? <Empty>No domain data yet.</Empty> :
              strengths.domains.map((d) => <BarRow key={d.label} label={d.label} pct={d.pct} right={`${d.pct}% (${d.correct}/${d.total})`} />)}
          </div>
        </div>
      )}
    </Section>
  );
}

const ACT_LABEL = [
  { key: "homework", name: "Assignment problems", dot: "bg-ink" },
  { key: "lesson", name: "Lesson problems", dot: "bg-grey-500" },
  { key: "vocab", name: "Words added", dot: "bg-grey-300" },
] as const;

function HabitSection({ x }: { x: ExtendedStats }) {
  const { weekly, vocabQuizzes } = x.habits;
  const total = weekly.reduce((a, w) => a + w.total, 0);
  const active = weekly.filter((w) => w.total > 0).length;
  return (
    <Section title="Study Habits" hint="Activity over the last 12 weeks.">
      {total === 0 && vocabQuizzes.length === 0 ? (
        <Empty>No study activity recorded in the last 12 weeks.</Empty>
      ) : (
        <>
          <div className="flex gap-6 mb-3">
            <Metric value={`${total}`} label="Activities (12 wks)" />
            <Metric value={`${active}/12`} label="Active weeks" />
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
            <div className="text-[11.5px] font-bold text-grey-500 mb-1">Vocabulary quiz scores</div>
            {vocabQuizzes.length === 0 ? <Empty>No vocabulary quizzes taken yet.</Empty> : (
              <Sparkline label="Vocabulary quiz scores" points={vocabQuizzes.map((q) => ({ x: fmtDate(q.at, { month: "numeric", day: "numeric" }), y: q.pct }))} />
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
    <Section title="Lesson Activity" hint="Last 6 months (by lesson start time).">
      {ops && any && (
        <>
          <div className="grid grid-cols-5 gap-2 mb-3">
            <Metric value={`${ops.totals.completed}`} label="Lessons" />
            <Metric value={`${ops.totals.noShow}`} label="No-shows" />
            <Metric value={`${ops.totals.late}`} label="Late" />
            <Metric value={`${ops.totals.cancelled}`} label="Cancelled" />
            <Metric value={`${ops.totals.lateCancel}`} label="Late cancels" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] text-ink">
              <caption className="sr-only">Monthly lesson activity</caption>
              <thead>
                <tr className="text-grey-500 text-left">
                  <th scope="col" className="font-bold py-1">Month</th>
                  {["Lessons", "No-shows", "Late", "Cancelled", "Late cancels"].map((h) => <th key={h} scope="col" className="font-bold py-1 text-right">{h}</th>)}
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
      {ops && !any && <Empty>No lessons in the last 6 months.</Empty>}
      <h3 className="text-[12.5px] font-bold text-ink mt-4 mb-2">Attendance by subject</h3>
      {data.bySubject.length === 0 ? (
        <Empty>No lesson records to summarize yet.</Empty>
      ) : (
        data.bySubject.map((s) => <BarRow key={s.subjectName} label={s.subjectName} pct={s.pct} right={`${s.pct}%`} />)
      )}
    </Section>
  );
}

function EntitlementSection({ x }: { x: ExtendedStats }) {
  const e = x.entitlements;
  return (
    <Section title="Lesson Credits" hint="Available credits and upcoming expirations.">
      {e.groups.length === 0 ? (
        <Empty>No lesson credits available.</Empty>
      ) : (
        <>
          <div className="flex gap-6 mb-3">
            <Metric value={`${e.remaining}`} label="Remaining" />
            <Metric value={`${e.expiringSoon}`} label="Expiring within 14 days" sub={e.nextExpiresAt ? `Earliest expiry ${fmtDate(e.nextExpiresAt)}` : undefined} />
          </div>
          <ul className="text-[12.5px] text-ink">
            {e.groups.map((g, i) => (
              <li key={i} className="flex justify-between gap-3 py-1.5 border-t border-grey-100 first:border-t-0">
                <span>{g.label}{g.isPaid ? "" : " (free)"}</span>
                <span className="text-grey-500">{g.remaining} {g.remaining === 1 ? "credit" : "credits"}{g.expiresAt ? ` · until ${fmtDate(g.expiresAt)}` : ""}</span>
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
    <Section title="Teacher Feedback (Admin)" hint="Lessons completed in the last 90 days. Visible to admins only." wide>
      {t.reviews.length === 0 ? (
        <Empty>No lessons completed in the last 90 days.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] text-ink">
            <caption className="sr-only">Lesson review status by teacher</caption>
            <thead>
              <tr className="text-grey-500 text-left">
                <th scope="col" className="font-bold py-1">Teacher</th>
                {["Completed", "Finalized", "Draft", "Missing", "Avg. time to finalize"].map((h) => <th key={h} scope="col" className="font-bold py-1 text-right">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {t.reviews.map((r) => (
                <tr key={r.teacherName} className="border-t border-grey-100">
                  <th scope="row" className="font-normal py-1 text-left">{r.teacherName}</th>
                  <td className="text-right">{r.sessions}</td><td className="text-right">{r.finalized}</td>
                  <td className="text-right">{r.draft}</td>
                  <td className={"text-right " + (r.missing > 0 ? "font-bold text-red" : "")}>{r.missing}{r.missing > 0 ? " ⚠" : ""}</td>
                  <td className="text-right">{r.avgHoursToFinalize !== null ? `${r.avgHoursToFinalize} h` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex gap-6 mt-4 pt-3 border-t border-grey-100">
        <Metric value={`${t.grading.pending}`} label="Awaiting grading" sub={t.grading.oldestPendingAt ? `Oldest submission ${fmtDate(t.grading.oldestPendingAt)}` : undefined} />
        <Metric value={t.grading.avgHoursToGrade !== null ? `${t.grading.avgHoursToGrade} h` : "—"} label="Avg. time to grade" />
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
      .catch((e) => !cancelled && setState({ data: null, error: e instanceof Error ? e.message : "Couldn't load statistics." }));
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
          Try again
        </button>
      </div>
    );
  }
  if (!state.data) return <StatsSkeleton />;
  return <StatsTab data={state.data} />;
}
