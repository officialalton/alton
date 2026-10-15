import { describe, expect, it } from "vitest";
import { planDraftSet, subjectOfSetIdOrNull, SET_ID_RE, defaultDraftName, type FullSetUsage, type PoolRow, type SetKeys } from "./assemble-draft";
import { buildWhOrder, solveWhSets, toReportSet, verifyWhAssignment } from "../../scripts/ap-generation/wh-assign";
import type { WhItem } from "../../scripts/ap-generation/wh-pool";
import { WH_SETS } from "../ap-generation/wh-plan";
import { whSkillCat } from "../ap-exam/wh-rules";

// World History 풀 세트 초안 계획(DB 없음): 합성 재고(고정 계획의 세트 30개 + 시대 구간이 다른 SAQ + DBQ·LEQ 각 2개)를 배정기로 풀어 얻은 키를 쓰고, 변환 상태만 가짜 풀로 만든다.
const examOf = new Map(WH_SETS.map((s) => [`m${s.id}`, s.exam]));
const sets: WhItem[] = WH_SETS.map((s) => ({ key: `m${s.id}`, keyUnit: String(s.unit), kind: "mc", members: s.skills.map((k, j) => ({ skill: k, cat: whSkillCat(k), topic: `${s.unit}.${j + 1}`, unit: String(s.unit), topicUnit: String(s.unit) })), fam: `theme:${s.theme}`, template: "", era: 0, stim: s.stim, theme: s.theme, screen: true, batch: "t", renderType: "none", stimKind: "text", exam: 3 }));
const frq = (t: string, era: number, i: number): WhItem => ({ key: `f-${t}-${i}`, keyUnit: "", kind: "frq", members: [], fam: `frq:${t}${i}`, template: t, era, stim: "", theme: "", screen: true, batch: "t", renderType: "none", stimKind: "none", exam: 0 });
const st: WhItem[] = [...sets, frq("saq1", 4, 0), frq("saq1", 3, 1), frq("saq2", 1, 0), frq("saq2", 4, 1), frq("saq3", 2, 0), frq("saq3", 1, 1), frq("dbq", 3, 0), frq("dbq", 4, 1), frq("leq", 2, 0), frq("leq", 3, 1)];
const bl = new Set<string>(); const outs: ReturnType<typeof solveWhSets>["out"] = []; let status = "optimal";
for (const id of ["WH1", "WH2"]) { const one = solveWhSets([id], st.filter((c) => c.kind === "frq" || examOf.get(c.key) === id), { timeMs: 100000, blocked: bl }); if (one.res.status !== "optimal") status = one.res.status; outs.push(...one.out); for (const c of [...one.out[0].sets, ...one.out[0].frq]) bl.add(c.key); }
const solved = { res: { status }, out: outs };
const reports = solved.out.map(toReportSet); const wh1 = reports.find((s) => s.id === "WH1")!; const stockBy = new Map(st.map((c) => [c.key, c]));
const keys: SetKeys = { mcA: wh1.mcA, mcB: wh1.mcB ?? [], frqA: wh1.frqA, frqB: wh1.frqB ?? [] };
const poolFor = (o: Partial<PoolRow> = {}): PoolRow[] => [...keys.mcA, ...keys.frqA].map((k, i) => { const c = stockBy.get(k)!; const m = c.kind === "mc" ? c.members.length : 1; return { candidate_key: k, kind: c.kind === "mc" ? "mc" : "frq_bundle", keyword_code: c.members[0]?.topic ?? "4.1", difficulty_provisional: "exam_prep", purpose: "mock_exam", is_current: true, render_verified: true, screen_verified: true, ap_candidate_problems: Array.from({ length: m }, (_, j) => ({ item_index: j, problem_id: `p${i}-${j}`, problem_version_id: `v${i}-${j}` })), ...o }; });
const base = () => ({ setId: "WH1", keys, hasVirtual: false, pool: poolFor(), existingFullSets: [] as FullSetUsage[], publishedKeys: new Set<string>(), stock: [], whStock: st });

describe("World History assignment (synthetic stock)", () => {
  it("is feasible, passes the independent verifier and keeps the two exams disjoint", () => {
    expect(["optimal", "limit"]).toContain(solved.res.status); expect(solved.out.every((r) => r.sets.length > 0)).toBe(true); expect(verifyWhAssignment(solved.out)).toEqual([]);
    const k1 = new Set([...reports[0].mcA, ...reports[0].frqA]); expect([...reports[1].mcA, ...reports[1].frqA].some((k) => k1.has(k))).toBe(false);
    for (const r of solved.out) expect(buildWhOrder(r).length).toBe(55);
  }, 180000);
  it("the verifier rejects shared keys and missing FRQ types", () => {
    const bad = solved.out.map((r) => ({ ...r, sets: [...r.sets] })); bad[1].sets[0] = bad[0].sets[0]; expect(verifyWhAssignment(bad).join()).toMatch(/겹침/);
    expect(verifyWhAssignment(solved.out.map((r) => ({ ...r, frq: r.frq.slice(1) }))).join()).toMatch(/frq_/);
  });
  it("is infeasible (not padded with virtual cells) when the stock cannot fill the structure", () => { expect(solveWhSets(["WH1"], st.filter((c) => c.keyUnit !== "3"), { timeMs: 30000 }).res.status).not.toBe("optimal"); });
});
describe("planDraftSet for ap_world_history", () => {
  it("WH is a known set prefix", () => { expect(subjectOfSetIdOrNull("WH2")).toBe("ap_world_history"); expect(SET_ID_RE.test("WH1")).toBe(true); expect(defaultDraftName("WH2")).toBe("AP World History: Modern — Practice Exam 2"); });
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
