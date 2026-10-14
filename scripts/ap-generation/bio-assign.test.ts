import { describe, expect, it } from "vitest";
import { BIO_FRQ_TYPES, BIO_MC_COUNT, bioPracticeBounds, bioUnitBounds, verifyBioFullComposition } from "../../lib/ap-exam/full-set-rules";
import { LIB_FRQ, LIB_SETS, LIB_SINGLES, buildBioOrder, practiceSummary, solveBioSets, toReportSet, verifyBioAssignment } from "./bio-assign";
import type { BioItem } from "./bio-pool";

let n = 0;
const single = (e: { id: string; topic: string; skill: string }, copy: number): BioItem => ({ key: `m${n++}`, kind: "mc", shared: false, members: [{ unit: Number(e.topic.split(".")[0]), skill: e.skill, topic: e.topic }], fam: `${e.id}|${copy}`, frqType: "", archetype: e.id, screen: true, batch: "t", renderType: "none", stimKind: "none", exam: 0 });
const set = (e: (typeof LIB_SETS)[number], copy: number): BioItem => ({ key: `s${n++}`, kind: "mc", shared: true, members: e.members.map((m) => ({ unit: m.unit, skill: m.skill, topic: `${m.unit}.1` })), fam: `${e.id}|${copy}`, frqType: "", archetype: e.id, screen: true, batch: "t", renderType: "none", stimKind: "none", exam: 0 });
const frq = (e: { id: string; type: string }): BioItem => ({ key: `f-${e.id}-${n++}`, kind: "frq", shared: false, members: [], fam: `ff-${e.id}`, frqType: e.type, archetype: e.id, screen: true, batch: "t", renderType: "text", stimKind: "text", exam: 0 });
/** 라이브러리 원형마다 후보 copies 개 + 시나리오마다 후보 1개. 문항군은 후보마다 따로 둔다(원형 단위 겹침 제한은 배정기가 건다). */
const stock = (copies = 2) => { n = 0; return [...LIB_SINGLES.flatMap((e) => Array.from({ length: copies }, (_, c) => single(e, c))), ...LIB_SETS.flatMap((e) => Array.from({ length: copies }, (_, c) => set(e, c))), ...LIB_FRQ.map(frq)]; };

describe("bio rules (official ranges)", () => {
  it("MC bounds from the CED percentages (floor/ceil) match the python coverage planner", () => {
    expect(bioUnitBounds()).toEqual({ "1": { min: 4, max: 7 }, "2": { min: 6, max: 8 }, "3": { min: 7, max: 10 }, "4": { min: 6, max: 9 }, "5": { min: 4, max: 7 }, "6": { min: 7, max: 10 }, "7": { min: 7, max: 12 }, "8": { min: 6, max: 9 } });
    expect(bioPracticeBounds()).toEqual({ "1": { min: 15, max: 20 }, "2": { min: 9, max: 15 }, "3": { min: 4, max: 9 }, "4": { min: 4, max: 9 }, "5": { min: 4, max: 9 }, "6": { min: 12, max: 16 } });
  });
  it("rejects a composition with the wrong counts, a unit outside the range, non-contiguous sets and duplicate FRQ keys", () => {
    const mk = (units: number[], skill = "1.A") => units.map((u, i) => ({ kind: "mc" as const, unit: String(u), skill, candidateKey: null, position: i + 1 }));
    const ok = [...mk([...Array(5).fill(1), ...Array(7).fill(2), ...Array(8).fill(3), ...Array(7).fill(4), ...Array(5).fill(5), ...Array(8).fill(6), ...Array(12).fill(7), ...Array(8).fill(8)], "1.A")];
    expect(verifyBioFullComposition([...ok, ...BIO_FRQ_TYPES.map((t, i) => ({ kind: "frq" as const, unit: null, skill: null, candidateKey: `f${i}`, position: i + 1 }))]).join()).toMatch(/shared_sets_0\/2/);
    const bad = verifyBioFullComposition([...ok.slice(0, 59), ...BIO_FRQ_TYPES.slice(0, 3).map((t, i) => ({ kind: "frq" as const, unit: null, skill: null, candidateKey: "same", position: i + 1 }))]).join();
    expect(bad).toMatch(/mc_count_59\/60/); expect(bad).toMatch(/frq_count_3\/6/); expect(bad).toMatch(/frq_duplicate_key/);
    expect(bad).toMatch(/practice_1_59_not_in_15-20/); // 59문항이 모두 Practice 1 이라 Practice 1 상한(20)을 넘고 나머지 Practice 는 하한 미달
    expect(bad).toMatch(/practice_6_0_not_in_12-16/);
  });
});

describe("bio exact assignment (ILP + independent verifier)", () => {
  it("a complete library stock fills two exams with no virtual items, disjoint structures, every official range and each FRQ type once", () => {
    const st = stock(2);
    const { res, out } = solveBioSets(["BI1", "BI2"], st, { timeMs: 120000 });
    expect(["optimal", "feasible"]).toContain(res.status);
    for (const r of out) {
      expect(r.virtual).toEqual([]); expect(r.virtualSets).toEqual([]); expect(r.frqVirtual).toEqual([]);
      expect(r.singles.length + 4 * r.sets.length).toBe(BIO_MC_COUNT); expect(r.frq).toHaveLength(6);
      expect(r.sets).toHaveLength(2);
    }
    expect(verifyBioAssignment(out)).toEqual([]);
    const a0 = new Set([...out[0].singles, ...out[0].sets, ...out[0].frq].map((c) => c.archetype));
    expect([...out[1].singles, ...out[1].sets, ...out[1].frq].filter((c) => a0.has(c.archetype))).toEqual([]); // 두 회는 구조(원형)가 겹치지 않는다
    for (const r of out) { const sk = practiceSummary(r); expect(Object.values(sk.practice).reduce((a, b) => a + b, 0)).toBe(BIO_MC_COUNT); }
    expect(toReportSet(out[0]).frqA).toHaveLength(6);
    expect(new Set(toReportSet(out[0]).frqA.map((k) => st.find((c) => c.key === k)!.frqType))).toEqual(new Set(BIO_FRQ_TYPES));
  }, 240000);

  it("reports exactly the missing slots as virtual items when the stock is short (no Q2 scenarios, three quarters of the archetypes gone)", () => {
    const keep = stock(1).filter((c) => !(c.kind === "frq" && c.frqType === "bio_q2_graphing")).filter((c, i) => c.kind === "frq" || i % 4 === 0);
    const { res, out } = solveBioSets(["BI1"], keep, { timeMs: 60000 });
    expect(["optimal", "feasible"]).toContain(res.status);
    const r = out[0];
    expect(r.frqVirtual.map((v) => v.type)).toContain("bio_q2_graphing");
    expect(r.virtual.length + r.virtualSets.length).toBeGreaterThan(0);
    expect(verifyBioAssignment(out)).toEqual([]); // 가상 문항을 포함한 구조도 구성 규칙을 만족한다
  }, 120000);

  it("never puts two candidates of one family into one exam (family cap 1) and never reuses a structure in the second exam", () => {
    const st = stock(2);
    const u3 = st.filter((c) => c.kind === "mc" && !c.shared && c.members[0].unit === 3);
    for (const c of u3) c.fam = u3[0].fam; // 단원 3 의 모든 단독 문항이 같은 군
    const { out } = solveBioSets(["BI1", "BI2"], st, { timeMs: 120000 });
    for (const r of out) expect(r.singles.filter((c) => c.members[0].unit === 3).length).toBeLessThanOrEqual(1);
    expect(verifyBioAssignment(out)).toEqual([]);
  }, 240000);

  it("the independent verifier catches a reused structure across exams and a reused candidate", () => {
    const st = stock(2);
    const { out } = solveBioSets(["BI1"], st, { timeMs: 60000 });
    const clone = { ...out[0], id: "BI2" };
    const v = verifyBioAssignment([out[0], clone]);
    expect(v.join()).toMatch(/겹침/); expect(v.join()).toMatch(/중복/);
    expect(buildBioOrder(out[0]).filter((i) => i.candidateKey).length % 4).toBe(0); // 세트 문항은 4칸씩
  }, 120000);
});
