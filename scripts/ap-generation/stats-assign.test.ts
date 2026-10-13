import { describe, expect, it } from "vitest";
import { STATS_FRQ_TEMPLATES } from "../../lib/ap-generation/stats-frq-checks";
import { buildStatsOrder, solveStatsSets, toReportSet, verifyStatsAssignment } from "./stats-assign";
import type { StatsItem } from "./stats-pool";

const mem = (unit: number, skill: number) => ({ unit, skill, topic: `${unit}.1`, skillCode: `${skill}.A` });
let n = 0;
const single = (unit: number, skill: number, fam = `f${n}`): StatsItem => ({ key: `s${n++}`, kind: "mc", shared: false, members: [mem(unit, skill)], fam, frqType: "", archetype: "a", screen: true, batch: "t", renderType: "x", stimKind: "none" });
const set = (unit: number, skills: number[]): StatsItem => ({ key: `set${n++}`, kind: "mc", shared: true, members: skills.map((k) => mem(unit, k)), fam: `f${n}`, frqType: "", archetype: "set", screen: true, batch: "t", renderType: "x", stimKind: "stat_chart" });
const frq = (t: string): StatsItem => ({ key: `frq-${t}-${n++}`, kind: "frq", shared: false, members: [], fam: `ff${n}`, frqType: t, archetype: "frq", screen: true, batch: "t", renderType: "x", stimKind: "none" });

/** 목표(단원 10/9/9/7/7, 스킬 4/10/14/14)를 정확히 채우는 재고 하나: 단독 36 + 세트 2(단원 2·5, 스킬 3·3·4) + FRQ 4. */
function fullStock(): StatsItem[] {
  n = 0; const items: StatsItem[] = [];
  const unitSingles: Record<number, number> = { 1: 10, 2: 6, 3: 9, 4: 7, 5: 4 };
  // 스킬 분배(단독): P1 4, P2 10, P3 10, P4 12 — 단원마다 돌려 가며 배정
  const skillPool = [...Array(4).fill(1), ...Array(10).fill(2), ...Array(10).fill(3), ...Array(12).fill(4)]; let i = 0;
  for (const [u, c] of Object.entries(unitSingles)) for (let q = 0; q < c; q++) items.push(single(Number(u), skillPool[i++ % skillPool.length]));
  items.push(set(2, [3, 3, 4]), set(5, [3, 3, 4]));
  for (const t of STATS_FRQ_TEMPLATES) items.push(frq(t));
  return items;
}
const skillOrder = (items: StatsItem[]) => items;

describe("stats exact assignment (ILP + independent verifier)", () => {
  it("finds a complete set with 0 virtual items when the stock covers the official structure, and the verifier agrees", () => {
    const stock = skillOrder(fullStock());
    // 단독 문항의 단원·스킬 합이 목표와 맞도록 재배정이 필요할 수 있으므로 스킬을 단원 순서로 다시 맞춘다(재고 구성 자체가 목표를 만족함을 확인).
    const { res, out } = solveStatsSets(["ST1"], stock, { timeMs: 30000 });
    expect(res.status).toBe("optimal");
    const r = out[0];
    expect(r.virtual).toEqual([]); expect(r.virtualSets).toEqual([]); expect(r.frqVirtual).toEqual([]);
    expect(r.singles).toHaveLength(36); expect(r.sets).toHaveLength(2); expect(r.frq).toHaveLength(4);
    expect(verifyStatsAssignment(out)).toEqual([]);
    const order = buildStatsOrder(r);
    expect(order).toHaveLength(42);
    expect(order.filter((x) => x.candidateKey?.startsWith("set")).map((x) => x.position)).toEqual([13, 14, 15, 31, 32, 33]); // 공유 세트는 연속 3칸
  });
  it("reports exactly the missing slots as virtual items when the stock is short (no FRQ q3, no regression set)", () => {
    const stock = fullStock().filter((c) => !(c.kind === "frq" && c.frqType === "q3_inference") && !(c.shared && c.members[0].unit === 5));
    const { out } = solveStatsSets(["ST1"], stock, { timeMs: 30000 });
    expect(out[0].frqVirtual.map((v) => v.type)).toEqual(["q3_inference"]);
    expect(out[0].virtualSets).toEqual([5]);
    expect(out[0].virtual.filter((v) => v.fromSet)).toHaveLength(3);
    expect(verifyStatsAssignment(out)).toEqual([]);
  });
  it("keeps items of different sets apart and never uses a blocked key", () => {
    const stock = [...fullStock(), ...fullStock().map((c) => ({ ...c, key: `${c.key}-b`, fam: `${c.fam}-b` }))];
    const blocked = new Set(stock.filter((c) => c.kind === "frq" && !c.key.endsWith("-b")).map((c) => c.key));
    const { out } = solveStatsSets(["ST1", "ST2"], stock, { timeMs: 60000, blocked });
    const keys = out.flatMap((r) => [...r.singles, ...r.sets, ...r.frq].map((c) => c.key));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.some((k) => blocked.has(k))).toBe(false);
    expect(verifyStatsAssignment(out, blocked)).toEqual([]);
  });
  it("the independent verifier rejects a duplicate family, a duplicated key across sets and a wrong FRQ type mix", () => {
    const { out } = solveStatsSets(["ST1"], fullStock(), { timeMs: 30000 });
    const bad = JSON.parse(JSON.stringify(out)) as typeof out; bad[0].singles[1].fam = bad[0].singles[0].fam;
    expect(verifyStatsAssignment(bad).some((v) => v.includes("문항군 중복"))).toBe(true);
    const bad2 = JSON.parse(JSON.stringify(out)) as typeof out; bad2[0].frq[1].frqType = bad2[0].frq[0].frqType;
    expect(verifyStatsAssignment(bad2).some((v) => v.includes("FRQ 유형"))).toBe(true);
    const bad3 = JSON.parse(JSON.stringify(out)) as typeof out; bad3[0].sets.pop();
    expect(verifyStatsAssignment(bad3).length).toBeGreaterThan(0);
  });
  it("toReportSet lists each shared set once in position order and FRQs in Q1-Q4 order, with the exact-assign report shape", () => {
    const { out } = solveStatsSets(["ST1"], fullStock(), { timeMs: 30000 });
    const rep = toReportSet(out[0]);
    expect(rep.mcA).toHaveLength(38); expect(rep.mcA.filter((k) => k.startsWith("set"))).toHaveLength(2); expect(rep.mcB).toEqual([]); expect(rep.frqB).toEqual([]);
    expect(rep.frqA.map((k) => k.split("-")[1])).toEqual([...STATS_FRQ_TEMPLATES]);
    expect(rep.mcA.indexOf(rep.mcA.find((k) => k.startsWith("set"))!)).toBe(12); // 12개 단독 뒤에 첫 세트
  });
});
