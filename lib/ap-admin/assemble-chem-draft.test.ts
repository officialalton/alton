import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { planDraftSet, subjectOfSetIdOrNull, SET_ID_RE, defaultDraftName, type FullSetUsage, type PoolRow, type SetKeys } from "./assemble-draft";
import { loadChemPool } from "../../scripts/ap-generation/chem-pool";

// 화학 풀 세트 초안 계획(DB 없음): 커밋된 정확 배정 보고서(CH1·CH2)의 키 + 커밋된 재고로, 변환 상태만 가짜 풀로 주입한다.
const report = JSON.parse(readFileSync("data/ap/stock/exact-assign-chem-ch1-ch2.json", "utf-8")) as { sets: { id: string; mcA: string[]; mcB: string[]; frqA: string[]; frqB: string[]; virtual?: unknown[] }[] };
const { pool: st } = loadChemPool({ requireScreen: true });
const stockBy = new Map(st.map((c) => [c.key, c]));
const ch1 = report.sets.find((s) => s.id === "CH1")!;
const keys: SetKeys = { mcA: ch1.mcA, mcB: ch1.mcB ?? [], frqA: ch1.frqA, frqB: ch1.frqB ?? [] };
const poolFor = (o: Partial<PoolRow> = {}): PoolRow[] => [...keys.mcA, ...keys.frqA].map((k, i) => {
  const c = stockBy.get(k)!; const m = c.kind === "mc" ? c.members.length : 1;
  return { candidate_key: k, kind: c.kind === "mc" ? "mc" : "frq_bundle", keyword_code: c.members[0]?.topic ?? "1.1", difficulty_provisional: "exam_prep", purpose: "mock_exam", is_current: true, render_verified: true, screen_verified: true,
    ap_candidate_problems: Array.from({ length: m }, (_, j) => ({ item_index: j, problem_id: `p${i}-${j}`, problem_version_id: `v${i}-${j}` })), ...o };
});
const base = () => ({ setId: "CH1", keys, hasVirtual: false, pool: poolFor(), existingFullSets: [] as FullSetUsage[], publishedKeys: new Set<string>(), stock: [], chemStock: st });

describe("planDraftSet for ap_chemistry", () => {
  it("CH is a known set prefix and the committed report has no virtual cells", () => {
    expect(subjectOfSetIdOrNull("CH2")).toBe("ap_chemistry"); expect(SET_ID_RE.test("CH1")).toBe(true);
    expect(defaultDraftName("CH2")).toBe("AP Chemistry — Practice Exam 2");
    for (const s of report.sets) expect(s.virtual ?? []).toHaveLength(0);
  });
  it("the plan for the committed CH1 assignment is saveable: 60 MC problems, 7 FRQ", () => {
    const p = planDraftSet(base() as never);
    expect(p.problems).toEqual([]); expect(p.ok).toBe(true);
    expect(p.composition).toMatchObject({ mcTotal: 60, frqTotal: 7 });
    expect(p.items.filter((i) => i.sectionKey === "ap_mc").map((i) => i.position)).toEqual(Array.from({ length: 60 }, (_, i) => i + 1));
  });
  it("rejects virtual items, unconverted candidates, a dropped item, and reuse across saved sets", () => {
    expect(planDraftSet({ ...base(), hasVirtual: true } as never).problems.join()).toMatch(/가상 문항/);
    const pool = poolFor(); pool[0].purpose = null;
    expect(planDraftSet({ ...base(), pool } as never).problems.join()).toMatch(/변환·검증이 끝나지 않은 문항/);
    expect(planDraftSet({ ...base(), keys: { ...keys, mcA: keys.mcA.slice(1) } } as never).ok).toBe(false);
    const existing: FullSetUsage[] = [{ id: "x", name: "other", status: "draft", problemIds: ["p0-0"], candidateKeys: [keys.mcA[0]] }];
    expect(planDraftSet({ ...base(), existingFullSets: existing } as never).problems.join()).toMatch(/다른 풀 세트가 이미 쓰는 문항/);
  });
});
