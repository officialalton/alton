// AP U.S. History Stage B: 실제 자료 DBQ 2건(ush-real-b)과 새 버전 계획(us1·us2-v3-real-b-swap-plan.json)의 정합성. DB 없이 관리자 '새 버전' 흐름(resolveSwaps + checkNewVersionComposition,
// DB 단원 기준)을 2026-10-15 SELECT 전용 스냅샷(게시 US1 v2·US2 v2)에서 재현하고, 교체 뒤 구성을 독립 검증기로 다시 확인한다.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fullPracticeUnitBounds } from "../ap-exam/full-set-rules";
import { checkNewVersionComposition, type SlotItem } from "../mock-exam/new-version";
import { gateCandidate } from "../ap-figures/gate";
import { planConversion } from "../ap-exam/convert";
import { registryViolations, type RegistrySource } from "../ap-generation/ush-real-gates";
import { realDbqPassage, realDbqViolations, REAL_DBQ_LABEL } from "../ap-generation/ush-real-dbq";
import type { UshFrqPayload } from "../ap-generation/ushistory-frq";
import { loadUshPool } from "../../scripts/ap-generation/ush-pool";
import { verifyUshAssignment } from "../../scripts/ap-generation/ush-assign";
import { applySwaps, dbUnitViolations, resultOf, type Slot, type Snap } from "../../scripts/ap-generation/ush-stage-a-plans";
import { planFor, STAGE_B } from "../../scripts/ap-generation/ush-stage-b-plans";
import { DBQS } from "../../scripts/ap-generation/ush-real-b-build";
import { MARKET, REGULATION } from "../../scripts/ap-generation/ush-real-b-content";
import { STOCK_BATCHES } from "./batches";
import { parseSwapPlan, resolveSwaps, type PlanSwapInput } from "./new-version";

const rd = <T>(p: string) => JSON.parse(readFileSync(p, "utf-8")) as T;
const live = rd<Snap>("data/ap/stock/ush-us1-us2-published-v2-slots.json"); // 2026-10-15 현재 DB: 게시 US1 v2 + US2 v2(SELECT 전용)
const { all } = loadUshPool(); const by = new Map(all.filter((c) => c.screen).map((c) => [c.key, c]));
const plan = (id: "US1" | "US2") => { const raw = rd<{ swapCount: number; verifierViolations: string[]; note: string }>(`data/ap/stock/${id.toLowerCase()}-v3-real-b-swap-plan.json`); return { raw, p: parseSwapPlan(raw) }; };
const pid = (key: string, i: number) => `${key}#${i}`;
const unitOf = (key: string) => (by.get(key)!.kind === "mc" ? by.get(key)!.keyUnit : ""); // 관리자 새 버전 서비스와 같은 단원: 후보 keyword_code 단원(세트 전 칸 동일)

function flow(id: "US1" | "US2", other: Slot[], src: Snap = live, swapsIn?: PlanSwapInput[]) {
  const cur = src[id].slots; const inputs = swapsIn ?? plan(id).p.swaps;
  const res = resolveSwaps(inputs, cur.map((s) => ({ section: s.section, position: s.position, candidateKey: s.candidateKey })));
  expect(res.problems).toEqual([]);
  const idx = (s: Slot) => cur.filter((x) => x.section === s.section && x.candidateKey === s.candidateKey).sort((a, b) => a.position - b.position).findIndex((x) => x.position === s.position);
  const toSlot = (s: Slot, i: number): SlotItem => { const c = by.get(s.candidateKey)!; return { section: s.section, position: s.position, problemId: pid(s.candidateKey, i), candidateKey: s.candidateKey, kind: c.kind === "mc" ? "mc" : "frq", unit: unitOf(s.candidateKey), calculator: null, family: c.fam }; };
  const before = cur.map((s) => toSlot(s, idx(s)));
  const actionSwaps = res.swaps.map((sw) => ({ section: sw.section, position: sw.position, problemId: pid(sw.addKey, sw.addIndex ?? 0) }));
  const replacements = new Map(res.swaps.map((sw) => { const c = by.get(sw.addKey)!; return [pid(sw.addKey, sw.addIndex ?? 0), { problemId: pid(sw.addKey, sw.addIndex ?? 0), candidateKey: sw.addKey, kind: (c.kind === "mc" ? "mc" : "frq") as "mc" | "frq", unit: unitOf(sw.addKey), calculator: null, family: c.fam, section: sw.section, position: sw.position }]; }));
  const used = new Set(other.flatMap((s) => [0, 1, 2, 3].map((i) => pid(s.candidateKey, i))));
  const setSizes = new Map(all.filter((c) => c.kind === "mc").map((c) => [c.key, c.members.length] as [string, number]));
  const out = checkNewVersionComposition(before, actionSwaps, { apLabel: "full_practice", sectionCalculator: {}, unitBounds: fullPracticeUnitBounds("ap_us_history", "full_practice"), usedByOtherExams: used, replacements, setSizes });
  return { res, out, next: applySwaps(cur, inputs.map((i) => ({ ...i, position: i.position ?? 0 })) as never) };
}

describe("스냅샷: 게시 v2 두 시험", () => {
  it("US1 v2·US2 v2 가 게시본이고 DB 단원 수가 범위 안(FRQ 교체가 단원 때문에 막히지 않는다)", () => {
    expect(live.US1.sourceVersionNo).toBe(2); expect(live.US2.sourceVersionNo).toBe(2);
    for (const id of ["US1", "US2"] as const) { expect(live[id].slots).toHaveLength(60); expect(dbUnitViolations(live[id].slots, by)).toEqual([]); expect(live[id].slots.filter((s) => s.section === "ap_frq")[0].candidateKey).toBe(STAGE_B[id].remove); }
  });
});

for (const id of ["US1", "US2"] as const) {
  describe(`${id} 계획(게시 v2 → v3)`, () => {
    const { raw, p } = plan(id); const other = (id === "US1" ? live.US2 : live.US1).slots;
    it("형식·교체 칸: ap_frq 위치 1 의 가공 DBQ 를 실제 자료 DBQ 로", () => {
      expect(p.sourceVersionNo).toBe(2); expect(p.sourceSetName).toBe(live[id].sourceSetName); expect(raw.swapCount).toBe(1); expect(p.swaps).toHaveLength(1); expect(raw.verifierViolations).toEqual([]);
      expect(p.swaps[0]).toMatchObject({ section: "ap_frq", position: 1, removeKey: STAGE_B[id].remove, addKey: STAGE_B[id].add });
      expect(live[id].slots.find((x) => x.section === "ap_frq" && x.position === 1)?.candidateKey).toBe(STAGE_B[id].remove);
    });
    it("실제 새 버전 검사(resolveSwaps + checkNewVersionComposition, DB 단원) 통과", () => {
      const { res, out } = flow(id, other); expect(out.issues).toEqual([]); expect(res.swaps).toHaveLength(1);
    });
    it("독립 검증기: 교체 뒤 두 시험 위반 0, MC·SAQ·LEQ 칸 그대로, DBQ 시대 그대로", () => {
      const next = flow(id, other).next; const o = id === "US1" ? "US2" : "US1";
      expect(verifyUshAssignment([resultOf(id, next, by), resultOf(o, live[o].slots, by)])).toEqual([]);
      const a = live[id].slots.filter((s) => s.candidateKey !== STAGE_B[id].remove), b = next.filter((s) => s.candidateKey !== STAGE_B[id].add); expect(b).toEqual(a);
      expect(by.get(STAGE_B[id].add)!.period).toBe(by.get(STAGE_B[id].remove)!.period); expect(by.get(STAGE_B[id].add)!.template).toBe("dbq");
    });
    it("계획은 다른 시험의 슬롯에는 적용되지 않는다(제거 문항이 없음)", () => {
      const o = id === "US1" ? live.US2.slots : live.US1.slots; const r = resolveSwaps(p.swaps, o.map((s) => ({ section: s.section, position: s.position, candidateKey: s.candidateKey }))); expect(r.problems.length).toBeGreaterThan(0);
    });
  });
}
describe("계획 생성기", () => {
  it("DBQ 시대가 다른 교체나 dbq 가 아닌 후보를 거부한다", () => {
    const bad = planFor("US1", live.US1.slots, by); expect(bad.problems).toEqual([]);
    const wrongSlot = planFor("US1", live.US2.slots, by); expect(wrongSlot.problems.join(" ")).toMatch(/ap_frq 에 없음/);
  });
});

describe("ush-real-b 배치", () => {
  const items = rd<{ stockKey: string; kind: string; validation: string; reviewState: string; payload: Record<string, unknown> & { ush_frq: UshFrqPayload; verification: Record<string, unknown> }; sourceRegistryIds: string[] }[]>("data/ap/stock/ush-real-b-items.json");
  const registry = rd<{ sources: RegistrySource[] }>("data/ap/ush-sources/registry.json").sources; const reg = new Map(registry.map((s) => [s.id, s]));
  const orderOf = (key: string) => (key.includes("market") ? MARKET : REGULATION).order;
  it("등록·통과 키·레지스트리·DBQ 게이트·검증 기록", () => {
    const b = STOCK_BATCHES.find((x) => x.id === "ush-real-b"); expect(b).toMatchObject({ itemsFile: "ush-real-b-items.json", passKeysFile: "ush-real-b-pass-keys.json", evidenceFile: "evidence-ush-real-b.json", supplement: true });
    expect(rd<string[]>("data/ap/stock/ush-real-b-pass-keys.json")).toEqual(items.map((i) => i.stockKey)); expect(items).toHaveLength(2); expect(DBQS).toHaveLength(2);
    expect(registryViolations(registry)).toEqual([]);
    for (const i of items) {
      expect(i.validation).toBe("auto_passed"); expect(i.reviewState).toBe("verified_by_independent_models"); expect(String(i.payload.set_intro)).not.toMatch(/ALTON-composed/);
      expect(realDbqViolations(i.payload, reg, orderOf(i.stockKey))).toEqual([]);
      const v = i.payload.verification as { sample_totals: Record<string, number>; grader_totals: Record<string, number[]>; flags: unknown[]; fact_verdicts: { verdict: string }[] };
      expect(v.sample_totals.high).toBeGreaterThanOrEqual(5); expect(v.sample_totals.mid).toBeGreaterThanOrEqual(3); expect(v.sample_totals.mid).toBeLessThanOrEqual(5); expect(v.sample_totals.low).toBeLessThanOrEqual(3);
      for (const [tier, [lo, hi]] of Object.entries({ high: [5, 7], mid: [3, 5], low: [1, 3] })) { expect(v.grader_totals[tier]).toHaveLength(2); for (const t of v.grader_totals[tier]) { expect(t).toBeGreaterThanOrEqual(lo); expect(t).toBeLessThanOrEqual(hi); } }
      expect(v.flags).toEqual([]); expect(v.fact_verdicts.every((x) => x.verdict === "sound")).toBe(true);
    }
  });
  it("문서 7개: 시각 자료 2, 서로 다른 관점, 모든 문서가 논증 줄을 뒷받침하고 반론·복합성을 주는 문서가 있다; 증거 지도·루브릭 표지", () => {
    for (const i of items) {
      const u = i.payload.ush_frq; expect(u.sources).toHaveLength(7); expect(u.sources.filter((s) => s.kind === "image")).toHaveLength(2);
      const em = u.expected_features.evidence_map!; expect(new Set(em.flatMap((l) => l.supports))).toEqual(new Set(["1", "2", "3", "4", "5", "6", "7"])); expect(em.some((l) => l.complicates.length > 0)).toBe(true);
      expect(u.rubric.total_points).toBe(7); expect(u.rubric.scoring_notes.join(" ")).toContain(REAL_DBQ_LABEL); expect(String(i.payload.reference_text)).toContain(REAL_DBQ_LABEL); expect(String(i.payload.reference_text)).toContain("Evidence map");
      expect(u.samples.map((s) => s.tier)).toEqual(["high", "mid", "low"]); expect(u.samples.map((s) => s.rubric_scores.total).sort((a, b) => b - a)).toEqual(u.samples.map((s) => s.rubric_scores.total));
    }
    expect(MARKET.theses.length).toBeGreaterThanOrEqual(3); expect(REGULATION.theses.length).toBeGreaterThanOrEqual(3);
  });
  it("두 DBQ 와 ush-real-a 는 같은 레지스트리 자료를 쓰지 않는다(시험 안·시험 사이 중복 없음)", () => {
    const a = new Set(items[0].sourceRegistryIds), b = new Set(items[1].sourceRegistryIds); for (const x of a) expect(b.has(x)).toBe(false);
    const stageA = rd<{ sourceRegistryIds: string[] }[]>("data/ap/stock/ush-real-a-items.json").flatMap((r) => r.sourceRegistryIds); for (const x of [...a, ...b]) expect(stageA.includes(x)).toBe(false);
  });
  it("변조를 잡는다: 발췌 글자·표 숫자·이미지 출처·본문 순서·증거 지도·ALTON 표지", () => {
    const base = items.find((x) => x.stockKey.includes("market"))!; const order = orderOf(base.stockKey); const fresh = () => JSON.parse(JSON.stringify(base.payload));
    const t1 = fresh(); t1.ush_frq.sources[0].body = t1.ush_frq.sources[0].body.replace("rich and powerful", "rich and mighty"); t1.set_intro = t1.set_intro.replace("rich and powerful", "rich and mighty"); expect(realDbqViolations(t1, reg, order).some((x) => x.endsWith("body_not_verbatim_registry_excerpt"))).toBe(true);
    const t2 = fresh(); t2.ush_frq.sources[5].table.rows[0][1] = "1"; expect(realDbqViolations(t2, reg, order).some((x) => x.endsWith("table_differs_from_registry"))).toBe(true);
    const t3 = fresh(); t3.ush_frq.sources[3].image.credit = "x"; expect(realDbqViolations(t3, reg, order).some((x) => x.endsWith("credit_differs"))).toBe(true);
    const t4 = fresh(); t4.set_intro = t4.set_intro.replace("Document 1 (primary source)", "Document 1 (primary source) edited"); expect(realDbqViolations(t4, reg, order)).toContain("set_intro_differs_from_generated_passage");
    const t5 = fresh(); t5.ush_frq.expected_features.evidence_map[0].supports = ["1"]; t5.ush_frq.expected_features.evidence_map.forEach((l: { supports: string[] }) => (l.supports = l.supports.filter((x) => x !== "4"))); expect(realDbqViolations(t5, reg, order)).toContain("doc4:supports_no_line_of_reasoning");
    const t6 = fresh(); t6.set_intro = "ALTON-composed stimulus\n" + t6.set_intro; expect(realDbqViolations(t6, reg, order)).toContain("real_set_marked_alton_composed");
    const t7 = fresh(); t7.stimulus.data.more = []; expect(realDbqViolations(t7, reg, order)).toContain("stimulus_images_differ_from_image_documents");
    const t8 = fresh(); t8.ush_frq.expected_features.evidence_map[0].complicates = [t8.ush_frq.expected_features.evidence_map[0].supports[0]]; expect(realDbqViolations(t8, reg, order)).toContain("evidence_map_doc_both_supports_and_complicates");
  });
  it("표시문은 레지스트리에서 코드로 만든 문안이고, 변환하면 이미지 2장(라벨·출처 포함)이 그림 칸에 실린다", () => {
    for (const i of items) {
      const d = i.stockKey.includes("market") ? MARKET : REGULATION; const imgDocs = i.payload.ush_frq.sources.flatMap((s, n) => (s.kind === "image" ? [n + 1] : []));
      expect(i.payload.set_intro).toBe(realDbqPassage(d.order, reg, imgDocs));
      const g = gateCandidate(i as never); expect(g.issues.filter((x) => x.level === "error")).toEqual([]);
      const spec = g.spec as unknown as { type: string; bucket: string; label: string; credit: string; more: { path: string; label: string; credit: string }[] }; expect(spec).toMatchObject({ type: "image", bucket: "static" }); expect(spec.more).toHaveLength(1);
      expect([spec.label, spec.more[0].label]).toEqual(imgDocs.map((n) => `Document ${n}`)); expect(spec.credit).toMatch(/Library of Congress/); expect(spec.more[0].credit).toMatch(/Library of Congress/);
      const plan = planConversion(i as never); expect(plan.ok).toBe(true);
      if (plan.ok) { expect(plan.items).toHaveLength(1); expect(plan.items[0].format).toBe("essay"); expect(plan.items[0].passage).toMatch(/^Historical source \(real document\)/); expect(plan.items[0].figure).toMatchObject({ type: "image", bucket: "static" }); }
    }
  });
});
