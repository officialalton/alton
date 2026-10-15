import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildLtOrder, verifyLtAssignment, type LtResult } from "./lt-assign";
import { loadLtPool } from "./lt-pool";

// 저장소에 커밋된 정확 배정(LT1·LT2)이 실제 재고(화면 증거 보유)에 대해 독립 검증기를 통과하고, 가상 칸이 없으며 두 시험이 서로소인지 고정한다.
describe("committed English Literature exact assignment", () => {
  const rep = JSON.parse(readFileSync("data/ap/stock/exact-assign-englit-lt1-lt2.json", "utf-8")) as { sets: { id: string; mcA: string[]; frqA: string[]; virtual: unknown[]; frqVirtual: unknown[] }[] };
  const { pool } = loadLtPool(); const by = new Map(pool.map((c) => [c.key, c]));
  const res: LtResult[] = rep.sets.map((s) => ({ id: s.id, sets: s.mcA.map((k) => by.get(k)!), frq: s.frqA.map((k) => by.get(k)!) }));
  it("has two exams, every key is in the screened stock, no virtual cells", () => {
    expect(rep.sets.map((s) => s.id)).toEqual(["LT1", "LT2"]);
    for (const r of res) expect([...r.sets, ...r.frq].every(Boolean)).toBe(true);
    for (const s of rep.sets) { expect(s.virtual).toHaveLength(0); expect(s.frqVirtual).toHaveLength(0); }
  });
  it("passes the independent verifier (55 MC in 5 sets, 3 FRQ, genre/category bounds, disjoint exams and families)", () => {
    expect(verifyLtAssignment(res)).toEqual([]);
    for (const r of res) { expect(buildLtOrder(r)).toHaveLength(55); expect(r.sets).toHaveLength(5); expect(r.frq.map((c) => c.frqType).sort()).toEqual(["q1", "q2", "q3"]); }
  });
});
