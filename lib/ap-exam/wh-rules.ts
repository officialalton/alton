// AP World History: Modern 풀 모의고사 구성 규칙(순수, docs/ap/worldhistory-facts.md; CED effective Fall 2026 Exam Information p.195-200).
// MC 55 = 3–4문항 자료 세트(공식: "typically in sets of three to four"), 단원 비중 8–10(U1·U2·U7·U8·U9) / 12–15(U3–U6) % 를 55문항에 옮길 때 하한 내림·상한 올림(다른 과목과 같은 관용).
// 공식 미공표라 우리 내부 구성(공식 구성이라 주장하지 않는다): 세트 수 14–18, 자료 유형 최소(paired ≥1 — 공식 "at least one set of paired text-based stimuli", 표·그래프 ≥1, 이미지·지도 ≥2, 1차 ≥4, 2차 ≥2), 스킬 범주 1–5 각 ≥3.
// FRQ 5 = SAQ 3(q1 2차 자료 · q2 1차 자료 · q3 비텍스트, 서로 다른 시대 구간) + DBQ 1(문서 7개) + LEQ 1(필수, 선택 없음 — 2027 개편, 연표의 약 절반).
export type UnitBounds = Record<string, { min: number; max: number }>;
export const WH_MC_COUNT = 55;
export const WH_UNIT_PCT: Record<string, [number, number]> = { "1": [8, 10], "2": [8, 10], "3": [12, 15], "4": [12, 15], "5": [12, 15], "6": [12, 15], "7": [8, 10], "8": [8, 10], "9": [8, 10] };
export const WH_SET_SIZE = { min: 3, max: 4 } as const;
export const WH_SET_COUNT = { min: 14, max: 18 } as const;
export const WH_STIM_TYPES = ["primary_text", "secondary_text", "paired_text", "quantitative", "image"] as const;
export type WhStimType = (typeof WH_STIM_TYPES)[number];
export const WH_STIM_MIN: Record<WhStimType, number> = { primary_text: 4, secondary_text: 2, paired_text: 1, quantitative: 1, image: 2 };
export const WH_SKILL_CATEGORY_MIN = 3;
export const WH_FRQ_TEMPLATES = ["saq1", "saq2", "saq3", "dbq", "leq"] as const;
export const WH_FRQ_COUNT = 5;
export const WH_FRQ_POINTS: Record<string, number> = { saq1: 3, saq2: 3, saq3: 3, dbq: 7, leq: 6 };
/** 목표 배분(제안): 단원별 문항 수(합 55). */
export const WH_FULL_TARGET = { units: { "1": 5, "2": 5, "3": 7, "4": 8, "5": 7, "6": 7, "7": 5, "8": 6, "9": 5 } as Record<string, number> };
const floorCeil = ([lo, hi]: [number, number], n: number) => ({ min: Math.floor((lo * n) / 100 + 1e-9), max: Math.ceil((hi * n) / 100 - 1e-9) });
export const whUnitBounds = (): UnitBounds => Object.fromEntries(Object.entries(WH_UNIT_PCT).map(([k, v]) => [k, floorCeil(v, WH_MC_COUNT)]));
/** 스킬 코드("3.B") → 범주 번호("3"). 1–5 만 MC 대상. */
export const whSkillCat = (skill: string | null | undefined): string => String(skill ?? "").split(".")[0];
export const whUnitOfTopic = (topic: string): string => /^U?(\d+)\./.exec(topic)?.[1] ?? "";
/** CED 연표 구간(Exam Information p.196): 1 = c.1200–1450(U1–2), 2 = c.1450–1750(U3–4), 3 = c.1750–1900(U5–6), 4 = c.1900–현재(U7–9). SAQ 3문항은 서로 다른 구간이어야 한다("each focus on a different historical period"). */
export const whEra = (unit: number | string): number => { const u = Number(unit); return u <= 2 ? 1 : u <= 4 ? 2 : u <= 6 ? 3 : 4; };

/** dbUnit = 후보 keyword_code 단원(관리자 새 버전·초안이 DB 에서 읽는 단원; 세트의 모든 문항에 같은 값). 주면 같은 범위를 dbUnit 으로도 검사한다. */
export type WhSetItem = { kind: "mc" | "frq"; unit: string | null; dbUnit?: string | null; skill: string | null; candidateKey: string | null; position: number; stim?: string; template?: string; /** FRQ: 시대 구간(1–4) */ era?: number };
/** 풀 세트 구성 검증(순수, 차단 위반): MC 55·FRQ 5, 단원 범위(문항별 토픽 단원 + DB 단원), 세트 크기·수·연속 위치, 자료 유형 최소, 스킬 범주, FRQ 유형·SAQ 시대 서로 다름. */
export function verifyWhFullComposition(items: WhSetItem[]): string[] {
  const out: string[] = [];
  const mc = items.filter((i) => i.kind === "mc"), frq = items.filter((i) => i.kind === "frq");
  if (mc.length !== WH_MC_COUNT) out.push(`mc_count_${mc.length}/${WH_MC_COUNT}`);
  if (frq.length !== WH_FRQ_COUNT) out.push(`frq_count_${frq.length}/${WH_FRQ_COUNT}`);
  for (const [u, b] of Object.entries(whUnitBounds())) { const n = mc.filter((i) => i.unit === u).length; if (n < b.min || n > b.max) out.push(`unit_${u}_${n}_not_in_${b.min}-${b.max}`); }
  if (mc.length && mc.every((i) => i.dbUnit)) for (const [u, b] of Object.entries(whUnitBounds())) { const n = mc.filter((i) => i.dbUnit === u).length; if (n < b.min || n > b.max) out.push(`db_unit_${u}_${n}_not_in_${b.min}-${b.max}`); }
  for (const i of mc) if (!/^[1-5]\./.test(i.skill ?? "")) out.push(`mc_skill_${i.skill}_not_assessed`);
  for (const c of ["1", "2", "3", "4", "5"]) { const n = mc.filter((i) => whSkillCat(i.skill) === c).length; if (n < WH_SKILL_CATEGORY_MIN) out.push(`skill_category_${c}_${n}_lt_${WH_SKILL_CATEGORY_MIN}`); }
  const byKey = new Map<string, WhSetItem[]>();
  for (const i of mc) if (i.candidateKey) byKey.set(i.candidateKey, [...(byKey.get(i.candidateKey) ?? []), i]);
  const sets = [...byKey.values()];
  if (sets.length < WH_SET_COUNT.min || sets.length > WH_SET_COUNT.max) out.push(`set_count_${sets.length}_not_in_${WH_SET_COUNT.min}-${WH_SET_COUNT.max}`);
  for (const s of sets) {
    if (s.length < WH_SET_SIZE.min || s.length > WH_SET_SIZE.max) out.push(`set_size_${s.length}_not_in_${WH_SET_SIZE.min}-${WH_SET_SIZE.max}`);
    const pos = s.map((x) => x.position).sort((a, b) => a - b);
    if (pos.some((p, i) => i > 0 && p !== pos[i - 1] + 1)) out.push(`set_not_contiguous_${s[0].candidateKey}`);
  }
  for (const t of WH_STIM_TYPES) { const n = sets.filter((s) => s[0].stim === t).length; if (n < WH_STIM_MIN[t]) out.push(`stim_${t}_${n}_lt_${WH_STIM_MIN[t]}`); }
  const tpl = frq.map((i) => i.template);
  for (const t of WH_FRQ_TEMPLATES) if (tpl.filter((x) => x === t).length !== 1) out.push(`frq_template_${t}_not_exactly_one`);
  const per = frq.filter((i) => /^saq/.test(i.template ?? "")).map((i) => i.era);
  if (new Set(per).size !== per.length) out.push("saq_eras_not_distinct");
  if (per.some((p) => !p || p < 1 || p > 4)) out.push("saq_era_missing");
  const ft = frq.map((i) => i.candidateKey).filter(Boolean); if (new Set(ft).size !== ft.length) out.push("frq_duplicate_key");
  return out;
}
