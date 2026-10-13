import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { planDraftSet, subjectOfSetIdOrNull, SET_ID_RE, defaultDraftName, type FullSetUsage, type PoolRow, type SetKeys } from "./assemble-draft";
import { loadMicroPool } from "../../scripts/ap-generation/micro-pool";
import { MICRO_FRQ_PROFILES } from "../ap-exam/micro-rules";

// 마이크로 풀 세트 초안 계획(DB 없음): 커밋된 정확 배정 보고서(MI1·MI2)의 키 + 커밋된 재고로, 변환 상태만 가짜 풀로 주입한다.
const report = JSON.parse(readFileSync("data/ap/stock/exact-assign-micro-mi1-mi2.json", "utf-8")) as { sets: { id: string; mcA: string[]; mcB: string[]; frqA: string[]; frqB: string[]; virtual?: unknown[]; frqVirtual?: unknown[] }[] };
const { pool: st } = loadMicroPool({ requireScreen: true });
const stockBy = new Map(st.map((c) => [c.key, c]));
const mi = (id: string) => report.sets.find((s) => s.id === id)!;
const keysOf = (id: string): SetKeys => ({ mcA: mi(id).mcA, mcB: mi(id).mcB ?? [], frqA: mi(id).frqA, frqB: mi(id).frqB ?? [] });
const poolFor = (keys: SetKeys, o: Partial<PoolRow> = {}): PoolRow[] => [...keys.mcA, ...keys.frqA].map((k, i) => {
  const c = stockBy.get(k)!;
  return { candidate_key: k, kind: c.kind === "mc" ? "mc" : "frq_bundle", keyword_code: c.members[0]?.topic ?? "1.1", difficulty_provisional: "exam_prep", purpose: "mock_exam", is_current: true, render_verified: true, screen_verified: true,
    ap_candidate_problems: [{ item_index: 0, problem_id: `p${i}`, problem_version_id: `v${i}` }], ...o };
});
const base = (id: string) => ({ setId: id, keys: keysOf(id), hasVirtual: false, pool: poolFor(keysOf(id)), existingFullSets: [] as FullSetUsage[], publishedKeys: new Set<string>(), stock: [], microStock: st });

describe("planDraftSet for ap_microeconomics", () => {
  it("MI is a known set prefix and the committed report has no virtual cells and no shared items", () => {
    expect(subjectOfSetIdOrNull("MI2")).toBe("ap_microeconomics"); expect(SET_ID_RE.test("MI1")).toBe(true);
    expect(defaultDraftName("MI2")).toBe("AP Microeconomics — Practice Exam 2");
    for (const s of report.sets) { expect(s.virtual ?? []).toHaveLength(0); expect(s.frqVirtual ?? []).toHaveLength(0); }
    const a = new Set([...mi("MI1").mcA, ...mi("MI1").frqA]); expect([...mi("MI2").mcA, ...mi("MI2").frqA].filter((k) => a.has(k))).toEqual([]);
  });
  it("the plans for the committed MI1 and MI2 assignments are saveable: 60 MC problems, 3 FRQ (1 long + 2 short = 20 points)", () => {
    for (const id of ["MI1", "MI2"]) {
      const p = planDraftSet(base(id) as never);
      expect({ id, problems: p.problems }).toEqual({ id, problems: [] }); expect(p.ok).toBe(true);
      expect(p.composition).toMatchObject({ mcTotal: 60, frqTotal: 3 });
      expect(p.items.filter((i) => i.sectionKey === "ap_mc").map((i) => i.position)).toEqual(Array.from({ length: 60 }, (_, i) => i + 1));
      expect(mi(id).frqA.map((k) => MICRO_FRQ_PROFILES[stockBy.get(k)!.frqType].points).sort((a, b) => a - b)).toEqual([5, 5, 10]);
    }
  });
  it("the two exams use different FRQ types", () => {
    const t = (id: string) => mi(id).frqA.map((k) => stockBy.get(k)!.frqType);
    expect(t("MI1").filter((x) => t("MI2").includes(x))).toEqual([]);
  });
  it("rejects virtual items, unconverted candidates, a dropped item, a skill-category violation, and reuse across saved sets", () => {
    expect(planDraftSet({ ...base("MI1"), hasVirtual: true } as never).problems.join()).toMatch(/가상 문항/);
    const pool = poolFor(keysOf("MI1")); pool[0].purpose = null;
    expect(planDraftSet({ ...base("MI1"), pool } as never).problems.join()).toMatch(/변환·검증이 끝나지 않은 문항/);
    expect(planDraftSet({ ...base("MI1"), keys: { ...keysOf("MI1"), mcA: keysOf("MI1").mcA.slice(1) } } as never).ok).toBe(false);
    const swapped = { ...keysOf("MI1"), frqA: [...keysOf("MI1").frqA.slice(0, 2), ...keysOf("MI2").frqA.slice(0, 1)] };
    expect(planDraftSet({ ...base("MI1"), keys: swapped, pool: poolFor(swapped) } as never).ok).toBe(false);
    const existing: FullSetUsage[] = [{ id: "x", name: "other", status: "draft", problemIds: ["p0"], candidateKeys: [keysOf("MI1").mcA[0]] }];
    expect(planDraftSet({ ...base("MI1"), existingFullSets: existing } as never).problems.join()).toMatch(/다른 풀 세트가 이미 쓰는 문항/);
  });
});
