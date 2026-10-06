// 모의고사 점수 집계 단일 모듈(순수 함수). 학생·학부모·컨설턴트·관리자 화면과 Free Accounts가 모두 이 모듈을 쓴다.
// 규칙: graded 응시만 / 총점은 같은 응시의 R&W·Math가 둘 다 있을 때만 / 응시 간 섹션 합성 금지 /
// 재응시는 별개 레코드 / 기록 없음은 0이 아니라 null / 모든 요약에 표본 수. 추정 방식은 score-estimate.ts 그대로.
import { estimateScore, type ScoreRange, type ScoreRoute } from "./score-estimate";

export type ExamTrack = "sat" | "ap";
export type SectionFacts = { total: number; correct: number | null; complete: boolean; route: ScoreRoute | null };
export type AttemptFacts = {
  attemptId: string;
  examName: string;
  track: ExamTrack;
  apSubject: string | null;
  format: "fixed" | "mst";
  status: "assigned" | "in_progress" | "submitted" | "graded";
  startedAt: string | null;
  gradedAt: string | null;
  attemptSeq: number;
  sections: { rw: SectionFacts; math: SectionFacts };
};
export type EstimateReason = null | "not_graded" | "no_estimate_fixed" | "no_estimate_ap" | "section_incomplete";
export type AttemptEstimate = { rw: ScoreRange | null; math: ScoreRange | null; total: ScoreRange | null; reason: EstimateReason };
export type Metric = "total" | "rw" | "math";
export type ScorePoint = { attemptId: string; at: string; attemptSeq: number; partial: false; total: ScoreRange | null; rw: ScoreRange | null; math: ScoreRange | null };
export type ScoreSummary = {
  sampleSize: number;
  latest: ScoreRange | null;
  best: ScoreRange | null;
  average: ScoreRange | null;
  trend: { attemptId: string; at: string; range: ScoreRange; deltaMid: number | null }[];
};

const round10 = (n: number) => Math.round(n / 10) * 10;
const mid = (r: ScoreRange) => (r.low + r.high) / 2;

export const isScorable = (f: AttemptFacts) => f.status === "graded" && !!f.gradedAt;
export const groupKey = (f: Pick<AttemptFacts, "track" | "apSubject">) => (f.track === "ap" ? `ap:${f.apSubject ?? "unknown"}` : "sat");

/** 단일 응시의 추정. 섹션 점수는 반드시 같은 응시의 정답 수에서만 나온다. */
export function estimateAttempt(f: AttemptFacts): AttemptEstimate {
  const none = { rw: null, math: null, total: null };
  if (!isScorable(f)) return { ...none, reason: "not_graded" };
  if (f.track === "ap") return { ...none, reason: "no_estimate_ap" };
  if (f.format !== "mst") return { ...none, reason: "no_estimate_fixed" };
  const { rw, math } = f.sections;
  if (!rw.complete || !math.complete) return { ...none, reason: "section_incomplete" };
  const e = estimateScore(
    [{ section: "rw", total: rw.total, correct: rw.correct }, { section: "math", total: math.total, correct: math.correct }],
    { rw: rw.route, math: math.route },
  );
  return e ? { rw: e.rw, math: e.math, total: e.total, reason: null } : { ...none, reason: "section_incomplete" };
}

/** 점수 포인트(응시 단위, 완료 시각 오름차순). 추정이 없는 응시는 제외된다. */
export function buildScorePoints(facts: AttemptFacts[]): ScorePoint[] {
  return facts
    .map((f) => ({ f, e: estimateAttempt(f) }))
    .filter(({ e }) => e.total !== null)
    .map(({ f, e }) => ({ attemptId: f.attemptId, at: f.gradedAt as string, attemptSeq: f.attemptSeq, partial: false as const, total: e.total, rw: e.rw, math: e.math }))
    .sort((a, b) => a.at.localeCompare(b.at));
}

export function summarize(points: ScorePoint[], metric: Metric): ScoreSummary {
  const rows = points.filter((p) => p[metric] !== null).map((p) => ({ p, r: p[metric] as ScoreRange }));
  if (!rows.length) return { sampleSize: 0, latest: null, best: null, average: null, trend: [] };
  const sorted = [...rows].sort((a, b) => a.p.at.localeCompare(b.p.at));
  const best = sorted.reduce((acc, x) => (mid(x.r) >= mid(acc.r) ? x : acc));
  const n = sorted.length;
  const avg = {
    low: round10(sorted.reduce((s, x) => s + x.r.low, 0) / n),
    high: round10(sorted.reduce((s, x) => s + x.r.high, 0) / n),
  };
  return {
    sampleSize: n,
    latest: sorted[n - 1].r,
    best: best.r,
    average: avg,
    trend: sorted.map((x, i) => ({ attemptId: x.p.attemptId, at: x.p.at, range: x.r, deltaMid: i === 0 ? null : mid(x.r) - mid(sorted[i - 1].r) })),
  };
}

/** 트랙/AP 과목별로 분리(합산 API 없음). */
export function groupFacts(facts: AttemptFacts[]): Map<string, AttemptFacts[]> {
  const m = new Map<string, AttemptFacts[]>();
  for (const f of facts) m.set(groupKey(f), [...(m.get(groupKey(f)) ?? []), f]);
  return m;
}

/** 정답률(고정형·AP처럼 점수 추정이 없는 응시용). graded만, 기록 없으면 pct=null. */
export function accuracySummary(facts: AttemptFacts[]): { sampleSize: number; pct: number | null } {
  const g = facts.filter((f) => isScorable(f) && f.sections.rw.correct !== null && f.sections.math.correct !== null);
  const total = g.reduce((s, f) => s + f.sections.rw.total + f.sections.math.total, 0);
  const correct = g.reduce((s, f) => s + (f.sections.rw.correct ?? 0) + (f.sections.math.correct ?? 0), 0);
  return { sampleSize: g.length, pct: total > 0 ? Math.round((correct / total) * 100) : null };
}

/** 요약 집계 안내용: 점수가 없어 제외된 응시 수. */
export function excludedCounts(facts: AttemptFacts[]) {
  let notGraded = 0, noEstimate = 0;
  for (const f of facts) {
    const r = estimateAttempt(f).reason;
    if (r === "not_graded") notGraded++;
    else if (r) noEstimate++;
  }
  return { notGraded, noEstimate };
}
