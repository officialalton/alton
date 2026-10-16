import { describe, expect, it } from "vitest";
import { planDraftSet, subjectOfSetIdOrNull, SET_ID_RE, defaultDraftName, type FullSetUsage, type PoolRow, type SetKeys } from "./assemble-draft";
import { buildUshOrder, solveUshSets, toReportSet, verifyUshAssignment } from "../../scripts/ap-generation/ush-assign";
import type { UshItem } from "../../scripts/ap-generation/ush-pool";
import { planUshSets } from "../ap-generation/ushistory-plan";
import { ushSkillCat } from "../ap-exam/ush-rules";

// US History 풀 세트 초안 계획(DB 없음): 합성 재고(계획기가 만든 4문항 세트 + 시대 다른 SAQ + DBQ·LEQ 각 2~3개)를 배정기로 풀어 얻은 키를 쓰고, 변환 상태만 가짜 풀로 만든다.
const specs = planUshSets({ perPeriod: { 1: 5, 2: 5, 3: 9, 4: 9, 5: 9, 6: 9, 7: 9, 8: 9, 9: 5 }, seed: 77, noQuantPeriods: [1] });
const sets: UshItem[] = specs.map((s, i) => ({ key: `m${i}`, keyUnit: String(s.period), kind: "mc", members: s.skills.slice(0, i % 3 === 0 ? 3 : 4).map((k, j) => ({ skill: k, cat: ushSkillCat(k), topic: `${s.period}.${j + 2}`, unit: String(s.period) })), fam: `theme:${s.theme}`, template: "", period: s.period, stim: s.stim, theme: s.theme, screen: true, batch: "t", renderType: "none", stimKind: "text", exam: 3 }));
const frq = (t: string, p: number, i: number): UshItem => ({ key: `f-${t}-${i}`, keyUnit: "", kind: "frq", members: [], fam: `frq:${t}${i}`, template: t, period: p, stim: "", theme: "", screen: true, batch: "t", renderType: "none", stimKind: "none", exam: 0 });
const st: UshItem[] = [...sets, frq("saq1", 6, 0), frq("saq1", 5, 1), frq("saq2", 4, 0), frq("saq2", 7, 1), frq("saq3", 8, 0), frq("saq3", 3, 1), frq("dbq", 4, 0), frq("dbq", 6, 1), frq("leq", 4, 0), frq("leq", 7, 1)];
// 두 시험을 한 번에 풀면 내장 분기한정이 느려, 한 시험씩 풀고 쓴 후보는 차단한다(psych-assign.test.ts 와 같은 방식).
const bl = new Set<string>(); const outs: ReturnType<typeof solveUshSets>["out"] = []; let status = "optimal";
for (const id of ["US1", "US2"]) { const one = solveUshSets([id], st, { timeMs: 100000, blocked: bl }); if (one.res.status !== "optimal") status = one.res.status; outs.push(...one.out); for (const c of [...one.out[0].sets, ...one.out[0].frq]) { bl.add(c.key); } }
const solved = { res: { status }, out: outs };
const reports = solved.out.map(toReportSet); const us1 = reports.find((s) => s.id === "US1")!; const stockBy = new Map(st.map((c) => [c.key, c]));
const keys: SetKeys = { mcA: us1.mcA, mcB: us1.mcB ?? [], frqA: us1.frqA, frqB: us1.frqB ?? [] };
const poolFor = (o: Partial<PoolRow> = {}): PoolRow[] => [...keys.mcA, ...keys.frqA].map((k, i) => { const c = stockBy.get(k)!; const m = c.kind === "mc" ? c.members.length : 1; return { candidate_key: k, kind: c.kind === "mc" ? "mc" : "frq_bundle", keyword_code: c.members[0]?.topic ?? "4.1", difficulty_provisional: "exam_prep", purpose: "mock_exam", is_current: true, render_verified: true, screen_verified: true, ap_candidate_problems: Array.from({ length: m }, (_, j) => ({ item_index: j, problem_id: `p${i}-${j}`, problem_version_id: `v${i}-${j}` })), ...o }; });
const base = () => ({ setId: "US1", keys, hasVirtual: false, pool: poolFor(), existingFullSets: [] as FullSetUsage[], publishedKeys: new Set<string>(), stock: [], ushStock: st });

describe("US History assignment (synthetic stock)", () => {
  it("is feasible, passes the independent verifier and keeps the two exams disjoint", () => {
    expect(["optimal", "limit"]).toContain(solved.res.status); expect(solved.out.every((r) => r.sets.length > 0)).toBe(true); expect(verifyUshAssignment(solved.out)).toEqual([]);
    const k1 = new Set([...reports[0].mcA, ...reports[0].frqA]); expect([...reports[1].mcA, ...reports[1].frqA].some((k) => k1.has(k))).toBe(false);
    for (const r of solved.out) expect(buildUshOrder(r).length).toBe(55);
  }, 180000);
  it("the verifier rejects shared keys and missing FRQ types", () => {
    const bad = solved.out.map((r) => ({ ...r, sets: [...r.sets] })); bad[1].sets[0] = bad[0].sets[0]; expect(verifyUshAssignment(bad).join()).toMatch(/겹침/);
    expect(verifyUshAssignment(solved.out.map((r) => ({ ...r, frq: r.frq.slice(1) }))).join()).toMatch(/frq_/);
  });
  it("is infeasible (not padded with virtual cells) when the stock cannot fill the structure", () => { expect(solveUshSets(["US1"], st.filter((c) => c.period !== 3 || c.kind === "frq"), { timeMs: 30000 }).res.status).not.toBe("optimal"); });
});
describe("planDraftSet for ap_us_history", () => {
  it("US is a known set prefix", () => { expect(subjectOfSetIdOrNull("US2")).toBe("ap_us_history"); expect(SET_ID_RE.test("US1")).toBe(true); expect(defaultDraftName("US2")).toBe("AP U.S. History — Practice Exam 2"); });
  it("the plan is saveable: 55 MC in consecutive set blocks, SAQ 3 then DBQ and LEQ", () => {
    const p = planDraftSet(base() as never); expect(p.problems).toEqual([]); expect(p.ok).toBe(true);
    expect(p.composition).toMatchObject({ mcTotal: 55, frqTotal: 5 });
    expect(p.items.filter((i) => i.sectionKey === "ap_saq")).toHaveLength(3); expect(p.items.filter((i) => i.sectionKey === "ap_frq")).toHaveLength(2); expect(p.layout.sections).toHaveLength(3);
    expect(keys.frqA.map((k) => stockBy.get(k)!.template)).toEqual(["saq1", "saq2", "saq3", "dbq", "leq"]);
  });
  it("rejects virtual items, unconverted candidates, a dropped set and reuse across saved sets", () => {
    expect(planDraftSet({ ...base(), hasVirtual: true } as never).problems.join()).toMatch(/가상 문항/);
    const pool = poolFor(); pool[0].purpose = null; expect(planDraftSet({ ...base(), pool } as never).problems.join()).toMatch(/변환·검증이 끝나지 않은 문항/);
    expect(planDraftSet({ ...base(), keys: { ...keys, mcA: keys.mcA.slice(1) } } as never).ok).toBe(false);
    const existing: FullSetUsage[] = [{ id: "x", name: "other", status: "draft", problemIds: ["p0-0"], candidateKeys: [keys.mcA[0]] }]; expect(planDraftSet({ ...base(), existingFullSets: existing } as never).problems.join()).toMatch(/다른 풀 세트가 이미 쓰는 문항/);
  });
});
