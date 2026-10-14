// AP English Language and Composition 풀 모의고사 구성 규칙(순수, docs/ap/englang-facts.md).
// MC 45 = 읽기 23–25(스킬 1·3·5·7) + 글쓰기·수정 20–22(스킬 2·4·6·8), 모두 지문 묶음(passage set)이다. 스킬 범주(8) 비중 RS-R 11–14 / RS-W 11–14 / CE-R 13–16 / CE-W 11–14 /
// RO-R 13–16 / RO-W 11–14 / S-R 11–14 / S-W 11–14 %를 45문항에 옮길 때 하한은 내림, 상한은 올림(다른 과목과 같은 관용). 단원 가중은 공식 미공표라 단원 범위 제약은 없다.
// 묶음 크기·묶음 수는 공식 미공표 — 우리 구성(공식 구성이라 주장하지 않는다): 묶음당 3–6문항, 읽기·글쓰기 각 4–6묶음, 읽기 묶음이 먼저.
// FRQ 3 = 종합(q1) · 수사 분석(q2) · 논증(q3) 각 1(각 6점).
export type UnitBounds = Record<string, { min: number; max: number }>;
export const ELANG_MC_COUNT = 45;
export const ELANG_CATEGORIES = ["RS-R", "RS-W", "CE-R", "CE-W", "RO-R", "RO-W", "S-R", "S-W"] as const;
export const ELANG_CATEGORY_PCT: Record<string, [number, number]> = { "RS-R": [11, 14], "RS-W": [11, 14], "CE-R": [13, 16], "CE-W": [11, 14], "RO-R": [13, 16], "RO-W": [11, 14], "S-R": [11, 14], "S-W": [11, 14] };
export const ELANG_READING_RANGE = { min: 23, max: 25 } as const;
export const ELANG_WRITING_RANGE = { min: 20, max: 22 } as const;
export const ELANG_SET_SIZE = { min: 3, max: 6 } as const;
export const ELANG_SET_COUNT = { min: 4, max: 6 } as const;
export const ELANG_FRQ_TYPES = ["q1", "q2", "q3"] as const;
export const ELANG_FRQ_COUNT = 3;
const PREFIX_CATEGORY: Record<string, string> = { "1": "RS-R", "2": "RS-W", "3": "CE-R", "4": "CE-W", "5": "RO-R", "6": "RO-W", "7": "S-R", "8": "S-W" };
/** 스킬 코드("3.B") → 범주("CE-R"). 알 수 없는 코드는 null. */
export const elangCategoryOf = (skill: string | null | undefined): string | null => PREFIX_CATEGORY[String(skill ?? "").split(".")[0]] ?? null;
export const elangSectionOf = (skill: string | null | undefined): "reading" | "writing" | null => { const c = elangCategoryOf(skill); return c ? (c.endsWith("-R") ? "reading" : "writing") : null; };
const floorCeil = ([lo, hi]: [number, number], n: number) => ({ min: Math.floor((lo * n) / 100 + 1e-9), max: Math.ceil((hi * n) / 100 - 1e-9) });
export const elangCategoryBounds = (): UnitBounds => Object.fromEntries(Object.entries(ELANG_CATEGORY_PCT).map(([k, v]) => [k, floorCeil(v, ELANG_MC_COUNT)]));
/** 공식 비중 중앙값을 45문항으로 정수화한 목표(제안): 읽기 24 = RS-R 5·CE-R 7·RO-R 7·S-R 5, 글쓰기 21 = RS-W 5·CE-W 5·RO-W 5·S-W 6. */
export const ELANG_FULL_TARGET = { categories: { "RS-R": 5, "RS-W": 5, "CE-R": 7, "CE-W": 5, "RO-R": 7, "RO-W": 5, "S-R": 5, "S-W": 6 } as Record<string, number> };

export type ElangSetItem = { kind: "mc" | "frq"; skill: string | null; candidateKey: string | null; position: number };
/** 영어 풀 세트 구성 검증(순수, 차단 위반): MC 45·FRQ 3, 읽기/글쓰기 범위, 8범주 범위, 묶음 크기·수·연속 위치, 읽기→글쓰기 순서. FRQ 유형·문항군·시험 간 중복은 배정기가 재고로 따로 본다. */
export function verifyElangFullComposition(items: ElangSetItem[]): string[] {
  const out: string[] = [];
  const mc = items.filter((i) => i.kind === "mc"), frq = items.filter((i) => i.kind === "frq");
  if (mc.length !== ELANG_MC_COUNT) out.push(`mc_count_${mc.length}/${ELANG_MC_COUNT}`);
  if (frq.length !== ELANG_FRQ_COUNT) out.push(`frq_count_${frq.length}/${ELANG_FRQ_COUNT}`);
  const reading = mc.filter((i) => elangSectionOf(i.skill) === "reading").length, writing = mc.filter((i) => elangSectionOf(i.skill) === "writing").length;
  if (reading + writing !== mc.length) out.push("mc_unknown_skill");
  if (reading < ELANG_READING_RANGE.min || reading > ELANG_READING_RANGE.max) out.push(`reading_${reading}_not_in_${ELANG_READING_RANGE.min}-${ELANG_READING_RANGE.max}`);
  if (writing < ELANG_WRITING_RANGE.min || writing > ELANG_WRITING_RANGE.max) out.push(`writing_${writing}_not_in_${ELANG_WRITING_RANGE.min}-${ELANG_WRITING_RANGE.max}`);
  for (const [c, b] of Object.entries(elangCategoryBounds())) { const n = mc.filter((i) => elangCategoryOf(i.skill) === c).length; if (n < b.min || n > b.max) out.push(`category_${c}_${n}_not_in_${b.min}-${b.max}`); }
  const byKey = new Map<string, ElangSetItem[]>();
  for (const i of mc) if (i.candidateKey) byKey.set(i.candidateKey, [...(byKey.get(i.candidateKey) ?? []), i]);
  const sets = [...byKey.values()];
  for (const s of sets) {
    if (s.length < ELANG_SET_SIZE.min || s.length > ELANG_SET_SIZE.max) out.push(`set_size_${s.length}_not_in_${ELANG_SET_SIZE.min}-${ELANG_SET_SIZE.max}`);
    const pos = s.map((x) => x.position).sort((a, b) => a - b);
    if (pos.some((p, i) => i > 0 && p !== pos[i - 1] + 1)) out.push(`set_not_contiguous_${s[0].candidateKey}`);
    if (new Set(s.map((x) => elangSectionOf(x.skill))).size > 1) out.push(`set_mixes_reading_and_writing_${s[0].candidateKey}`);
  }
  for (const sec of ["reading", "writing"] as const) { const n = sets.filter((s) => elangSectionOf(s[0].skill) === sec).length; if (n < ELANG_SET_COUNT.min || n > ELANG_SET_COUNT.max) out.push(`${sec}_sets_${n}_not_in_${ELANG_SET_COUNT.min}-${ELANG_SET_COUNT.max}`); }
  const rp = mc.filter((i) => elangSectionOf(i.skill) === "reading").map((i) => i.position), wp = mc.filter((i) => elangSectionOf(i.skill) === "writing").map((i) => i.position);
  if (rp.length && wp.length && Math.max(...rp) > Math.min(...wp)) out.push("reading_after_writing");
  const ft = frq.map((i) => i.candidateKey).filter(Boolean); if (new Set(ft).size !== ft.length) out.push("frq_duplicate_key");
  return out;
}
