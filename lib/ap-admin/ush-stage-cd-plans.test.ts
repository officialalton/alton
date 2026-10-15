// AP U.S. History Stage C·D: 실제 자료 MC 세트 7건(ush-real-c·ush-real-d)과 새 버전 계획(us1·us2-v4-real-cd-swap-plan.json)의 정합성.
// DB 없이 관리자 '새 버전' 흐름(resolveSwaps + checkNewVersionComposition, DB 단원 = 후보 keyword_code 단원)을 2026-10-15 SELECT 전용 스냅샷(게시 US1 v3·US2 v3)에서 재현하고,
// 교체 뒤 구성을 독립 검증기로 다시 확인한다.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fullPracticeUnitBounds } from "../ap-exam/full-set-rules";
import { checkNewVersionComposition, type SlotItem } from "../mock-exam/new-version";
import { gateCandidate } from "../ap-figures/gate";
import { planConversion } from "../ap-exam/convert";
import { realSetViolations, registryViolations, type RegistrySource } from "../ap-generation/ush-real-gates";
import { loadUshPool } from "../../scripts/ap-generation/ush-pool";
import { verifyUshAssignment } from "../../scripts/ap-generation/ush-assign";
import { applySwaps, dbUnitViolations, resultOf, type Slot, type Snap } from "../../scripts/ap-generation/ush-stage-a-plans";
import { planFor, STAGE_CD } from "../../scripts/ap-generation/ush-stage-cd-plans";
import { MC_SETS_C } from "../../scripts/ap-generation/ush-real-c-content";
import { MC_SETS_D } from "../../scripts/ap-generation/ush-real-d-content";
import { setIntro } from "../../scripts/ap-generation/ush-real-cd-build";
import { STOCK_BATCHES } from "./batches";
import { parseSwapPlan, resolveSwaps, type PlanSwapInput } from "./new-version";

const rd = <T>(p: string) => JSON.parse(readFileSync(p, "utf-8")) as T;
const live = rd<Snap>("data/ap/stock/ush-us1-us2-published-v3-slots.json"); // 2026-10-15 현재 DB: 게시 US1 v3 + US2 v3(SELECT 전용)
const { all } = loadUshPool(); const by = new Map(all.filter((c) => c.screen).map((c) => [c.key, c]));
const plan = (id: "US1" | "US2") => { const raw = rd<{ swapCount: number; verifierViolations: string[] }>(`data/ap/stock/${id.toLowerCase()}-v4-real-cd-swap-plan.json`); return { raw, p: parseSwapPlan(raw) }; };
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

describe("스냅샷: 게시 v3 두 시험", () => {
  it("US1 v3·US2 v3 가 게시본이고 DB 단원 수가 범위 안, 교체 대상 세트가 현재 ap_mc 에 있다", () => {
    expect(live.US1.sourceVersionNo).toBe(3); expect(live.US2.sourceVersionNo).toBe(3);
    for (const id of ["US1", "US2"] as const) {
      expect(live[id].slots).toHaveLength(60); expect(dbUnitViolations(live[id].slots, by)).toEqual([]);
      for (const [rk] of STAGE_CD[id]) expect(live[id].slots.filter((s) => s.section === "ap_mc" && s.candidateKey === rk).length).toBeGreaterThanOrEqual(3);
    }
  });
});

for (const id of ["US1", "US2"] as const) {
  describe(`${id} 계획(게시 v3 → v4)`, () => {
    const { raw, p } = plan(id); const other = (id === "US1" ? live.US2 : live.US1).slots; const spec = STAGE_CD[id];
    it("형식·교체 칸: 현재 슬롯의 ALTON 작성 세트를 실제 자료 세트로(같은 위치)", () => {
      expect(p.sourceVersionNo).toBe(3); expect(p.sourceSetName).toBe(live[id].sourceSetName); expect(raw.swapCount).toBe(spec.length); expect(p.swaps).toHaveLength(spec.length); expect(raw.verifierViolations).toEqual([]);
      for (const [rk, ak] of spec) {
        const first = live[id].slots.filter((s) => s.section === "ap_mc" && s.candidateKey === rk).sort((a, b) => a.position - b.position)[0];
        expect(p.swaps.find((s) => s.removeKey === rk)).toMatchObject({ section: "ap_mc", position: first.position, addKey: ak });
      }
    });
    it("실제 새 버전 검사(resolveSwaps + checkNewVersionComposition, DB 단원) 통과 — 세트 전체가 하나의 새 세트로 교체된다", () => {
      const { res, out } = flow(id, other); expect(out.issues).toEqual([]);
      const nSlots = spec.reduce((a, [rk]) => a + live[id].slots.filter((s) => s.section === "ap_mc" && s.candidateKey === rk).length, 0); expect(res.swaps).toHaveLength(nSlots);
    });
    it("독립 검증기: 교체 뒤 두 시험 위반 0(단원·스킬 범주·자료 유형 최소·겹침 없음), 다른 칸 그대로, DB 단원 수 범위 안", () => {
      const next = flow(id, other).next; const o = id === "US1" ? "US2" : "US1";
      expect(verifyUshAssignment([resultOf(id, next, by), resultOf(o, live[o].slots, by)])).toEqual([]);
      expect(dbUnitViolations(next, by)).toEqual([]);
      const removed = new Set(spec.map(([r]) => r)), added = new Set(spec.map(([, a]) => a));
      expect(next.filter((s) => !added.has(s.candidateKey))).toEqual(live[id].slots.filter((s) => !removed.has(s.candidateKey)));
      for (const [rk, ak] of spec) { const r = by.get(rk)!, n = by.get(ak)!; expect(n.members.length).toBe(r.members.length); expect(n.period).toBe(r.period); expect(n.keyUnit).toBe(r.keyUnit); expect(n.members.map((m) => [m.unit, m.skill[0]])).toEqual(r.members.map((m) => [m.unit, m.skill[0]])); }
    });
    it("계획은 다른 시험의 슬롯에는 적용되지 않는다(제거 문항이 없음)", () => {
      const o = id === "US1" ? live.US2.slots : live.US1.slots; const r = resolveSwaps(p.swaps, o.map((s) => ({ section: s.section, position: s.position, candidateKey: s.candidateKey }))); expect(r.problems.length).toBeGreaterThan(0);
    });
    it("교체해 넣는 세트는 두 시험 사이에 겹치지 않는다", () => {
      const a = new Set(STAGE_CD.US1.map(([, x]) => x)), b = new Set(STAGE_CD.US2.map(([, x]) => x)); for (const x of a) expect(b.has(x)).toBe(false);
    });
  });
}
describe("계획 생성기", () => {
  it("크기·시대·단원이 다른 교체나 다른 시험의 슬롯을 거부한다", () => {
    expect(planFor("US1", live.US1.slots, by).problems).toEqual([]); expect(planFor("US2", live.US2.slots, by).problems).toEqual([]);
    expect(planFor("US1", live.US2.slots, by).problems.join(" ")).toMatch(/ap_mc 에 없음/);
    const bad = planFor("US1", live.US1.slots, by, [["ush-p2-a:ap_us_history-u528-k0", "ush-real-c:ap_us_history-real_c_emanc-k0"]]); expect(bad.problems.join(" ")).toMatch(/크기|시대|단원/);
  });
});

describe("ush-real-c · ush-real-d 배치", () => {
  const registry = rd<{ sources: RegistrySource[] }>("data/ap/ush-sources/registry.json").sources; const reg = new Map(registry.map((s) => [s.id, s]));
  type Rec = { stockKey: string; validation: string; reviewState: string; difficulty: { label: string }[]; sourceRegistryIds: string[]; replaces: string; payload: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
  for (const [run, sets, n] of [["c", MC_SETS_C, 4], ["d", MC_SETS_D, 3]] as const) {
    const items = rd<Rec[]>(`data/ap/stock/ush-real-${run}-items.json`);
    it(`${run}: 등록·통과 키·증거·레지스트리·게이트·검증 기록`, () => {
      const b = STOCK_BATCHES.find((x) => x.id === `ush-real-${run}`); expect(b).toMatchObject({ itemsFile: `ush-real-${run}-items.json`, passKeysFile: `ush-real-${run}-pass-keys.json`, evidenceFile: `evidence-ush-real-${run}.json`, supplement: true });
      expect(rd<string[]>(`data/ap/stock/ush-real-${run}-pass-keys.json`)).toEqual(items.map((i) => i.stockKey)); expect(items).toHaveLength(n); expect(sets).toHaveLength(n); expect(registryViolations(registry)).toEqual([]);
      const ev = rd<{ entries: { candidate_key: string; checks: Record<string, { result: string }> }[] }>(`data/ap/screen-evidence/evidence-ush-real-${run}.json`);
      for (const i of items) {
        expect(i.validation).toBe("auto_passed"); expect(i.reviewState).toBe("verified_by_independent_models"); expect(String(i.payload.set_intro)).not.toMatch(/ALTON-composed/);
        expect(realSetViolations(i.payload, reg)).toEqual([]); expect(gateCandidate(i as never).issues.filter((x) => x.level === "error")).toEqual([]); expect(planConversion(i as never).ok).toBe(true);
        const es = ev.entries.filter((e) => e.candidate_key === i.stockKey); expect(es).toHaveLength(i.payload.items.length * 2); for (const e of es) for (const c of Object.values(e.checks)) expect(["pass", "na"]).toContain(c.result);
        for (const it of i.payload.items) { expect(it.verification.status).toBe("verified"); expect(it.verification.flags).toEqual([]); expect(it.verification.fact_verdict).toBe("sound"); expect(it.verification.solver_choices.every((c: number) => c === it.key_index)).toBe(true); }
      }
    });
    it(`${run}: 칸 크기·시대·스킬·토픽·난이도가 교체 대상과 같고 키가 가장 긴 선택지가 아니며 정답 위치가 흩어져 있다`, () => {
      for (const i of items) {
        const orig = [...MC_SETS_C, ...MC_SETS_D].find((m) => i.stockKey.endsWith(`-${m.cell}-k0`))!; const slotKey = Object.values(STAGE_CD).flat().find(([, a]) => a === i.stockKey)![0]; const o = by.get(slotKey)!;
        expect(i.payload.items.map((x: { skill: string }) => x.skill[0])).toEqual(o.members.map((m) => m.cat)); expect(i.payload.items.map((x: { topic: string }) => x.topic.split(".")[0])).toEqual(o.members.map((m) => m.unit)); expect(i.payload.ush_set.period).toBe(o.period);
        expect(i.difficulty.map((d) => d.label)).toEqual(orig.difficulty);
        for (const it of i.payload.items as { options: { text: string }[]; key_index: number }[]) { const k = it.options[it.key_index].text.length; expect(it.options.some((x, j) => j !== it.key_index && x.text.length >= k)).toBe(true); }
      }
      expect(new Set(items.flatMap((i) => i.payload.items.map((x: { key_index: number }) => x.key_index))).size).toBeGreaterThanOrEqual(3);
    });
    it(`${run}: 변조를 잡는다(발췌 글자·ALTON 표지·이미지 출처·등록 해시)`, () => {
      const base = items[0]; const fresh = () => JSON.parse(JSON.stringify(base.payload));
      const t1 = fresh(); const seg = reg.get(base.sourceRegistryIds[0])!; if (seg.excerpt_segments) { t1.set_intro = t1.set_intro.replace(seg.excerpt_segments[0].slice(0, 25), "XXXXX"); expect(realSetViolations(t1, reg).some((x) => x.endsWith("excerpt_not_verbatim_in_set_intro"))).toBe(true); }
      else { t1.stimulus.data.credit = "x"; expect(realSetViolations(t1, reg).some((x) => x.endsWith("credit_differs"))).toBe(true); }
      const t2 = fresh(); t2.set_intro = "ALTON-composed stimulus\n" + t2.set_intro; expect(realSetViolations(t2, reg)).toContain("real_set_marked_alton_composed");
      const t3 = fresh(); t3.ush_set.sources[0].source_sha256 = "0".repeat(64); expect(realSetViolations(t3, reg).some((x) => x.endsWith("sha_not_pinned"))).toBe(true);
    });
  }
  it("표시문은 레지스트리에서 코드로 만든 문안이다(손으로 옮기지 않음); 이미지 세트는 그림 칸에 출처(credit)가 실린다", () => {
    for (const run of ["c", "d"] as const) for (const i of rd<Rec[]>(`data/ap/stock/ush-real-${run}-items.json`)) {
      const m = [...MC_SETS_C, ...MC_SETS_D].find((x) => i.stockKey.endsWith(`-${x.cell}-k0`))!; expect(i.payload.set_intro).toBe(setIntro(m, reg.get(m.sourceId)!));
      if (m.kind === "image") { const g = gateCandidate(i as never); const spec = g.spec as unknown as { type: string; bucket: string; credit: string; alt: string }; expect(spec).toMatchObject({ type: "image", bucket: "static" }); expect(spec.credit).toMatch(/Library of Congress/); expect(spec.alt.length).toBeGreaterThan(40); }
    }
  });
  it("실제 자료 세트 7건 모두 같은 레지스트리 자료를 두 번 쓰지 않는다(Stage A·B 와도 겹치지 않음)", () => {
    const ids = [...rd<Rec[]>("data/ap/stock/ush-real-c-items.json"), ...rd<Rec[]>("data/ap/stock/ush-real-d-items.json")].flatMap((r) => r.sourceRegistryIds); expect(new Set(ids).size).toBe(ids.length);
    const prior = [...rd<Rec[]>("data/ap/stock/ush-real-a-items.json"), ...rd<Rec[]>("data/ap/stock/ush-real-b-items.json")].flatMap((r) => r.sourceRegistryIds); for (const x of ids) expect(prior.includes(x)).toBe(false);
  });
});
