import { describe, expect, it } from "vitest";
import { CSA_FRQ_TYPES, CSA_MC_COUNT, csaPracticeBounds, csaUnitBounds, verifyCsaFullComposition } from "../../lib/ap-exam/full-set-rules";
import { LIB_FRQ, LIB_SETS, LIB_SINGLES, buildCsOrder, practiceSummary, solveCsSets, toReportSet, verifyCsAssignment } from "./cs-assign";
import type { CsItem } from "./cs-pool";

let n = 0;
const single = (e: { id: string; topic: string; skill: string }, copy: number): CsItem => ({ key: `m${n++}`, kind: "mc", shared: false, members: [{ unit: Number(e.topic.split(".")[0]), skill: e.skill, topic: e.topic }], fam: `${e.id}|${copy}`, frqType: "", archetype: e.id, screen: true, batch: "t", renderType: "none", stimKind: "none", exam: 0 });
const set = (e: (typeof LIB_SETS)[number], copy: number): CsItem => ({ key: `s${n++}`, kind: "mc", shared: true, members: e.members.map((m) => ({ unit: m.unit, skill: m.skill, topic: `${m.unit}.1` })), fam: `${e.id}|${copy}`, frqType: "", archetype: e.id, screen: true, batch: "t", renderType: "none", stimKind: "none", exam: 0 });
const frq = (e: { id: string; type: string }): CsItem => ({ key: `f-${e.id}-${n++}`, kind: "frq", shared: false, members: [], fam: `ff-${e.id}`, frqType: e.type, archetype: e.id, screen: true, batch: "t", renderType: "text", stimKind: "text", exam: 0 });
/** 라이브러리 원형마다 후보 copies 개 + 시나리오마다 후보 1개. 문항군은 후보마다 따로 둔다(원형 단위 겹침 제한은 배정기가 건다). */
const stock = (copies = 2) => { n = 0; return [...LIB_SINGLES.flatMap((e) => Array.from({ length: copies }, (_, c) => single(e, c))), ...LIB_SETS.flatMap((e) => Array.from({ length: copies }, (_, c) => set(e, c))), ...LIB_FRQ.map(frq)]; };

describe("cs rules (official ranges)", () => {
  it("MC bounds from the CED percentages (floor/ceil) match the python coverage planner", () => {
    expect(csaUnitBounds()).toEqual({ "1": { min: 6, max: 11 }, "2": { min: 10, max: 15 }, "3": { min: 4, max: 8 }, "4": { min: 12, max: 17 } });
    expect(csaPracticeBounds()).toEqual({ "1": { min: 0, max: 5 }, "2": { min: 9, max: 16 }, "3": { min: 15, max: 23 }, "4": { min: 4, max: 7 }, "5": { min: 0, max: 5 } });
  });
  it("rejects a composition with the wrong counts, a unit outside the range, non-contiguous sets and duplicate FRQ keys", () => {
    const mk = (units: number[], skill = "3.A") => units.map((u, i) => ({ kind: "mc" as const, unit: String(u), skill, candidateKey: null, position: i + 1 }));
    const ok = [...mk([1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4], "3.A")];
    expect(verifyCsaFullComposition([...ok, ...CSA_FRQ_TYPES.map((t, i) => ({ kind: "frq" as const, unit: null, skill: null, candidateKey: `f${i}`, position: i + 1 }))]).join()).toMatch(/shared_sets_0_not_in_1-3/);
    const bad = verifyCsaFullComposition([...ok.slice(0, 41), ...CSA_FRQ_TYPES.slice(0, 3).map((t, i) => ({ kind: "frq" as const, unit: null, skill: null, candidateKey: "same", position: i + 1 }))]).join();
    expect(bad).toMatch(/mc_count_41\/42/); expect(bad).toMatch(/frq_count_3\/4/); expect(bad).toMatch(/frq_duplicate_key/);
    expect(bad).toMatch(/unit_4_/); // 단원 4 가 17 을 넘는다
  });
});

describe("cs exact assignment (ILP + independent verifier)", () => {
  it("a complete library stock fills two exams with no virtual items, disjoint structures, every official range and each FRQ type once", () => {
    const st = stock(2);
    const { res, out } = solveCsSets(["CS1", "CS2"], st, { timeMs: 120000 });
    expect(["optimal", "feasible"]).toContain(res.status);
    for (const r of out) {
      expect(r.virtual).toEqual([]); expect(r.virtualSets).toEqual([]); expect(r.frqVirtual).toEqual([]);
      expect(r.singles.length + 2 * r.sets.length).toBe(CSA_MC_COUNT); expect(r.frq).toHaveLength(4);
      expect(r.sets.length).toBeGreaterThanOrEqual(1);
    }
    expect(verifyCsAssignment(out)).toEqual([]);
    const a0 = new Set([...out[0].singles, ...out[0].sets, ...out[0].frq].map((c) => c.archetype));
    expect([...out[1].singles, ...out[1].sets, ...out[1].frq].filter((c) => a0.has(c.archetype))).toEqual([]); // 두 회는 구조(원형)가 겹치지 않는다
    for (const r of out) { const sk = practiceSummary(r); expect(Object.values(sk.practice).reduce((a, b) => a + b, 0)).toBe(CSA_MC_COUNT); }
    expect(toReportSet(out[0]).frqA).toHaveLength(4);
    expect(new Set(toReportSet(out[0]).frqA.map((k) => st.find((c) => c.key === k)!.frqType))).toEqual(new Set(CSA_FRQ_TYPES));
  }, 240000);

  it("reports exactly the missing slots as virtual items when the stock is short (no q2 scenarios, three quarters of the archetypes gone)", () => {
    const keep = stock(1).filter((c) => !(c.kind === "frq" && c.frqType === "q2")).filter((c, i) => c.kind === "frq" || i % 4 === 0);
    const { res, out } = solveCsSets(["CS1"], keep, { timeMs: 60000 });
    expect(["optimal", "feasible"]).toContain(res.status);
    const r = out[0];
    expect(r.frqVirtual.map((v) => v.type)).toContain("q2");
    expect(r.virtual.length + r.virtualSets.length).toBeGreaterThan(0);
    expect(verifyCsAssignment(out)).toEqual([]); // 가상 문항을 포함한 구조도 구성 규칙을 만족한다
  }, 120000);

  it("never puts two candidates of one family into one exam (family cap 1) and never reuses a structure in the second exam", () => {
    const st = stock(2);
    const u3 = st.filter((c) => c.kind === "mc" && !c.shared && c.members[0].unit === 3);
    for (const c of u3) c.fam = u3[0].fam; // 단원 3 의 모든 단독 문항이 같은 군
    const { out } = solveCsSets(["CS1", "CS2"], st, { timeMs: 120000 });
    for (const r of out) expect(r.singles.filter((c) => c.members[0].unit === 3).length).toBeLessThanOrEqual(1);
    expect(verifyCsAssignment(out)).toEqual([]);
  }, 240000);

  it("the independent verifier catches a reused structure across exams and a reused candidate", () => {
    const st = stock(2);
    const { out } = solveCsSets(["CS1"], st, { timeMs: 60000 });
    const clone = { ...out[0], id: "CS2" };
    const v = verifyCsAssignment([out[0], clone]);
    expect(v.join()).toMatch(/겹침/); expect(v.join()).toMatch(/중복/);
    expect(buildCsOrder(out[0]).filter((i) => i.candidateKey).length % 2).toBe(0); // 세트 문항은 2칸씩
  }, 120000);
});
