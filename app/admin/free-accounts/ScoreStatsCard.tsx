"use client";

// SAT 점수 통계 카드 — Free Accounts 상세와 일반 학생 상세(StudentMockScoresCard)가 같은 공유 집계 모듈
// (lib/mock-exam/score-aggregate.ts)만 거쳐 숫자가 학생 화면과 일치한다. 점수는 범위(내부 추정)로만 표기한다.
import { useMemo, useState } from "react";
import { SCORE_DISCLAIMER_EN, type ScoreRange } from "@/lib/mock-exam/score-estimate";
import { accuracySummary, buildScorePoints, excludedCounts, groupFacts, summarize, type AttemptFacts, type Metric } from "@/lib/mock-exam/score-aggregate";

export const fmtRange = (r: ScoreRange | null) => (r ? `${new Intl.NumberFormat("en-US").format(r.low)}–${new Intl.NumberFormat("en-US").format(r.high)}` : "—");
const METRICS: { id: Metric; label: string }[] = [
  { id: "total", label: "SAT Total" },
  { id: "rw", label: "Reading & Writing" },
  { id: "math", label: "Math" },
];

export default function ScoreStatsCard({ facts }: { facts: AttemptFacts[] }) {
  const [metric, setMetric] = useState<Metric>("total");
  const model = useMemo(() => {
    const groups = groupFacts(facts);
    const sat = groups.get("sat") ?? [];
    const points = buildScorePoints(sat);
    const apGroups = [...groups.entries()].filter(([k]) => k.startsWith("ap:"));
    return {
      points, excluded: excludedCounts(sat), satCount: sat.length,
      summaries: { total: summarize(points, "total"), rw: summarize(points, "rw"), math: summarize(points, "math") },
      ap: apGroups.map(([k, f]) => ({ subject: k.slice(3), acc: accuracySummary(f) })),
    };
  }, [facts]);
  const s = model.summaries[metric];
  const latestPoint = model.points[model.points.length - 1];

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4" data-testid="score-stats-card">
      <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">Score stats</div>
      <div role="tablist" aria-label="Score metric" className="inline-flex gap-1 mb-3">
        {METRICS.map((m) => (
          <button key={m.id} role="tab" aria-selected={metric === m.id} onClick={() => setMetric(m.id)}
            className={"px-3 py-1 rounded-lg text-[12.5px] font-semibold border-[1.5px] " + (metric === m.id ? "border-navy text-navy" : "border-grey-200 text-grey-500")}>
            {m.label}
          </button>
        ))}
      </div>
      {s.sampleSize === 0 ? (
        <p className="text-[12.5px] text-grey-500">No scored attempts yet</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
            <Stat label="Latest" value={fmtRange(s.latest)} />
            <Stat label="Best" value={fmtRange(s.best)} />
            <Stat label="Average" value={fmtRange(s.average)} sub={`avg of ${s.sampleSize} attempt${s.sampleSize === 1 ? "" : "s"}`} />
            <Stat label="Attempts counted" value={String(s.sampleSize)} />
          </dl>
          {metric === "total" && latestPoint && (
            <p className="text-[12px] text-grey-500 mb-2" data-testid="latest-breakdown">
              Latest breakdown: R&amp;W {fmtRange(latestPoint.rw)} · Math {fmtRange(latestPoint.math)}
            </p>
          )}
          <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mt-3 mb-1" title="Change is measured on the midpoint of each range.">Change by attempt date</div>
          <ul className="text-[12.5px] text-ink space-y-0.5">
            {s.trend.map((t) => (
              <li key={t.attemptId} className="flex justify-between">
                <span>{t.at.slice(0, 10)}</span>
                <span>{fmtRange(t.range)} <span className="text-grey-500">{t.deltaMid === null ? "—" : `${t.deltaMid > 0 ? "+" : ""}${t.deltaMid}`}</span></span>
              </li>
            ))}
          </ul>
        </>
      )}
      {(model.excluded.noEstimate > 0 || model.excluded.notGraded > 0) && (
        <p className="text-[11.5px] text-grey-500 mt-2">
          {model.excluded.noEstimate > 0 && `${model.excluded.noEstimate} fixed-format attempt${model.excluded.noEstimate === 1 ? " has" : "s have"} no score estimate. `}
          {model.excluded.notGraded > 0 && `${model.excluded.notGraded} attempt${model.excluded.notGraded === 1 ? "" : "s"} not yet graded.`}
        </p>
      )}
      <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mt-4 mb-1">AP accuracy by subject</div>
      {model.ap.length === 0 ? (
        <p className="text-[12.5px] text-grey-500">No AP tests available yet</p>
      ) : (
        <ul className="text-[12.5px] text-ink">
          {model.ap.map((a) => <li key={a.subject}>{a.subject}: {a.acc.pct === null ? "—" : `${a.acc.pct}%`} (n={a.acc.sampleSize})</li>)}
        </ul>
      )}
      <p className="text-[11.5px] text-grey-500 mt-3">Estimated score range — not an official SAT / College Board score. {SCORE_DISCLAIMER_EN}</p>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <dt className="text-[11px] text-grey-500">{label}</dt>
      <dd className="text-[15px] font-bold text-ink">{value}</dd>
      {sub && <div className="text-[11px] text-grey-500">{sub}</div>}
    </div>
  );
}
