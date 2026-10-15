// AP English Literature and Composition 풀 모의고사 구성 규칙(순수, docs/ap/englit-facts.md — CED V.1 Fall 2024 Exam Information p.133–137 + AP Central 시험 페이지).
// MC 55 = 지문 5묶음(묶음당 8–13문항). 묶음 지문은 산문(단편 소설·장편/희곡 발췌)이거나 시이고, 산문 ≥ 2·시 ≥ 2 묶음이 항상 들어간다.
// 장르 비중(MC): 단편 소설 42–49% · 시 36–45% · 장편 소설·희곡 15–18%. 스킬 범주 7개 비중: 1 인물 16–20 / 2 배경 3–6 / 3 플롯·구조 16–20 / 4 서술자·화자 21–26 / 5 어휘·이미지·상징 10–13 / 6 비교 10–13 / 7 논증 10–13 %.
// 55문항에 옮길 때 하한은 내림·상한은 올림(다른 과목과 같은 관용). FRQ 3 = 시 분석(q1) · 산문 분석(q2) · 문학 논증(q3) 각 6점.
export type UnitBounds = Record<string, { min: number; max: number }>;
export const ENGLIT_MC_COUNT = 55;
export const ENGLIT_SET_COUNT = 5;
export const ENGLIT_SET_SIZE = { min: 8, max: 13 } as const;
export const ENGLIT_GROUPS = ["short", "poetry", "longer"] as const;
export type EnglitGroup = (typeof ENGLIT_GROUPS)[number];
export const ENGLIT_GROUP_PCT: Record<EnglitGroup, [number, number]> = { short: [42, 49], poetry: [36, 45], longer: [15, 18] };
export const ENGLIT_CATEGORIES = ["1", "2", "3", "4", "5", "6", "7"] as const;
export const ENGLIT_CATEGORY_PCT: Record<string, [number, number]> = { "1": [16, 20], "2": [3, 6], "3": [16, 20], "4": [21, 26], "5": [10, 13], "6": [10, 13], "7": [10, 13] };
export const ENGLIT_CATEGORY_NAME: Record<string, string> = { "1": "Character", "2": "Setting", "3": "Plot and Structure", "4": "Narrator or Speaker", "5": "Word Choice, Imagery, and Symbols", "6": "Comparison", "7": "Literary Argumentation" };
export const ENGLIT_FRQ_TYPES = ["q1", "q2", "q3"] as const;
export const ENGLIT_FRQ_COUNT = 3;
/** 공식 비중 중앙값을 55문항으로 정수화한 목표(제안, 공식 고정 아님). */
export const ENGLIT_FULL_TARGET = { categories: { "1": 10, "2": 2, "3": 10, "4": 13, "5": 6, "6": 7, "7": 7 } as Record<string, number> };
/** 스킬 코드("3.B") → 범주 "3". 7.E(작문 통제)는 MC 로 출제하지 않는다(CED: MC 는 논증 스킬 7.A–7.D). */
export const englitCategoryOf = (skill: string | null | undefined): string | null => { const m = /^([1-7])\.[A-F]$/.exec(String(skill ?? "")); return m ? m[1] : null; };
export const ENGLIT_MC_SKILLS_7 = ["7.A", "7.B", "7.C", "7.D"] as const;
const floorCeil = ([lo, hi]: [number, number], n: number) => ({ min: Math.floor((lo * n) / 100 + 1e-9), max: Math.ceil((hi * n) / 100 - 1e-9) });
export const englitGroupBounds = (): UnitBounds => Object.fromEntries(Object.entries(ENGLIT_GROUP_PCT).map(([k, v]) => [k, floorCeil(v, ENGLIT_MC_COUNT)]));
export const englitCategoryBounds = (): UnitBounds => Object.fromEntries(Object.entries(ENGLIT_CATEGORY_PCT).map(([k, v]) => [k, floorCeil(v, ENGLIT_MC_COUNT)]));
/** 토픽 코드 U<단원>.<n> → 장르 묶음(단편 1·4·7 / 시 2·5·8 / 장편·희곡 3·6·9). */
export const englitGroupOfUnit = (unit: string | number): EnglitGroup | null => { const u = Number(unit); return [1, 4, 7].includes(u) ? "short" : [2, 5, 8].includes(u) ? "poetry" : [3, 6, 9].includes(u) ? "longer" : null; };
export const englitGroupOfTopic = (topic: string | null | undefined): EnglitGroup | null => { const m = /^U(\d)\./.exec(String(topic ?? "")); return m ? englitGroupOfUnit(m[1]) : null; };

export type EnglitSetItem = { kind: "mc" | "frq"; skill: string | null; group: EnglitGroup | null; candidateKey: string | null; position: number };
/** 풀 세트 구성 검증(순수, 차단 위반): MC 55·FRQ 3, 묶음 5개(각 8–13문항·연속 위치·한 장르), 장르별 문항 수, 7범주 범위, 산문 ≥2·시 ≥2 묶음. */
export function verifyEnglitFullComposition(items: EnglitSetItem[]): string[] {
  const out: string[] = []; const mc = items.filter((i) => i.kind === "mc"), frq = items.filter((i) => i.kind === "frq");
  if (mc.length !== ENGLIT_MC_COUNT) out.push(`mc_count_${mc.length}/${ENGLIT_MC_COUNT}`);
  if (frq.length !== ENGLIT_FRQ_COUNT) out.push(`frq_count_${frq.length}/${ENGLIT_FRQ_COUNT}`);
  if (mc.some((i) => englitCategoryOf(i.skill) === null)) out.push("mc_unknown_skill");
  if (mc.some((i) => i.skill === "7.E")) out.push("mc_skill_7E_not_assessed_in_mc");
  for (const [g, b] of Object.entries(englitGroupBounds())) { const n = mc.filter((i) => i.group === g).length; if (n < b.min || n > b.max) out.push(`group_${g}_${n}_not_in_${b.min}-${b.max}`); }
  for (const [c, b] of Object.entries(englitCategoryBounds())) { const n = mc.filter((i) => englitCategoryOf(i.skill) === c).length; if (n < b.min || n > b.max) out.push(`category_${c}_${n}_not_in_${b.min}-${b.max}`); }
  const byKey = new Map<string, EnglitSetItem[]>(); for (const i of mc) if (i.candidateKey) byKey.set(i.candidateKey, [...(byKey.get(i.candidateKey) ?? []), i]);
  const sets = [...byKey.values()]; if (sets.length !== ENGLIT_SET_COUNT) out.push(`set_count_${sets.length}/${ENGLIT_SET_COUNT}`);
  for (const s of sets) {
    if (s.length < ENGLIT_SET_SIZE.min || s.length > ENGLIT_SET_SIZE.max) out.push(`set_size_${s.length}_not_in_${ENGLIT_SET_SIZE.min}-${ENGLIT_SET_SIZE.max}`);
    const pos = s.map((x) => x.position).sort((a, b) => a - b); if (pos.some((p, i) => i > 0 && p !== pos[i - 1] + 1)) out.push(`set_not_contiguous_${s[0].candidateKey}`);
    if (new Set(s.map((x) => x.group)).size > 1) out.push(`set_mixes_genres_${s[0].candidateKey}`);
  }
  const poetry = sets.filter((s) => s[0].group === "poetry").length, prose = sets.filter((s) => s[0].group === "short" || s[0].group === "longer").length;
  if (poetry < 2) out.push(`poetry_sets_${poetry}_below_2`); if (prose < 2) out.push(`prose_sets_${prose}_below_2`);
  const ft = frq.map((i) => i.candidateKey).filter(Boolean); if (new Set(ft).size !== ft.length) out.push("frq_duplicate_key");
  return out;
}
