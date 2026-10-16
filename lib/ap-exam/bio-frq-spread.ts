// AP Biology 풀 모의고사 FRQ 주제 분산 규칙(순수 함수). 오너 결정(2026-10-15): 효소 FRQ 쏠림(Practice Exam 1 FRQ1~3 = 22/34점) 해소.
// '주제 영역' = FRQ 대표 CED 토픽의 단원(1~8). 한 영역이 FRQ 총점(34)의 35 % 를 넘지 않고(= 11점 이하), 서로 다른 영역이 4개 이상이어야 한다.
export const BIO_FRQ_POINTS: Record<string, number> = { bio_q1_results: 9, bio_q2_graphing: 9, bio_q3_investigation: 4, bio_q4_conceptual: 4, bio_q5_model: 4, bio_q6_data: 4 };
export const BIO_FRQ_TOTAL_POINTS = 34;
export const BIO_FRQ_MAX_AREA_PCT = 35;
export const BIO_FRQ_MIN_AREAS = 4;
export const bioFrqMaxAreaPoints = (): number => Math.floor((BIO_FRQ_MAX_AREA_PCT / 100) * BIO_FRQ_TOTAL_POINTS);
export const bioFrqUnitOf = (topic: string): string => String(topic).split(".")[0];
export type BioFrqRef = { type: string; topic: string };

export function bioFrqSpread(frq: BioFrqRef[]): { byUnit: Record<string, number>; total: number; maxUnit: string; maxPct: number; areas: number } {
  const byUnit: Record<string, number> = {};
  for (const f of frq) { const u = bioFrqUnitOf(f.topic); byUnit[u] = (byUnit[u] ?? 0) + (BIO_FRQ_POINTS[f.type] ?? 0); }
  const total = Object.values(byUnit).reduce((a, b) => a + b, 0);
  const [maxUnit, maxPts] = Object.entries(byUnit).sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
  return { byUnit, total, maxUnit, maxPct: total ? (maxPts / total) * 100 : 0, areas: Object.keys(byUnit).length };
}

/** 위반 목록(빈 배열 = 통과). */
export function verifyBioFrqSpread(frq: BioFrqRef[]): string[] {
  const s = bioFrqSpread(frq); const out: string[] = [];
  if (s.total !== BIO_FRQ_TOTAL_POINTS) out.push(`frq_points_${s.total}_not_${BIO_FRQ_TOTAL_POINTS}`);
  for (const [u, p] of Object.entries(s.byUnit)) if (p > bioFrqMaxAreaPoints()) out.push(`frq_unit_${u}_${p}pts_over_${bioFrqMaxAreaPoints()}`);
  if (s.areas < BIO_FRQ_MIN_AREAS) out.push(`frq_areas_${s.areas}_under_${BIO_FRQ_MIN_AREAS}`);
  return out;
}
