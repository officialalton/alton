import { describe, expect, it } from "vitest";
import { solveFrq, solveMc, verifyAssignment, type Spec } from "../../scripts/ap-generation/exact-assign";
import { loadPool, published } from "../../scripts/ap-generation/assign-pool";

// 정확 배정(정수계획) 회귀: 게시된 AB#1 항목을 빼고 BC#1·AB#2 가 가상 문항 0 으로 조립 가능해야 한다(2026-10-09 기준 재고).
// 단일 세트가 가능하면 두 세트 동시도 가능하다는 것의 반대(두 세트 가능 ⇒ 각 세트 단독 가능)도 함께 확인한다 — 휴리스틱이 단독 1 부족을 냈던 모순이 다시 나오면 실패한다.
const FLOOR = 10;
const spec = (id: string): Spec => ({ id, subj: id.startsWith("BC") ? "bc" : "ab", floor: FLOOR });
const pub = published(); const blocked = new Set([...pub.mcA, ...pub.mcB, ...pub.frqA, ...pub.frqB]);
const items = loadPool({ strictFamilies: true }).pool.filter((c) => !blocked.has(c.key));
const run = (ids: string[]) => { const sets = ids.map(spec); const m = solveMc(sets, items, { timeMs: 120000 }); const f = solveFrq(sets, items, { timeMs: 120000 }); return { m, f, sets, res: sets.map((s, i) => ({ ...m.out[i], ...f.out[i] })) }; };

describe("exact-assign(BC#1, AB#2 · 게시 AB#1 고정)", () => {
  it("BC#1 + AB#2 동시: 가상 문항 0, 독립 검증기 위반 0, 세트 간 동일 문항 0", () => {
    const r = run(["BC1", "AB2"]);
    expect(r.m.res.status).toBe("optimal"); expect(r.m.res.obj).toBe(0); expect(r.f.res.obj).toBe(0);
    expect(verifyAssignment(r.sets, r.res, blocked)).toEqual([]);
  }, 180000);
  it("각 세트 단독도 0(합동 가능 ⇒ 단독 가능)", () => {
    for (const id of ["BC1", "AB2"]) { const r = run([id]); expect(r.m.res.obj, id).toBe(0); expect(verifyAssignment(r.sets, r.res, blocked), id).toEqual([]); }
  }, 180000);
  it("검증기는 위반을 잡는다(게시본 항목 사용·세트 간 중복)", () => {
    const r = run(["BC1", "AB2"]);
    const bad = r.res.map((s) => ({ ...s })); bad[1] = { ...bad[1], mcA: [bad[0].mcA[0], ...bad[1].mcA.slice(1)] };
    expect(verifyAssignment(r.sets, bad, blocked).length).toBeGreaterThan(0);
  }, 180000);
});
