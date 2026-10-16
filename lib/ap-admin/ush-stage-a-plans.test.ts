// AP U.S. History Stage A 새 버전 계획(us1·us2-v2-real-a-swap-plan.json)의 정합성. DB 없이 관리자 '새 버전' 흐름(resolveSwaps + checkNewVersionComposition)을
// 게시 v1 스냅샷에서 재현하고, 교체 뒤 구성을 독립 검증기(verifyUshAssignment)로 다시 확인한다.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ushUnitBounds } from "../ap-exam/ush-rules";
import { fullPracticeUnitBounds } from "../ap-exam/full-set-rules";
import { checkNewVersionComposition, type SlotItem } from "../mock-exam/new-version";
import { realFrqViolations, realSetViolations, registryViolations, type RegistrySource } from "../ap-generation/ush-real-gates";
import { loadUshPool } from "../../scripts/ap-generation/ush-pool";
import { verifyUshAssignment } from "../../scripts/ap-generation/ush-assign";
import { applySwaps, dbUnitCounts, dbUnitViolations, planFor, resultOf, STAGE_A, type Slot, type Snap } from "../../scripts/ap-generation/ush-stage-a-plans";
import { STOCK_BATCHES } from "./batches";
import { parseSwapPlan, resolveSwaps, type PlanSwapInput } from "./new-version";

const rd = <T>(p: string) => JSON.parse(readFileSync(p, "utf-8")) as T;
const snap = rd<Snap>("data/ap/stock/ush-us1-us2-published-v1-slots.json"); // 게시 v1 두 시험(US2 계획의 출발점)
const now = rd<Snap>("data/ap/stock/ush-us1-us2-db-state-v2.json"); // 2026-10-15 현재 DB: US1 v1 + US2 v2(Stage A 적용됨) + 변환 완료 키
const { all } = loadUshPool(); const by = new Map(all.filter((c) => c.screen).map((c) => [c.key, c]));
const plan = (id: "US1" | "US2") => { const raw = rd<{ swapCount: number; verifierViolations: string[]; note: string }>(`data/ap/stock/${id.toLowerCase()}-v2-real-a-swap-plan.json`); return { raw, p: parseSwapPlan(raw) }; };
const pid = (key: string, i: number) => `${key}#${i}`;
// 관리자 새 버전 서비스와 같은 단원: 후보 keyword_code 단원(세트 전 칸 동일) — 문항별 토픽 단원이 아니다.
const unitOf = (key: string, _i: number) => (by.get(key)!.kind === "mc" ? by.get(key)!.keyUnit : "");

function flow(id: "US1" | "US2", other: Slot[], src: Snap = snap, swapsIn?: PlanSwapInput[]) {
  const cur = src[id].slots; const inputs = swapsIn ?? plan(id).p.swaps;
  const res = resolveSwaps(inputs, cur.map((s) => ({ section: s.section, position: s.position, candidateKey: s.candidateKey })));
  expect(res.problems).toEqual([]);
  const idx = (s: Slot) => cur.filter((x) => x.section === s.section && x.candidateKey === s.candidateKey).sort((a, b) => a.position - b.position).findIndex((x) => x.position === s.position);
  const toSlot = (s: Slot, i: number): SlotItem => { const c = by.get(s.candidateKey)!; return { section: s.section, position: s.position, problemId: pid(s.candidateKey, i), candidateKey: s.candidateKey, kind: c.kind === "mc" ? "mc" : "frq", unit: unitOf(s.candidateKey, i), calculator: null, family: c.fam }; };
  const before = cur.map((s) => toSlot(s, idx(s)));
  const actionSwaps = res.swaps.map((sw) => ({ section: sw.section, position: sw.position, problemId: pid(sw.addKey, sw.addIndex ?? 0) }));
  const replacements = new Map(res.swaps.map((sw) => { const c = by.get(sw.addKey)!; return [pid(sw.addKey, sw.addIndex ?? 0), { problemId: pid(sw.addKey, sw.addIndex ?? 0), candidateKey: sw.addKey, kind: (c.kind === "mc" ? "mc" : "frq") as "mc" | "frq", unit: unitOf(sw.addKey, sw.addIndex ?? 0), calculator: null, family: c.fam, section: sw.section, position: sw.position }]; }));
  const used = new Set(other.flatMap((s) => [0, 1, 2, 3].map((i) => pid(s.candidateKey, i))));
  const setSizes = new Map(all.filter((c) => c.kind === "mc").map((c) => [c.key, c.members.length] as [string, number]));
  // 관리자 서비스(lib/ap-admin/new-version.ts buildNewVersionPreview)와 같은 컨텍스트: unitBounds = fullPracticeUnitBounds(ap_us_history, full_practice) = ushUnitBounds().
  const out = checkNewVersionComposition(before, actionSwaps, { apLabel: "full_practice", sectionCalculator: {}, unitBounds: fullPracticeUnitBounds("ap_us_history", "full_practice"), usedByOtherExams: used, replacements, setSizes });
  return { res, out, next: applySwaps(cur, inputs.map((i) => ({ ...i, position: i.position ?? 0 })) as never) };
}

describe("fullPracticeUnitBounds 는 US History 에서 ushUnitBounds 이다", () => { it("같은 범위", () => expect(fullPracticeUnitBounds("ap_us_history", "full_practice")).toEqual(ushUnitBounds())); });

describe("US2 계획(게시 v1 → v2, 이미 적용됨)", () => {
  it("형식·교체 칸·관리자 흐름(DB 단원 기준) 통과", () => {
    const { raw, p } = plan("US2"); expect(p.sourceVersionNo).toBe(1); expect(snap.US2.sourceVersionNo).toBe(1); expect(p.swaps).toHaveLength(raw.swapCount); expect(raw.swapCount).toBe(2);
    for (const sw of p.swaps) expect(snap.US2.slots.find((x) => x.section === sw.section && x.position === sw.position)?.candidateKey).toBe(sw.removeKey);
    const { res, out } = flow("US2", snap.US1.slots); expect(out.issues).toEqual([]); expect(res.swaps).toHaveLength(4);
  });
});

describe("US1 계획: Stage A + 단원 균형 교체", () => {
  const { raw, p } = plan("US1");
  it("현재 DB(US1 v1)가 이미 DB 단원 범위를 벗어나 있다 — 교체만으로는 막힌다", () => {
    expect(now.US1.sourceVersionNo).toBe(1); expect(dbUnitCounts(now.US1.slots, by)).toMatchObject({ "3": 11, "4": 4 });
    expect(dbUnitViolations(now.US1.slots, by)).toEqual(expect.arrayContaining(["db_unit_3_11_not_in_5-10", "db_unit_4_4_not_in_5-10"]));
    const stageAOnly = p.swaps.filter((s) => s.removeKey !== "ush-p2-a:ap_us_history-u313-k0");
    const bad = flow("US1", now.US2.slots, now, stageAOnly); expect(bad.out.issues.join(" ")).toMatch(/unit_3_above_max_11\/10/); expect(bad.out.issues.join(" ")).toMatch(/unit_4_below_min_4\/5/);
  });
  it("계획: 3건(MC 세트 2 + SAQ 1), 제거 문항이 그 칸에, 교체 문항은 모두 변환 완료·US2 와 겹치지 않음", () => {
    expect(p.sourceVersionNo).toBe(1); expect(p.swaps).toHaveLength(raw.swapCount); expect(raw.swapCount).toBe(3); expect(raw.verifierViolations).toEqual([]);
    for (const sw of p.swaps) expect(now.US1.slots.find((x) => x.section === sw.section && x.position === sw.position)?.candidateKey).toBe(sw.removeKey);
    expect(p.swaps.map((s) => s.addKey)).toEqual(["ush-real-a:ap_us_history-real_a_gm-k0", "ush-p2-a:ap_us_history-u418-k0", "ush-real-a:ap_us_history-real_a_saq3_own-k0"]);
    const us2 = new Set(now.US2.slots.map((s) => s.candidateKey)); for (const sw of p.swaps) { expect(now.convertedKeys![sw.addKey]).toBe(by.get(sw.addKey)!.kind === "mc" ? by.get(sw.addKey)!.members.length : 1); expect(us2.has(sw.addKey)).toBe(false); }
  });
  it("실제 새 버전 검사(resolveSwaps + checkNewVersionComposition, DB 단원) 통과, 교체 뒤 DB 단원 수가 범위 안", () => {
    const { res, out, next } = flow("US1", now.US2.slots, now); expect(out.issues).toEqual([]); expect(res.swaps).toHaveLength(8); // 세트 3칸 + 세트 4칸 + SAQ 1칸
    expect(dbUnitCounts(next, by)).toEqual({ "1": 3, "2": 3, "3": 7, "4": 8, "5": 8, "6": 8, "7": 7, "8": 7, "9": 4 }); expect(dbUnitViolations(next, by)).toEqual([]);
  });
  it("독립 검증기(이제 DB 단원도 검사): 교체 뒤 US1 + 현재 US2 위반 0, 교체 전 v1 은 DB 단원 위반을 잡는다", () => {
    const next = flow("US1", now.US2.slots, now).next;
    expect(verifyUshAssignment([resultOf("US1", next, by), resultOf("US2", now.US2.slots, by)])).toEqual([]);
    const v = verifyUshAssignment([resultOf("US1", now.US1.slots, by), resultOf("US2", now.US2.slots, by)]); expect(v.some((x) => x.includes("db_unit_3_11_not_in_5-10"))).toBe(true); expect(v.some((x) => x.includes("db_unit_4_4_not_in_5-10"))).toBe(true);
  });
  it("구성 보존: 스킬 범주 최소·자료 유형 최소·SAQ 시대·exam_prep 수", () => {
    const next = flow("US1", now.US2.slots, now).next; const a = resultOf("US1", now.US1.slots, by), b = resultOf("US1", next, by);
    const per = (r: typeof a) => r.frq.filter((c) => c.template.startsWith("saq")).map((c) => c.period); expect(per(b)).toEqual(per(a));
    const ex = (r: typeof a) => r.sets.reduce((n, c) => n + c.exam, 0); expect(ex(b)).toBe(ex(a));
  });
  it("균형 교체도 같은 크기만 허용한다", () => {
    const bad = planFor("US1", now.US1.slots, by, { mc: [["ush-p2-a:ap_us_history-u313-k0", "ush-p2-a:ap_us_history-u424-k0", true]], saq: STAGE_A.US1.saq }); // 4문항 세트 → 3문항 세트
    expect(bad.problems.join(" ")).toMatch(/MC 세트 크기가 다름/);
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
