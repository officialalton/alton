import { describe, expect, it } from "vitest";
import { planDraftSet, subjectOfSetIdOrNull, SET_ID_RE, defaultDraftName, type FullSetUsage, type PoolRow, type SetKeys } from "./assemble-draft";
import { LIB_FRQ, LIB_SETS, LIB_SINGLES, solveBioSets, toReportSet } from "../../scripts/ap-generation/bio-assign";
import type { BioItem } from "../../scripts/ap-generation/bio-pool";

// Biology 풀 세트 초안 계획(DB 없음): 아직 커밋된 배정 보고서·재고가 없으므로(유료 생성 전) 라이브러리 구조대로 만든 합성 재고를 배정기로 풀어 얻은 키를 쓰고, 변환 상태만 가짜 풀로 주입한다.
let n = 0;
const single = (e: { id: string; topic: string; skill: string }, copy: number): BioItem => ({ key: `m${n++}`, kind: "mc", shared: false, members: [{ unit: Number(e.topic.split(".")[0]), skill: e.skill, topic: e.topic }], fam: `${e.id}|${copy}`, frqType: "", archetype: e.id, screen: true, batch: "t", renderType: "none", stimKind: "none", exam: 0 });
const set = (e: (typeof LIB_SETS)[number], copy: number): BioItem => ({ key: `s${n++}`, kind: "mc", shared: true, members: e.members.map((m) => ({ unit: m.unit, skill: m.skill, topic: `${m.unit}.1` })), fam: `${e.id}|${copy}`, frqType: "", archetype: e.id, screen: true, batch: "t", renderType: "none", stimKind: "none", exam: 0 });
const frq = (e: { id: string; type: string }): BioItem => ({ key: `f-${e.id}-${n++}`, kind: "frq", shared: false, members: [], fam: `ff-${e.id}`, frqType: e.type, archetype: e.id, screen: true, batch: "t", renderType: "text", stimKind: "text", exam: 0 });
const st: BioItem[] = [...LIB_SINGLES.flatMap((e) => [0, 1].map((c) => single(e, c))), ...LIB_SETS.flatMap((e) => [0, 1].map((c) => set(e, c))), ...LIB_FRQ.map(frq)];
const solved = solveBioSets(["BI1", "BI2"], st, { timeMs: 120000 });
const reports = solved.out.map(toReportSet);
const bi1 = reports.find((s) => s.id === "BI1")!;
const stockBy = new Map(st.map((c) => [c.key, c]));
const keys: SetKeys = { mcA: bi1.mcA, mcB: bi1.mcB ?? [], frqA: bi1.frqA, frqB: bi1.frqB ?? [] };
const poolFor = (o: Partial<PoolRow> = {}): PoolRow[] => [...keys.mcA, ...keys.frqA].map((k, i) => {
  const c = stockBy.get(k)!; const m = c.kind === "mc" ? c.members.length : 1;
  return { candidate_key: k, kind: c.kind === "mc" ? "mc" : "frq_bundle", keyword_code: c.members[0]?.topic ?? "2.9", difficulty_provisional: "exam_prep", purpose: "mock_exam", is_current: true, render_verified: true, screen_verified: true,
    ap_candidate_problems: Array.from({ length: m }, (_, j) => ({ item_index: j, problem_id: `p${i}-${j}`, problem_version_id: `v${i}-${j}` })), ...o };
});
const base = () => ({ setId: "BI1", keys, hasVirtual: false, pool: poolFor(), existingFullSets: [] as FullSetUsage[], publishedKeys: new Set<string>(), stock: [], bioStock: st });

describe("planDraftSet for ap_biology", () => {
  it("BI is a known set prefix and the synthetic assignment has no virtual cells", () => {
    expect(subjectOfSetIdOrNull("BI2")).toBe("ap_biology"); expect(SET_ID_RE.test("BI1")).toBe(true); expect(SET_ID_RE.test("CX1")).toBe(false);
    expect(defaultDraftName("BI2")).toBe("AP Biology — Practice Exam 2");
    for (const s of reports) { expect(s.virtual).toHaveLength(0); expect(s.virtualSets).toHaveLength(0); expect(s.frqVirtual).toHaveLength(0); }
  }, 180000);
  it("the plan for the assignment is saveable: 60 MC problems (singles plus two four-question sets), 6 FRQ", () => {
    const p = planDraftSet(base() as never);
    expect(p.problems).toEqual([]); expect(p.ok).toBe(true);
    expect(p.composition).toMatchObject({ mcTotal: 60, frqTotal: 6 });
    expect(p.items.filter((i) => i.sectionKey === "ap_mc").map((i) => i.position)).toEqual(Array.from({ length: 60 }, (_, i) => i + 1));
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
  it("a four-question set stays together: all four problems are saved in consecutive positions", () => {
    const p = planDraftSet(base() as never);
    const setKey = keys.mcA.find((k) => stockBy.get(k)!.shared)!;
    const pos = p.items.filter((i) => i.candidateKey === setKey).map((i) => i.position);
    expect(pos).toHaveLength(4); expect(pos.map((x, i) => x - pos[0] - i)).toEqual([0, 0, 0, 0]);
  });
});

describe("the committed BI1/BI2 exact assignment (data/ap/stock/exact-assign-bio-bi1-bi2.json)", () => {
  it("is a valid draft plan for both sets against the real stock, with no key shared between them", async () => {
    const { readFileSync } = await import("node:fs");
    const { planBioDraftSet, bioStockItems } = await import("./assemble-bio-draft");
    const rep = JSON.parse(readFileSync("data/ap/stock/exact-assign-bio-bi1-bi2.json", "utf-8")) as { sets: { id: string; mcA: string[]; mcB?: string[]; frqA: string[]; frqB?: string[]; virtual: unknown[]; virtualSets: unknown[]; frqVirtual: unknown[] }[] };
    const stock = bioStockItems(); const by = new Map(stock.map((c) => [c.key, c]));
    const used = new Map<string, string>();
    expect(rep.sets.map((s) => s.id)).toEqual(["BI1", "BI2"]);
    for (const s of rep.sets) {
      const k: SetKeys = { mcA: s.mcA, mcB: s.mcB ?? [], frqA: s.frqA, frqB: s.frqB ?? [] };
      const all = [...k.mcA, ...(k.mcB ?? []), ...k.frqA, ...(k.frqB ?? [])];
      for (const key of all) { expect(used.get(key)).toBeUndefined(); used.set(key, s.id); }
      const pool = all.map((key, i) => { const c = by.get(key)!; const m = c.kind === "mc" ? c.members.length : 1; return { candidate_key: key, kind: c.kind === "mc" ? "mc" : "frq_bundle", keyword_code: c.members[0]?.topic ?? "2.9", difficulty_provisional: "exam_prep", purpose: "mock_exam", is_current: true, render_verified: true, screen_verified: true, ap_candidate_problems: Array.from({ length: m }, (_, j) => ({ item_index: j, problem_id: `${s.id}p${i}-${j}`, problem_version_id: `${s.id}v${i}-${j}` })) } as PoolRow; });
      const p = planBioDraftSet({ setId: s.id, keys: k, hasVirtual: s.virtual.length + s.virtualSets.length + s.frqVirtual.length > 0, name: defaultDraftName(s.id), pool, existingFullSets: [], stock, subject: "ap_biology" } as never);
      expect({ id: s.id, problems: p.problems }).toEqual({ id: s.id, problems: [] });
      expect(p.composition).toMatchObject({ mcTotal: 60, frqTotal: 6 });
    }
  }, 120000);
});
