import { describe, expect, it } from "vitest";
import { planDraftSet, subjectOfSetIdOrNull, SET_ID_RE, defaultDraftName, type FullSetUsage, type PoolRow, type SetKeys } from "./assemble-draft";
import { LIB_FRQ, LIB_SETS, LIB_SINGLES, solveCsSets, toReportSet } from "../../scripts/ap-generation/cs-assign";
import type { CsItem } from "../../scripts/ap-generation/cs-pool";

// CS A 풀 세트 초안 계획(DB 없음): 아직 커밋된 배정 보고서·재고가 없으므로(유료 생성 전) 라이브러리 구조대로 만든 합성 재고를 배정기로 풀어 얻은 키를 쓰고, 변환 상태만 가짜 풀로 주입한다.
let n = 0;
const single = (e: { id: string; topic: string; skill: string }, copy: number): CsItem => ({ key: `m${n++}`, kind: "mc", shared: false, members: [{ unit: Number(e.topic.split(".")[0]), skill: e.skill, topic: e.topic }], fam: `${e.id}|${copy}`, frqType: "", archetype: e.id, screen: true, batch: "t", renderType: "none", stimKind: "none", exam: 0 });
const set = (e: (typeof LIB_SETS)[number], copy: number): CsItem => ({ key: `s${n++}`, kind: "mc", shared: true, members: e.members.map((m) => ({ unit: m.unit, skill: m.skill, topic: `${m.unit}.1` })), fam: `${e.id}|${copy}`, frqType: "", archetype: e.id, screen: true, batch: "t", renderType: "none", stimKind: "none", exam: 0 });
const frq = (e: { id: string; type: string }): CsItem => ({ key: `f-${e.id}-${n++}`, kind: "frq", shared: false, members: [], fam: `ff-${e.id}`, frqType: e.type, archetype: e.id, screen: true, batch: "t", renderType: "text", stimKind: "text", exam: 0 });
const st: CsItem[] = [...LIB_SINGLES.flatMap((e) => [0, 1].map((c) => single(e, c))), ...LIB_SETS.flatMap((e) => [0, 1].map((c) => set(e, c))), ...LIB_FRQ.map(frq)];
const solved = solveCsSets(["CS1", "CS2"], st, { timeMs: 120000 });
const reports = solved.out.map(toReportSet);
const cs1 = reports.find((s) => s.id === "CS1")!;
const stockBy = new Map(st.map((c) => [c.key, c]));
const keys: SetKeys = { mcA: cs1.mcA, mcB: cs1.mcB ?? [], frqA: cs1.frqA, frqB: cs1.frqB ?? [] };
const poolFor = (o: Partial<PoolRow> = {}): PoolRow[] => [...keys.mcA, ...keys.frqA].map((k, i) => {
  const c = stockBy.get(k)!; const m = c.kind === "mc" ? c.members.length : 1;
  return { candidate_key: k, kind: c.kind === "mc" ? "mc" : "frq_bundle", keyword_code: c.members[0]?.topic ?? "2.9", difficulty_provisional: "exam_prep", purpose: "mock_exam", is_current: true, render_verified: true, screen_verified: true,
    ap_candidate_problems: Array.from({ length: m }, (_, j) => ({ item_index: j, problem_id: `p${i}-${j}`, problem_version_id: `v${i}-${j}` })), ...o };
});
const base = () => ({ setId: "CS1", keys, hasVirtual: false, pool: poolFor(), existingFullSets: [] as FullSetUsage[], publishedKeys: new Set<string>(), stock: [], csaStock: st });

describe("planDraftSet for ap_computer_science_a", () => {
  it("CS is a known set prefix and the synthetic assignment has no virtual cells", () => {
    expect(subjectOfSetIdOrNull("CS2")).toBe("ap_computer_science_a"); expect(SET_ID_RE.test("CS1")).toBe(true); expect(SET_ID_RE.test("CX1")).toBe(false);
    expect(defaultDraftName("CS2")).toBe("AP Computer Science A — Practice Exam 2");
    for (const s of reports) { expect(s.virtual).toHaveLength(0); expect(s.virtualSets).toHaveLength(0); expect(s.frqVirtual).toHaveLength(0); }
  }, 180000);
  it("the plan for the assignment is saveable: 42 MC problems (singles plus two-question sets), 4 FRQ", () => {
    const p = planDraftSet(base() as never);
    expect(p.problems).toEqual([]); expect(p.ok).toBe(true);
    expect(p.composition).toMatchObject({ mcTotal: 42, frqTotal: 4 });
    expect(p.items.filter((i) => i.sectionKey === "ap_mc").map((i) => i.position)).toEqual(Array.from({ length: 42 }, (_, i) => i + 1));
    expect(p.layout.sections).toHaveLength(2);
  });
  it("rejects virtual items, unconverted candidates, a dropped item, a missing FRQ type and reuse across saved sets", () => {
    expect(planDraftSet({ ...base(), hasVirtual: true } as never).problems.join()).toMatch(/가상 문항/);
    const pool = poolFor(); pool[0].purpose = null;
    expect(planDraftSet({ ...base(), pool } as never).problems.join()).toMatch(/변환·검증이 끝나지 않은 문항/);
    expect(planDraftSet({ ...base(), keys: { ...keys, mcA: keys.mcA.slice(1) } } as never).ok).toBe(false);
    expect(planDraftSet({ ...base(), keys: { ...keys, frqA: keys.frqA.slice(1) } } as never).problems.join()).toMatch(/FRQ/);
    const existing: FullSetUsage[] = [{ id: "x", name: "other", status: "draft", problemIds: ["p0-0"], candidateKeys: [keys.mcA[0]] }];
    expect(planDraftSet({ ...base(), existingFullSets: existing } as never).problems.join()).toMatch(/다른 풀 세트가 이미 쓰는 문항/);
  });
  it("a two-question set stays together: both problems are saved in consecutive positions", () => {
    const p = planDraftSet(base() as never);
    const setKey = keys.mcA.find((k) => stockBy.get(k)!.shared)!;
    const pos = p.items.filter((i) => i.candidateKey === setKey).map((i) => i.position);
    expect(pos).toHaveLength(2); expect(pos[1]).toBe(pos[0] + 1);
  });
});
