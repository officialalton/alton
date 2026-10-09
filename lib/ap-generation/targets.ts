// 재고 목표(칸 단위): 단원 × 계산기 사용 × 표현 × 스킬 범주 × 문항군 하한. 합계만이 아니라 구조별 부족을 따로 본다(합계가 목표를 넘어도 구조에서 모자랄 수 있다).
// 파일 계산(이 모듈)과 DB 뷰(ap_stock_cell_shortfall_v, 마이그레이션 404)는 같은 정의를 쓴다. 목표 숫자는 **초기 목표**이며 10세트 최종 목표가 아니다.
export type Representation = "none" | "table" | "graph" | "text" | "diagram";
export type CalculatorUse = "required" | "not_allowed" | "allowed"; // MC: 계산기가 "실제로 필요"(required)와 "허용만"(allowed)을 구분
export type Dimension = "cell" | "skill_category" | "representation" | "family_floor" | "frq_type";
export type CellTarget = { dimension: Dimension; kind: "mc" | "frq_bundle"; unit_code?: string | null; skill_category?: string | null; calculator_use?: CalculatorUse | null; representation?: Representation | null; keyword_code?: string | null; target: number; note?: string };
export type ItemAttrs = { kind: "mc" | "frq_bundle"; keywordCode: string; skillPrimary: string; calculator: string; payload: Record<string, unknown>; itemFamilyId: string | null; candidateKey: string };
export const representationOf = (payload: Record<string, unknown>): Representation => {
  const st = payload.stimulus; const k = typeof st === "string" ? "text" : st && typeof st === "object" ? String((st as { kind?: unknown }).kind ?? "none") : "none";
  return k === "table" || k === "payoff_matrix" ? "table" : k === "graph" ? "graph" : k === "diagram" ? "diagram" : k === "text" ? "text" : "none";
};
export const calculatorUseOf = (c: string): CalculatorUse => (c === "required" ? "required" : c === "not_allowed" ? "not_allowed" : "allowed");
export const unitOf = (keyword: string) => keyword.split(".")[0];
const matches = (t: CellTarget, i: ItemAttrs) => i.kind === t.kind && (t.unit_code == null || unitOf(i.keywordCode) === t.unit_code) && (t.skill_category == null || i.skillPrimary.startsWith(t.skill_category + ".")) && (t.calculator_use == null || calculatorUseOf(i.calculator) === t.calculator_use)
  && (t.representation == null || representationOf(i.payload) === t.representation) && (t.keyword_code == null || i.keywordCode === t.keyword_code);
/** 칸 달성도: effective = 문항군당 min(개수, 2) 합(군 집중 상한), families = 서로 다른 문항군 수. family_floor 는 families 로 판정. */
export function cellStatus(t: CellTarget, items: ItemAttrs[]): { effective: number; families: number; achieved: number; shortfall: number } {
  const by = new Map<string, number>(); for (const i of items) if (matches(t, i)) { const f = i.itemFamilyId ?? i.candidateKey; by.set(f, (by.get(f) ?? 0) + 1); }
  const effective = [...by.values()].reduce((a, n) => a + Math.min(n, 2), 0); const families = by.size; const achieved = t.dimension === "family_floor" ? families : effective;
  return { effective, families, achieved, shortfall: Math.max(0, t.target - achieved) };
}
const largestRemainder = (weights: number[], total: number) => { const sum = weights.reduce((a, b) => a + b, 0); const raw = weights.map((w) => (w / sum) * total); const base = raw.map(Math.floor); let left = total - base.reduce((a, b) => a + b, 0); raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left-- > 0) base[i] += 1; }); return base; };
export type UnitWeight = { code: string; min: number; max: number };
/** AB 초기 목표: MC 100 = Part A 87(계산기 불가: 29×3) + Part B 13(계산기 필수: 13×1)을 공식 단원 비중으로 단원별 배분 + 표현·스킬 범주·문항군 하한. FRQ 12 = 내부 구성 기준 6유형 × 2. */
export function buildAbTargets(units: UnitWeight[]): CellTarget[] {
  const w = units.map((u) => (u.min + u.max) / 2); const rows: CellTarget[] = [];
  largestRemainder(w, 87).forEach((n, i) => n > 0 && rows.push({ dimension: "cell", kind: "mc", unit_code: units[i].code, calculator_use: "not_allowed", target: n, note: "Part A(계산기 불가) 29×3 세트, 단원 비중 배분" }));
  largestRemainder(w, 13).forEach((n, i) => n > 0 && rows.push({ dimension: "cell", kind: "mc", unit_code: units[i].code, calculator_use: "required", target: n, note: "Part B(그래핑 계산기 필수) 13×1 세트, 단원 비중 배분" }));
  // 내부 구성 기준(공식 고정 목록이 아님): 표현 최소치와 공식 MC 스킬 범주 하한(Implementing 50–70%, Connecting 15–30%, Justification 10–20% 의 하한)
  rows.push({ dimension: "representation", kind: "mc", representation: "graph", target: 15, note: "내부 기준: 그래프 자료 MC 최소 15" }, { dimension: "representation", kind: "mc", representation: "table", target: 15, note: "내부 기준: 표 자료 MC 최소 15" });
  rows.push({ dimension: "skill_category", kind: "mc", skill_category: "1", target: 50, note: "공식 MC 스킬 비중 하한(Implementing Mathematical Processes 50–70%)" }, { dimension: "skill_category", kind: "mc", skill_category: "2", target: 15, note: "공식 하한(Connecting Representations 15–30%)" }, { dimension: "skill_category", kind: "mc", skill_category: "3", target: 10, note: "공식 하한(Justification 10–20%)" });
  rows.push({ dimension: "family_floor", kind: "mc", target: 50, note: "서로 다른 문항군 최소 50(문항군당 유효 2개 상한 → MC 100)" });
  // FRQ: 내부 구성 기준 6유형(공식 고정 목록이 아님). 계산기 2유형 + 계산기 불가 4유형(Part B 가 서로 다른 4유형이어야 한다).
  const frq: [string, CalculatorUse, string][] = [["6.2", "required", "표 자료 변화율·누적(계산기)"], ["4.2", "required", "직선 운동(입자 운동, 계산기)"], ["5.9", "not_allowed", "f′ 그래프 정당화"], ["7.7", "not_allowed", "미분방정식 특수해"], ["4.5", "not_allowed", "관련 변화율"], ["3.2", "not_allowed", "음함수 미분"]];
  for (const [k, c, note] of frq) rows.push({ dimension: "frq_type", kind: "frq_bundle", keyword_code: k, calculator_use: c, target: 2, note: `내부 구성 유형: ${note}` });
  return rows;
}
