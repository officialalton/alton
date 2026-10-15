// AP Psychology 풀 모의고사 구성 규칙(순수). 근거: AP Psychology CED(effective Fall 2025) Exam Information p.147–149, docs/ap/psychology-facts.md.
// MC 75(4지선다; 단독 문항 + 같은 단원 3문항 공유 세트), FRQ 2 = Article Analysis(AAQ, 7점) 1 + Evidence-Based(EBQ, 7점) 1 = 14점. 단원 MC 비중은 5단원 각 15-25 % — 75문항으로 옮길 때 하한은 내림, 상한은 올림(다른 과목 규칙과 같음).
// Practice 비중은 CED 가 '대략'으로만 공표한다(Practice 1 개념 적용 65 / 2 연구 방법·설계 25 / 3 자료 해석 10 %): ALTON 은 ±5%p 허용(내부 관용, UNVERIFIED) — 60-70 / 20-30 / 5-15 %. Practice 4(논증)는 MC 에서 평가하지 않는다.
// 회당 공유 세트 개수는 CED 가 공표하지 않는다(공식 샘플 21문항 중 3세트 9문항): 우리 구성은 회당 정확히 PSYCH_SET_COUNT 개이며 '공식 구성'이라 주장하지 않는다(docs/ap/psychology-groundwork.md §6).
export type UnitBounds = Record<string, { min: number; max: number }>;
export const PSYCH_MC_COUNT = 75;
export const PSYCH_MC_UNIT_PCT: Record<string, [number, number]> = { "1": [15, 25], "2": [15, 25], "3": [15, 25], "4": [15, 25], "5": [15, 25] };
export const PSYCH_MC_PRACTICE_PCT: Record<string, [number, number]> = { "1": [60, 70], "2": [20, 30], "3": [5, 15] };
export const PSYCH_SET_SIZE = 3;
export const PSYCH_SET_COUNT = 6;
export const PSYCH_FRQ_TYPES = ["aaq", "ebq"] as const;
export const PSYCH_FRQ_COUNT = 2;
export const PSYCH_FRQ_POINTS = 14;
const floorCeil = ([lo, hi]: [number, number], n: number) => ({ min: Math.floor((lo * n) / 100 + 1e-9), max: Math.ceil((hi * n) / 100 - 1e-9) });
const mapFloorCeil = (pct: Record<string, [number, number]>, n: number): UnitBounds => Object.fromEntries(Object.entries(pct).map(([k, v]) => [k, floorCeil(v, n)]));
export const psychUnitBounds = (): UnitBounds => mapFloorCeil(PSYCH_MC_UNIT_PCT, PSYCH_MC_COUNT);
export const psychPracticeBounds = (): UnitBounds => mapFloorCeil(PSYCH_MC_PRACTICE_PCT, PSYCH_MC_COUNT);
/** 공식 비중 중앙값 × 75 = 단원당 15문항(합 75). */
export const PSYCH_FULL_TARGET = { units: Object.fromEntries(Object.entries(PSYCH_MC_UNIT_PCT).map(([u, [lo, hi]]) => [u, (((lo + hi) / 2) * PSYCH_MC_COUNT) / 100])) as Record<string, number>, practice: { "1": 49, "2": 19, "3": 7 } as Record<string, number> };

export type PsychSetItem = { kind: "mc" | "frq"; unit: string | null; skill: string | null; candidateKey: string | null; position: number; frqType?: string };
/** 심리학 FRQ 2문항(AAQ 1 + EBQ 1)의 구조 위반 목록. */
export function verifyPsychFrqExam(types: string[]): string[] {
  const out: string[] = [];
  if (types.length !== PSYCH_FRQ_COUNT) out.push(`frq_count_${types.length}/${PSYCH_FRQ_COUNT}`);
  const t = [...types].sort().join("+");
  if (t !== [...PSYCH_FRQ_TYPES].sort().join("+")) out.push(`frq_types_${t || "none"}_not_aaq+ebq`);
  return out;
}
/** 심리학 풀 세트 구성 검증(순수, 차단 위반): MC 75·FRQ 2, 단원 범위, Practice 1-3 범위, 4.x 스킬 금지, 3문항 공유 세트 정확히 PSYCH_SET_COUNT 개(연속 위치). 문항군·재고 검사는 배정기·계획기가 따로 한다. */
export function verifyPsychFullComposition(items: PsychSetItem[]): string[] {
  const out: string[] = [];
  const mc = items.filter((i) => i.kind === "mc"), frq = items.filter((i) => i.kind === "frq");
  if (mc.length !== PSYCH_MC_COUNT) out.push(`mc_count_${mc.length}/${PSYCH_MC_COUNT}`);
  for (const [u, b] of Object.entries(psychUnitBounds())) { const n = mc.filter((i) => i.unit === u).length; if (n < b.min || n > b.max) out.push(`unit_${u}_${n}_not_in_${b.min}-${b.max}`); }
  for (const [p, b] of Object.entries(psychPracticeBounds())) { const n = mc.filter((i) => (i.skill ?? "").startsWith(`${p}.`)).length; if (n < b.min || n > b.max) out.push(`practice_${p}_${n}_not_in_${b.min}-${b.max}`); }
  if (mc.some((i) => (i.skill ?? "").startsWith("4."))) out.push("practice_4_not_assessed_in_mc");
  const byKey = new Map<string, PsychSetItem[]>();
  for (const i of mc) if (i.candidateKey) byKey.set(i.candidateKey, [...(byKey.get(i.candidateKey) ?? []), i]);
  const sets = [...byKey.values()].filter((v) => v.length > 1);
  if (sets.length !== PSYCH_SET_COUNT) out.push(`shared_sets_${sets.length}/${PSYCH_SET_COUNT}`);
  for (const s of sets) {
    if (s.length !== PSYCH_SET_SIZE) out.push(`set_size_${s.length}_not_${PSYCH_SET_SIZE}`);
    const pos = s.map((x) => x.position).sort((a, b) => a - b);
    if (pos.some((p, i) => i > 0 && p !== pos[i - 1] + 1)) out.push(`set_not_contiguous_${s[0].candidateKey}`);
  }
  out.push(...verifyPsychFrqExam(frq.map((i) => i.frqType ?? "")));
  const ft = frq.map((i) => i.candidateKey).filter(Boolean);
  if (new Set(ft).size !== ft.length) out.push("frq_duplicate_key");
  return out;
}
