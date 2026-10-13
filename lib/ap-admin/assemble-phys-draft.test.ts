import { describe, expect, it } from "vitest";
import { planDraftSet, subjectOfSetIdOrNull, SET_ID_RE, defaultDraftName, type FullSetUsage, type PoolRow, type SetKeys } from "./assemble-draft";
import { PHYS_FRQ_TEMPLATES } from "../ap-exam/full-set-rules";
import { solvePhysSets, toReportSet } from "../../scripts/ap-generation/phys-assign";
import type { PhysItem } from "../../scripts/ap-generation/phys-pool";

// 물리 풀 세트 초안 계획(DB 없음): 합성 재고로 공식 구조(MC 42 = 단독 38 + 2문항 공유 세트 2, FRQ 4유형)를 만든 뒤 변환 상태를 가짜 풀로 주입한다.
let n = 0;
const mem = (unit: number, skill: string) => ({ unit, skill, topic: `${unit}.1` });
const single = (unit: number, skill = "2.B"): PhysItem => ({ key: `s${n++}`, kind: "mc", shared: false, members: [mem(unit, skill)], fam: `f${n}`, frqType: "", archetype: "a", screen: true, batch: "t", renderType: "x", stimKind: "none" });
const set = (unit: number, skills = ["2.B", "3.B"]): PhysItem => ({ key: `set${n++}`, kind: "mc", shared: true, members: skills.map((k) => mem(unit, k)), fam: `f${n}`, frqType: "", archetype: "set", screen: true, batch: "t", renderType: "x", stimKind: "diagram" });
const frq = (t: string): PhysItem => ({ key: `frq-${t}`, kind: "frq", shared: false, members: [], fam: `ff${n++}`, frqType: t, archetype: "frq", screen: true, batch: "t", renderType: "x", stimKind: "none" });
function stock(): PhysItem[] {
  n = 0; const items: PhysItem[] = []; const us: Record<number, number> = { 1: 3, 2: 8, 3: 8, 4: 5, 5: 5, 6: 1, 7: 3, 8: 5 };
  for (const [u, c] of Object.entries(us)) for (let q = 0; q < c; q++) items.push(single(Number(u)));
  items.push(set(1), set(6)); for (const t of PHYS_FRQ_TEMPLATES) items.push(frq(t));
  return items;
}
const st = stock();
const rep = toReportSet(solvePhysSets(["PH1"], st, { timeMs: 30000 }).out[0]);
const keys: SetKeys = { mcA: rep.mcA, mcB: rep.mcB, frqA: rep.frqA, frqB: rep.frqB };
const stockBy = new Map(st.map((c) => [c.key, c]));
const poolFor = (o: Partial<PoolRow> = {}): PoolRow[] => [...keys.mcA, ...keys.frqA].map((k, i) => {
  const c = stockBy.get(k)!; const m = c.kind === "mc" ? c.members.length : 1;
  return { candidate_key: k, kind: c.kind === "mc" ? "mc" : "frq_bundle", keyword_code: c.members[0]?.topic ?? "1.1", difficulty_provisional: "exam_prep", purpose: "mock_exam", is_current: true, render_verified: true, screen_verified: true,
    ap_candidate_problems: Array.from({ length: m }, (_, j) => ({ item_index: m - 1 - j, problem_id: `p${i}-${j}`, problem_version_id: `v${i}-${j}` })), ...o };
});
const base = () => ({ setId: "PH1", keys, hasVirtual: false, pool: poolFor(), existingFullSets: [] as FullSetUsage[], publishedKeys: new Set<string>(), stock: [], physStock: st });

describe("planDraftSet for ap_physics_1", () => {
  it("PH is a known set prefix mapping to ap_physics_1 and saveable ids are AB|BC|ST|PH + digit", () => {
    expect(subjectOfSetIdOrNull("PH2")).toBe("ap_physics_1"); expect(SET_ID_RE.test("PH1")).toBe(true); expect(SET_ID_RE.test("PX1")).toBe(false);
    expect(defaultDraftName("PH2")).toBe("AP Physics 1 — Practice Exam 2");
  });
  it("the dry-run plan for a complete physics set is saveable: 42 MC problems (2-question sets contiguous), 4 FRQ, default name", () => {
    const p = planDraftSet(base() as never);
    expect(p.problems).toEqual([]); expect(p.ok).toBe(true);
    expect(p.subject).toBe("ap_physics_1"); expect(p.name).toBe("AP Physics 1 — Practice Exam 1");
    expect(p.composition).toMatchObject({ mcTotal: 42, frqTotal: 4 });
    const mc = p.items.filter((i) => i.sectionKey === "ap_mc");
    expect(mc).toHaveLength(42); expect(mc.map((i) => i.position)).toEqual(Array.from({ length: 42 }, (_, i) => i + 1));
    for (const setKey of keys.mcA.filter((k) => k.startsWith("set"))) {
      const pos = mc.filter((i) => i.candidateKey === setKey).map((i) => i.position); expect(pos).toHaveLength(2); expect(pos[1] - pos[0]).toBe(1);
      const ids = mc.filter((i) => i.candidateKey === setKey).map((i) => i.problemId); expect(ids.map((x) => x.split("-")[1])).toEqual(["1", "0"]); // item_index 순서(입력은 역순)
    }
    expect(p.layout.sections).toHaveLength(2);
    // FRQ 는 MR·TBR·LAB·QQT 순서
    expect(p.items.filter((i) => i.sectionKey === "ap_frq").map((i) => i.candidateKey)).toEqual(PHYS_FRQ_TEMPLATES.map((t) => `frq-${t}`));
  });
  it("rejects virtual items, a set whose conversion has fewer than 2 problems, and unconverted or unverified candidates", () => {
    expect(planDraftSet({ ...base(), hasVirtual: true } as never).problems.join()).toMatch(/가상 문항/);
    const pool = poolFor(); const si = pool.findIndex((r) => r.candidate_key.startsWith("set")); pool[si].ap_candidate_problems = pool[si].ap_candidate_problems!.slice(0, 1);
    expect(planDraftSet({ ...base(), pool } as never).problems.join()).toMatch(/변환 문제 1건, 2건 필요/);
    const pool2 = poolFor(); pool2[0].purpose = null; pool2[1].screen_verified = false;
    expect(planDraftSet({ ...base(), pool: pool2 } as never).problems.join()).toMatch(/변환·검증이 끝나지 않은 문항 2건/);
  });
  it("rejects a wrong composition: dropping a single, a duplicate key, a missing FRQ type and an out-of-range unit", () => {
    const k1: SetKeys = { ...keys, mcA: keys.mcA.slice(1) };
    expect(planDraftSet({ ...base(), keys: k1 } as never).problems.join()).toMatch(/mc_count_41\/42/);
    const k2: SetKeys = { ...keys, frqA: keys.frqA.slice(1) };
    const q = planDraftSet({ ...base(), keys: k2 } as never).problems.join(); expect(q).toMatch(/frq_count_3\/4/); expect(q).toMatch(/FRQ 유형/);
    const k3: SetKeys = { ...keys, mcA: [keys.mcA[0], ...keys.mcA.slice(0, -1)] };
    expect(planDraftSet({ ...base(), keys: k3 } as never).problems.join()).toMatch(/같은 문항이 두 번/);
    const st2 = st.map((c) => (c.key === keys.mcA.find((k) => !k.startsWith("set") && stockBy.get(k)!.members[0].unit === 3) ? { ...c, members: [mem(2, "2.B")] } : c));
    expect(planDraftSet({ ...base(), physStock: st2 } as never).problems.join()).toMatch(/unit_(2|3)_/);
  });
  it("rejects two items of the same family, reuse across saved full sets, and a same-named set", () => {
    const fam = st.map((c) => (c.key === keys.mcA[0] || c.key === keys.mcA[1] ? { ...c, fam: "samefam" } : c));
    expect(planDraftSet({ ...base(), physStock: fam } as never).problems.join()).toMatch(/문항군/);
    const existing: FullSetUsage[] = [{ id: "x", name: "other", status: "draft", problemIds: ["p0-0"], candidateKeys: [keys.mcA[0]] }];
    const q = planDraftSet({ ...base(), existingFullSets: existing } as never).problems.join(); expect(q).toMatch(/같은 문항이 있습니다/); expect(q).toMatch(/다른 풀 세트가 이미 쓰는 문항/);
    expect(planDraftSet({ ...base(), existingFullSets: [{ id: "y", name: "AP Physics 1 — Practice Exam 1", status: "draft", problemIds: [], candidateKeys: [] }] } as never).problems.join()).toMatch(/같은 이름/);
  });
});
