// AP Macroeconomics Practice Exam 1·2 새 버전 계획(ma1-v3-swap-plan.json: MA1 게시 v2 → v3, ma2-v2-swap-plan.json: MA2 게시 v1 → v2)의 정합성(DB 없음). 게시본 SELECT 전용 스냅샷에 관리자 '새 버전' 흐름
// (resolveSwaps + checkNewVersionComposition, 단원 = DB candidate 의 keyword_code 첫 마디, 절대 범위)을 그대로 돌리고, 최종 구성이 v3 배정과 같고 독립 검증기 위반이 0 임을 확인한다.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fullPracticeUnitBounds } from "../ap-exam/full-set-rules";
import { macroNumericBounds, macroUnitBounds } from "../ap-exam/macro-rules";
import { checkNewVersionComposition, type SlotItem } from "../mock-exam/new-version";
import { verifyMacroAssignment, categorySummary, type MacroResult } from "../../scripts/ap-generation/macro-assign";
import { loadMacroPool } from "../../scripts/ap-generation/macro-pool";
import { parseSwapPlan, resolveSwaps } from "./new-version";

type Id = "MA1" | "MA2";
type Slot = { section: string; position: number; candidateKey: string };
const rd = <T>(p: string) => JSON.parse(readFileSync(p, "utf-8")) as T;
const snap = rd<Record<Id, { sourceSetName: string; sourceVersionNo: number; setGroupId: string; slots: Slot[] }> & { convertedKeys: string[]; dbKeywordCodes: Record<string, string | null>; usedByGroup: Record<string, string[]> }>("data/ap/stock/macro-ma1-ma2-published-slots.json");
const assign = Object.fromEntries(rd<{ sets: { id: Id; mcA: string[]; frqA: string[]; virtual: unknown[]; frqVirtual: unknown[] }[] }>("data/ap/stock/exact-assign-macro-ma1-ma2-v3.json").sets.map((s) => [s.id, s])) as unknown as Record<Id, { mcA: string[]; frqA: string[]; virtual: unknown[]; frqVirtual: unknown[] }>;
const PLAN: Record<Id, string> = { MA1: "ma1-v3-swap-plan.json", MA2: "ma2-v2-swap-plan.json" };
const plans = Object.fromEntries((["MA1", "MA2"] as Id[]).map((id) => [id, { p: parseSwapPlan(rd(`data/ap/stock/${PLAN[id]}`)), raw: rd<{ swapCount: number; verifierViolations: string[]; requiresConvertedCandidates?: string[] }>(`data/ap/stock/${PLAN[id]}`) }])) as Record<Id, { p: ReturnType<typeof parseSwapPlan>; raw: { swapCount: number; verifierViolations: string[]; requiresConvertedCandidates?: string[] } }>;
const { all } = loadMacroPool({ requireScreen: false }); const by = new Map(all.map((c) => [c.key, c]));
/** 관리자 새 버전 검사의 단원: DB candidate 의 keyword_code 첫 마디(DB 에 아직 없는 새 배치 후보는 재고 keywordCode — 적재 시 같은 값이 DB 에 들어간다). */
const dbUnit = (k: string) => String(snap.dbKeywordCodes[k] ?? by.get(k)!.members[0].topic).split(".")[0];
const toSlot = (s: Slot): SlotItem => { const c = by.get(s.candidateKey)!; return { section: s.section, position: s.position, problemId: `${s.candidateKey}#0`, candidateKey: s.candidateKey, kind: c.kind === "mc" ? "mc" : "frq", unit: c.kind === "mc" ? dbUnit(s.candidateKey) : null, family: c.fam, calculator: "allowed" }; };
function replay(id: Id, other: Slot[] | null = null) {
  const cur = snap[id].slots;
  const res = resolveSwaps(plans[id].p.swaps, cur.map((s) => ({ ...s })));
  expect(res.problems, `${id} resolveSwaps`).toEqual([]);
  const actionSwaps = res.swaps.map((sw) => ({ section: sw.section, position: sw.position, problemId: `${sw.addKey}#0` }));
  const replacements = new Map(res.swaps.map((sw) => { const sl = toSlot({ section: sw.section, position: sw.position, candidateKey: sw.addKey }); return [`${sw.addKey}#0`, { problemId: `${sw.addKey}#0`, candidateKey: sw.addKey, kind: sl.kind, unit: sl.unit, family: sl.family, calculator: sl.calculator }] as const; }));
  const otherId: Id = id === "MA1" ? "MA2" : "MA1";
  const used = new Set((other ?? snap[otherId].slots).map((s) => `${s.candidateKey}#0`)); // 다른 계열의 게시·초안 세트에 쓰인 문항
  const out = checkNewVersionComposition(cur.map(toSlot), actionSwaps, { apLabel: "full_practice", sectionCalculator: { ap_mc: "allowed", ap_frq: "allowed" }, unitBounds: fullPracticeUnitBounds("ap_macroeconomics", "full_practice"), usedByOtherExams: used, replacements, setSizes: new Map() });
  expect(out.issues, `${id} 새 버전 검증`).toEqual([]);
  return { next: cur.map((s) => { const sw = res.swaps.find((x) => x.section === s.section && x.position === s.position); return sw ? { ...s, candidateKey: sw.addKey } : s; }), swaps: res.swaps };
}
const resultOf = (id: string, s: Slot[]): MacroResult => ({ id, singles: s.filter((x) => x.section === "ap_mc").map((x) => by.get(x.candidateKey)!), frq: s.filter((x) => x.section === "ap_frq").map((x) => by.get(x.candidateKey)!), virtual: [], frqVirtual: [] });
const exam = (s: Slot[]) => s.filter((x) => x.section === "ap_mc").reduce((n, x) => n + (by.get(x.candidateKey)!.exam ?? 0), 0);

describe("AP Macroeconomics Practice Exam 1·2 새 버전 계획(v3 배정)", () => {
  it("게시본 스냅샷: MA1 v2 · MA2 v1, 둘 다 ap_mc 60 + ap_frq 3, 계획의 제거 문항이 그 칸에 있고 계획 파일 형식이 맞다", () => {
    expect(snap.MA1.sourceVersionNo).toBe(2); expect(snap.MA2.sourceVersionNo).toBe(1);
    for (const id of ["MA1", "MA2"] as Id[]) {
      const s = snap[id].slots; expect(s.filter((x) => x.section === "ap_mc")).toHaveLength(60); expect(s.filter((x) => x.section === "ap_frq")).toHaveLength(3);
      const { p, raw } = plans[id]; expect(p.set).toBe(id); expect(p.sourceSetName).toBe(snap[id].sourceSetName); expect(p.sourceVersionNo).toBe(snap[id].sourceVersionNo); expect(p.swaps.length).toBe(raw.swapCount); expect(raw.verifierViolations).toEqual([]);
      for (const sw of p.swaps) expect(s.find((x) => x.section === sw.section && x.position === sw.position)?.candidateKey).toBe(sw.removeKey);
    }
  });
  it("관리자 새 버전 흐름(resolveSwaps + checkNewVersionComposition, DB keyword_code 단원·절대 범위)을 각각 한 번에 통과하고, 최종 구성이 v3 배정과 같다", () => {
    for (const id of ["MA1", "MA2"] as Id[]) {
      const r = replay(id);
      const mc = new Set(r.next.filter((x) => x.section === "ap_mc").map((x) => x.candidateKey)); expect([...mc].sort()).toEqual([...assign[id].mcA].sort());
      expect(r.next.filter((x) => x.section === "ap_frq").map((x) => x.candidateKey).sort()).toEqual([...assign[id].frqA].sort());
    }
  });
  it("두 시험은 서로 독립이다: 한 시험의 현재 문항은 다른 시험으로 가지 않고(순환 겹침·중간판 없음) 어느 순서로 적용해도 같은 결과다", () => {
    for (const id of ["MA1", "MA2"] as Id[]) {
      const o: Id = id === "MA1" ? "MA2" : "MA1"; const curO = new Set(snap[o].slots.map((x) => x.candidateKey));
      for (const k of [...assign[id].mcA, ...assign[id].frqA]) expect(curO.has(k), `${id} 목표 ${k} 가 ${o} 의 현재 문항`).toBe(false);
    }
    const a = replay("MA1"); const b = replay("MA2");
    const a2 = replay("MA1", b.next); const b2 = replay("MA2", a.next); // 상대가 이미 새 버전으로 바뀐 뒤 적용해도 같은 검증 통과(다른 계열에 쓰인 문항 = 상대의 새 구성)
    expect(a2.next).toEqual(a.next); expect(b2.next).toEqual(b.next);
  });
  it("최종 구성: 가상 0, 독립 검증기 위반 0(문항군·세트 간 겹침·FRQ 유형·한 시험 전용 원형 포함), 두 시험 문항 서로소, exam_prep MC 각 20 이상(26)", () => {
    const f = { MA1: replay("MA1").next, MA2: replay("MA2").next };
    for (const id of ["MA1", "MA2"] as Id[]) { expect(assign[id].virtual).toEqual([]); expect(assign[id].frqVirtual).toEqual([]); expect(exam(f[id])).toBeGreaterThanOrEqual(20); expect(exam(f[id])).toBe(26); }
    expect(verifyMacroAssignment([resultOf("MA1", f.MA1), resultOf("MA2", f.MA2)])).toEqual([]);
    const k1 = new Set(f.MA1.map((x) => x.candidateKey)); expect(f.MA2.filter((x) => k1.has(x.candidateKey))).toEqual([]);
  });
  it("공식 범위: 단원·스킬 범주·수치 분석(DB 단원 기준)과 칸의 단원 순서(오름차순) 유지", () => {
    const ub = macroUnitBounds(); const nb = macroNumericBounds();
    for (const id of ["MA1", "MA2"] as Id[]) {
      const next = replay(id).next.filter((x) => x.section === "ap_mc").sort((a, b) => a.position - b.position);
      const units = next.map((x) => Number(dbUnit(x.candidateKey)));
      for (const [u, b] of Object.entries(ub)) { const n = units.filter((x) => x === Number(u)).length; expect(n, `${id} 단원 ${u}`).toBeGreaterThanOrEqual(b.min); expect(n).toBeLessThanOrEqual(b.max); }
      expect(units.every((u, i) => i === 0 || u >= units[i - 1]), `${id} 칸의 단원 순서`).toBe(true);
      const sk = categorySummary(resultOf(id, next)); expect(sk.numeric).toBeGreaterThanOrEqual(nb.min); expect(sk.numeric).toBeLessThanOrEqual(nb.max);
      for (const sw of plans[id].p.swaps) { const rm = dbUnit(sw.removeKey!), ad = dbUnit(sw.addKey); expect(ad, `${id} #${sw.position} 칸의 단원`).toBe(rm); }
    }
  });
  it("솔버의 단원은 DB 가 쓰는 keyword_code 첫 마디와 같다(재고 keywordCode = DB keyword_code)", () => {
    let n = 0;
    for (const [k, code] of Object.entries(snap.dbKeywordCodes)) { const c = by.get(k); if (!c || c.kind !== "mc") continue; n++; expect(String(code).split(".")[0], k).toBe(String(c.members[0].unit)); expect(code, k).toBe(c.members[0].topic); }
    expect(n).toBeGreaterThan(150);
  });
  it("교체해 넣는 문항은 DB 변환 완료 후보이거나, 계획의 requiresConvertedCandidates(새 배치 macro-hard-a/b 통과 키)에 적혀 있다", () => {
    const conv = new Set(snap.convertedKeys);
    const newKeys = new Set(["macro-hard-a", "macro-hard-b"].flatMap((b) => rd<{ stockKey: string; validation: string; duplicateOf?: string | null }[]>(`data/ap/stock/${b}-items.json`).filter((r) => r.validation === "auto_passed" && !r.duplicateOf).map((r) => r.stockKey)));
    for (const id of ["MA1", "MA2"] as Id[]) {
      const adds = plans[id].p.swaps.map((s) => s.addKey); expect(new Set(adds).size).toBe(adds.length);
      const req = new Set(plans[id].raw.requiresConvertedCandidates ?? []);
      for (const k of adds) { if (conv.has(k)) { expect(req.has(k)).toBe(false); continue; } expect(newKeys.has(k), `${id} ${k} 는 변환 완료도 새 배치 통과 키도 아니다`).toBe(true); expect(req.has(k)).toBe(true); }
      for (const k of req) expect(adds.includes(k)).toBe(true);
    }
  });
  it("교체 문항은 모두 화면 증거를 가진 재고 문항이고 단독 MC 는 같은 부류끼리만 바뀐다", () => {
    for (const id of ["MA1", "MA2"] as Id[]) for (const sw of plans[id].p.swaps) { const r = by.get(sw.removeKey!)!, a = by.get(sw.addKey)!; expect(a.screen, sw.addKey).toBe(true); expect(a.kind).toBe(r.kind); expect(a.members).toHaveLength(1); }
  });
});
