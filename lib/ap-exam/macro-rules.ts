// AP Macroeconomics 풀 모의고사 구성 규칙(순수). 근거: AP Macroeconomics CED V.1(©2026) Exam Information p.129–132, docs/ap/macroeconomics-facts.md.
// MC 60(모두 단독 문항, 5지선다), FRQ 3 = 긴 1(10점) + 짧은 2(각 5점) = 20점. 단원 MC 비중 5-10 / 12-17 / 17-27 / 18-23 / 20-30 / 10-13 %, 스킬 범주 MC 비중 범주1 30-40 / 범주2 25-32 / 범주3 30-40 %
// (범주 4 그래프 그리기는 MC 에서 평가하지 않음), 수치 분석 스킬(1.C·2.C·3.C) 문항 16-20 %. MC 문항 수 경계는 하한 내림·상한 올림(chem 과 같은 관용; 비중 합이 100% 에 걸쳐 있어 엄격히 올림·내림하면 해가 없다).
// FRQ 점수의 과제 유형 비중: 그래프 30-50 / 단언 10-20 / 설명 25-35 / 수치 10-25 %(20점 기준 정수 점수 6-10 / 2-4 / 5-7 / 2-5; 점수는 쪼갤 수 없으므로 범위 안으로 엄격하게).
// 물리와 달리 스킬(범주) 범위는 차단 조건이다(2026-10-13 오너: 이번에는 공식 범위 안으로). 매크로 CED 의 MC 샘플은 모두 단독 문항이다(공유 그래프 세트 없음).
export type UnitBounds = Record<string, { min: number; max: number }>;
export const MACRO_MC_COUNT = 60;
export const MACRO_MC_UNIT_PCT: Record<string, [number, number]> = { "1": [5, 10], "2": [12, 17], "3": [17, 27], "4": [18, 23], "5": [20, 30], "6": [10, 13] };
export const MACRO_MC_CATEGORY_PCT: Record<string, [number, number]> = { "1": [30, 40], "2": [25, 32], "3": [30, 40] };
export const MACRO_NUMERIC_PCT: [number, number] = [16, 20];
export const MACRO_NUMERIC_SKILLS = ["1.C", "2.C", "3.C"] as const;
export const MACRO_FRQ_COUNT = 3;
export const MACRO_FRQ_POINTS = 20;
type TaskType = "graph" | "assertion" | "explain" | "numeric";
export const MACRO_FRQ_TYPE_PCT: Record<TaskType, [number, number]> = { graph: [30, 50], assertion: [10, 20], explain: [25, 35], numeric: [10, 25] };
/** FRQ 원형별 점수 프로필(파트 response_mode: draw=그래프, select=단언, explain=설명, calculate=수치). Python `macro_coverage.frq_task_points` 와 같은 값(테스트가 대조한다). */
export type MacroFrqProfile = { points: number; graph: number; assertion: number; explain: number; numeric: number };
export const MACRO_FRQ_PROFILES: Record<string, MacroFrqProfile> = {
  maf_long_adas_policy: { points: 10, graph: 5, assertion: 1, explain: 3, numeric: 1 },
  maf_long_money_market: { points: 10, graph: 4, assertion: 2, explain: 2, numeric: 2 },
  maf_long_open_economy: { points: 10, graph: 4, assertion: 1, explain: 3, numeric: 2 },
  maf_short_fiscal_multiplier: { points: 5, graph: 0, assertion: 1, explain: 2, numeric: 2 },
  maf_short_fx_trade: { points: 5, graph: 2, assertion: 1, explain: 2, numeric: 0 },
  maf_short_gdp_data: { points: 5, graph: 0, assertion: 1, explain: 2, numeric: 2 },
  maf_short_lf_crowding: { points: 5, graph: 2, assertion: 0, explain: 3, numeric: 0 },
  maf_short_money_banking: { points: 5, graph: 0, assertion: 1, explain: 1, numeric: 3 },
  maf_short_phillips: { points: 5, graph: 3, assertion: 0, explain: 2, numeric: 0 },
  maf_short_ppc_trade: { points: 5, graph: 2, assertion: 1, explain: 1, numeric: 1 },
};
export const MACRO_FRQ_TYPES = Object.keys(MACRO_FRQ_PROFILES);
export const MACRO_LONG_TYPES = MACRO_FRQ_TYPES.filter((t) => MACRO_FRQ_PROFILES[t].points === 10);
export const MACRO_SHORT_TYPES = MACRO_FRQ_TYPES.filter((t) => MACRO_FRQ_PROFILES[t].points === 5);

const floorCeil = ([lo, hi]: [number, number], n: number) => ({ min: Math.floor((lo * n) / 100 + 1e-9), max: Math.ceil((hi * n) / 100 - 1e-9) });
const mapFloorCeil = (pct: Record<string, [number, number]>, n: number): UnitBounds => Object.fromEntries(Object.entries(pct).map(([k, v]) => [k, floorCeil(v, n)]));
export const macroUnitBounds = (): UnitBounds => mapFloorCeil(MACRO_MC_UNIT_PCT, MACRO_MC_COUNT);
export const macroCategoryBounds = (): UnitBounds => mapFloorCeil(MACRO_MC_CATEGORY_PCT, MACRO_MC_COUNT);
export const macroNumericBounds = () => floorCeil(MACRO_NUMERIC_PCT, MACRO_MC_COUNT);
export const macroFrqTypeBounds = (): Record<TaskType, { min: number; max: number }> =>
  Object.fromEntries(Object.entries(MACRO_FRQ_TYPE_PCT).map(([k, [lo, hi]]) => [k, { min: Math.ceil((lo * MACRO_FRQ_POINTS) / 100 - 1e-9), max: Math.floor((hi * MACRO_FRQ_POINTS) / 100 + 1e-9) }])) as Record<TaskType, { min: number; max: number }>;
/** 공식 비중 상한×60 — 비중 합이 100% 에 닿으려면 모든 단원이 상한 근처여야 해서 실수 목표로 쓴다. */
export const MACRO_FULL_TARGET = { units: Object.fromEntries(Object.entries(MACRO_MC_UNIT_PCT).map(([u, [lo, hi]]) => [u, ((lo + hi) / 2 * MACRO_MC_COUNT) / 100])) as Record<string, number> };

export type MacroSetItem = { kind: "mc" | "frq"; unit: string | null; skill: string | null; candidateKey: string | null; position: number; frqType?: string };
/** 매크로 FRQ 3문항(긴 1 + 짧은 2)의 구조·과제 유형 비중 위반 목록. */
export function verifyMacroFrqExam(types: string[]): string[] {
  const out: string[] = [];
  if (types.length !== MACRO_FRQ_COUNT) out.push(`frq_count_${types.length}/${MACRO_FRQ_COUNT}`);
  if (new Set(types).size !== types.length) out.push("frq_duplicate_type");
  const prof = types.map((t) => MACRO_FRQ_PROFILES[t]);
  if (prof.some((p) => !p)) { out.push("frq_unknown_type"); return out; }
  if (prof.filter((p) => p.points === 10).length !== 1 || prof.filter((p) => p.points === 5).length !== 2) out.push("frq_structure_not_1_long_2_short");
  const tot: Record<TaskType, number> = { graph: 0, assertion: 0, explain: 0, numeric: 0 };
  for (const p of prof) for (const k of Object.keys(tot) as TaskType[]) tot[k] += p[k];
  for (const [k, b] of Object.entries(macroFrqTypeBounds())) { const n = tot[k as TaskType]; if (n < b.min || n > b.max) out.push(`frq_${k}_${n}_not_in_${b.min}-${b.max}`); }
  return out;
}
/** 매크로 풀 세트 구성 검증(순수, 차단 위반): MC 60·FRQ 3, 단원·스킬 범주·수치 분석 범위, 4.x 스킬 금지, FRQ 구조·과제 유형 비중. FRQ 문항군·재고 검사는 계획기가 따로 한다. */
export function verifyMacroFullComposition(items: MacroSetItem[]): string[] {
  const out: string[] = [];
  const mc = items.filter((i) => i.kind === "mc"), frq = items.filter((i) => i.kind === "frq");
  if (mc.length !== MACRO_MC_COUNT) out.push(`mc_count_${mc.length}/${MACRO_MC_COUNT}`);
  for (const [u, b] of Object.entries(macroUnitBounds())) { const n = mc.filter((i) => i.unit === u).length; if (n < b.min || n > b.max) out.push(`unit_${u}_${n}_not_in_${b.min}-${b.max}`); }
  for (const [c, b] of Object.entries(macroCategoryBounds())) { const n = mc.filter((i) => (i.skill ?? "").startsWith(`${c}.`)).length; if (n < b.min || n > b.max) out.push(`category_${c}_${n}_not_in_${b.min}-${b.max}`); }
  const nb = macroNumericBounds(); const nn = mc.filter((i) => (MACRO_NUMERIC_SKILLS as readonly string[]).includes(i.skill ?? "")).length;
  if (nn < nb.min || nn > nb.max) out.push(`numeric_${nn}_not_in_${nb.min}-${nb.max}`);
  if (mc.some((i) => (i.skill ?? "").startsWith("4."))) out.push("category_4_not_assessed_in_mc");
  const keys = mc.map((i) => i.candidateKey).filter(Boolean); if (new Set(keys).size !== keys.length) out.push("mc_duplicate_key");
  out.push(...verifyMacroFrqExam(frq.map((i) => i.frqType ?? "")));
  const ft = frq.map((i) => i.candidateKey).filter(Boolean);
  if (new Set(ft).size !== ft.length) out.push("frq_duplicate_key");
  return out;
}
