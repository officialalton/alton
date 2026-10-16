// AP U.S. History 풀 모의고사 구성 규칙(순수, docs/ap/ushistory-facts.md; CED effective Fall 2026 p.497-501).
// MC 55 = 3–4문항 자료 세트(공식: "typically in sets of three to four"), 단원(Period) 비중 4–6/6–8/10–17×6/4–6 % 를 55문항에 옮길 때 하한 내림·상한 올림(다른 과목과 같은 관용).
// 공식 미공표라 우리 내부 구성(공식 구성이라 주장하지 않는다): 세트 수 14–18, 자료 유형 최소(paired ≥1 — 공식 "at least one set of paired text-based stimuli", 표·그래프 ≥1, 1차 ≥5, 2차 ≥2), 스킬 범주 1–5 각 ≥3.
// FRQ 5 = SAQ 3(q1 2차 자료 · q2 1차 자료 · q3 비텍스트, 서로 다른 시대) + DBQ 1 + LEQ 1(필수, 선택 없음 — 2027 개편).
export type UnitBounds = Record<string, { min: number; max: number }>;
export const USH_MC_COUNT = 55;
export const USH_UNIT_PCT: Record<string, [number, number]> = { "1": [4, 6], "2": [6, 8], "3": [10, 17], "4": [10, 17], "5": [10, 17], "6": [10, 17], "7": [10, 17], "8": [10, 17], "9": [4, 6] };
export const USH_SET_SIZE = { min: 3, max: 4 } as const;
export const USH_SET_COUNT = { min: 14, max: 18 } as const;
export const USH_STIM_TYPES = ["primary_text", "secondary_text", "paired_text", "quantitative"] as const;
export type UshStimType = (typeof USH_STIM_TYPES)[number];
export const USH_STIM_MIN: Record<UshStimType, number> = { primary_text: 5, secondary_text: 2, paired_text: 1, quantitative: 1 };
export const USH_SKILL_CATEGORY_MIN = 3;
export const USH_FRQ_TEMPLATES = ["saq1", "saq2", "saq3", "dbq", "leq"] as const;
export const USH_FRQ_COUNT = 5;
export const USH_FRQ_POINTS: Record<string, number> = { saq1: 3, saq2: 3, saq3: 3, dbq: 7, leq: 6 };
/** 목표 배분(제안): 단원별 문항 수. */
export const USH_FULL_TARGET = { units: { "1": 3, "2": 4, "3": 8, "4": 7, "5": 8, "6": 7, "7": 8, "8": 7, "9": 3 } as Record<string, number> };
const floorCeil = ([lo, hi]: [number, number], n: number) => ({ min: Math.floor((lo * n) / 100 + 1e-9), max: Math.ceil((hi * n) / 100 - 1e-9) });
export const ushUnitBounds = (): UnitBounds => Object.fromEntries(Object.entries(USH_UNIT_PCT).map(([k, v]) => [k, floorCeil(v, USH_MC_COUNT)]));
/** 스킬 코드("3.B") → 범주 번호("3"). 1–5 만 MC 대상. */
export const ushSkillCat = (skill: string | null | undefined): string => String(skill ?? "").split(".")[0];
export const ushUnitOfTopic = (topic: string): string => /^U?(\d+)\./.exec(topic)?.[1] ?? "";

/** dbUnit = 후보 keyword_code 단원(관리자 새 버전·초안이 DB 에서 읽는 단원; 세트의 모든 문항에 같은 값). 주면 같은 범위를 dbUnit 으로도 검사한다. */
export type UshSetItem = { kind: "mc" | "frq"; unit: string | null; dbUnit?: string | null; skill: string | null; candidateKey: string | null; position: number; stim?: string; template?: string; period?: number };
/** 풀 세트 구성 검증(순수, 차단 위반): MC 55·FRQ 5, 단원 범위, 세트 크기·수·연속 위치, 자료 유형 최소, 스킬 범주, FRQ 유형·SAQ 시대 서로 다름·DBQ/LEQ. */
export function verifyUshFullComposition(items: UshSetItem[]): string[] {
  const out: string[] = [];
  const mc = items.filter((i) => i.kind === "mc"), frq = items.filter((i) => i.kind === "frq");
  if (mc.length !== USH_MC_COUNT) out.push(`mc_count_${mc.length}/${USH_MC_COUNT}`);
  if (frq.length !== USH_FRQ_COUNT) out.push(`frq_count_${frq.length}/${USH_FRQ_COUNT}`);
  for (const [u, b] of Object.entries(ushUnitBounds())) { const n = mc.filter((i) => i.unit === u).length; if (n < b.min || n > b.max) out.push(`unit_${u}_${n}_not_in_${b.min}-${b.max}`); }
  if (mc.length && mc.every((i) => i.dbUnit)) for (const [u, b] of Object.entries(ushUnitBounds())) { const n = mc.filter((i) => i.dbUnit === u).length; if (n < b.min || n > b.max) out.push(`db_unit_${u}_${n}_not_in_${b.min}-${b.max}`); }
  for (const i of mc) if (!/^[1-5]\./.test(i.skill ?? "")) out.push(`mc_skill_${i.skill}_not_assessed`);
  for (const c of ["1", "2", "3", "4", "5"]) { const n = mc.filter((i) => ushSkillCat(i.skill) === c).length; if (n < USH_SKILL_CATEGORY_MIN) out.push(`skill_category_${c}_${n}_lt_${USH_SKILL_CATEGORY_MIN}`); }
  const byKey = new Map<string, UshSetItem[]>();
  for (const i of mc) if (i.candidateKey) byKey.set(i.candidateKey, [...(byKey.get(i.candidateKey) ?? []), i]);
  const sets = [...byKey.values()];
  if (sets.length < USH_SET_COUNT.min || sets.length > USH_SET_COUNT.max) out.push(`set_count_${sets.length}_not_in_${USH_SET_COUNT.min}-${USH_SET_COUNT.max}`);
  for (const s of sets) {
    if (s.length < USH_SET_SIZE.min || s.length > USH_SET_SIZE.max) out.push(`set_size_${s.length}_not_in_${USH_SET_SIZE.min}-${USH_SET_SIZE.max}`);
    const pos = s.map((x) => x.position).sort((a, b) => a - b);
    if (pos.some((p, i) => i > 0 && p !== pos[i - 1] + 1)) out.push(`set_not_contiguous_${s[0].candidateKey}`);
  }
  for (const t of USH_STIM_TYPES) { const n = sets.filter((s) => s[0].stim === t).length; if (n < USH_STIM_MIN[t]) out.push(`stim_${t}_${n}_lt_${USH_STIM_MIN[t]}`); }
  const tpl = frq.map((i) => i.template);
  for (const t of USH_FRQ_TEMPLATES) if (tpl.filter((x) => x === t).length !== 1) out.push(`frq_template_${t}_not_exactly_one`);
  const per = frq.filter((i) => /^saq/.test(i.template ?? "")).map((i) => i.period);
  if (new Set(per).size !== per.length) out.push("saq_periods_not_distinct");
  if (per.some((p) => !p || p < 1 || p > 9)) out.push("saq_period_missing");
  const ft = frq.map((i) => i.candidateKey).filter(Boolean); if (new Set(ft).size !== ft.length) out.push("frq_duplicate_key");
  return out;
}
