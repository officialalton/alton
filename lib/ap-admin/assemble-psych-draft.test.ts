import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { planDraftSet, subjectOfSetIdOrNull, SET_ID_RE, defaultDraftName, type FullSetUsage, type PoolRow, type SetKeys } from "./assemble-draft";
import { loadPsychPool } from "../../scripts/ap-generation/psych-pool";

// 심리학 풀 세트 초안 계획(DB 없음): 커밋된 정확 배정 보고서(PS1·PS2)의 키 + 커밋된 재고로, 변환 상태만 가짜 풀로 주입한다.
const report = JSON.parse(readFileSync("data/ap/stock/exact-assign-psych-ps1-ps2.json", "utf-8")) as { sets: { id: string; mcA: string[]; mcB: string[]; frqA: string[]; frqB: string[]; virtual?: unknown[]; virtualSets?: unknown[]; frqVirtual?: unknown[] }[] };
const { pool: st } = loadPsychPool({ requireScreen: true });
const stockBy = new Map(st.map((c) => [c.key, c]));
const ps = (id: string) => report.sets.find((s) => s.id === id)!;
const keysOf = (id: string): SetKeys => ({ mcA: ps(id).mcA, mcB: ps(id).mcB ?? [], frqA: ps(id).frqA, frqB: ps(id).frqB ?? [] });
const poolFor = (keys: SetKeys, o: Partial<PoolRow> = {}): PoolRow[] => [...keys.mcA, ...keys.frqA].map((k, i) => {
  const c = stockBy.get(k)!;
  return { candidate_key: k, kind: c.kind === "mc" ? "mc" : "frq_bundle", keyword_code: c.members[0]?.topic ?? "1.1", difficulty_provisional: "exam_prep", purpose: "mock_exam", is_current: true, render_verified: true, screen_verified: true,
    ap_candidate_problems: (c.shared ? c.members : [0]).map((_, j) => ({ item_index: j, problem_id: `p${i}-${j}`, problem_version_id: `v${i}-${j}` })), ...o };
});
const base = (id: string) => ({ setId: id, keys: keysOf(id), hasVirtual: false, pool: poolFor(keysOf(id)), existingFullSets: [] as FullSetUsage[], publishedKeys: new Set<string>(), stock: [], psychStock: st });

describe("planDraftSet for ap_psychology", () => {
  it("PS is a known set prefix and the committed report has no virtual cells and PS1/PS2 are disjoint", () => {
    expect(subjectOfSetIdOrNull("PS2")).toBe("ap_psychology"); expect(SET_ID_RE.test("PS1")).toBe(true);
    expect(defaultDraftName("PS2")).toBe("AP Psychology — Practice Exam 2");
    for (const s of report.sets) { expect(s.virtual ?? []).toHaveLength(0); expect(s.virtualSets ?? []).toHaveLength(0); expect(s.frqVirtual ?? []).toHaveLength(0); }
    const a = new Set([...ps("PS1").mcA, ...ps("PS1").frqA]); expect([...ps("PS2").mcA, ...ps("PS2").frqA].filter((k) => a.has(k))).toEqual([]);
  });
  it("the plans for PS1 and PS2 are saveable: 75 MC problems (singles + 3-item sets) and 2 FRQ (AAQ + EBQ)", () => {
    for (const id of ["PS1", "PS2"]) {
      const p = planDraftSet(base(id) as never);
      expect({ id, problems: p.problems }).toEqual({ id, problems: [] }); expect(p.ok).toBe(true);
      expect(p.composition).toMatchObject({ mcTotal: 75, frqTotal: 2 });
      expect(p.items.filter((i) => i.sectionKey === "ap_mc").map((i) => i.position)).toEqual(Array.from({ length: 75 }, (_, i) => i + 1));
      expect(ps(id).frqA.map((k) => stockBy.get(k)!.frqType)).toEqual(["aaq", "ebq"]);
    }
  });
  it("rejects virtual items, unconverted candidates, a dropped item, and reuse across saved sets", () => {
    expect(planDraftSet({ ...base("PS1"), hasVirtual: true } as never).problems.join()).toMatch(/가상 문항/);
    const pool = poolFor(keysOf("PS1")); pool[0].purpose = null;
    expect(planDraftSet({ ...base("PS1"), pool } as never).problems.join()).toMatch(/변환·검증이 끝나지 않은 문항/);
    expect(planDraftSet({ ...base("PS1"), keys: { ...keysOf("PS1"), mcA: keysOf("PS1").mcA.slice(1) } } as never).ok).toBe(false);
    const existing: FullSetUsage[] = [{ id: "x", name: "other", status: "draft", problemIds: ["p0-0"], candidateKeys: [keysOf("PS1").mcA[0]] }];
    expect(planDraftSet({ ...base("PS1"), existingFullSets: existing } as never).problems.join()).toMatch(/다른 풀 세트가 이미 쓰는 문항/);
  });
});
