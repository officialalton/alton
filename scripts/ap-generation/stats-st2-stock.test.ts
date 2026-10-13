import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { solveStatsSets, verifyStatsAssignment } from "./stats-assign";
import { loadStatsPool } from "./stats-pool";

type Rep = { sets: { id: string; mcA: string[]; frqA: string[]; virtual: unknown[]; virtualSets: unknown[]; frqVirtual: unknown[] }[] };
const rep = (f: string) => (JSON.parse(readFileSync(f, "utf-8")) as Rep).sets[0];
const ST1 = "data/ap/stock/assembled/stats-st1-s3a-prefer-ep.json";
const ST2 = "data/ap/stock/assembled/stats-st2-s3b.json";

// 2026-10-13 S3-b: 두 번째 풀 세트(ST2)가 ST1 v2 와 겹치지 않고 가상 문항 0 으로 조립되는지 고정한다(DB 없음).
describe("ST2 second full Statistics set (S3-b stock)", () => {
  const st1 = rep(ST1);
  const block = new Set([...st1.mcA, ...st1.frqA]);
  it("is assemblable without ST1 v2 items: 0 virtual cells, 0 verifier violations, exact unit targets, exam_prep >= 35%", () => {
    const { pool } = loadStatsPool({});
    const { res, out } = solveStatsSets(["ST2"], pool, { timeMs: 60000, preferExamPrep: true, blocked: block });
    expect(res.x.length).toBeGreaterThan(0);
    expect(verifyStatsAssignment(out, block)).toEqual([]);
    const r = out[0];
    expect(r.singles).toHaveLength(36); expect(r.sets).toHaveLength(2); expect(r.frq).toHaveLength(4);
    expect(r.virtual).toHaveLength(0); expect(r.virtualSets).toHaveLength(0); expect(r.frqVirtual).toHaveLength(0);
    const exam = [...r.singles, ...r.sets].reduce((a, c) => a + (c.exam ?? 0), 0);
    expect(exam / 42).toBeGreaterThanOrEqual(0.35);
    expect(new Set(r.frq.map((c) => c.frqType)).size).toBe(4);
  });
  it("the saved ST2 report has no virtual cells and zero overlap with the saved ST1 v2 report", () => {
    const st2 = rep(ST2);
    expect(st2.id).toBe("ST2");
    expect(st2.virtual).toEqual([]); expect(st2.virtualSets).toEqual([]); expect(st2.frqVirtual).toEqual([]);
    expect(st2.frqA).toHaveLength(4);
    expect([...st2.mcA, ...st2.frqA].filter((k) => block.has(k))).toEqual([]);
  });
});
