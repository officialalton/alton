import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { solveStatsSets, verifyStatsAssignment } from "./stats-assign";
import { loadStatsPool } from "./stats-pool";

// 커밋된 재고(S1 파일럿 + S2-a + S2-b, 화면 증거 보유)만으로 첫 풀 세트(ST1)가 가상 문항 0 으로 조립되는지 고정한다(2026-10-12 S2-b).
describe("ST1 first full Statistics set from the committed stock", () => {
  it("is assemblable with 0 virtual cells and 0 independent-verifier violations, on the exact unit targets", () => {
    const { pool } = loadStatsPool({});
    const { res, out } = solveStatsSets(["ST1"], pool, { timeMs: 60000 });
    expect(res.x.length).toBeGreaterThan(0);
    expect(verifyStatsAssignment(out)).toEqual([]);
    const r = out[0];
    expect(r.singles).toHaveLength(36); expect(r.sets).toHaveLength(2); expect(r.frq).toHaveLength(4);
    expect(r.virtual).toHaveLength(0); expect(r.virtualSets).toHaveLength(0); expect(r.frqVirtual).toHaveLength(0);
    expect(Math.abs(res.obj)).toBe(0); // 단원 목표 10/9/9/7/7 과 스킬 목표 4/10/14/14 를 정확히 맞춘다
  });
  it("the saved assembled report matches the same assignment (new file under data/ap/stock/assembled)", () => {
    const rep = JSON.parse(readFileSync("data/ap/stock/assembled/stats-st1-s2b.json", "utf-8")) as { sets: { id: string; mcA: string[]; frqA: string[]; virtual: unknown[]; virtualSets: unknown[]; frqVirtual: unknown[] }[] };
    expect(rep.sets).toHaveLength(1);
    expect(rep.sets[0].virtual).toEqual([]); expect(rep.sets[0].virtualSets).toEqual([]); expect(rep.sets[0].frqVirtual).toEqual([]);
    expect(rep.sets[0].mcA).toHaveLength(38); expect(rep.sets[0].frqA).toHaveLength(4);
  });
});
