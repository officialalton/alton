// AP 공식 섹션 구조(docs/ap/2027-exam-spec-table.md 가 단일 출처). 세트를 만들 때 mock_exam_sets.section_layout 으로 복사한다.
// 라벨 규칙: 공식 구조(문항 수·시간·계산기 파트)를 전부 갖춘 세트만 "Full Practice Exam", MC 만이면 "AP Multiple-Choice Practice", FRQ 만이면 "AP Free-Response Practice".
// AP 1~5 환산 점수는 표시하지 않는다(검증 계획 승인 전).

export type ApCalculator = "allowed" | "not_allowed" | "required" | "na";
export type ApSection = { key: string; kind: "mc" | "frq"; label: string; minutes: number; count: number; calculator: ApCalculator; options?: 4 | 5 };
export type ApSetLabel = "full_practice" | "mc_practice" | "frq_practice";

const s = (key: string, kind: "mc" | "frq", label: string, minutes: number, count: number, calculator: ApCalculator, options?: 4 | 5): ApSection => ({ key, kind, label, minutes, count, calculator, ...(options ? { options } : {}) });

const CALC = [
  s("ap_mc_a", "mc", "Section I, Part A: Multiple Choice (no calculator)", 62, 29, "not_allowed", 4),
  s("ap_mc_b", "mc", "Section I, Part B: Multiple Choice (graphing calculator required)", 38, 13, "required", 4),
  s("ap_frq_a", "frq", "Section II, Part A: Free Response (calculator)", 30, 2, "allowed"),
  s("ap_frq_b", "frq", "Section II, Part B: Free Response (no calculator)", 60, 4, "not_allowed"),
];
export const AP_LAYOUTS: Record<string, ApSection[]> = {
  ap_calculus_ab: CALC,
  ap_calculus_bc: CALC,
  ap_biology: [s("ap_mc", "mc", "Section I: Multiple Choice", 90, 60, "allowed", 4), s("ap_frq", "frq", "Section II: Free Response", 90, 6, "allowed")],
  ap_microeconomics: [s("ap_mc", "mc", "Section I: Multiple Choice", 70, 60, "allowed", 5), s("ap_frq", "frq", "Section II: Free Response (includes 10 minutes of reading)", 60, 3, "allowed")],
  ap_macroeconomics: [s("ap_mc", "mc", "Section I: Multiple Choice", 70, 60, "allowed", 5), s("ap_frq", "frq", "Section II: Free Response (includes 10 minutes of reading)", 60, 3, "allowed")],
  ap_statistics: [s("ap_mc", "mc", "Section I: Multiple Choice", 90, 42, "allowed", 4), s("ap_frq", "frq", "Section II: Free Response", 90, 4, "allowed")],
  ap_chemistry: [s("ap_mc", "mc", "Section I: Multiple Choice", 90, 60, "allowed", 4), s("ap_frq", "frq", "Section II: Free Response", 105, 7, "allowed")],
  ap_physics_1: [s("ap_mc", "mc", "Section I: Multiple Choice", 85, 42, "allowed", 4), s("ap_frq", "frq", "Section II: Free Response", 95, 4, "allowed")],
  ap_computer_science_a: [s("ap_mc", "mc", "Section I: Multiple Choice", 90, 42, "na", 4), s("ap_frq", "frq", "Section II: Free Response", 90, 4, "na")],
  ap_english_language: [s("ap_mc", "mc", "Section I: Multiple Choice", 60, 45, "na", 4), s("ap_frq", "frq", "Section II: Free Response (3 essays)", 135, 3, "na")],
};

export function apSectionLayout(subject: string): ApSection[] {
  const l = AP_LAYOUTS[subject];
  if (!l) throw new Error(`No AP exam layout for ${subject}`);
  return l;
}

/** 시험 화면·목록에 쓰는 영어 라벨. */
export const AP_LABEL_TEXT: Record<ApSetLabel, string> = {
  full_practice: "Full Practice Exam",
  mc_practice: "AP Multiple-Choice Practice",
  frq_practice: "AP Free-Response Practice",
};

export const AP_SUBJECT_NAME: Record<string, string> = {
  ap_calculus_ab: "AP Calculus AB", ap_calculus_bc: "AP Calculus BC", ap_biology: "AP Biology", ap_microeconomics: "AP Microeconomics",
  ap_macroeconomics: "AP Macroeconomics", ap_statistics: "AP Statistics", ap_chemistry: "AP Chemistry", ap_physics_1: "AP Physics 1",
  ap_computer_science_a: "AP Computer Science A", ap_english_language: "AP English Language",
};

/** 라벨이 요구하는 섹션(조립이 채워야 할 섹션). */
export function sectionsForLabel(subject: string, label: ApSetLabel): ApSection[] {
  const l = apSectionLayout(subject);
  return label === "full_practice" ? l : l.filter((x) => x.kind === (label === "mc_practice" ? "mc" : "frq"));
}

export const CALCULATOR_TEXT: Record<ApCalculator, string> = {
  allowed: "Calculator allowed", not_allowed: "No calculator", required: "Graphing calculator required", na: "",
};
export function totalMinutes(subject: string, label: ApSetLabel): number {
  return sectionsForLabel(subject, label).reduce((a, x) => a + x.minutes, 0);
}
