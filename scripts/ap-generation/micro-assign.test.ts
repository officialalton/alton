import { describe, expect, it } from "vitest";
import { MICRO_FRQ_PROFILES, MICRO_FRQ_TYPES, microCategoryBounds, microFrqTypeBounds, microNumericBounds, microUnitBounds, verifyMicroFrqExam, verifyMicroFullComposition } from "../../lib/ap-exam/micro-rules";
import { LIB_SINGLES, ONE_EXAM_ONLY, buildMicroOrder, categorySummary, solveMicroSets, toReportSet, verifyMicroAssignment } from "./micro-assign";
import type { MicroItem } from "./micro-pool";

let n = 0;
const mc = (e: { id: string; topic: string; skill: string }, copy: number): MicroItem => ({ key: `m${n++}`, kind: "mc", members: [{ unit: Number(e.topic.split(".")[0]), skill: e.skill, topic: e.topic }], fam: `${e.id}|${e.topic}|${copy}`, frqType: "", archetype: e.id, screen: true, batch: "t", renderType: "none", stimKind: "none", exam: 0 });
const frq = (t: string): MicroItem => ({ key: `f-${t}-${n++}`, kind: "frq", members: [], fam: `ff-${t}`, frqType: t, archetype: t, screen: true, batch: "t", renderType: "text", stimKind: "table", exam: 0 });
/** 라이브러리 원형마다 한 문항(+선택적으로 둘째 문항) + FRQ 10유형. 문항군은 원형별로 따로 둔다. */
const stock = (copies = 2) => { n = 0; return [...LIB_SINGLES.flatMap((e) => Array.from({ length: copies }, (_, c) => mc(e, c))), ...MICRO_FRQ_TYPES.map(frq)]; };

describe("micro-rules (official ranges)", () => {
  it("MC bounds from the CED percentages (floor/ceil) and the FRQ point ranges", () => {
    expect(microUnitBounds()).toEqual({ "1": { min: 7, max: 9 }, "2": { min: 12, max: 15 }, "3": { min: 13, max: 15 }, "4": { min: 9, max: 14 }, "5": { min: 6, max: 8 }, "6": { min: 4, max: 8 } });
    expect(microCategoryBounds()).toEqual({ "1": { min: 18, max: 26 }, "2": { min: 22, max: 29 }, "3": { min: 9, max: 15 } });
    expect(microNumericBounds()).toEqual({ min: 12, max: 18 });
    expect(microFrqTypeBounds()).toEqual({ graph: { min: 6, max: 10 }, assertion: { min: 2, max: 4 }, explain: { min: 5, max: 7 }, numeric: { min: 3, max: 6 } });
  });
  it("FRQ profiles are 10 or 5 points and a valid exam is one long + two short inside the task ranges", () => {
    for (const t of MICRO_FRQ_TYPES) { const p = MICRO_FRQ_PROFILES[t]; expect(p.graph + p.assertion + p.explain + p.numeric).toBe(p.points); expect([5, 10]).toContain(p.points); }
    expect(verifyMicroFrqExam(["mif_long_market_policy", "mif_short_labor", "mif_short_mc"])).toEqual([]);
    expect(verifyMicroFrqExam(["mif_long_pc_firm", "mif_short_externality", "mif_short_trade"])).toEqual([]);
    expect(verifyMicroFrqExam(["mif_long_monopoly", "mif_short_elasticity", "frq_micro_monopoly"]).length).toBeGreaterThan(0); // 그래프 0점·수치 과다
    expect(verifyMicroFrqExam(["mif_long_pc_firm", "mif_long_monopoly", "mif_short_mc"])).toContain("frq_structure_not_1_long_2_short");
    expect(verifyMicroFrqExam(["mif_short_mc", "mif_short_mc", "mif_long_pc_firm"])).toContain("frq_duplicate_type");
  });
  it("rejects a skill outside category 1-3, a category count outside the range, and duplicate keys", () => {
    const items = buildMicroOrder({ id: "x", singles: [], frq: [], virtual: [], frqVirtual: [] });
    expect(items).toEqual([]);
    const base = Array.from({ length: 60 }, (_, i) => ({ kind: "mc" as const, unit: String([1, 2, 3, 4, 5, 6][i % 6]), skill: ["1.C", "2.A", "3.A"][i % 3], candidateKey: `k${i}`, position: i + 1 }));
    expect(verifyMicroFullComposition(base).join()).toMatch(/frq_count_0\/3/);
    expect(verifyMicroFullComposition([...base.slice(0, 59), { ...base[59], skill: "4.A" }]).join()).toMatch(/category_4_not_assessed_in_mc/);
  });
});

describe("micro exact assignment (ILP + independent verifier)", () => {
  it("a complete library stock fills two exams with no virtual items, zero overlap, and every official range satisfied", () => {
    const st = stock(2);
    const out: ReturnType<typeof solveMicroSets>["out"] = []; const bl = new Set<string>(); const blArch = new Set<string>();
    for (const id of ["MI1", "MI2"]) {
      const one = solveMicroSets([id], st, { timeMs: 90000, blocked: bl, blockedArchetypes: blArch });
      expect(one.res.status).toBe("optimal"); out.push(...one.out); for (const it of [...one.out[0].singles, ...one.out[0].frq]) bl.add(it.key);
      for (const a of [...one.out[0].singles.map((c) => c.archetype), ...one.out[0].virtual.map((v) => v.archetype)]) if (ONE_EXAM_ONLY.has(a)) blArch.add(a);
    }
    for (const r of out) { expect(r.virtual).toEqual([]); expect(r.frqVirtual).toEqual([]); expect(r.singles).toHaveLength(60); expect(r.frq).toHaveLength(3); }
    expect(verifyMicroAssignment(out)).toEqual([]);
    const sk = categorySummary(out[0]); expect(sk.numeric).toBeGreaterThanOrEqual(12); expect(sk.numeric).toBeLessThanOrEqual(18);
    const types0 = out[0].frq.map((c) => c.frqType); const types1 = out[1].frq.map((c) => c.frqType);
    expect(types0.filter((t) => types1.includes(t))).toEqual([]); // FRQ 유형 재고가 유형당 1개라 두 시험은 서로 다른 유형
    const a0 = new Set(out[0].singles.map((c) => c.archetype)); expect(out[1].singles.filter((c) => ONE_EXAM_ONLY.has(c.archetype) && a0.has(c.archetype))).toEqual([]); // 한 시험 전용 원형은 두 시험에 나오지 않는다
    expect(toReportSet(out[0]).frqA).toHaveLength(3);
    expect(toReportSet(out[0]).mcA).toHaveLength(60);
  }, 240000);

  it("reports exactly the missing slots as virtual items when the stock is short (no long FRQ type, 60 percent of the archetypes gone)", () => {
    const keep = stock(1).filter((c) => !(c.kind === "frq" && MICRO_FRQ_PROFILES[c.frqType].points === 10)).filter((c, i) => c.kind === "frq" || i % 5 < 2);
    const { res, out } = solveMicroSets(["MI1"], keep, { timeMs: 60000 });
    expect(res.status).toBe("optimal");
    const r = out[0];
    expect(r.frqVirtual.map((v) => MICRO_FRQ_PROFILES[v.type].points)).toContain(10);
    expect(r.virtual.length + r.singles.length).toBe(60);
    expect(r.virtual.length).toBeGreaterThan(0);
    expect(verifyMicroAssignment(out)).toEqual([]); // 가상 문항을 포함한 구조도 구성 규칙을 만족한다
  }, 120000);

  it("never puts two items of the same family into one exam (family cap 1) and charges a virtual item instead", () => {
    const st = stock(1);
    const u5 = st.filter((c) => c.kind === "mc" && c.members[0].unit === 5);
    for (const c of u5) c.fam = u5[0].fam; // 단원 5 의 모든 문항이 같은 군
    const { res, out } = solveMicroSets(["MI1"], st, { timeMs: 60000 });
    expect(res.status).toBe("optimal");
    expect(out[0].singles.filter((c) => c.members[0].unit === 5).length).toBeLessThanOrEqual(1);
    expect(out[0].virtual.filter((v) => v.unit === 5).length).toBeGreaterThanOrEqual(5);
    expect(verifyMicroAssignment(out)).toEqual([]);
  }, 120000);
});
