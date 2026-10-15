// AP U.S. History Stage A 새 버전 계획(us1·us2-v2-real-a-swap-plan.json)의 정합성. DB 없이 관리자 '새 버전' 흐름(resolveSwaps + checkNewVersionComposition)을
// 게시 v1 스냅샷에서 재현하고, 교체 뒤 구성을 독립 검증기(verifyUshAssignment)로 다시 확인한다.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ushUnitBounds } from "../ap-exam/ush-rules";
import { checkNewVersionComposition, type SlotItem } from "../mock-exam/new-version";
import { realFrqViolations, realSetViolations, registryViolations, type RegistrySource } from "../ap-generation/ush-real-gates";
import { loadUshPool } from "../../scripts/ap-generation/ush-pool";
import { verifyUshAssignment } from "../../scripts/ap-generation/ush-assign";
import { applySwaps, planFor, resultOf, STAGE_A, type Slot, type Snap } from "../../scripts/ap-generation/ush-stage-a-plans";
import { STOCK_BATCHES } from "./batches";
import { parseSwapPlan, resolveSwaps } from "./new-version";

const rd = <T>(p: string) => JSON.parse(readFileSync(p, "utf-8")) as T;
const snap = rd<Snap>("data/ap/stock/ush-us1-us2-published-v1-slots.json");
const { all } = loadUshPool(); const by = new Map(all.filter((c) => c.screen).map((c) => [c.key, c]));
const plan = (id: "US1" | "US2") => { const raw = rd<{ swapCount: number; verifierViolations: string[]; note: string }>(`data/ap/stock/${id.toLowerCase()}-v2-real-a-swap-plan.json`); return { raw, p: parseSwapPlan(raw) }; };
const pid = (key: string, i: number) => `${key}#${i}`;
const unitOf = (key: string, i: number) => (by.get(key)!.kind === "mc" ? by.get(key)!.members[i].unit : "");

function flow(id: "US1" | "US2", other: Slot[]) {
  const cur = snap[id].slots; const { p } = plan(id);
  const res = resolveSwaps(p.swaps, cur.map((s) => ({ section: s.section, position: s.position, candidateKey: s.candidateKey })));
  expect(res.problems).toEqual([]);
  const idx = (s: Slot) => cur.filter((x) => x.section === s.section && x.candidateKey === s.candidateKey).sort((a, b) => a.position - b.position).findIndex((x) => x.position === s.position);
  const toSlot = (s: Slot, i: number): SlotItem => { const c = by.get(s.candidateKey)!; return { section: s.section, position: s.position, problemId: pid(s.candidateKey, i), candidateKey: s.candidateKey, kind: c.kind === "mc" ? "mc" : "frq", unit: unitOf(s.candidateKey, i), calculator: null, family: c.fam }; };
  const before = cur.map((s) => toSlot(s, idx(s)));
  const actionSwaps = res.swaps.map((sw) => ({ section: sw.section, position: sw.position, problemId: pid(sw.addKey, sw.addIndex ?? 0) }));
  const replacements = new Map(res.swaps.map((sw) => { const c = by.get(sw.addKey)!; return [pid(sw.addKey, sw.addIndex ?? 0), { problemId: pid(sw.addKey, sw.addIndex ?? 0), candidateKey: sw.addKey, kind: (c.kind === "mc" ? "mc" : "frq") as "mc" | "frq", unit: unitOf(sw.addKey, sw.addIndex ?? 0), calculator: null, family: c.fam, section: sw.section, position: sw.position }]; }));
  const used = new Set(other.flatMap((s) => [0, 1, 2, 3].map((i) => pid(s.candidateKey, i))));
  const setSizes = new Map(all.filter((c) => c.kind === "mc").map((c) => [c.key, c.members.length] as [string, number]));
  const out = checkNewVersionComposition(before, actionSwaps, { apLabel: "full_practice", sectionCalculator: {}, unitBounds: ushUnitBounds(), usedByOtherExams: used, replacements, setSizes });
  return { res, out, next: applySwaps(cur, p.swaps as never, by) };
}

describe("AP U.S. History Stage A 새 버전 계획", () => {
  it("현재 게시본은 v1 이고, 계획의 제거 문항이 그 칸에 있으며 형식이 맞다", () => {
    for (const id of ["US1", "US2"] as const) {
      const { raw, p } = plan(id); expect(p.set).toBe(id); expect(p.sourceVersionNo).toBe(1); expect(snap[id].sourceVersionNo).toBe(1); expect(p.swaps).toHaveLength(raw.swapCount); expect(raw.swapCount).toBe(2); expect(raw.verifierViolations).toEqual([]);
      expect(snap[id].slots.filter((s) => s.section === "ap_mc")).toHaveLength(55); expect(snap[id].slots.filter((s) => s.section === "ap_saq")).toHaveLength(3);
      for (const sw of p.swaps) expect(snap[id].slots.find((x) => x.section === sw.section && x.position === sw.position)?.candidateKey).toBe(sw.removeKey);
      expect(p.swaps.map((s) => s.removeKey)).toEqual([STAGE_A[id].mc[0], STAGE_A[id].saq[0]]); expect(p.swaps.map((s) => s.addKey)).toEqual([STAGE_A[id].mc[1], STAGE_A[id].saq[1]]);
    }
  });
  it("관리자 새 버전 흐름 검증을 통과한다(세트 통째 교체·단원 범위·시험 간 겹침 0)", () => {
    for (const id of ["US1", "US2"] as const) {
      const other = snap[id === "US1" ? "US2" : "US1"].slots; const { res, out } = flow(id, other);
      expect(out.issues, id).toEqual([]); expect(res.swaps).toHaveLength(4); // MC 세트 3칸 + SAQ 1칸
      expect(res.swaps.filter((s) => s.section === "ap_mc").map((s) => s.addIndex)).toEqual([0, 1, 2]);
    }
  });
  it("교체 뒤 구성: 독립 검증기 위반 0, 단원 수·스킬 범주 수·자료 유형 수·SAQ 시대가 그대로", () => {
    const fin = Object.fromEntries((["US1", "US2"] as const).map((id) => [id, flow(id, snap[id === "US1" ? "US2" : "US1"].slots).next])) as Record<"US1" | "US2", Slot[]>;
    expect(verifyUshAssignment([resultOf("US1", fin.US1, by), resultOf("US2", fin.US2, by)])).toEqual([]);
    for (const id of ["US1", "US2"] as const) {
      const a = resultOf(id, snap[id].slots, by), b = resultOf(id, fin[id], by);
      const count = (r: typeof a, f: (m: (typeof a.sets)[number]["members"][number]) => string) => { const c: Record<string, number> = {}; for (const s of r.sets) for (const m of s.members) c[f(m)] = (c[f(m)] ?? 0) + 1; return c; };
      expect(count(b, (m) => m.unit)).toEqual(count(a, (m) => m.unit)); expect(count(b, (m) => m.cat)).toEqual(count(a, (m) => m.cat));
      const stim = (r: typeof a) => r.sets.map((s) => s.stim).sort(); expect(stim(b)).toEqual(stim(a));
      const per = (r: typeof a) => r.frq.filter((c) => c.template.startsWith("saq")).map((c) => c.period); expect(per(b)).toEqual(per(a)); // 같은 위치의 SAQ 시대 그대로(서로 다름 유지)
    }
  });
  it("교체 계획 생성기가 같은 위치·크기·단원 순서·스킬 범주·시대만 허용한다", () => {
    for (const id of ["US1", "US2"] as const) expect(planFor(id, snap[id].slots, by).problems).toEqual([]);
    const bad = planFor("US1", snap.US1.slots, new Map([...by].map(([k, v]) => [k, k.includes("real_a_saq3_own") ? { ...v, period: 7 } : v])));
    expect(bad.problems.join(" ")).toMatch(/SAQ 시대가 다름/);
  });
});

describe("ush-real-a 배치", () => {
  const items = rd<{ stockKey: string; kind: string; validation: string; reviewState: string; payload: Record<string, unknown> }[]>("data/ap/stock/ush-real-a-items.json");
  const registry = rd<{ sources: RegistrySource[] }>("data/ap/ush-sources/registry.json").sources; const reg = new Map(registry.map((s) => [s.id, s]));
  it("등록·통과 키·레지스트리·실제 자료 게이트", () => {
    const b = STOCK_BATCHES.find((x) => x.id === "ush-real-a"); expect(b).toMatchObject({ itemsFile: "ush-real-a-items.json", passKeysFile: "ush-real-a-pass-keys.json", evidenceFile: "evidence-ush-real-a.json", supplement: true });
    expect(rd<string[]>("data/ap/stock/ush-real-a-pass-keys.json")).toEqual(items.map((i) => i.stockKey)); expect(items).toHaveLength(4);
    expect(registryViolations(registry)).toEqual([]);
    for (const i of items) { expect(i.validation).toBe("auto_passed"); expect(i.reviewState).toBe("verified_by_independent_models"); expect(i.payload.set_intro).toMatch(/^Historical source \(real document\)\n/); expect(String(i.payload.set_intro)).not.toMatch(/ALTON-composed/); }
    for (const i of items.filter((x) => x.kind === "mc")) { expect(realSetViolations(i.payload, reg)).toEqual([]); for (const it of i.payload.items as { verification: { status: string } }[]) expect(it.verification.status).toBe("verified"); }
    for (const i of items.filter((x) => x.kind !== "mc")) expect(realFrqViolations(i.payload, reg)).toEqual([]);
  });
  it("실제 자료 SAQ 게이트가 표 변조와 ALTON 작성 표지를 잡는다", () => {
    const f = JSON.parse(JSON.stringify(items.find((x) => x.kind !== "mc")!.payload)); f.ush_frq.sources[0].table.rows[0][1] = "1"; f.stimulus.data.rows[0][1] = "1"; f.set_intro = "ALTON-composed stimulus\n" + f.set_intro;
    const v = realFrqViolations(f, reg); expect(v.some((x) => x.endsWith("table_differs_from_registry"))).toBe(true); expect(v).toContain("real_set_marked_alton_composed");
  });
  it("교체 후보의 표 자료 수치가 Census 원자료와 합계가 맞는다(지역 합 = 전국)", () => {
    const t = reg.get("stat-black-pop-region-1900-1940")!.table!; const n = (s: string) => Number(s.replace(/,/g, ""));
    for (const r of t.rows) expect(n(r[1]) + n(r[2]) + n(r[3]) + n(r[4])).toBe(n(r[5]));
  });
});
