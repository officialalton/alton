import { describe, expect, it } from "vitest";
import { PHYS_FRQ_TEMPLATES, PHYS_FULL_TARGET, physSkillWarnings, verifyPhysFullComposition } from "../../lib/ap-exam/full-set-rules";
import { buildPhysOrder, skillSummary, solvePhysSets, toReportSet, verifyPhysAssignment } from "./phys-assign";
import type { PhysItem } from "./phys-pool";

const mem = (unit: number, skill: string) => ({ unit, skill, topic: `${unit}.1` });
let n = 0;
const single = (unit: number, skill = "2.B", fam = `f${n}`): PhysItem => ({ key: `s${n++}`, kind: "mc", shared: false, members: [mem(unit, skill)], fam, frqType: "", archetype: "a", screen: true, batch: "t", renderType: "none", stimKind: "none", exam: 0 });
const set = (unit: number, skills = ["2.B", "3.B"]): PhysItem => ({ key: `set${n++}`, kind: "mc", shared: true, members: skills.map((k) => mem(unit, k)), fam: `f${n}`, frqType: "", archetype: "set", screen: true, batch: "t", renderType: "none", stimKind: "diagram", exam: 0 });
const frq = (t: string): PhysItem => ({ key: `frq-${t}-${n++}`, kind: "frq", shared: false, members: [], fam: `ff${n}`, frqType: t, archetype: "frq", screen: true, batch: "t", renderType: "text", stimKind: "text", exam: 0 });

/** 한 세트를 정확히 채우는 재고: 단독 38(단원 5/8/8/5/5/3/3/5 에서 세트 4문항을 뺀 값) + 2문항 세트 2(단원 1·6) + FRQ 4. */
function fullStock(copies = 1): PhysItem[] {
  n = 0; const items: PhysItem[] = [];
  const unitSingles: Record<number, number> = { 1: 3, 2: 8, 3: 8, 4: 5, 5: 5, 6: 1, 7: 3, 8: 5 };
  for (let c = 0; c < copies; c++) {
    for (const [u, k] of Object.entries(unitSingles)) for (let q = 0; q < k; q++) items.push(single(Number(u), "2.B", `u${u}-${q}`));
    items.push(set(1), set(6));
    for (const t of PHYS_FRQ_TEMPLATES) items.push(frq(t));
  }
  return items;
}

describe("physics exact assignment (ILP + independent verifier)", () => {
  it("official unit counts are forced to 5/8/8/5/5/3/3/5 and a complete stock needs no virtual items", () => {
    const { res, out } = solvePhysSets(["PH1"], fullStock(), { timeMs: 30000 });
    expect(res.status).toBe("optimal");
    const r = out[0];
    expect(r.virtual).toEqual([]); expect(r.virtualSets).toEqual([]); expect(r.frqVirtual).toEqual([]);
    expect(r.singles).toHaveLength(38); expect(r.sets).toHaveLength(2); expect(r.frq).toHaveLength(4);
    expect(verifyPhysAssignment(out)).toEqual([]);
    const order = buildPhysOrder(r);
    expect(order).toHaveLength(42);
    const counts: Record<string, number> = {}; for (const it of order) counts[it.unit!] = (counts[it.unit!] ?? 0) + 1;
    expect(counts).toEqual(Object.fromEntries(Object.entries(PHYS_FULL_TARGET.units).map(([u, c]) => [u, c])));
    // 공유 세트는 연속 2칸, 단원 오름차순 블록
    for (const key of r.sets.map((s) => s.key)) { const pos = order.filter((x) => x.candidateKey === key).map((x) => x.position); expect(pos).toHaveLength(2); expect(pos[1] - pos[0]).toBe(1); }
    expect(order.map((x) => Number(x.unit))).toEqual([...order.map((x) => Number(x.unit))].sort((a, b) => a - b));
    expect(toReportSet(r).frqA).toHaveLength(4);
  });

  it("reports exactly the missing slots as virtual items when the stock is short (no LAB FRQ, no set in unit 6, one unit-3 single missing)", () => {
    const stock = fullStock().filter((c) => !(c.kind === "frq" && c.frqType === "lab") && !(c.shared && c.members[0].unit === 6) && c.key !== "s11");
    const { res, out } = solvePhysSets(["PH1"], stock, { timeMs: 30000 });
    expect(res.status).toBe("optimal");
    const r = out[0];
    expect(r.frqVirtual.map((v) => v.type)).toEqual(["lab"]);
    // 세트 하나가 빠져 가상 세트 1, 단독은 단원 3 하나가 부족한 자리 + (가상 세트는 단원 자유이므로 단원 6 에 둔다)
    expect(r.virtualSets.length + r.sets.length).toBe(2);
    expect(r.virtual.length + r.virtualSets.length * 2).toBeGreaterThanOrEqual(3);
    expect(verifyPhysAssignment(out)).toEqual([]); // 가상 문항을 포함한 구조는 구성 규칙을 만족한다
    expect(r.virtual.length + r.singles.length).toBe(38);
  });

  it("never puts two items of the same family into one exam (family cap 1) and charges a virtual item instead", () => {
    const stock = fullStock();
    const u8 = stock.filter((c) => !c.shared && c.members[0]?.unit === 8);
    for (const c of u8.slice(1)) c.fam = u8[0].fam; // 단원 8 의 5문항이 모두 같은 군
    const { res, out } = solvePhysSets(["PH1"], stock, { timeMs: 30000 });
    expect(res.status).toBe("optimal");
    const r = out[0];
    expect(r.singles.filter((c) => c.members[0].unit === 8)).toHaveLength(1);
    expect(r.virtual.filter((v) => v.unit === 8)).toHaveLength(4);
    expect(verifyPhysAssignment(out)).toEqual([]);
  });

  it("sequential assignment of two exams from a doubled stock gives zero overlap and no virtual items; the verifier catches an overlap", () => {
    const stock = fullStock(2); const blocked = new Set<string>(); const out = [];
    for (const id of ["PH1", "PH2"]) {
      const one = solvePhysSets([id], stock, { timeMs: 30000, blocked }); expect(one.res.status).toBe("optimal");
      out.push(one.out[0]); for (const c of [...one.out[0].singles, ...one.out[0].sets, ...one.out[0].frq]) blocked.add(c.key);
    }
    expect(out.every((r) => r.virtual.length === 0 && r.virtualSets.length === 0 && r.frqVirtual.length === 0)).toBe(true);
    expect(verifyPhysAssignment(out)).toEqual([]);
    const dup = [out[0], { ...out[1], singles: [out[0].singles[0], ...out[1].singles.slice(1)] }];
    expect(verifyPhysAssignment(dup).some((v) => v.includes("중복"))).toBe(true);
  });

  it("blocked keys are excluded (zero overlap with an already built exam)", () => {
    const stock = fullStock(2);
    const first = solvePhysSets(["PH1"], stock, { timeMs: 30000 }).out[0];
    const blocked = new Set([...first.singles, ...first.sets, ...first.frq].map((c) => c.key));
    const second = solvePhysSets(["PH2"], stock, { timeMs: 30000, blocked }).out[0];
    for (const c of [...second.singles, ...second.sets, ...second.frq]) expect(blocked.has(c.key)).toBe(false);
  });

  it("skill ranges are non-blocking warnings: an all-2.B stock still assembles and the summary names the out-of-range skills", () => {
    const { out } = solvePhysSets(["PH1"], fullStock(), { timeMs: 30000 });
    const sk = skillSummary(out[0]);
    expect(sk.warnings.length).toBeGreaterThan(0);
    expect(verifyPhysAssignment(out)).toEqual([]);
  });
});

describe("hard skill ranges (--hard-skills)", () => {
  /** 단원별 2.B 대신 스킬을 섞은 재고: 한 세트가 스킬 범위(2.A 7–8, 2.B 9–10, 2.C 5–6, 2.D 5–6, 3.B 9–10, 3.C 3–4)를 정확히 만족하도록 단원마다 스킬을 돌려 쓴다. */
  function skilled(copies: number): PhysItem[] {
    n = 0; const items: PhysItem[] = []; const cycle = ["2.B", "2.B", "3.B", "3.B", "2.A", "2.A", "2.C", "2.D", "3.C", "2.B"];
    const unitSingles: Record<number, number> = { 1: 3, 2: 8, 3: 8, 4: 5, 5: 5, 6: 1, 7: 3, 8: 5 }; let k = 0;
    for (let c = 0; c < copies; c++) {
      for (const [u, cnt] of Object.entries(unitSingles)) for (let q = 0; q < cnt; q++) items.push(single(Number(u), cycle[k++ % cycle.length], `c${c}-u${u}-${q}`));
      items.push(set(1, ["2.A", "2.C"]), set(6, ["2.D", "3.B"]));
      for (const t of PHYS_FRQ_TEMPLATES) items.push(frq(t));
    }
    return items;
  }
  it("with hardSkills a stock that cannot meet the ranges has no solution instead of a warning", () => {
    const { res } = solvePhysSets(["PH1"], fullStock(), { timeMs: 30000, hardSkills: true });
    expect(res.x.length === 0 || res.status === "infeasible").toBe(true);
  });
  it("with hardSkills a mixed-skill stock is assembled inside every official skill range and the verifier agrees", () => {
    const stock = skilled(2); const { res, out } = solvePhysSets(["PH1"], stock, { timeMs: 60000, hardSkills: true });
    expect(res.x.length).toBeGreaterThan(0);
    expect(skillSummary(out[0]).warnings).toEqual([]);
    expect(verifyPhysAssignment(out)).toEqual([]);
  });
});

describe("physics full-set composition rules (pure)", () => {
  const order = (units: number[], setAt?: number[]) => units.map((u, i) => ({ kind: "mc" as const, unit: String(u), skill: "2.B", candidateKey: setAt?.includes(i) ? `set${setAt.indexOf(i) < 2 ? "A" : "B"}` : null, position: i + 1 }));
  const base = [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8, 8, 8];
  const frq4 = PHYS_FRQ_TEMPLATES.map((t, i) => ({ kind: "frq" as const, unit: null, skill: null, candidateKey: `f-${t}`, position: i + 1 }));
  it("passes the official 5/8/8/5/5/3/3/5 structure with two contiguous 2-question sets", () => {
    expect(base).toHaveLength(42);
    expect(verifyPhysFullComposition([...order(base, [0, 1, 21, 22]), ...frq4])).toEqual([]);
  });
  it("flags wrong unit counts, a missing set, a split set and the wrong FRQ count", () => {
    const wrong = [...base]; wrong[41] = 7;
    expect(verifyPhysFullComposition([...order(wrong, [0, 1, 21, 22]), ...frq4]).some((v) => v.startsWith("unit_8_4"))).toBe(true);
    expect(verifyPhysFullComposition([...order(base, [0, 1]), ...frq4])).toContain("shared_sets_1/2");
    const split = order(base, [0, 2, 21, 22]).map((x) => ({ ...x, candidateKey: x.position === 1 || x.position === 3 ? "setA" : x.candidateKey }));
    expect(verifyPhysFullComposition([...split, ...frq4]).some((v) => v.startsWith("set_not_contiguous"))).toBe(true);
    expect(verifyPhysFullComposition([...order(base, [0, 1, 21, 22]), ...frq4.slice(0, 3)])).toContain("frq_count_3/4");
  });
  it("skill warnings list only out-of-range skills (non-blocking)", () => {
    expect(physSkillWarnings(order(base)).join()).toContain("skill_2.A_0_not_in_7-8");
  });
});
