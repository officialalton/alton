// AP Psychology psych-hard: PS1·PS2 (게시 v2) → v3 새 버전 교체 계획의 정합성. DB 없이 관리자 '새 버전' 흐름(resolveSwaps + checkNewVersionComposition, **DB 단원 = 후보 keyword_code 단원**, 절대 범위 11-19)을
// 2026-10-15 SELECT 전용 스냅샷(게시 PS1 v2·PS2 v2)에서 재현하고, 교체 뒤 구성을 독립 검증기로 다시 확인한다.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fullPracticeUnitBounds } from "../ap-exam/full-set-rules";
import { PSYCH_SET_COUNT } from "../ap-exam/psych-rules";
import { checkNewVersionComposition, type SlotItem } from "../mock-exam/new-version";
import { loadPsychPool } from "../../scripts/ap-generation/psych-pool";
import { verifyPsychAssignment } from "../../scripts/ap-generation/psych-assign";
import { afterSwaps, dbUnitViolations, resultOf, slotViolations, type SetId, type Slot, type Snap } from "../../scripts/ap-generation/psych-new-version-plans";
import { pctRowViolations, itemTables } from "../../scripts/audit/psych-table-pct-scan";
import { STOCK_BATCHES } from "./batches";
import { parseSwapPlan, resolveSwaps, type PlanSwapInput } from "./new-version";

const rd = <T>(p: string) => JSON.parse(readFileSync(p, "utf-8")) as T;
const live = rd<Snap>("data/ap/stock/psych-ps1-ps2-published-v2-slots.json"); // 2026-10-15 현재 DB: 게시 PS1 v2 + PS2 v2(SELECT 전용)
const assign = rd<{ sets: { id: string; mcA: string[]; frqA: string[]; virtual: unknown[]; virtualSets: unknown[]; frqVirtual: unknown[] }[] }>("data/ap/stock/exact-assign-psych-ps1-ps2-v3.json");
const { all } = loadPsychPool(); const by = new Map(all.filter((c) => c.screen).map((c) => [c.key, c]));
const planOf = (id: SetId) => { const raw = rd<{ swapCount: number; verifierViolations: string[]; requiresConvertedCandidates: string[] }>(`data/ap/stock/${id.toLowerCase()}-v3-swap-plan.json`); return { raw, p: parseSwapPlan(raw) }; };
const pid = (key: string, i: number) => `${key}#${i}`;
const unitOf = (key: string) => String(by.get(key)!.keyUnit); // 관리자 새 버전 서비스와 같은 단원: 후보 keyword_code 단원(세트 전 칸 동일)
const other = (id: SetId): SetId => (id === "PS1" ? "PS2" : "PS1");

/** 관리자 새 버전 미리보기·서버 액션과 같은 입력으로 조합 검사를 돌린다(DB 대신 스냅샷). */
function flow(id: SetId) {
  const cur = live[id].slots; const inputs: PlanSwapInput[] = planOf(id).p.swaps;
  const res = resolveSwaps(inputs, cur.map((s) => ({ section: s.section, position: s.position, candidateKey: s.candidateKey })));
  const idx = (s: Slot) => cur.filter((x) => x.section === s.section && x.candidateKey === s.candidateKey).sort((a, b) => a.position - b.position).findIndex((x) => x.position === s.position);
  const toSlot = (s: Slot, i: number): SlotItem => { const c = by.get(s.candidateKey)!; return { section: s.section, position: s.position, problemId: pid(s.candidateKey, i), candidateKey: s.candidateKey, kind: c.kind === "mc" ? "mc" : "frq", unit: unitOf(s.candidateKey), calculator: null, family: c.fam }; };
  const before = cur.map((s) => toSlot(s, idx(s)));
  const actionSwaps = res.swaps.map((sw) => ({ section: sw.section, position: sw.position, problemId: pid(sw.addKey, sw.addIndex ?? 0) }));
  const replacements = new Map(res.swaps.map((sw) => { const c = by.get(sw.addKey)!; return [pid(sw.addKey, sw.addIndex ?? 0), { problemId: pid(sw.addKey, sw.addIndex ?? 0), candidateKey: sw.addKey, kind: (c.kind === "mc" ? "mc" : "frq") as "mc" | "frq", unit: unitOf(sw.addKey), calculator: null, family: c.fam, section: sw.section, position: sw.position }]; }));
  const used = new Set(live[other(id)].slots.flatMap((s) => [0, 1, 2].map((i) => pid(s.candidateKey, i)))); // 다른 시험의 초안·게시본에 있는 문제
  const setSizes = new Map(all.filter((c) => c.kind === "mc").map((c) => [c.key, c.members.length] as [string, number]));
  const out = checkNewVersionComposition(before, actionSwaps, { apLabel: "full_practice", sectionCalculator: {}, unitBounds: fullPracticeUnitBounds("ap_psychology", "full_practice"), usedByOtherExams: used, replacements, setSizes });
  return { res, out, next: afterSwaps(cur, inputs.map((i) => ({ section: i.section as "ap_mc" | "ap_frq", position: i.position ?? 0, removeKey: i.removeKey ?? "", addKey: i.addKey, remove: {} as never, add: {} as never }))) };
}
const examOf = (slots: Slot[]) => [...new Set(slots.filter((s) => s.section === "ap_mc").map((s) => s.candidateKey))].reduce((n, k) => n + (by.get(k)!.exam ?? 0), 0);

describe("스냅샷: 게시 v2 두 시험", () => {
  it("PS1 v2·PS2 v2 는 게시본이고 DB 단원 수가 범위 안, 문항 77칸(MC 75 + FRQ 2)", () => {
    for (const id of ["PS1", "PS2"] as const) { expect(live[id].sourceVersionNo).toBe(2); expect(live[id].slots).toHaveLength(77); expect(live[id].slots.filter((s) => s.section === "ap_frq")).toHaveLength(2); expect(dbUnitViolations(live[id].slots, by)).toEqual([]); }
  });
  it("스냅샷의 DB keyword_code 단원과 재고의 keyUnit 이 같다(관리자 단원 집계와 배정기 단원이 일치)", () => {
    for (const [k, code] of Object.entries(live.dbKeywordCode ?? {})) { const c = by.get(k); if (c && c.kind === "mc") expect(c.keyUnit).toBe(Number(code.split(".")[0])); }
  });
});

describe("v3 배정", () => {
  it("가상 칸 0, 세트 정확히 PSYCH_SET_COUNT, FRQ = AAQ + EBQ, 독립 검증기 위반 0, 두 시험 문항 서로소", () => {
    const rs = assign.sets.map((s) => { expect(s.virtual).toHaveLength(0); expect(s.virtualSets).toHaveLength(0); expect(s.frqVirtual).toHaveLength(0); return resultOf(s.id, [...s.mcA.flatMap((k) => Array.from({ length: by.get(k)!.members.length }, () => ({ section: "ap_mc", position: 0, candidateKey: k }))), ...s.frqA.map((k) => ({ section: "ap_frq", position: 0, candidateKey: k }))], by); });
    expect(verifyPsychAssignment(rs)).toEqual([]);
    for (const r of rs) { expect(r.sets).toHaveLength(PSYCH_SET_COUNT); expect(r.frq.map((c) => c.frqType).sort()).toEqual(["aaq", "ebq"]); }
  });
  it("표의 백분율은 정수 인원과 맞는다(표를 가진 배정 문항 전부)", () => {
    for (const s of assign.sets) for (const k of [...s.mcA, ...s.frqA]) { const raw = by.get(k); void raw; }
    const flags = rd<Record<string, string[]>>("data/ap/stock/psych-table-pct-flags.json");
    for (const s of assign.sets) for (const k of [...s.mcA, ...s.frqA]) expect(flags[k], k).toBeUndefined();
    const stock = new Map<string, { payload: Record<string, unknown> }>();
    for (const f of ["psych-p1a", "psych-p1b", "psych-p2a", "psych-p3a", "psych-p3b", "psych-p4a", "psych-hard-a", "psych-hard-b"]) { const p = `data/ap/stock/${f}-items.json`; if (existsSync(p)) for (const r of rd<{ stockKey: string; payload: Record<string, unknown> }[]>(p)) stock.set(r.stockKey, r); }
    for (const s of assign.sets) for (const k of [...s.mcA, ...s.frqA]) for (const t of itemTables(stock.get(k)!.payload as never)) expect(pctRowViolations(t), k).toEqual([]);
  });
});

for (const id of ["PS1", "PS2"] as const) {
  describe(`${id} 계획(게시 v2 → v3)`, () => {
    const { raw, p } = planOf(id);
    it("형식·원본: sourceVersionNo 2, 이름 일치, 위반 0, 변환 필요 후보는 새 배치 키만", () => {
      expect(p.sourceVersionNo).toBe(2); expect(p.sourceSetName).toBe(live[id].sourceSetName); expect(raw.verifierViolations).toEqual([]); expect(raw.swapCount).toBe(p.swaps.length);
      for (const k of raw.requiresConvertedCandidates) expect(k).toMatch(/^psych-hard-[ab]:/);
      for (const k of live.convertedKeys) expect(raw.requiresConvertedCandidates).not.toContain(k);
    });
    it("실제 새 버전 검사(resolveSwaps + checkNewVersionComposition, DB 단원·절대 범위 11-19) 통과", () => {
      const { res, out } = flow(id); expect(res.problems).toEqual([]); expect(out.issues).toEqual([]);
    });
    it("교체 뒤 구성 = v3 배정, 위치 기준 구성·DB 단원 위반 0, 두 시험 독립 검증기 위반 0, 상대 시험 문항을 가져오지 않는다", () => {
      const { next } = flow(id); const t = assign.sets.find((s) => s.id === id)!;
      expect(new Set(next.map((s) => s.candidateKey))).toEqual(new Set([...t.mcA, ...t.frqA]));
      expect(slotViolations(id, next, by)).toEqual([]); expect(dbUnitViolations(next, by)).toEqual([]);
      const otherKeys = new Set(live[other(id)].slots.map((s) => s.candidateKey)); for (const sw of p.swaps) expect(otherKeys.has(sw.addKey), sw.addKey).toBe(false);
      expect(verifyPsychAssignment([resultOf(id, next, by), resultOf(other(id), flow(other(id)).next, by)])).toEqual([]);
    });
    it("계획은 다른 시험의 슬롯에는 적용되지 않는다(제거 문항이 없음)", () => {
      const o = live[other(id)].slots; const r = resolveSwaps(p.swaps, o.map((s) => ({ section: s.section, position: s.position, candidateKey: s.candidateKey }))); expect(r.problems.length).toBeGreaterThan(0);
    });
    it("교체는 같은 부류끼리: 단독→단독, 세트(3칸)→세트, AAQ→AAQ·EBQ→EBQ", () => {
      for (const sw of p.swaps) { expect(Boolean((sw as unknown as { remove: { shared: boolean } }).remove.shared)).toBe(Boolean((sw as unknown as { add: { shared: boolean } }).add.shared)); }
      for (const sw of p.swaps.filter((x) => x.section === "ap_frq")) expect(by.get(sw.addKey)!.frqType).toBe(by.get(sw.removeKey)!.frqType);
    });
  });
}

describe("배치 등록·통과 키·난이도 목표", () => {
  for (const b of ["psych-hard-a", "psych-hard-b"]) {
    it(`${b}: 등록·통과 키 파일·증거 파일`, () => {
      const reg = STOCK_BATCHES.find((x) => x.id === b); expect(reg).toMatchObject({ itemsFile: `${b}-items.json`, passKeysFile: `${b}-pass-keys.json`, evidenceFile: "evidence-psych-hard.json", supplement: true });
      const items = rd<{ stockKey: string; validation: string; duplicateOf?: string | null }[]>(`data/ap/stock/${b}-items.json`); const pass = new Set(rd<string[]>(`data/ap/stock/${b}-pass-keys.json`));
      for (const k of pass) expect(items.some((i) => i.stockKey === k && i.validation === "auto_passed")).toBe(true);
    });
  }
  it("exam_prep 문항 수: 배정 PS1·PS2 모두 MIN_EXAM 이상(기존 v2 배정은 PS1 1·PS2 1)", () => {
    const MIN_EXAM = Number(process.env.PSYCH_MIN_EXAM ?? 20);
    for (const s of assign.sets) expect(examOf(flow(s.id as SetId).next)).toBeGreaterThanOrEqual(MIN_EXAM);
    expect(examOf(live.PS1.slots)).toBeLessThanOrEqual(2);
  });
});
