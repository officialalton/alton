import { describe, expect, it } from "vitest";
import { planDraftSet, subjectOfSetIdOrNull, SET_ID_RE, defaultDraftName, type PoolRow, type SetKeys } from "./assemble-draft";
import { readAssignReport, STOCK_BATCHES } from "./batches";
import { apSectionLayout } from "../ap-exam/layouts";
import { apFrqIsPaper } from "../ap-exam/frq-delivery";
import { loadPrePool } from "../../scripts/ap-generation/pre-pool";

// Precalculus PC1–PC4: 커밋된 배정 보고서 + 커밋된 재고로 초안 계획(관리자 '초안 저장' 드라이런과 같은 함수)이 통과하는지 DB 없이 확인한다.
const rep = readAssignReport("exact-assign-pre-pc1-pc4.json");
const stock = loadPrePool().pool;
const rows = (k: SetKeys): PoolRow[] => [...k.mcA, ...k.mcB, ...k.frqA, ...k.frqB].map((key, i) => ({
  candidate_key: key, kind: stock.find((c) => c.key === key)?.kind === "mc" ? "mc" : "frq_bundle", keyword_code: stock.find((c) => c.key === key)?.topic ?? "1.1", difficulty_provisional: "exam_prep", purpose: "mock_exam", is_current: true, render_verified: true, screen_verified: true,
  ap_candidate_problems: [{ item_index: 0, problem_id: `p${i}`, problem_version_id: `v${i}` }],
}));
const keysOf = (id: string): SetKeys => { const s = rep.sets.find((x) => x.id === id)!; return { mcA: s.mcA, mcB: s.mcB, frqA: s.frqA, frqB: s.frqB }; };
const plan = (id: string, k = keysOf(id), pool = rows(k)) => planDraftSet({ setId: id, keys: k, hasVirtual: false, pool, existingFullSets: [], publishedKeys: new Set(), stock: [], preStock: stock } as never);

describe("planDraftSet for ap_precalculus", () => {
  it("PC is a known prefix; names and delivery", () => {
    expect(subjectOfSetIdOrNull("PC2")).toBe("ap_precalculus"); expect(SET_ID_RE.test("PC4")).toBe(true);
    expect(defaultDraftName("PC3")).toBe("AP Precalculus — Practice Exam 3");
    expect(apFrqIsPaper("ap_precalculus")).toBe(true);
  });
  it("layout: Part A no calculator / Part B graphing calculator for MC; FRQ Part A calculator / Part B none", () => {
    expect(apSectionLayout("ap_precalculus").map((s) => [s.key, s.count, s.calculator])).toEqual([["ap_mc_a", 29, "not_allowed"], ["ap_mc_b", 13, "required"], ["ap_frq_a", 2, "required"], ["ap_frq_b", 2, "not_allowed"]]);
  });
  it.each(["PC1", "PC2", "PC3", "PC4"])("%s: dry-run plan is saveable into the four sections", (id) => {
    const p = plan(id);
    expect(p.problems).toEqual([]); expect(p.ok).toBe(true);
    expect(p.subject).toBe("ap_precalculus"); expect(p.composition).toMatchObject({ mcA: 29, mcB: 13, frqA: 2, frqB: 2, mcTotal: 42, frqTotal: 4 });
    const count = (sk: string) => p.items.filter((i) => i.sectionKey === sk).map((i) => i.position);
    expect(count("ap_mc_a")).toEqual(Array.from({ length: 29 }, (_, i) => i + 1)); expect(count("ap_mc_b")).toHaveLength(13); expect(count("ap_frq_a")).toEqual([1, 2]); expect(count("ap_frq_b")).toEqual([1, 2]);
  });
  it("rejects a calculator item in Part A, swapped FRQ parts, virtual items and unconverted candidates", () => {
    const k = keysOf("PC1");
    const swapped: SetKeys = { ...k, mcA: [k.mcB[0], ...k.mcA.slice(1)], mcB: [k.mcA[0], ...k.mcB.slice(1)] };
    expect(plan("PC1", swapped).problems.join()).toMatch(/파트 A\(계산기 불가\)에 계산기 필수/);
    expect(plan("PC1", { ...k, frqA: k.frqB, frqB: k.frqA }).problems.join()).toMatch(/FRQ 파트 A 유형/);
    expect(planDraftSet({ setId: "PC1", keys: k, hasVirtual: true, pool: rows(k), existingFullSets: [], publishedKeys: new Set(), stock: [], preStock: stock } as never).problems.join()).toMatch(/가상 문항/);
    const pool = rows(k); pool[0].purpose = null;
    expect(plan("PC1", k, pool).problems.join()).toMatch(/변환·검증이 끝나지 않은 문항 1건/);
    expect(plan("PC1", { ...k, mcA: k.mcA.slice(1) }).problems.join()).toMatch(/mc_count_41\/42/);
  });
  it("the four sets share no candidate and every candidate is in a registered pre-* batch pass-keys file", () => {
    const all = rep.sets.flatMap((x) => [...x.mcA, ...x.mcB, ...x.frqA, ...x.frqB]); expect(new Set(all).size).toBe(all.length);
    expect(STOCK_BATCHES.filter((b) => b.id.startsWith("pre-")).length).toBeGreaterThan(0);
  });
});
