import { describe, expect, it } from "vitest";
import { planDraftSet, subjectOfSetIdOrNull, SET_ID_RE, defaultDraftName, type FullSetUsage, type PoolRow, type SetKeys } from "./assemble-draft";
import { buildLtOrder, solveLtSets, toReportSet, verifyLtAssignment } from "../../scripts/ap-generation/lt-assign";
import type { LtItem } from "../../scripts/ap-generation/lt-pool";
import { englitCategoryOf, type EnglitGroup } from "../ap-exam/englit-rules";

// 문학 풀 세트 초안 계획(DB 없음): 합성 재고(시험 2회분의 유효 구성 + 여분)를 배정기로 풀어 얻은 키를 쓰고, 변환 상태만 가짜 풀로 만든다.
const LAYOUT: { group: EnglitGroup; skills: string[] }[] = [
  { group: "short", skills: ["1.A", "1.B", "1.D", "2.A", "3.A", "3.B", "4.A", "4.C", "5.B", "6.A", "7.B", "7.C"] },
  { group: "poetry", skills: ["1.A", "3.C", "3.D", "4.A", "4.C", "4.C", "5.B", "5.D", "6.B", "6.D", "7.B"] },
  { group: "longer", skills: ["1.E", "3.E", "3.F", "4.C", "4.D", "5.C", "7.C", "7.D", "3.B"] },
  { group: "poetry", skills: ["1.E", "2.A", "3.C", "3.D", "4.A", "4.C", "5.B", "5.D", "6.B", "6.C", "7.A"] },
  { group: "short", skills: ["1.B", "1.C", "1.D", "2.B", "3.A", "3.B", "4.B", "4.C", "4.D", "5.D", "6.C", "7.D"] },
];
let n = 0;
const mkSets = (copy: number): LtItem[] => LAYOUT.map((l, i) => ({ key: `lt${copy}-${i}-${n++}`, kind: "mc" as const, group: l.group, members: l.skills.map((k) => ({ skill: k, cat: englitCategoryOf(k)!, topic: "U1.1" })), fam: `fam-${copy}-${i}`, frqType: "", archetype: `lt_${l.group}_${copy}${i}`, screen: true, batch: "t", renderType: "none", stimKind: "none", conf: 0.9, exam: l.skills.length }));
const frq = (t: string, i: number): LtItem => ({ key: `f-${t}-${i}`, kind: "frq", group: null, members: [], fam: `ff-${t}-${i}`, frqType: t, archetype: `ltfrq_${t}${i}`, screen: true, batch: "t", renderType: "none", stimKind: "none", conf: 1 });
const st: LtItem[] = [...mkSets(1), ...mkSets(2), ...mkSets(3), ...["q1", "q2", "q3"].flatMap((t) => [0, 1].map((i) => frq(t, i)))];
const solved = solveLtSets(["LT1", "LT2"], st, { timeMs: 120000 });
const reports = solved.out.map(toReportSet); const lt1 = reports.find((s) => s.id === "LT1")!;
const stockBy = new Map(st.map((c) => [c.key, c]));
const keys: SetKeys = { mcA: lt1.mcA, mcB: lt1.mcB ?? [], frqA: lt1.frqA, frqB: lt1.frqB ?? [] };
const poolFor = (o: Partial<PoolRow> = {}): PoolRow[] => [...keys.mcA, ...keys.frqA].map((k, i) => { const c = stockBy.get(k)!; const m = c.kind === "mc" ? c.members.length : 1;
  return { candidate_key: k, kind: c.kind === "mc" ? "mc" : "frq_bundle", keyword_code: c.members[0]?.topic ?? "U9.4", difficulty_provisional: "exam_prep", purpose: "mock_exam", is_current: true, render_verified: true, screen_verified: true, ap_candidate_problems: Array.from({ length: m }, (_, j) => ({ item_index: j, problem_id: `p${i}-${j}`, problem_version_id: `v${i}-${j}` })), ...o }; });
const base = () => ({ setId: "LT1", keys, hasVirtual: false, pool: poolFor(), existingFullSets: [] as FullSetUsage[], publishedKeys: new Set<string>(), stock: [], ltStock: st });

describe("English Literature assignment (synthetic stock)", () => {
  it("is feasible, passes the independent verifier and keeps the two exams disjoint", () => {
    expect(solved.res.status).toBe("optimal"); expect(verifyLtAssignment(solved.out)).toEqual([]);
    const k1 = new Set([...reports[0].mcA, ...reports[0].frqA]); expect([...reports[1].mcA, ...reports[1].frqA].some((k) => k1.has(k))).toBe(false);
    for (const r of solved.out) { const o = buildLtOrder(r); expect(o.length).toBe(55); expect(r.sets).toHaveLength(5); expect(r.frq.map((c) => c.frqType).sort()).toEqual(["q1", "q2", "q3"]); }
  }, 180000);
  it("the verifier rejects a shared key, a missing FRQ type and an out-of-range genre count", () => {
    const bad = solved.out.map((r) => ({ ...r, sets: [...r.sets] })); bad[1].sets[0] = bad[0].sets[0]; expect(verifyLtAssignment(bad).join()).toMatch(/겹침/);
    const noFrq = solved.out.map((r) => ({ ...r, frq: r.frq.slice(1) })); expect(verifyLtAssignment(noFrq).join()).toMatch(/FRQ/);
    const dropPoetry = solved.out.map((r, i) => (i === 0 ? { ...r, sets: r.sets.filter((c, j) => !(c.group === "poetry" && j === r.sets.findIndex((x) => x.group === "poetry"))) } : r)); expect(verifyLtAssignment(dropPoetry).join()).toMatch(/mc_count|group_poetry|set_count/);
  });
  it("is infeasible (not padded with virtual cells) when the stock cannot fill the structure", () => {
    const r = solveLtSets(["LT1"], st.filter((c) => c.group !== "longer"), { timeMs: 30000 }); expect(r.res.status).not.toBe("optimal");
  });
});

describe("planDraftSet for ap_english_literature", () => {
  it("LT is a known set prefix", () => { expect(subjectOfSetIdOrNull("LT2")).toBe("ap_english_literature"); expect(SET_ID_RE.test("LT1")).toBe(true); expect(defaultDraftName("LT2")).toBe("AP English Literature — Practice Exam 2"); });
  it("the plan for the assignment is saveable: 55 MC problems in 5 passage sets, 3 FRQ in order q1 q2 q3", () => {
    const p = planDraftSet(base() as never); expect(p.problems).toEqual([]); expect(p.ok).toBe(true); expect(p.composition).toMatchObject({ mcTotal: 55, frqTotal: 3 });
    expect(p.items.filter((i) => i.sectionKey === "ap_mc").map((i) => i.position)).toEqual(Array.from({ length: 55 }, (_, i) => i + 1)); expect(p.layout.sections).toHaveLength(2);
    expect(keys.frqA.map((k) => stockBy.get(k)!.frqType)).toEqual(["q1", "q2", "q3"]);
  });
  it("a passage set stays together in consecutive positions", () => {
    const p = planDraftSet(base() as never); const k = keys.mcA[0]; const pos = p.items.filter((i) => i.candidateKey === k).map((i) => i.position);
    expect(pos.length).toBe(stockBy.get(k)!.members.length); expect(pos.every((x, i) => i === 0 || x === pos[i - 1] + 1)).toBe(true);
  });
  it("rejects virtual items, unconverted candidates, a dropped passage set and reuse across saved sets", () => {
    expect(planDraftSet({ ...base(), hasVirtual: true } as never).problems.join()).toMatch(/가상 문항/);
    const pool = poolFor(); pool[0].purpose = null; expect(planDraftSet({ ...base(), pool } as never).problems.join()).toMatch(/변환 안 됨/);
    expect(planDraftSet({ ...base(), keys: { ...keys, mcA: keys.mcA.slice(1) } } as never).problems.join()).toMatch(/독립 검증/);
    const used: FullSetUsage = { id: "x", name: "other", status: "draft", problemIds: ["p0-0"], candidateKeys: [keys.mcA[0]] }; expect(planDraftSet({ ...base(), existingFullSets: [used] } as never).ok).toBe(false);
  });
});
