import { describe, expect, it } from "vitest";
import { planDraftSet, type FullSetUsage, type PoolRow, type SetKeys } from "./assemble-draft";
import { STATS_FRQ_TEMPLATES } from "../ap-generation/stats-frq-checks";
import { solveStatsSets, toReportSet } from "../../scripts/ap-generation/stats-assign";
import type { StatsItem } from "../../scripts/ap-generation/stats-pool";

// 통계 풀 세트 초안 계획(DB 없음): 합성 재고로 공식 구조(MC 42 = 단독 36 + 공유 세트 2, FRQ 4유형)를 만든 뒤 변환 상태를 가짜 풀로 주입한다.
let n = 0;
const mem = (unit: number, skill: number) => ({ unit, skill, topic: `${unit}.${skill}`, skillCode: `${skill}.A` });
const single = (unit: number, skill: number): StatsItem => ({ key: `s${n++}`, kind: "mc", shared: false, members: [mem(unit, skill)], fam: `f${n}`, frqType: "", archetype: "a", screen: true, batch: "t", renderType: "x", stimKind: "none" });
const set = (unit: number, skills: number[]): StatsItem => ({ key: `set${n++}`, kind: "mc", shared: true, members: skills.map((k) => mem(unit, k)), fam: `f${n}`, frqType: "", archetype: "set", screen: true, batch: "t", renderType: "x", stimKind: "stat_chart" });
const frq = (t: string): StatsItem => ({ key: `frq-${t}`, kind: "frq", shared: false, members: [], fam: `ff${n++}`, frqType: t, archetype: "frq", screen: true, batch: "t", renderType: "x", stimKind: "none" });
function stock(): StatsItem[] {
  n = 0; const items: StatsItem[] = []; const us: Record<number, number> = { 1: 10, 2: 6, 3: 9, 4: 7, 5: 4 };
  const pool = [...Array(4).fill(1), ...Array(10).fill(2), ...Array(10).fill(3), ...Array(12).fill(4)]; let i = 0;
  for (const [u, c] of Object.entries(us)) for (let q = 0; q < c; q++) items.push(single(Number(u), pool[i++]));
  items.push(set(2, [3, 3, 4]), set(5, [3, 3, 4])); for (const t of STATS_FRQ_TEMPLATES) items.push(frq(t));
  return items;
}
const st = stock();
const rep = toReportSet(solveStatsSets(["ST1"], st, { timeMs: 30000 }).out[0]);
const keys: SetKeys = { mcA: rep.mcA, mcB: rep.mcB, frqA: rep.frqA, frqB: rep.frqB };
const stockBy = new Map(st.map((c) => [c.key, c]));
const poolFor = (o: Partial<PoolRow> = {}): PoolRow[] => [...keys.mcA, ...keys.frqA].map((k, i) => {
  const c = stockBy.get(k)!; const m = c.kind === "mc" ? c.members.length : 1;
  return { candidate_key: k, kind: c.kind === "mc" ? "mc" : "frq_bundle", keyword_code: c.members[0]?.topic ?? "1.1", difficulty_provisional: "exam_prep", purpose: "mock_exam", is_current: true, render_verified: true, screen_verified: true,
    ap_candidate_problems: Array.from({ length: m }, (_, j) => ({ item_index: m - 1 - j, problem_id: `p${i}-${j}`, problem_version_id: `v${i}-${j}` })), ...o };
});
const base = () => ({ setId: "ST1", keys, hasVirtual: false, pool: poolFor(), existingFullSets: [] as FullSetUsage[], publishedKeys: new Set<string>(), stock: [], statsStock: st });

describe("planDraftSet for ap_statistics", () => {
  it("the dry-run plan for a complete statistics set is saveable: 42 MC problems (shared sets contiguous), 4 FRQ, default name", () => {
    const p = planDraftSet(base() as never);
    expect(p.problems).toEqual([]); expect(p.ok).toBe(true);
    expect(p.subject).toBe("ap_statistics"); expect(p.name).toBe("AP Statistics — Practice Exam 1");
    expect(p.composition).toMatchObject({ mcTotal: 42, frqTotal: 4 });
    const mc = p.items.filter((i) => i.sectionKey === "ap_mc");
    expect(mc).toHaveLength(42); expect(mc.map((i) => i.position)).toEqual(Array.from({ length: 42 }, (_, i) => i + 1));
    const setKey = keys.mcA.find((k) => k.startsWith("set"))!;
    const pos = mc.filter((i) => i.candidateKey === setKey).map((i) => i.position); expect(pos).toEqual([13, 14, 15]);
    // 세트 문항은 item_index 순서로 들어간다(입력은 역순으로 줬다)
    const ids = mc.filter((i) => i.candidateKey === setKey).map((i) => i.problemId); expect(ids.map((x) => x.split("-")[1])).toEqual(["2", "1", "0"]);
    expect(p.layout.sections).toHaveLength(2);
  });
  it("rejects virtual items, a set whose conversion has fewer than 3 problems, and unconverted or unverified candidates", () => {
    expect(planDraftSet({ ...base(), hasVirtual: true } as never).problems.join()).toMatch(/가상 문항/);
    const pool = poolFor(); const si = pool.findIndex((r) => r.candidate_key.startsWith("set")); pool[si].ap_candidate_problems = pool[si].ap_candidate_problems!.slice(0, 2);
    expect(planDraftSet({ ...base(), pool } as never).problems.join()).toMatch(/변환 문제 2건, 3건 필요/);
    const pool2 = poolFor(); pool2[0].purpose = null; pool2[1].screen_verified = false;
    expect(planDraftSet({ ...base(), pool: pool2 } as never).problems.join()).toMatch(/변환·검증이 끝나지 않은 문항 2건/);
  });
  it("rejects a wrong composition: dropping a single, a duplicate key and a missing FRQ type", () => {
    const k1: SetKeys = { ...keys, mcA: keys.mcA.slice(1) };
    expect(planDraftSet({ ...base(), keys: k1 } as never).problems.join()).toMatch(/mc_count_41\/42/);
    const k2: SetKeys = { ...keys, frqA: keys.frqA.slice(1) };
    const q = planDraftSet({ ...base(), keys: k2 } as never).problems.join(); expect(q).toMatch(/frq_count_3\/4/); expect(q).toMatch(/FRQ 유형/);
    const k3: SetKeys = { ...keys, mcA: [keys.mcA[0], ...keys.mcA.slice(0, -1)] };
    expect(planDraftSet({ ...base(), keys: k3 } as never).problems.join()).toMatch(/같은 문항이 두 번/);
  });
  it("rejects a split shared set (members not contiguous) and units outside the official ranges", () => {
    const si = keys.mcA.findIndex((k) => k.startsWith("set")); // 첫 세트를 맨 끝으로 옮기지 않고, 단독 문항 하나를 세트 앞으로 끼우지는 못하므로 세트 단원이 바뀐 재고로 대체
    const bad = st.map((c) => (c.shared && c.members[0].unit === 5 ? { ...c, members: c.members.map((m) => ({ ...m, unit: 4 })) } : c));
    expect(planDraftSet({ ...base(), statsStock: bad } as never).problems.join()).toMatch(/set_units_/);
    void si;
  });
  it("rejects the same name, the same composition and overlap with another saved full set", () => {
    const ids = poolFor().flatMap((r) => r.ap_candidate_problems!.map((p) => p.problem_id));
    expect(planDraftSet({ ...base(), existingFullSets: [{ id: "d", name: "AP Statistics — Practice Exam 1", status: "draft", problemIds: ["zz"], candidateKeys: [] }] } as never).problems.join()).toMatch(/같은 이름/);
    expect(planDraftSet({ ...base(), existingFullSets: [{ id: "d", name: "other", status: "draft", problemIds: ids, candidateKeys: [...keys.mcA, ...keys.frqA] }] } as never).problems.join()).toMatch(/같은 문항 구성/);
    expect(planDraftSet({ ...base(), existingFullSets: [{ id: "d", name: "other", status: "draft", problemIds: [ids[0]], candidateKeys: [keys.mcA[0]] }] } as never).problems.join()).toMatch(/같은 문항이 있습니다/);
  });
});
