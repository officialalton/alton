import { describe, expect, it } from "vitest";
import { planDraftSet, type FullSetUsage, type PoolRow, type SetKeys } from "./assemble-draft";
import { buildElOrder, officialClass, solveElSets, toReportSet, verifyElAssignment } from "../../scripts/ap-generation/el-assign";
import type { ElItem } from "../../scripts/ap-generation/el-pool";
import { planSets } from "../ap-generation/englang-plan";
import { elangCategoryOf } from "../ap-exam/elang-rules";

// 공식 5묶음 구조(읽기 2 × 11–14, 글쓰기 7–9 ×2 + 4–6): 합성 재고로 배정·초안 계획을 점검한다. 기존 레거시 구조(6~12묶음) 테스트는 assemble-elang-draft.test.ts 가 계속 본다.
let n = 0;
const sets = (kind: "reading" | "writing", count: number, per: number, seed: number): ElItem[] => planSets({ kind, sets: count, perSet: per, seed }).map((s) => ({ key: `${kind[0]}${per}-${n++}`, kind: "mc" as const, section: kind, members: s.skills.map((k) => ({ skill: k, cat: elangCategoryOf(k)!, topic: "U1.1" })), fam: `fam-${n}`, frqType: "", archetype: `el_${kind}_${s.id}`, screen: true, batch: "t", renderType: "none", stimKind: "none", conf: 0.95, exam: s.skills.length }));
const frq = (t: string, i: number): ElItem => ({ key: `f-${t}-${i}`, kind: "frq", section: null, members: [], fam: `ff-${t}-${i}`, frqType: t, archetype: `elfrq_${t}${i}`, screen: true, batch: "t", renderType: "none", stimKind: "none", conf: 1, exam: 0 });
const stock: ElItem[] = [...sets("reading", 4, 12, 31), ...sets("writing", 4, 8, 32), ...sets("writing", 2, 5, 33), ...["q1", "q2", "q3"].flatMap((t) => [0, 1].map((i) => frq(t, i)))];
const solved = solveElSets(["EL1", "EL2"], stock, { timeMs: 120000, official: true });

describe("official 5-set assignment (synthetic stock)", () => {
  it("is feasible, passes the independent verifier, uses 2 reading + 2 long writing + 1 short writing per exam and keeps exams disjoint", () => {
    expect(solved.res.status).toBe("optimal"); expect(verifyElAssignment(solved.out)).toEqual([]);
    for (const r of solved.out) { expect(r.sets.filter((c) => officialClass(c) === "r")).toHaveLength(2); expect(r.sets.filter((c) => officialClass(c) === "wl")).toHaveLength(2); expect(r.sets.filter((c) => officialClass(c) === "ws")).toHaveLength(1); expect(buildElOrder(r)).toHaveLength(45); }
    const k = (i: number) => new Set(solved.out[i].sets.map((c) => c.key)); expect([...k(0)].some((x) => k(1).has(x))).toBe(false);
  }, 180000);
  it("writing sets are ordered long, long, short and the draft plan is saveable with 45 MC problems", () => {
    const rep = toReportSet(solved.out[0]); const stockBy = new Map(stock.map((c) => [c.key, c]));
    const sizes = rep.mcA.map((k) => stockBy.get(k)!.members.length); const w = rep.mcA.map((k, i) => (stockBy.get(k)!.section === "writing" ? sizes[i] : 0)).filter(Boolean); expect(w[0]).toBeGreaterThanOrEqual(7); expect(w[2]).toBeLessThanOrEqual(6);
    const keys: SetKeys = { mcA: rep.mcA, mcB: [], frqA: rep.frqA, frqB: [] };
    const pool: PoolRow[] = [...keys.mcA, ...keys.frqA].map((k, i) => { const c = stockBy.get(k)!; const m = c.kind === "mc" ? c.members.length : 1; return { candidate_key: k, kind: c.kind === "mc" ? "mc" : "frq_bundle", keyword_code: "U1.1", difficulty_provisional: "exam_prep", purpose: "mock_exam", is_current: true, render_verified: true, screen_verified: true, ap_candidate_problems: Array.from({ length: m }, (_, j) => ({ item_index: j, problem_id: `p${i}-${j}`, problem_version_id: `v${i}-${j}` })) } as PoolRow; });
    const p = planDraftSet({ setId: "EL1", keys, hasVirtual: false, pool, existingFullSets: [] as FullSetUsage[], publishedKeys: new Set<string>(), stock: [], elStock: stock } as never);
    expect(p.problems).toEqual([]); expect(p.ok).toBe(true); expect(p.composition).toMatchObject({ mcTotal: 45, frqTotal: 3 });
  });
});
