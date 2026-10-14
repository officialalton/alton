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
};

export function subjectToolsConfig(apSubject: string | null | undefined): SubjectToolsConfig {
  return (apSubject && BY_SUBJECT[apSubject]) || DEFAULT_CONFIG;
}
