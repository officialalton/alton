// AP Microeconomics 풀 모의고사 구성 규칙(순수). 근거: AP Microeconomics CED V.1(©2026) Exam Information p.121–124, docs/ap/microeconomics-facts.md.
// MC 60(모두 단독 문항, 5지선다), FRQ 3 = 긴 1(10점) + 짧은 2(각 5점) = 20점. 단원 MC 비중 12-15 / 20-25 / 22-25 / 15-22 / 10-13 / 8-13 %, 스킬 범주 MC 비중 범주1 30-42 / 범주2 37-47 / 범주3 16-25 %
// (범주 4 그래프 그리기는 MC 에서 평가하지 않음), 수치 분석 스킬(1.C·2.C·3.C) 문항 20-30 %. MC 문항 수 경계는 하한 내림·상한 올림(chem 과 같은 관용; 비중 합이 100% 에 걸쳐 있어 엄격히 올림·내림하면 해가 없다).
// FRQ 점수의 과제 유형 비중: 그래프 30-50 / 단언 10-20 / 설명 25-35 / 수치 15-30 %(20점 기준 정수 점수 6-10 / 2-4 / 5-7 / 3-6; 점수는 쪼갤 수 없으므로 범위 안으로 엄격하게).
// 물리와 달리 스킬(범주) 범위는 차단 조건이다(2026-10-13 오너: 이번에는 공식 범위 안으로). 마이크로의 공유 그래프 세트는 공식 구성 미공표라 쓰지 않는다.
export type UnitBounds = Record<string, { min: number; max: number }>;
export const MICRO_MC_COUNT = 60;
export const MICRO_MC_UNIT_PCT: Record<string, [number, number]> = { "1": [12, 15], "2": [20, 25], "3": [22, 25], "4": [15, 22], "5": [10, 13], "6": [8, 13] };
export const MICRO_MC_CATEGORY_PCT: Record<string, [number, number]> = { "1": [30, 42], "2": [37, 47], "3": [16, 25] };
export const MICRO_NUMERIC_PCT: [number, number] = [20, 30];
export const MICRO_NUMERIC_SKILLS = ["1.C", "2.C", "3.C"] as const;
export const MICRO_FRQ_COUNT = 3;
export const MICRO_FRQ_POINTS = 20;
type TaskType = "graph" | "assertion" | "explain" | "numeric";
export const MICRO_FRQ_TYPE_PCT: Record<TaskType, [number, number]> = { graph: [30, 50], assertion: [10, 20], explain: [25, 35], numeric: [15, 30] };
/** FRQ 원형별 점수 프로필(파트 response_mode: draw=그래프, select=단언, explain=설명, calculate=수치). Python `micro_coverage.frq_task_points` 와 같은 값(테스트가 대조한다). */
export type MicroFrqProfile = { points: number; graph: number; assertion: number; explain: number; numeric: number };
export const MICRO_FRQ_PROFILES: Record<string, MicroFrqProfile> = {
  frq_micro_game: { points: 5, graph: 0, assertion: 2, explain: 3, numeric: 0 },
  frq_micro_monopoly: { points: 5, graph: 0, assertion: 0, explain: 1, numeric: 4 },
  mif_long_market_policy: { points: 10, graph: 4, assertion: 1, explain: 2, numeric: 3 },
  mif_long_monopoly: { points: 10, graph: 4, assertion: 0, explain: 2, numeric: 4 },
  mif_long_pc_firm: { points: 10, graph: 5, assertion: 1, explain: 2, numeric: 2 },
  mif_short_elasticity: { points: 5, graph: 0, assertion: 1, explain: 1, numeric: 3 },
  mif_short_externality: { points: 5, graph: 2, assertion: 0, explain: 2, numeric: 1 },
  mif_short_labor: { points: 5, graph: 0, assertion: 1, explain: 2, numeric: 2 },
  mif_short_mc: { points: 5, graph: 3, assertion: 1, explain: 1, numeric: 0 },
  mif_short_trade: { points: 5, graph: 1, assertion: 1, explain: 1, numeric: 2 },
};
export const MICRO_FRQ_TYPES = Object.keys(MICRO_FRQ_PROFILES);
export const MICRO_LONG_TYPES = MICRO_FRQ_TYPES.filter((t) => MICRO_FRQ_PROFILES[t].points === 10);
export const MICRO_SHORT_TYPES = MICRO_FRQ_TYPES.filter((t) => MICRO_FRQ_PROFILES[t].points === 5);

const floorCeil = ([lo, hi]: [number, number], n: number) => ({ min: Math.floor((lo * n) / 100 + 1e-9), max: Math.ceil((hi * n) / 100 - 1e-9) });
const mapFloorCeil = (pct: Record<string, [number, number]>, n: number): UnitBounds => Object.fromEntries(Object.entries(pct).map(([k, v]) => [k, floorCeil(v, n)]));
export const microUnitBounds = (): UnitBounds => mapFloorCeil(MICRO_MC_UNIT_PCT, MICRO_MC_COUNT);
export const microCategoryBounds = (): UnitBounds => mapFloorCeil(MICRO_MC_CATEGORY_PCT, MICRO_MC_COUNT);
export const microNumericBounds = () => floorCeil(MICRO_NUMERIC_PCT, MICRO_MC_COUNT);
export const microFrqTypeBounds = (): Record<TaskType, { min: number; max: number }> =>
  Object.fromEntries(Object.entries(MICRO_FRQ_TYPE_PCT).map(([k, [lo, hi]]) => [k, { min: Math.ceil((lo * MICRO_FRQ_POINTS) / 100 - 1e-9), max: Math.floor((hi * MICRO_FRQ_POINTS) / 100 + 1e-9) }])) as Record<TaskType, { min: number; max: number }>;
/** 공식 비중 상한×60 — 비중 합이 100% 에 닿으려면 모든 단원이 상한 근처여야 해서 실수 목표로 쓴다. */
export const MICRO_FULL_TARGET = { units: Object.fromEntries(Object.entries(MICRO_MC_UNIT_PCT).map(([u, [lo, hi]]) => [u, ((lo + hi) / 2 * MICRO_MC_COUNT) / 100])) as Record<string, number> };

export type MicroSetItem = { kind: "mc" | "frq"; unit: string | null; skill: string | null; candidateKey: string | null; position: number; frqType?: string };
/** 마이크로 FRQ 3문항(긴 1 + 짧은 2)의 구조·과제 유형 비중 위반 목록. */
export function verifyMicroFrqExam(types: string[]): string[] {
  const out: string[] = [];
  if (types.length !== MICRO_FRQ_COUNT) out.push(`frq_count_${types.length}/${MICRO_FRQ_COUNT}`);
  if (new Set(types).size !== types.length) out.push("frq_duplicate_type");
  const prof = types.map((t) => MICRO_FRQ_PROFILES[t]);
  if (prof.some((p) => !p)) { out.push("frq_unknown_type"); return out; }
  if (prof.filter((p) => p.points === 10).length !== 1 || prof.filter((p) => p.points === 5).length !== 2) out.push("frq_structure_not_1_long_2_short");
  const tot: Record<TaskType, number> = { graph: 0, assertion: 0, explain: 0, numeric: 0 };
  for (const p of prof) for (const k of Object.keys(tot) as TaskType[]) tot[k] += p[k];
  for (const [k, b] of Object.entries(microFrqTypeBounds())) { const n = tot[k as TaskType]; if (n < b.min || n > b.max) out.push(`frq_${k}_${n}_not_in_${b.min}-${b.max}`); }
  return out;
}
/** 마이크로 풀 세트 구성 검증(순수, 차단 위반): MC 60·FRQ 3, 단원·스킬 범주·수치 분석 범위, 4.x 스킬 금지, FRQ 구조·과제 유형 비중. FRQ 문항군·재고 검사는 계획기가 따로 한다. */
export function verifyMicroFullComposition(items: MicroSetItem[]): string[] {
  const out: string[] = [];
  const mc = items.filter((i) => i.kind === "mc"), frq = items.filter((i) => i.kind === "frq");
  if (mc.length !== MICRO_MC_COUNT) out.push(`mc_count_${mc.length}/${MICRO_MC_COUNT}`);
  for (const [u, b] of Object.entries(microUnitBounds())) { const n = mc.filter((i) => i.unit === u).length; if (n < b.min || n > b.max) out.push(`unit_${u}_${n}_not_in_${b.min}-${b.max}`); }
  for (const [c, b] of Object.entries(microCategoryBounds())) { const n = mc.filter((i) => (i.skill ?? "").startsWith(`${c}.`)).length; if (n < b.min || n > b.max) out.push(`category_${c}_${n}_not_in_${b.min}-${b.max}`); }
  const nb = microNumericBounds(); const nn = mc.filter((i) => (MICRO_NUMERIC_SKILLS as readonly string[]).includes(i.skill ?? "")).length;
  if (nn < nb.min || nn > nb.max) out.push(`numeric_${nn}_not_in_${nb.min}-${nb.max}`);
  if (mc.some((i) => (i.skill ?? "").startsWith("4."))) out.push("category_4_not_assessed_in_mc");
  const keys = mc.map((i) => i.candidateKey).filter(Boolean); if (new Set(keys).size !== keys.length) out.push("mc_duplicate_key");
  out.push(...verifyMicroFrqExam(frq.map((i) => i.frqType ?? "")));
  const ft = frq.map((i) => i.candidateKey).filter(Boolean);
  if (new Set(ft).size !== ft.length) out.push("frq_duplicate_key");
  return out;
}
