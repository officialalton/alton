// 과목별 시험 도구 구성. 새 과목은 여기에 항목을 더하고 패널 컴포넌트만 꽂으면 된다
// (예: 물리 참조 정보, 화학 주기율표·데이터). 현재는 통계만 구현.
export type CalculatorTab = "statistics" | "desmos" | "scientific" | "basic";
export type ReferenceKind = "statistics" | "physics" | "chemistry" | "microeconomics";
export type SubjectToolsConfig = { calculatorTabs: CalculatorTab[]; reference: ReferenceKind | null };

const DEFAULT_CONFIG: SubjectToolsConfig = { calculatorTabs: ["desmos"], reference: null };

const BY_SUBJECT: Record<string, SubjectToolsConfig> = {
  ap_statistics: { calculatorTabs: ["statistics", "desmos"], reference: "statistics" },
  // Physics 1: 계산기 허용(4칙·공학용·그래핑, CED p.170)이나 Bluebook 내장 형태는 미확인 — 앱은 공학용만 제공하고 Desmos 는 켜지 않는다.
  ap_physics_1: { calculatorTabs: ["scientific"], reference: "physics" },
  // Chemistry: CED(2024)는 공학용 또는 그래핑 계산기를 두 섹션에서 권장한다고 적고 4칙 전용은 언급하지 않는다(docs/ap/chemistry-facts.md). Bluebook 내장 계산기 형태는 UNVERIFIED —
  // 앱은 공학용만 제공하고 Desmos 는 켜지 않는다. 주기율표·식 시트는 시험 중 제공되므로 Reference 패널(ALTON 자체 문구)을 둔다.
  ap_chemistry: { calculatorTabs: ["scientific"], reference: "chemistry" },
  // Microeconomics: CED(V.1) — 사칙(four-function) 계산기가 두 섹션 모두에서 허용된다. 그래핑·공학용은 요구하지 않으므로 사칙 계산기만 제공하고 Desmos 는 켜지 않는다.
  // 공식 수식 시트는 CED 에 언급이 없다(UNVERIFIED) — Reference 패널은 ALTON 자체 문구의 학습용 요약이며 고지문을 둔다.
  ap_microeconomics: { calculatorTabs: ["basic"], reference: "microeconomics" },
};

export function subjectToolsConfig(apSubject: string | null | undefined): SubjectToolsConfig {
  return (apSubject && BY_SUBJECT[apSubject]) || DEFAULT_CONFIG;
}
