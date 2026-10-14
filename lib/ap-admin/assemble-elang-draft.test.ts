import { describe, expect, it } from "vitest";
import { planDraftSet, subjectOfSetIdOrNull, SET_ID_RE, defaultDraftName, type FullSetUsage, type PoolRow, type SetKeys } from "./assemble-draft";
import { buildElOrder, solveElSets, toReportSet, verifyElAssignment } from "../../scripts/ap-generation/el-assign";
import type { ElItem } from "../../scripts/ap-generation/el-pool";
import { planSets } from "../ap-generation/englang-plan";
import { elangCategoryOf, elangSectionOf } from "../ap-exam/elang-rules";

// 영어 풀 세트 초안 계획(DB 없음): 합성 재고(계획기가 스킬 범주 비중대로 만든 지문 묶음 + FRQ 유형별 2개)를 배정기로 풀어 얻은 키를 쓰고, 변환 상태만 가짜 풀로 만든다.
let n = 0;
const mkSets = (kind: "reading" | "writing", seed: number): ElItem[] => [[4, 6, 0], [4, 5, 4], [4, 4, 8]].flatMap(([sets, per, start], g) => planSets({ kind, sets, perSet: per, seed: seed + g, startIndex: start }).map((s) => ({
  key: `${kind[0]}${n++}`, kind: "mc" as const, section: kind, members: s.skills.map((k) => ({ skill: k, cat: elangCategoryOf(k)!, topic: "U1.1" })), fam: `fam-${s.id}-${kind}`, frqType: "", archetype: `el_${kind}_${s.id}`, screen: true, batch: "t", renderType: "none", stimKind: "none", conf: 0.95, exam: s.skills.length,
})));
const frq = (t: string, i: number): ElItem => ({ key: `f-${t}-${i}`, kind: "frq", section: null, members: [], fam: `ff-${t}-${i}`, frqType: t, archetype: `elfrq_${t}${i}`, screen: true, batch: "t", renderType: "none", stimKind: "none", conf: 1, exam: 0 });
const st: ElItem[] = [...mkSets("reading", 21), ...mkSets("writing", 22), ...["q1", "q2", "q3"].flatMap((t) => [0, 1].map((i) => frq(t, i)))];
const solved = solveElSets(["EL1", "EL2"], st, { timeMs: 120000 });
const reports = solved.out.map(toReportSet);
const el1 = reports.find((s) => s.id === "EL1")!;
const stockBy = new Map(st.map((c) => [c.key, c]));
const keys: SetKeys = { mcA: el1.mcA, mcB: el1.mcB ?? [], frqA: el1.frqA, frqB: el1.frqB ?? [] };
const poolFor = (o: Partial<PoolRow> = {}): PoolRow[] => [...keys.mcA, ...keys.frqA].map((k, i) => {
  const c = stockBy.get(k)!; const m = c.kind === "mc" ? c.members.length : 1;
  return { candidate_key: k, kind: c.kind === "mc" ? "mc" : "frq_bundle", keyword_code: c.members[0]?.topic ?? "U9.3", difficulty_provisional: "exam_prep", purpose: "mock_exam", is_current: true, render_verified: true, screen_verified: true,
    ap_candidate_problems: Array.from({ length: m }, (_, j) => ({ item_index: j, problem_id: `p${i}-${j}`, problem_version_id: `v${i}-${j}` })), ...o };
});
const base = () => ({ setId: "EL1", keys, hasVirtual: false, pool: poolFor(), existingFullSets: [] as FullSetUsage[], publishedKeys: new Set<string>(), stock: [], elStock: st });

describe("English assignment (synthetic stock)", () => {
  it("is feasible, passes the independent verifier and keeps the two exams disjoint (no shared key or family)", () => {
    expect(solved.res.status).toBe("optimal");
    expect(verifyElAssignment(solved.out)).toEqual([]);
    const k1 = new Set([...reports[0].mcA, ...reports[0].frqA]); expect([...reports[1].mcA, ...reports[1].frqA].some((k) => k1.has(k))).toBe(false);
    for (const r of solved.out) {
      const o = buildElOrder(r); expect(o.length).toBe(45);
      const rd = o.filter((x) => elangSectionOf(x.skill) === "reading").length; expect(rd).toBeGreaterThanOrEqual(23); expect(rd).toBeLessThanOrEqual(25);
      expect(Math.max(...o.filter((x) => elangSectionOf(x.skill) === "reading").map((x) => x.position))).toBeLessThan(Math.min(...o.filter((x) => elangSectionOf(x.skill) === "writing").map((x) => x.position)));
    }
  }, 180000);
  it("the verifier rejects a key used by both exams, a missing FRQ type and an out-of-range category", () => {
    const bad = solved.out.map((r) => ({ ...r, sets: [...r.sets] })); bad[1].sets[0] = bad[0].sets[0];
    expect(verifyElAssignment(bad).join()).toMatch(/겹침/);
    const noFrq = solved.out.map((r) => ({ ...r, frq: r.frq.slice(1) })); expect(verifyElAssignment(noFrq).join()).toMatch(/FRQ/);
    const skew = solved.out.map((r, i) => (i === 0 ? { ...r, sets: r.sets.filter((c) => !c.members.some((m) => m.cat === "RS-R")) } : r)); expect(verifyElAssignment(skew).join()).toMatch(/mc_count|category_RS-R/);
  });
  it("is infeasible (not padded with virtual cells) when the stock cannot fill the structure", () => {
    const r = solveElSets(["EL1"], st.filter((c) => c.section !== "writing"), { timeMs: 30000 });
    expect(r.res.status).not.toBe("optimal");
  });
});

describe("planDraftSet for ap_english_language", () => {
  it("EL is a known set prefix", () => {
    expect(subjectOfSetIdOrNull("EL2")).toBe("ap_english_language"); expect(SET_ID_RE.test("EL1")).toBe(true); expect(SET_ID_RE.test("EX1")).toBe(false);
    expect(defaultDraftName("EL2")).toBe("AP English Language — Practice Exam 2");
  });
  it("the plan for the assignment is saveable: 45 MC problems (passage sets), 3 FRQ in order q1 q2 q3", () => {
    const p = planDraftSet(base() as never);
    expect(p.problems).toEqual([]); expect(p.ok).toBe(true);
    expect(p.composition).toMatchObject({ mcTotal: 45, frqTotal: 3 });
    expect(p.items.filter((i) => i.sectionKey === "ap_mc").map((i) => i.position)).toEqual(Array.from({ length: 45 }, (_, i) => i + 1));
    expect(p.layout.sections).toHaveLength(2);
    expect(keys.frqA.map((k) => stockBy.get(k)!.frqType)).toEqual(["q1", "q2", "q3"]);
  });
  it("a passage set stays together in consecutive positions", () => {
    const p = planDraftSet(base() as never); const setKey = keys.mcA[0];
    const pos = p.items.filter((i) => i.candidateKey === setKey).map((i) => i.position);
    expect(pos.length).toBe(stockBy.get(setKey)!.members.length); expect(pos.every((x, i) => i === 0 || x === pos[i - 1] + 1)).toBe(true);
  });
  it("rejects virtual items, unconverted candidates, a dropped passage set, a missing FRQ type and reuse across saved sets", () => {
    expect(planDraftSet({ ...base(), hasVirtual: true } as never).problems.join()).toMatch(/가상 문항/);
    const pool = poolFor(); pool[0].purpose = null;
    expect(planDraftSet({ ...base(), pool } as never).problems.join()).toMatch(/변환·검증이 끝나지 않은 문항/);
    expect(planDraftSet({ ...base(), keys: { ...keys, mcA: keys.mcA.slice(1) } } as never).ok).toBe(false);
    expect(planDraftSet({ ...base(), keys: { ...keys, frqA: keys.frqA.slice(1) } } as never).problems.join()).toMatch(/FRQ/);
    const existing: FullSetUsage[] = [{ id: "x", name: "other", status: "draft", problemIds: ["p0-0"], candidateKeys: [keys.mcA[0]] }];
    expect(planDraftSet({ ...base(), existingFullSets: existing } as never).problems.join()).toMatch(/다른 풀 세트가 이미 쓰는 문항/);
    const short = poolFor(); short[0].ap_candidate_problems = short[0].ap_candidate_problems!.slice(1);
    expect(planDraftSet({ ...base(), pool: short } as never).problems.join()).toMatch(/변환 문제/);
  });
});
