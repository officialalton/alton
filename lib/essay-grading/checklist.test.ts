import { describe, expect, it } from "vitest";
import { LEQ_CHECKLIST, DBQ_CHECKLIST, checklistTool, scoreFromChecks, checklistSystemPrompt } from "./checklist";

const leqRaw = (o: Record<string, unknown> = {}) => ({
  thesis__position: true, thesis__reason: true, thesis__not_contradicted: true, thesis__quote: "x", thesis__comment: "good thesis here",
  context__developed: true, context__quote: "x", context__comment: "good context here",
  evidence__accurate_specific: 3, evidence__linked_to_claim: 2, evidence__quote: "x", evidence__comment: "good evidence here",
  analysis__reasoning_present: true, analysis__sustained_complexity: false, analysis__quote: "x", analysis__comment: "some reasoning here", improve: [], ...o,
});

describe("checklist scoring (off, design)", () => {
  it("point structure LEQ 6 / DBQ 7", () => {
    expect(LEQ_CHECKLIST.rows.reduce((n, r) => n + r.max, 0)).toBe(6);
    expect(DBQ_CHECKLIST.rows.reduce((n, r) => n + r.max, 0)).toBe(7);
  });
  it("sums element scores by rule", () => {
    const p = scoreFromChecks(leqRaw(), LEQ_CHECKLIST);
    expect(p.ok && p.scores).toEqual({ thesis: 1, context: 1, evidence: 2, analysis: 1 });
  });
  it("a one-clause 'because' thesis counts; a false-history claim does not", () => {
    expect((scoreFromChecks(leqRaw(), LEQ_CHECKLIST) as { scores: Record<string, number> }).scores.thesis).toBe(1);
    expect((scoreFromChecks(leqRaw({ thesis__not_contradicted: false }), LEQ_CHECKLIST) as { scores: Record<string, number> }).scores.thesis).toBe(0);
  });
  it("evidence: linked cannot exceed accurate; unlinked list earns 1; none earns 0", () => {
    const s = (a: number, l: number) => (scoreFromChecks(leqRaw({ evidence__accurate_specific: a, evidence__linked_to_claim: l }), LEQ_CHECKLIST) as { scores: Record<string, number> }).scores.evidence;
    expect(s(4, 0)).toBe(1); expect(s(1, 1)).toBe(0); expect(s(2, 5)).toBe(2); expect(s(0, 0)).toBe(0);
  });
  it("analysis: brief reasoning earns 1 even without complexity; complexity needs reasoning", () => {
    const s = (r: boolean, c: boolean) => (scoreFromChecks(leqRaw({ analysis__reasoning_present: r, analysis__sustained_complexity: c }), LEQ_CHECKLIST) as { scores: Record<string, number> }).scores.analysis;
    expect(s(true, false)).toBe(1); expect(s(true, true)).toBe(2); expect(s(false, true)).toBe(0);
  });
  it("rows are independent: weak thesis does not change analysis score", () => {
    const a = scoreFromChecks(leqRaw({ thesis__reason: false }), LEQ_CHECKLIST) as { scores: Record<string, number> };
    expect(a.scores.thesis).toBe(0); expect(a.scores.analysis).toBe(1);
  });
  it("DBQ docs thresholds 3 / 4", () => {
    const base = { thesis__position: true, thesis__reason: true, thesis__not_contradicted: true, thesis__quote: "x", thesis__comment: "ok ok ok", context__developed: true, context__quote: "x", context__comment: "ok ok ok", outside__outside_specific: 1, outside__quote: "x", outside__comment: "ok ok ok", sourcing__documents_sourced: 0, sourcing__quote: "x", sourcing__comment: "ok ok ok", complexity__sustained_complexity: false, complexity__quote: "x", complexity__comment: "ok ok ok", docs__quote: "x", docs__comment: "ok ok ok", improve: [] };
    const d = (a: number, u: number) => (scoreFromChecks({ ...base, docs__documents_described_accurately: a, docs__documents_used_for_argument: u }, DBQ_CHECKLIST) as { scores: Record<string, number> }).scores.docs;
    expect(d(2, 2)).toBe(0); expect(d(3, 1)).toBe(1); expect(d(5, 4)).toBe(2);
  });
  it("invalid output rejected; tool lists every check; prompt treats essay as data", () => {
    expect(scoreFromChecks({ ...leqRaw(), thesis__position: "yes" }, LEQ_CHECKLIST).ok).toBe(false);
    expect(Object.keys(checklistTool(LEQ_CHECKLIST).input_schema.properties)).toContain("evidence__linked_to_claim");
    expect(checklistSystemPrompt()).toMatch(/untrusted DATA/);
  });
});
