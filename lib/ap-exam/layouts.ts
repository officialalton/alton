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

// ── 부분 연습 세트(첫 제품 형태) ────────────────────────────────────────────
// 공식 파트의 문항 수와 시간을 전부 채운 경우에만 "파트 A/B 모의 연습"으로 이름 붙일 수 있다. 현재 재고를 완전한 모의고사로 부르지 않는다(full_practice 는 모든 섹션 충족 때만).
// DB 라벨은 기존 3종(mc_practice|frq_practice)을 그대로 쓴다: 세트의 section_layout 에 해당 파트 섹션만 담고 공개 게이트가 그 섹션의 공식 문항 수를 강제한다.
export type ApPartialId = "noncalc_mc" | "calc_mc" | "frq";
export const AP_PARTIALS: Record<ApPartialId, { label: ApSetLabel; nameSuffix: string; sectionKeys: string[] }> = {
  noncalc_mc: { label: "mc_practice", nameSuffix: "Non-Calculator Practice", sectionKeys: ["ap_mc_a"] },
  calc_mc: { label: "mc_practice", nameSuffix: "Calculator Practice", sectionKeys: ["ap_mc_b"] },
  frq: { label: "frq_practice", nameSuffix: "Free-Response Practice", sectionKeys: ["ap_frq_a", "ap_frq_b"] },
};
/** 부분 세트가 정의되는 과목: 계산기 파트가 나뉜 AB·BC. */
export const AP_PARTIAL_SUBJECTS = ["ap_calculus_ab", "ap_calculus_bc"];
export function partialSetName(subject: string, id: ApPartialId, seq?: number): string {
  return `${AP_SUBJECT_NAME[subject] ?? subject} — ${AP_PARTIALS[id].nameSuffix}${seq && seq > 1 ? ` ${seq}` : ""}`;
}
/** 부분 세트 표시 정책(오너 2026-10-09): 제목·배지·시작 안내가 같은 의미를 전달한다. FRQ 세트도 계산기 사용을 함께 표시한다. UI 는 이 상수를 그대로 쓴다. */
export const AP_PARTIAL_CALCULATOR_NOTE: Record<ApPartialId, string> = {
  noncalc_mc: "No calculator allowed",
  calc_mc: "Graphing calculator required",
  frq: "Part A: calculator allowed · Part B: no calculator",
};
/** 제목(partialSetName) 옆 배지 문구: 예) "No calculator allowed". */
export const partialBadge = (id: ApPartialId) => AP_PARTIAL_CALCULATOR_NOTE[id];
/** 시작 안내 문장(영어): 제목·배지와 같은 의미를 반복한다. */
export function partialStartGuidance(subject: string, id: ApPartialId): string {
  const secs = sectionsForPartial(subject, id); const q = secs.reduce((a, x) => a + x.count, 0); const min = secs.reduce((a, x) => a + x.minutes, 0);
  return `${partialSetName(subject, id)}: ${q} ${id === "frq" ? "free-response questions" : "multiple-choice questions"}, ${min} minutes. ${AP_PARTIAL_CALCULATOR_NOTE[id]}. This is a practice section, not a full practice exam.`;
}
/** "Full Practice Exam" 라벨은 공식 구성(문항 수·시간·계산기 파트·단원 비중·다양성)을 만족한 세트에만 붙인다. 만족하지 않으면 항상 false. */
export const fullPracticeLabelAllowed = (officialCompositionSatisfied: boolean) => officialCompositionSatisfied === true;
export function sectionsForPartial(subject: string, id: ApPartialId): ApSection[] {
  if (!AP_PARTIAL_SUBJECTS.includes(subject)) throw new Error(`No partial practice sets for ${subject}`);
  return apSectionLayout(subject).filter((x) => AP_PARTIALS[id].sectionKeys.includes(x.key));
}
/** 파트 라벨 허용 조건: 채운 문항 수가 포함 섹션의 공식 문항 수와 정확히 같을 때만(시간은 공식 값을 복사하므로 항상 일치). */
export function partialLabelAllowed(subject: string, id: ApPartialId, filled: Record<string, number>): boolean {
  return sectionsForPartial(subject, id).every((sec) => filled[sec.key] === sec.count);
}
