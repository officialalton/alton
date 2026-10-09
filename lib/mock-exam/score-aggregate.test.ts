import { describe, expect, it } from "vitest";
import { accuracySummary, buildScorePoints, estimateAttempt, excludedCounts, groupFacts, summarize, type AttemptFacts } from "./score-aggregate";

const sec = (correct: number | null, total = 54, route: "higher" | "lower" | null = "higher", complete = true) => ({ total, correct, complete, route, answered: total });
const mk = (id: string, day: number, o: Partial<AttemptFacts> & { rw?: number; math?: number } = {}): AttemptFacts => ({
  attemptId: id, examName: "T", track: "sat", apSubject: null, format: "mst", status: "graded", startedAt: null,
  gradedAt: `2026-09-${String(day).padStart(2, "0")}T00:00:00Z`, attemptSeq: 1,
  sections: { rw: sec(o.rw ?? 40), math: sec(o.math ?? 40) }, ...o,
});

describe("estimateAttempt", () => {
  it("graded MST: 총점 = 같은 응시의 R&W + Math 범위 합", () => {
    const e = estimateAttempt(mk("a", 1));
    expect(e.total).toEqual({ low: e.rw!.low + e.math!.low, high: e.rw!.high + e.math!.high });
  });
  it("미채점 응시는 점수 없음(0 아님)", () => {
    const e = estimateAttempt(mk("a", 1, { status: "in_progress", gradedAt: null }));
    expect(e).toEqual({ rw: null, math: null, total: null, reason: "not_graded" });
  });
  it("고정형·AP는 추정 없음", () => {
    expect(estimateAttempt(mk("a", 1, { format: "fixed" })).reason).toBe("no_estimate_fixed");
    expect(estimateAttempt(mk("a", 1, { track: "ap", apSubject: "calc" })).reason).toBe("no_estimate_ap");
  });
  it("한 섹션이 미완료면 총점 없음(섹션 합성 금지)", () => {
    const f = mk("a", 1); f.sections.math = sec(null, 54, null, false);
    expect(estimateAttempt(f)).toMatchObject({ total: null, reason: "section_incomplete" });
  });
});

describe("summarize", () => {
  it("기록 없음은 null·표본 0", () => {
    expect(summarize([], "total")).toEqual({ sampleSize: 0, latest: null, best: null, average: null, trend: [] });
  });
  it("재응시(seq 2)도 별개 표본, 최근·최고·평균·변화량", () => {
    const pts = buildScorePoints([mk("a", 1, { rw: 30, math: 30 }), mk("b", 5, { rw: 45, math: 45, attemptSeq: 2 }), mk("c", 9, { rw: 38, math: 38 })]);
    const s = summarize(pts, "total");
    expect(s.sampleSize).toBe(3);
    expect(s.latest).toEqual(pts[2].total);
    expect(s.best).toEqual(pts[1].total);
    expect(s.trend[0].deltaMid).toBeNull();
    expect(s.trend[1].deltaMid).toBeGreaterThan(0);
    expect(s.trend[2].deltaMid).toBeLessThan(0);
    expect(s.average!.low % 10).toBe(0);
  });
  it("미채점·고정형은 표본에서 빠지고 제외 건수로 안내", () => {
    const facts = [mk("a", 1), mk("b", 2, { format: "fixed" }), mk("c", 3, { status: "in_progress", gradedAt: null })];
    expect(summarize(buildScorePoints(facts), "rw").sampleSize).toBe(1);
    expect(excludedCounts(facts)).toEqual({ notGraded: 1, noEstimate: 1 });
  });
  it("SAT와 AP 과목은 섞이지 않는다", () => {
    const g = groupFacts([mk("a", 1), mk("b", 2, { track: "ap", apSubject: "calc" }), mk("c", 3, { track: "ap", apSubject: "bio" })]);
    expect([...g.keys()].sort()).toEqual(["ap:bio", "ap:calc", "sat"]);
  });
});

describe("accuracySummary", () => {
  it("graded만, 없으면 null", () => {
    expect(accuracySummary([])).toEqual({ sampleSize: 0, pct: null });
    expect(accuracySummary([mk("a", 1, { format: "fixed" })]).pct).toBe(Math.round((80 / 108) * 100));
  });
});
