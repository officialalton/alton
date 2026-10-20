// 과목별 시험 도구 구성. 새 과목은 여기에 항목을 더하고 패널 컴포넌트만 꽂으면 된다
// (예: 물리 참조 정보, 화학 주기율표·데이터). 현재는 통계만 구현.
export type CalculatorTab = "statistics" | "desmos" | "scientific" | "basic";
export type ReferenceKind = "statistics" | "physics" | "chemistry" | "java" | "microeconomics" | "biology";
export type SubjectToolsConfig = { calculatorTabs: CalculatorTab[]; reference: ReferenceKind | null };

const DEFAULT_CONFIG: SubjectToolsConfig = { calculatorTabs: ["desmos"], reference: null };

const BY_SUBJECT: Record<string, SubjectToolsConfig> = {
  ap_statistics: { calculatorTabs: ["statistics", "desmos"], reference: "statistics" },
  // Physics 1: 계산기 허용(4칙·공학용·그래핑, CED p.170)이나 Bluebook 내장 형태는 미확인 — 앱은 공학용만 제공하고 Desmos 는 켜지 않는다.
  ap_physics_1: { calculatorTabs: ["scientific"], reference: "physics" },
  // Chemistry: CED(2024)는 공학용 또는 그래핑 계산기를 두 섹션에서 권장한다고 적고 4칙 전용은 언급하지 않는다(docs/ap/chemistry-facts.md). Bluebook 내장 계산기 형태는 UNVERIFIED —
  // 앱은 공학용만 제공하고 Desmos 는 켜지 않는다. 주기율표·식 시트는 시험 중 제공되므로 Reference 패널(ALTON 자체 문구)을 둔다.
  ap_chemistry: { calculatorTabs: ["scientific"], reference: "chemistry" },
  // Computer Science A: 계산 문제가 없고 계산기는 시험 구성에 없다(레이아웃 "na"). 시험에는 Java Quick Reference 가 제공되므로(AP Central 시험 페이지) Reference 패널(ALTON 자체 문구)만 둔다 — docs/ap/csa-facts.md.
  ap_computer_science_a: { calculatorTabs: [], reference: "java" },
  // Microeconomics: CED(V.1) — 사칙(four-function) 계산기가 두 섹션 모두에서 허용된다. 그래핑·공학용은 요구하지 않으므로 사칙 계산기만 제공하고 Desmos 는 켜지 않는다.
  // 공식 수식 시트는 CED 에 언급이 없다(UNVERIFIED) — Reference 패널은 ALTON 자체 문구의 학습용 요약이며 고지문을 둔다.
  ap_microeconomics: { calculatorTabs: ["basic"], reference: "microeconomics" },
  // Macroeconomics: CED(V.1) — 사칙(four-function) 계산기가 두 섹션 모두에서 허용된다(Exam Overview p.129). 공식 수식 시트는 CED 에 언급이 없고 AP Macro 는 암기·정의·그래프 중심이라(docs/ap/macroeconomics-facts.md)
  // Reference 패널을 만들지 않는다(없는 시트를 지어내지 않는다). Bluebook 내장 계산기 형태는 UNVERIFIED.
  ap_macroeconomics: { calculatorTabs: ["basic"], reference: null },
  // Biology: CED(V.1) — 사칙·공학용·그래핑 계산기가 두 섹션 모두에서 허용된다(Exam Overview p.197). 표준오차·카이제곱·로그가 필요하므로 공학용을 제공하고 Desmos 는 켜지 않는다(Bluebook 내장 형태는 UNVERIFIED).
  // 공식 AP Biology Equations and Formulas 시트(CED Appendix p.230–231)는 시험 중 제공되므로 Reference 패널(ALTON 자체 문구)을 둔다 — docs/ap/biology-facts.md.
  ap_biology: { calculatorTabs: ["scientific"], reference: "biology" },
  // English Language and Composition: 계산·수식 도구가 없다(AP Central 시험 페이지에 계산기·참조 시트 언급 없음, docs/ap/englang-facts.md) — 계산기·참조 패널을 모두 끈다(기본값 Desmos 로 떨어지면 안 된다).
  ap_english_language: { calculatorTabs: [], reference: null },
  // English Literature and Composition: 계산·수식 도구가 없다(AP Central 시험 페이지·CED에 계산기·참조 시트 없음, docs/ap/englit-facts.md) — 모두 끈다.
  ap_english_literature: { calculatorTabs: [], reference: null },
  // Psychology: CED(effective Fall 2025) 시험 안내에 계산기·공식 수식 시트 언급이 없다(docs/ap/psychology-facts.md). 통계는 평균·중앙값·최빈값·범위·표준편차 해석 수준이라 손계산이다 — 계산기·참조 패널을 모두 끈다(기본값 Desmos 로 떨어지면 안 된다). 실제 시험 계산기 정책은 UNVERIFIED.
  ap_psychology: { calculatorTabs: [], reference: null },
  ap_world_history: { calculatorTabs: [], reference: null }, // 계산기·참조 시트 없음(CED)
  ap_us_history: { calculatorTabs: [], reference: null }, // 계산기·참조 시트 없음(CED)
  // 2026-10-20 추가 10과목. 참조 패널은 과목별 ALTON 자체 문구가 아직 없어 null(Physics 1 패널을 재사용하지 않는다) — docs/ap/new-subjects-plan-2026-10-20.md 의 후속 항목.
  ap_physics_2: { calculatorTabs: ["scientific"], reference: null }, // CED: 계산기 허용, 공식 식 시트는 Bluebook 제공
  ap_physics_c_mechanics: { calculatorTabs: ["scientific"], reference: null },
  ap_physics_c_electricity_and_magnetism: { calculatorTabs: ["scientific"], reference: null }, // CED: 사칙·공학용·그래핑 허용
  ap_environmental_science: { calculatorTabs: ["scientific"], reference: null }, // AP Central: 계산기 허용(종류 UNVERIFIED), 참조 정보는 Bluebook 에만 제공
  ap_us_government_and_politics: { calculatorTabs: [], reference: null },
  ap_comparative_government_and_politics: { calculatorTabs: [], reference: null },
  ap_human_geography: { calculatorTabs: [], reference: null },
  ap_computer_science_principles: { calculatorTabs: [], reference: null }, // Exam Reference Sheet 는 후속(자체 문구 필요)
  ap_european_history: { calculatorTabs: [], reference: null },
  ap_precalculus: { calculatorTabs: ["desmos"], reference: null }, // 파트 B 그래핑 계산기 필수(CED); 파트 A·FRQ 파트 B 는 계산기 불가 — 파트별 제어는 후속
};

export function subjectToolsConfig(apSubject: string | null | undefined): SubjectToolsConfig {
  return (apSubject && BY_SUBJECT[apSubject]) || DEFAULT_CONFIG;
}
