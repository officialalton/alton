// 풀 모의고사 과목별 구성 규칙(순수). 단원 범위는 공식 비중(data/ap/curriculum-2027/<과목>.json weights)을 42문항 등 실제 문항 수에 맞춰 정수로 바꾼 값이다.
// AB 는 기존 OFFICIAL.unitBounds(ab-select.ts)를 그대로 쓴다. 통계는 공식 MC 비중 20-30/15-25/15-25/10-20/10-20 % × 42 → [9,12]/[7,10]/[7,10]/[5,8]/[5,8],
// 스킬(Practice) 5-10/20-30/25-35/25-35 % → [3,4]/[9,12]/[11,14]/[11,14]. 목표 배분(제안, 공식 고정 아님)은 STATS_FULL_TARGET.
import { OFFICIAL } from "./ab-select";

export type UnitBounds = Record<string, { min: number; max: number }>;
export const rangeFromPct = ([lo, hi]: [number, number], n: number) => ({ min: Math.ceil((lo * n) / 100 - 1e-9), max: Math.floor((hi * n) / 100 + 1e-9) });

export const STATS_MC_COUNT = 42;
export const STATS_MC_UNIT_PCT: Record<string, [number, number]> = { "1": [20, 30], "2": [15, 25], "3": [15, 25], "4": [10, 20], "5": [10, 20] };
export const STATS_MC_SKILL_PCT: Record<string, [number, number]> = { "1": [5, 10], "2": [20, 30], "3": [25, 35], "4": [25, 35] };
/** 공유 자료 세트: 3문항 세트 2개(CED p.160 샘플·AP Central) — 하나는 확률·확률변수·분포(단원 2), 하나는 회귀(단원 5). 세트의 세 문항은 함께 있어야 한다. */
export const STATS_SETS = [{ unit: "2", items: 3 }, { unit: "5", items: 3 }] as const;
export const STATS_FULL_TARGET = { units: { "1": 10, "2": 9, "3": 9, "4": 7, "5": 7 } as Record<string, number>, skills: { "1": 4, "2": 10, "3": 14, "4": 14 } as Record<string, number> };
export const STATS_FRQ_COUNT = 4;
export const STATS_FRQ_POINTS = 10;

const mapBounds = (pct: Record<string, [number, number]>, n: number): UnitBounds => Object.fromEntries(Object.entries(pct).map(([k, v]) => [k, rangeFromPct(v, n)]));
export const statsUnitBounds = (): UnitBounds => mapBounds(STATS_MC_UNIT_PCT, STATS_MC_COUNT);
export const statsSkillBounds = (): UnitBounds => mapBounds(STATS_MC_SKILL_PCT, STATS_MC_COUNT);

/** 풀 모의고사의 MC 단원 허용 범위. 풀 세트가 아니거나 규칙이 없는 과목은 undefined(단원 점검 안 함). 과목을 AB 로 가정하지 않는다. */
export function fullPracticeUnitBounds(subject: string | null | undefined, label: string | null | undefined): UnitBounds | undefined {
  if (label !== "full_practice") return undefined;
  if (subject === "ap_calculus_ab") return Object.fromEntries(Object.entries(OFFICIAL.unitBounds).map(([u, [min, max]]) => [u, { min, max }]));
  if (subject === "ap_statistics") return statsUnitBounds();
  return undefined;
}

export type StatsSetItem = { kind: "mc" | "frq"; unit: string | null; skillCat: string | null; candidateKey: string | null; position: number };
/** 통계 풀 세트 구성 검증(순수): MC 42·FRQ 4, 단원·스킬 범위, 공유 세트 2개(각 3문항, 연속 위치, 단원 2·5). 위반 코드 배열. */
export function verifyStatsFullComposition(items: StatsSetItem[]): string[] {
  const out: string[] = [];
  const mc = items.filter((i) => i.kind === "mc"), frq = items.filter((i) => i.kind === "frq");
  if (mc.length !== STATS_MC_COUNT) out.push(`mc_count_${mc.length}/${STATS_MC_COUNT}`);
  if (frq.length !== STATS_FRQ_COUNT) out.push(`frq_count_${frq.length}/${STATS_FRQ_COUNT}`);
  for (const [u, b] of Object.entries(statsUnitBounds())) { const n = mc.filter((i) => i.unit === u).length; if (n < b.min || n > b.max) out.push(`unit_${u}_${n}_not_in_${b.min}-${b.max}`); }
  for (const [c, b] of Object.entries(statsSkillBounds())) { const n = mc.filter((i) => i.skillCat === c).length; if (n < b.min || n > b.max) out.push(`skill_${c}_${n}_not_in_${b.min}-${b.max}`); }
  const byKey = new Map<string, StatsSetItem[]>();
  for (const i of mc) if (i.candidateKey) byKey.set(i.candidateKey, [...(byKey.get(i.candidateKey) ?? []), i]);
  const sets = [...byKey.values()].filter((v) => v.length > 1);
  if (sets.length !== STATS_SETS.length) out.push(`shared_sets_${sets.length}/${STATS_SETS.length}`);
  for (const s of sets) {
    if (s.length !== 3) out.push(`set_size_${s.length}_not_3`);
    const pos = s.map((x) => x.position).sort((a, b) => a - b);
    if (pos.some((p, i) => i > 0 && p !== pos[i - 1] + 1)) out.push(`set_not_contiguous_${s[0].candidateKey}`);
  }
  const units = sets.map((s) => s[0].unit).sort();
  if (sets.length === STATS_SETS.length && units.join() !== STATS_SETS.map((x) => x.unit).sort().join()) out.push(`set_units_${units.join("+")}_not_${STATS_SETS.map((x) => x.unit).join("+")}`);
  return out;
}
