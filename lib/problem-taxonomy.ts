// 2026-09-14 제품 오너 지시 — 문제 분류: `SAT 영역`(domain) + `세부 기술 코드`(skill code).
// 문제은행(만들기·찾기), 회차 자동 구성(배정), 학생 성취 기록이 **같은 분류**를 쓴다. 표시용 태그가 아니라 기준이다.
// DB 원본은 problem_skill_codes 테이블(20261367)이고 이 파일은 화면·AI 프롬프트용 사본이다 — 둘이 같은지 테스트로 확인한다.

export type SatDomainCode =
  | "algebra"
  | "advanced_math"
  | "problem_solving_data"
  | "geometry_trig"
  | "rw_information_ideas"
  | "rw_craft_structure"
  | "rw_expression_ideas"
  | "rw_standard_english";

export type SatDomain = { code: SatDomainCode; label: string; section: "Math" | "Reading and Writing"; short: string };

export const SAT_DOMAINS: SatDomain[] = [
  { code: "algebra", label: "Algebra", section: "Math", short: "Algebra" },
  { code: "advanced_math", label: "Advanced Math", section: "Math", short: "Adv. Math" },
  { code: "problem_solving_data", label: "Problem-Solving and Data Analysis", section: "Math", short: "PSDA" },
  { code: "geometry_trig", label: "Geometry and Trigonometry", section: "Math", short: "Geo/Trig" },
  { code: "rw_information_ideas", label: "Information and Ideas", section: "Reading and Writing", short: "Info & Ideas" },
  { code: "rw_craft_structure", label: "Craft and Structure", section: "Reading and Writing", short: "Craft" },
  { code: "rw_expression_ideas", label: "Expression of Ideas", section: "Reading and Writing", short: "Expression" },
  { code: "rw_standard_english", label: "Standard English Conventions", section: "Reading and Writing", short: "SEC" },
];

export type SkillCode = {
  code: string;
  domain: SatDomainCode;
  label: string;
  /** AI 생성 힌트 — 이 기술의 전형적 문항이 무엇을 묻는가. */
  hint: string;
  /** 생성 규칙(말투·자극)을 물려받을 옛 유형 코드(lib/problem-skills). */
  legacySkill: string;
  /** 기본 그림 요구. */
  figurePolicy: "none" | "optional" | "require_plane" | "require_geometry" | "require_data";
};

export const SKILL_CODES: SkillCode[] = [
  // Algebra
  { code: "linear_equations_one_var", domain: "algebra", label: "Linear equations in one variable", hint: "일차방정식 풀이·해 해석", legacySkill: "math.algebra", figurePolicy: "none" },
  { code: "linear_functions", domain: "algebra", label: "Linear functions", hint: "기울기·절편·함수 표기·그래프 해석(표·그래프 자료 가능)", legacySkill: "math.algebra", figurePolicy: "optional" },
  { code: "linear_equations_two_var", domain: "algebra", label: "Linear equations in two variables", hint: "두 변수 일차식·직선의 방정식", legacySkill: "math.algebra", figurePolicy: "optional" },
  { code: "systems_linear", domain: "algebra", label: "Systems of two linear equations", hint: "연립일차방정식의 해·해의 개수·그래프의 교점", legacySkill: "math.algebra", figurePolicy: "optional" },
  { code: "linear_inequalities", domain: "algebra", label: "Linear inequalities", hint: "일차부등식·연립부등식·해 영역", legacySkill: "math.algebra", figurePolicy: "none" },
  // Advanced Math
  { code: "equivalent_expressions", domain: "advanced_math", label: "Equivalent expressions", hint: "식의 동치 변형·인수분해·유리식", legacySkill: "math.advanced", figurePolicy: "none" },
  { code: "nonlinear_equations_systems", domain: "advanced_math", label: "Nonlinear equations and systems", hint: "이차방정식·근·판별식·비선형 연립", legacySkill: "math.advanced", figurePolicy: "none" },
  { code: "nonlinear_functions", domain: "advanced_math", label: "Nonlinear functions", hint: "이차·지수·다항 함수의 그래프·꼭짓점·절편", legacySkill: "math.advanced", figurePolicy: "optional" },
  // Problem-Solving and Data Analysis
  { code: "ratios_rates_units", domain: "problem_solving_data", label: "Ratios, rates, proportional relationships, and units", hint: "비율·비례·속도·단위 변환", legacySkill: "math.problem_solving_data", figurePolicy: "optional" },
  { code: "percentages", domain: "problem_solving_data", label: "Percentages", hint: "백분율·증감률", legacySkill: "math.problem_solving_data", figurePolicy: "optional" },
  { code: "one_variable_data", domain: "problem_solving_data", label: "One-variable data: distributions and measures", hint: "평균·중앙값·범위·표준편차·히스토그램·상자그림·숫자 목록", legacySkill: "math.problem_solving_data", figurePolicy: "require_data" },
  { code: "two_variable_data", domain: "problem_solving_data", label: "Two-variable data: models and scatterplots", hint: "산점도·추세선·표를 읽는 모델 해석", legacySkill: "math.problem_solving_data", figurePolicy: "require_data" },
  { code: "probability", domain: "problem_solving_data", label: "Probability and conditional probability", hint: "빈도표·2×2 표에서 확률·조건부확률", legacySkill: "math.problem_solving_data", figurePolicy: "require_data" },
  { code: "inference_margin_error", domain: "problem_solving_data", label: "Inference from sample statistics and margin of error", hint: "표본 통계·오차범위·모집단 추정", legacySkill: "math.problem_solving_data", figurePolicy: "optional" },
  { code: "evaluating_statistical_claims", domain: "problem_solving_data", label: "Evaluating statistical claims: observational studies and experiments", hint: "관찰 연구·실험 설계와 주장의 타당성", legacySkill: "math.problem_solving_data", figurePolicy: "none" },
  // Geometry and Trigonometry
  { code: "area_volume", domain: "geometry_trig", label: "Area and volume", hint: "넓이·둘레·겉넓이·부피", legacySkill: "math.geometry_trig", figurePolicy: "optional" },
  { code: "lines_angles_triangles", domain: "geometry_trig", label: "Lines, angles, and triangles", hint: "평행선·횡단선의 각, 삼각형의 각·합동·닮음", legacySkill: "math.geometry_trig", figurePolicy: "require_geometry" },
  { code: "right_triangles_trigonometry", domain: "geometry_trig", label: "Right triangles and trigonometry", hint: "피타고라스·삼각비·특수각", legacySkill: "math.geometry_trig", figurePolicy: "require_geometry" },
  { code: "circles", domain: "geometry_trig", label: "Circles", hint: "원의 방정식·호·부채꼴·현·접선", legacySkill: "math.geometry_trig", figurePolicy: "optional" },
  // Reading and Writing
  { code: "central_ideas_details", domain: "rw_information_ideas", label: "Central Ideas and Details", hint: "", legacySkill: "rw.central_ideas_details", figurePolicy: "none" },
  { code: "inferences", domain: "rw_information_ideas", label: "Inferences", hint: "", legacySkill: "rw.inferences", figurePolicy: "none" },
  { code: "command_of_evidence_text", domain: "rw_information_ideas", label: "Command of Evidence (Textual)", hint: "", legacySkill: "rw.command_of_evidence_text", figurePolicy: "none" },
  { code: "command_of_evidence_quant", domain: "rw_information_ideas", label: "Command of Evidence (Quantitative)", hint: "표·그래프 자료는 figure(type:'data')", legacySkill: "rw.command_of_evidence_quant", figurePolicy: "require_data" },
  { code: "words_in_context", domain: "rw_craft_structure", label: "Words in Context", hint: "", legacySkill: "rw.words_in_context", figurePolicy: "none" },
  { code: "text_structure_purpose", domain: "rw_craft_structure", label: "Text Structure and Purpose", hint: "", legacySkill: "rw.text_structure_purpose", figurePolicy: "none" },
  { code: "cross_text_connections", domain: "rw_craft_structure", label: "Cross-Text Connections", hint: "", legacySkill: "rw.cross_text", figurePolicy: "none" },
  { code: "rhetorical_synthesis", domain: "rw_expression_ideas", label: "Rhetorical Synthesis", hint: "", legacySkill: "rw.rhetorical_synthesis", figurePolicy: "none" },
  { code: "transitions", domain: "rw_expression_ideas", label: "Transitions", hint: "", legacySkill: "rw.transitions", figurePolicy: "none" },
  { code: "boundaries", domain: "rw_standard_english", label: "Boundaries", hint: "", legacySkill: "rw.boundaries", figurePolicy: "none" },
  { code: "form_structure_sense", domain: "rw_standard_english", label: "Form, Structure, and Sense", hint: "", legacySkill: "rw.form_structure_sense", figurePolicy: "none" },
];

export const SKILL_BY_CODE = new Map(SKILL_CODES.map((s) => [s.code, s]));
export const DOMAIN_BY_CODE = new Map(SAT_DOMAINS.map((d) => [d.code, d]));
export const skillsForDomain = (domain: SatDomainCode | string | null | undefined) => SKILL_CODES.filter((s) => s.domain === domain);
export const domainLabel = (code: string | null | undefined) => (code ? DOMAIN_BY_CODE.get(code as SatDomainCode)?.label ?? code : null);
export const skillLabel = (code: string | null | undefined) => (code ? SKILL_BY_CODE.get(code)?.label ?? code : null);
export const domainShort = (code: string | null | undefined) => (code ? DOMAIN_BY_CODE.get(code as SatDomainCode)?.short ?? code : null);

/** 옛 자유 입력 유형(skill_type) → 영역 추정. 세부 기술은 사람이 고른다(추정하지 않음). */
export function inferDomainFromLegacy(skillType: string | null | undefined): SatDomainCode | null {
  if (!skillType) return null;
  const q = skillType.toLowerCase();
  if (q.includes("algebra") && !q.includes("advanced")) return "algebra";
  if (q.includes("advanced")) return "advanced_math";
  if (q.includes("problem-solving") || q.includes("data analysis")) return "problem_solving_data";
  if (q.includes("geometry") || q.includes("trigonometry")) return "geometry_trig";
  const direct = SKILL_CODES.find((s) => s.label.toLowerCase() === q || s.code === q);
  return direct?.domain ?? null;
}
