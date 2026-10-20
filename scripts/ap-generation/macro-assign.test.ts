import { describe, expect, it } from "vitest";
import { MACRO_FRQ_PROFILES, MACRO_FRQ_TYPES, macroCategoryBounds, macroFrqTypeBounds, macroNumericBounds, macroUnitBounds, verifyMacroFrqExam, verifyMacroFullComposition } from "../../lib/ap-exam/macro-rules";
import { LIB_SINGLES, ONE_EXAM_ONLY, buildMacroOrder, categorySummary, solveMacroSets, toReportSet, verifyMacroAssignment } from "./macro-assign";
import type { MacroItem } from "./macro-pool";

let n = 0;
const mc = (e: { id: string; topic: string; skill: string }, copy: number): MacroItem => ({ key: `m${n++}`, kind: "mc", members: [{ unit: Number(e.topic.split(".")[0]), skill: e.skill, topic: e.topic }], fam: `${e.id}|${e.topic}|${copy}`, frqType: "", archetype: e.id, screen: true, batch: "t", renderType: "none", stimKind: "none", sig: "", exam: 0 });
const frq = (t: string): MacroItem => ({ key: `f-${t}-${n++}`, kind: "frq", members: [], fam: `ff-${t}`, frqType: t, archetype: t, screen: true, batch: "t", renderType: "text", stimKind: "table", sig: "", exam: 0 });
/** 라이브러리 원형마다 한 문항(+선택적으로 둘째 문항) + FRQ 10유형. 문항군은 원형별로 따로 둔다. */
const stock = (copies = 2) => { n = 0; return [...LIB_SINGLES.flatMap((e) => Array.from({ length: copies }, (_, c) => mc(e, c))), ...MACRO_FRQ_TYPES.map(frq)]; };

describe("macro-rules (official ranges)", () => {
  it("MC bounds from the CED percentages (floor/ceil) and the FRQ point ranges", () => {
    expect(macroUnitBounds()).toEqual({ "1": { min: 3, max: 6 }, "2": { min: 7, max: 11 }, "3": { min: 10, max: 17 }, "4": { min: 10, max: 14 }, "5": { min: 12, max: 18 }, "6": { min: 6, max: 8 } });
    expect(macroCategoryBounds()).toEqual({ "1": { min: 18, max: 24 }, "2": { min: 15, max: 20 }, "3": { min: 18, max: 24 } });
    expect(macroNumericBounds()).toEqual({ min: 9, max: 12 });
    expect(macroFrqTypeBounds()).toEqual({ graph: { min: 6, max: 10 }, assertion: { min: 2, max: 4 }, explain: { min: 5, max: 7 }, numeric: { min: 2, max: 5 } });
  });
  it("FRQ profiles are 10 or 5 points and a valid exam is one long + two short inside the task ranges", () => {
    for (const t of MACRO_FRQ_TYPES) { const p = MACRO_FRQ_PROFILES[t]; expect(p.graph + p.assertion + p.explain + p.numeric).toBe(p.points); expect([5, 10]).toContain(p.points); }
    expect(verifyMacroFrqExam(["maf_long_adas_policy", "maf_short_fiscal_multiplier", "maf_short_fx_trade"])).toEqual([]);
    expect(verifyMacroFrqExam(["maf_long_open_economy", "maf_short_lf_crowding", "maf_short_money_banking"])).toEqual([]);
    expect(verifyMacroFrqExam(["maf_long_adas_policy", "maf_short_phillips", "maf_short_lf_crowding"]).length).toBeGreaterThan(0); // 수치 1점 < 2
    expect(verifyMacroFrqExam(["maf_long_adas_policy", "maf_long_open_economy", "maf_short_phillips"])).toContain("frq_structure_not_1_long_2_short");
    expect(verifyMacroFrqExam(["maf_short_phillips", "maf_short_phillips", "maf_long_adas_policy"])).toContain("frq_duplicate_type");
  });
  it("rejects a skill outside category 1-3, a category count outside the range, and duplicate keys", () => {
    const items = buildMacroOrder({ id: "x", singles: [], frq: [], virtual: [], frqVirtual: [] });
    expect(items).toEqual([]);
    const base = Array.from({ length: 60 }, (_, i) => ({ kind: "mc" as const, unit: String([1, 2, 3, 4, 5, 6][i % 6]), skill: ["1.C", "2.A", "3.A"][i % 3], candidateKey: `k${i}`, position: i + 1 }));
    expect(verifyMacroFullComposition(base).join()).toMatch(/frq_count_0\/3/);
    expect(verifyMacroFullComposition([...base.slice(0, 59), { ...base[59], skill: "4.A" }]).join()).toMatch(/category_4_not_assessed_in_mc/);
  });
});

describe("macro exact assignment (ILP + independent verifier)", () => {
  it("a complete library stock fills two exams with no virtual items, zero overlap, and every official range satisfied", () => {
    const st = stock(2);
    const out: ReturnType<typeof solveMacroSets>["out"] = []; const bl = new Set<string>(); const blArch = new Set<string>();
    for (const id of ["MA1", "MA2"]) {
      const one = solveMacroSets([id], st, { timeMs: 90000, blocked: bl, blockedArchetypes: blArch });
      expect(one.res.status).toBe("optimal"); out.push(...one.out); for (const it of [...one.out[0].singles, ...one.out[0].frq]) bl.add(it.key);
      for (const a of [...one.out[0].singles.map((c) => c.archetype), ...one.out[0].virtual.map((v) => v.archetype)]) if (ONE_EXAM_ONLY.has(a)) blArch.add(a);
      for (const c of one.out[0].frq) blArch.add(c.archetype);
    }
    for (const r of out) { expect(r.virtual).toEqual([]); expect(r.frqVirtual).toEqual([]); expect(r.singles).toHaveLength(60); expect(r.frq).toHaveLength(3); }
    expect(verifyMacroAssignment(out)).toEqual([]);
    const sk = categorySummary(out[0]); expect(sk.numeric).toBeGreaterThanOrEqual(9); expect(sk.numeric).toBeLessThanOrEqual(12);
    const types0 = out[0].frq.map((c) => c.frqType); const types1 = out[1].frq.map((c) => c.frqType);
    expect(types0.filter((t) => types1.includes(t))).toEqual([]); // FRQ 유형 재고가 유형당 1개라 두 시험은 서로 다른 유형
    const a0 = new Set(out[0].singles.map((c) => c.archetype)); expect(out[1].singles.filter((c) => ONE_EXAM_ONLY.has(c.archetype) && a0.has(c.archetype))).toEqual([]); // 한 시험 전용 원형은 두 시험에 나오지 않는다
    expect(toReportSet(out[0]).frqA).toHaveLength(3);
    expect(toReportSet(out[0]).mcA).toHaveLength(60);
  }, 240000);

  it("reports exactly the missing slots as virtual items when the stock is short (no long FRQ type, 80 percent of the archetypes gone)", () => {
    const keep = stock(1).filter((c) => !(c.kind === "frq" && MACRO_FRQ_PROFILES[c.frqType].points === 10)).filter((c, i) => c.kind === "frq" || i % 5 < 1);
    const { res, out } = solveMacroSets(["MA1"], keep, { timeMs: 60000 });
    expect(res.status).toBe("optimal");
    const r = out[0];
    expect(r.frqVirtual.map((v) => MACRO_FRQ_PROFILES[v.type].points)).toContain(10);
    expect(r.virtual.length + r.singles.length).toBe(60);
    expect(r.virtual.length).toBeGreaterThan(0);
    expect(verifyMacroAssignment(out)).toEqual([]); // 가상 문항을 포함한 구조도 구성 규칙을 만족한다
  }, 120000);

  it("never puts two items of the same family into one exam (family cap 1) and charges a virtual item instead", () => {
    const st = stock(1);
    const u5 = st.filter((c) => c.kind === "mc" && c.members[0].unit === 5);
    for (const c of u5) c.fam = u5[0].fam; // 단원 5 의 모든 문항이 같은 군
    const { res, out } = solveMacroSets(["MA1"], st, { timeMs: 60000 });
    expect(res.status).toBe("optimal");
    expect(out[0].singles.filter((c) => c.members[0].unit === 5).length).toBeLessThanOrEqual(1);
    expect(out[0].virtual.filter((v) => v.unit === 5).length).toBeGreaterThanOrEqual(11);
    expect(verifyMacroAssignment(out)).toEqual([]);
  }, 120000);
  it("minExamPrep raises the number of exam_prep singles in every exam to the floor (virtual items are not counted)", () => {
    const st = stock(2).map((c, i) => (c.kind === "mc" && i % 3 === 0 ? { ...c, exam: 1 } : c));
    const { res, out } = solveMacroSets(["MA1", "MA2"], st, { timeMs: 90000, minExamPrep: 18, preferExamPrep: true });
    expect(res.status).toBe("optimal");
    for (const r of out) expect(r.singles.reduce((a, c) => a + (c.exam ?? 0), 0)).toBeGreaterThanOrEqual(18);
    const none = solveMacroSets(["MA1"], stock(1).map((c) => ({ ...c, exam: 0 })), { timeMs: 30000, minExamPrep: 5 });
    expect(none.res.status).not.toBe("optimal"); // exam_prep 문항이 없으면 하한을 만족할 수 없다
  }, 240000);
});
