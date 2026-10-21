// AP European History 풀 모의고사 구성 규칙(순수; AP Central 시험 페이지·CED 2027, 2026-10-20 조회: MC 55/55분·SAQ 3/40분·DBQ+LEQ 100분, 공식 시험 범위 1450–2001; 단원 9개 각 MC 10–15%).
// MC 55 = 3–4문항 자료 세트(공식: "usually in sets of 3-4"), 단원 비중 10–15 % 를 55문항에 옮길 때 하한 내림·상한 올림(5–9문항, 다른 과목과 같은 관용). 세트의 문항 토픽은 세트 단원에 속한다(세트당 단원 1개).
// 공식 미공표라 우리 내부 구성(공식 구성이라 주장하지 않는다): 세트 수 14–20(단원마다 2세트가 되는 18세트 기본), 자료 유형 최소(paired ≥1, 표·그래프 ≥1, 이미지·지도 ≥2, 1차 ≥4, 2차 ≥2), 스킬 범주 1–5 각 ≥3.
// FRQ 5 = SAQ 3(q1 2차 텍스트 · q2 1차 텍스트 · q3 비텍스트, 서로 다른 시대 구간) + DBQ 1(문서 7개) + LEQ 1(필수, 선택 없음 — 2027 개편).
export type UnitBounds = Record<string, { min: number; max: number }>;
export const EURO_MC_COUNT = 55;
export const EURO_UNIT_PCT: Record<string, [number, number]> = { "1": [10, 15], "2": [10, 15], "3": [10, 15], "4": [10, 15], "5": [10, 15], "6": [10, 15], "7": [10, 15], "8": [10, 15], "9": [10, 15] };
export const EURO_SET_SIZE = { min: 3, max: 4 } as const;
export const EURO_SET_COUNT = { min: 14, max: 20 } as const;
export const EURO_STIM_TYPES = ["primary_text", "secondary_text", "paired_text", "quantitative", "image"] as const;
export type EuroStimType = (typeof EURO_STIM_TYPES)[number];
export const EURO_STIM_MIN: Record<EuroStimType, number> = { primary_text: 4, secondary_text: 2, paired_text: 1, quantitative: 1, image: 2 };
export const EURO_SKILL_CATEGORY_MIN = 3;
export const EURO_FRQ_TEMPLATES = ["saq1", "saq2", "saq3", "dbq", "leq"] as const;
export const EURO_FRQ_COUNT = 5;
export const EURO_FRQ_POINTS: Record<string, number> = { saq1: 3, saq2: 3, saq3: 3, dbq: 7, leq: 6 };
/** 목표 배분(제안): 단원별 문항 수(합 55). */
export const EURO_FULL_TARGET = { units: { "1": 6, "2": 6, "3": 6, "4": 6, "5": 6, "6": 6, "7": 6, "8": 6, "9": 7 } as Record<string, number> };
const floorCeil = ([lo, hi]: [number, number], n: number) => ({ min: Math.floor((lo * n) / 100 + 1e-9), max: Math.ceil((hi * n) / 100 - 1e-9) });
export const euroUnitBounds = (): UnitBounds => Object.fromEntries(Object.entries(EURO_UNIT_PCT).map(([k, v]) => [k, floorCeil(v, EURO_MC_COUNT)]));
/** 스킬 코드("3.B") → 범주 번호("3"). 1–5 만 MC 대상. */
export const euroSkillCat = (skill: string | null | undefined): string => String(skill ?? "").split(".")[0];
export const euroUnitOfTopic = (topic: string): string => /^U?(\d+)\./.exec(topic)?.[1] ?? "";
/** AP European History 시대 구간(CED): 1 = c.1450–1648(U1–2), 2 = c.1648–1815(U3–5), 3 = c.1815–1914(U6–7), 4 = c.1914–현재(U8–9). SAQ 3문항은 서로 다른 구간이어야 한다("each of the questions focuses on a different historical period"). */
export const euroEra = (unit: number | string): number => { const u = Number(unit); return u <= 2 ? 1 : u <= 5 ? 2 : u <= 7 ? 3 : 4; };

/** dbUnit = 후보 keyword_code 단원(관리자 새 버전·초안이 DB 에서 읽는 단원; 세트의 모든 문항에 같은 값). 주면 같은 범위를 dbUnit 으로도 검사한다. */
export type EuroSetItem = { kind: "mc" | "frq"; unit: string | null; dbUnit?: string | null; skill: string | null; candidateKey: string | null; position: number; stim?: string; template?: string; /** FRQ: 시대 구간(1–4) */ era?: number };
/** 풀 세트 구성 검증(순수, 차단 위반): MC 55·FRQ 5, 단원 범위(문항별 토픽 단원 + DB 단원), 세트 크기·수·연속 위치, 자료 유형 최소, 스킬 범주, FRQ 유형·SAQ 시대 서로 다름. */
export function verifyEuroFullComposition(items: EuroSetItem[]): string[] {
  const out: string[] = [];
  const mc = items.filter((i) => i.kind === "mc"), frq = items.filter((i) => i.kind === "frq");
  if (mc.length !== EURO_MC_COUNT) out.push(`mc_count_${mc.length}/${EURO_MC_COUNT}`);
  if (frq.length !== EURO_FRQ_COUNT) out.push(`frq_count_${frq.length}/${EURO_FRQ_COUNT}`);
  for (const [u, b] of Object.entries(euroUnitBounds())) { const n = mc.filter((i) => i.unit === u).length; if (n < b.min || n > b.max) out.push(`unit_${u}_${n}_not_in_${b.min}-${b.max}`); }
  if (mc.length && mc.every((i) => i.dbUnit)) for (const [u, b] of Object.entries(euroUnitBounds())) { const n = mc.filter((i) => i.dbUnit === u).length; if (n < b.min || n > b.max) out.push(`db_unit_${u}_${n}_not_in_${b.min}-${b.max}`); }
  for (const i of mc) if (!/^[1-5]\./.test(i.skill ?? "")) out.push(`mc_skill_${i.skill}_not_assessed`);
  for (const c of ["1", "2", "3", "4", "5"]) { const n = mc.filter((i) => euroSkillCat(i.skill) === c).length; if (n < EURO_SKILL_CATEGORY_MIN) out.push(`skill_category_${c}_${n}_lt_${EURO_SKILL_CATEGORY_MIN}`); }
  const byKey = new Map<string, EuroSetItem[]>();
  for (const i of mc) if (i.candidateKey) byKey.set(i.candidateKey, [...(byKey.get(i.candidateKey) ?? []), i]);
  const sets = [...byKey.values()];
  if (sets.length < EURO_SET_COUNT.min || sets.length > EURO_SET_COUNT.max) out.push(`set_count_${sets.length}_not_in_${EURO_SET_COUNT.min}-${EURO_SET_COUNT.max}`);
  for (const s of sets) {
    if (s.length < EURO_SET_SIZE.min || s.length > EURO_SET_SIZE.max) out.push(`set_size_${s.length}_not_in_${EURO_SET_SIZE.min}-${EURO_SET_SIZE.max}`);
    const pos = s.map((x) => x.position).sort((a, b) => a - b);
    if (pos.some((p, i) => i > 0 && p !== pos[i - 1] + 1)) out.push(`set_not_contiguous_${s[0].candidateKey}`);
  }
  for (const t of EURO_STIM_TYPES) { const n = sets.filter((s) => s[0].stim === t).length; if (n < EURO_STIM_MIN[t]) out.push(`stim_${t}_${n}_lt_${EURO_STIM_MIN[t]}`); }
  const tpl = frq.map((i) => i.template);
  for (const t of EURO_FRQ_TEMPLATES) if (tpl.filter((x) => x === t).length !== 1) out.push(`frq_template_${t}_not_exactly_one`);
  const per = frq.filter((i) => /^saq/.test(i.template ?? "")).map((i) => i.era);
  if (new Set(per).size !== per.length) out.push("saq_eras_not_distinct");
  if (per.some((p) => !p || p < 1 || p > 4)) out.push("saq_era_missing");
  const ft = frq.map((i) => i.candidateKey).filter(Boolean); if (new Set(ft).size !== ft.length) out.push("frq_duplicate_key");
  return out;
}
