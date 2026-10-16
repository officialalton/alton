import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { planDraftSet, subjectOfSetIdOrNull, SET_ID_RE, defaultDraftName, type FullSetUsage, type PoolRow, type SetKeys } from "./assemble-draft";
import { loadMacroPool } from "../../scripts/ap-generation/macro-pool";
import { MACRO_FRQ_PROFILES } from "../ap-exam/macro-rules";

// 매크로 풀 세트 초안 계획(DB 없음): 커밋된 정확 배정 보고서(MA1·MA2)의 키 + 커밋된 재고로, 변환 상태만 가짜 풀로 주입한다.
const report = JSON.parse(readFileSync("data/ap/stock/exact-assign-macro-ma1-ma2.json", "utf-8")) as { sets: { id: string; mcA: string[]; mcB: string[]; frqA: string[]; frqB: string[]; virtual?: unknown[]; frqVirtual?: unknown[] }[] };
const { pool: st } = loadMacroPool({ requireScreen: true });
const stockBy = new Map(st.map((c) => [c.key, c]));
const ma = (id: string) => report.sets.find((s) => s.id === id)!;
const keysOf = (id: string): SetKeys => ({ mcA: ma(id).mcA, mcB: ma(id).mcB ?? [], frqA: ma(id).frqA, frqB: ma(id).frqB ?? [] });
const poolFor = (keys: SetKeys, o: Partial<PoolRow> = {}): PoolRow[] => [...keys.mcA, ...keys.frqA].map((k, i) => {
  const c = stockBy.get(k)!;
  return { candidate_key: k, kind: c.kind === "mc" ? "mc" : "frq_bundle", keyword_code: c.members[0]?.topic ?? "1.1", difficulty_provisional: "exam_prep", purpose: "mock_exam", is_current: true, render_verified: true, screen_verified: true,
    ap_candidate_problems: [{ item_index: 0, problem_id: `p${i}`, problem_version_id: `v${i}` }], ...o };
});
const base = (id: string) => ({ setId: id, keys: keysOf(id), hasVirtual: false, pool: poolFor(keysOf(id)), existingFullSets: [] as FullSetUsage[], publishedKeys: new Set<string>(), stock: [], macroStock: st });

describe("planDraftSet for ap_macroeconomics", () => {
  it("MA is a known set prefix and the committed report has no virtual cells and no shared items", () => {
    expect(subjectOfSetIdOrNull("MA2")).toBe("ap_macroeconomics"); expect(SET_ID_RE.test("MA1")).toBe(true);
    expect(defaultDraftName("MA2")).toBe("AP Macroeconomics — Practice Exam 2");
    for (const s of report.sets) { expect(s.virtual ?? []).toHaveLength(0); expect(s.frqVirtual ?? []).toHaveLength(0); }
    const a = new Set([...ma("MA1").mcA, ...ma("MA1").frqA]); expect([...ma("MA2").mcA, ...ma("MA2").frqA].filter((k) => a.has(k))).toEqual([]);
  });
  it("the plans for the committed MA1 and MA2 assignments are saveable: 60 MC problems, 3 FRQ (1 long + 2 short = 20 points)", () => {
    for (const id of ["MA1", "MA2"]) {
      const p = planDraftSet(base(id) as never);
      expect({ id, problems: p.problems }).toEqual({ id, problems: [] }); expect(p.ok).toBe(true);
      expect(p.composition).toMatchObject({ mcTotal: 60, frqTotal: 3 });
      expect(p.items.filter((i) => i.sectionKey === "ap_mc").map((i) => i.position)).toEqual(Array.from({ length: 60 }, (_, i) => i + 1));
      expect(ma(id).frqA.map((k) => MACRO_FRQ_PROFILES[stockBy.get(k)!.frqType].points).sort((a, b) => a - b)).toEqual([5, 5, 10]);
    }
  });
  it("the two exams use different FRQ types", () => {
    const t = (id: string) => ma(id).frqA.map((k) => stockBy.get(k)!.frqType);
    expect(t("MA1").filter((x) => t("MA2").includes(x))).toEqual([]);
  });
  it("rejects virtual items, unconverted candidates, a dropped item, a skill-category violation, and reuse across saved sets", () => {
    expect(planDraftSet({ ...base("MA1"), hasVirtual: true } as never).problems.join()).toMatch(/가상 문항/);
    const pool = poolFor(keysOf("MA1")); pool[0].purpose = null;
    expect(planDraftSet({ ...base("MA1"), pool } as never).problems.join()).toMatch(/변환·검증이 끝나지 않은 문항/);
    expect(planDraftSet({ ...base("MA1"), keys: { ...keysOf("MA1"), mcA: keysOf("MA1").mcA.slice(1) } } as never).ok).toBe(false);
    const swapped = { ...keysOf("MA1"), frqA: [...keysOf("MA1").frqA.slice(0, 2), ...keysOf("MA2").frqA.slice(0, 1)] };
    expect(planDraftSet({ ...base("MA1"), keys: swapped, pool: poolFor(swapped) } as never).ok).toBe(false);
    const existing: FullSetUsage[] = [{ id: "x", name: "other", status: "draft", problemIds: ["p0"], candidateKeys: [keysOf("MA1").mcA[0]] }];
    expect(planDraftSet({ ...base("MA1"), existingFullSets: existing } as never).problems.join()).toMatch(/다른 풀 세트가 이미 쓰는 문항/);
  });
});
