import { describe, expect, it } from "vitest";
import { selectFrq, selectMc, verify, type Cand } from "./ab-select";
const mk = (i: number, o: Partial<Cand>): Cand => ({ key: `k${i}`, kind: "mc", unit: 1, skillCat: 1, calc: "not_allowed", family: `f${i}`, type: `t${i}`, graphRequired: false, screenVerified: true, renderOk: true, fullMockUses: 0, practiceUses: 0, ...o });
// 합성 재고: 단원마다 A/B 충분, 그래프 필수 12, 스킬 범주 2·3 충분
const pool: Cand[] = []; let n = 0;
for (let u = 1; u <= 8; u++) for (let j = 0; j < 12; j++) pool.push(mk(n++, { unit: u, calc: j < 8 ? "not_allowed" : "required", skillCat: j % 5 === 0 ? 3 : j % 3 === 0 ? 2 : 1, graphRequired: j % 4 === 0 }));
describe("ab-select", () => {
  it("합성 재고에서 MC 제약(official+internal)을 모두 만족하는 선택을 찾고 검증기가 재확인한다", () => {
    const s = selectMc(pool); expect(s).not.toBeNull();
    const c = verify({ ...s!, frqA: [], frqB: [] }).filter((x) => !x.id.startsWith("frq"));
    expect(c.every((x) => x.ok)).toBe(true); expect(c.find((x) => x.id === "graph_required")!.label).toBe("internal"); expect(c.find((x) => x.id === "unit_weights")!.label).toBe("official");
  });
  it("장식(비필수) 그래프만으로는 그래프 하한을 채우지 못한다", () => {
    const deco = pool.map((c) => ({ ...c, graphRequired: false })); expect(selectMc(deco)).toBeNull();
  });
  it("탈락 키를 빼고 교체해도 세트 제약이 다시 통과한다", () => {
    const s = selectMc(pool)!; const out = new Set([s.mcA[0].key, s.mcB[0].key]); const r = selectMc(pool, { exclude: out, prev: s }); expect(r).not.toBeNull();
    expect([...r!.mcA, ...r!.mcB].some((c) => out.has(c.key))).toBe(false); expect(verify({ ...r!, frqA: [], frqB: [] }).filter((x) => !x.id.startsWith("frq")).every((x) => x.ok)).toBe(true);
  });
  it("다른 풀 모의고사와 겹치는 항목은 제외된다", () => {
    const p2 = pool.map((c, i) => (i % 2 ? { ...c, fullMockUses: 1 } : c)); const s = selectMc(p2); if (s) expect([...s.mcA, ...s.mcB].every((c) => c.fullMockUses === 0)).toBe(true);
  });
  it("FRQ 는 서로 다른 유형 6개이고 유형이 모자라면 해가 없다", () => {
    const f = [mk(900, { kind: "frq", calc: "required", type: "6.2" }), mk(901, { kind: "frq", calc: "required", type: "8.4" }), ...["5.9", "7.7", "4.5", "3.2"].map((t, i) => mk(910 + i, { kind: "frq", calc: "not_allowed", type: t }))];
    const r = selectFrq(f); expect(r?.a).toHaveLength(2); expect(r?.b).toHaveLength(4); expect(selectFrq(f.slice(0, 5))).toBeNull();
  });
});
