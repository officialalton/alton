// 과목별 시험 도구 구성. 새 과목은 여기에 항목을 더하고 패널 컴포넌트만 꽂으면 된다
// (예: 물리 참조 정보, 화학 주기율표·데이터). 현재는 통계만 구현.
export type CalculatorTab = "statistics" | "desmos" | "scientific";
export type ReferenceKind = "statistics" | "physics";
export type SubjectToolsConfig = { calculatorTabs: CalculatorTab[]; reference: ReferenceKind | null };

const DEFAULT_CONFIG: SubjectToolsConfig = { calculatorTabs: ["desmos"], reference: null };

const BY_SUBJECT: Record<string, SubjectToolsConfig> = {
  ap_statistics: { calculatorTabs: ["statistics", "desmos"], reference: "statistics" },
  // Physics 1: 계산기 허용(4칙·공학용·그래핑, CED p.170)이나 Bluebook 내장 형태는 미확인 — 앱은 공학용만 제공하고 Desmos 는 켜지 않는다.
  ap_physics_1: { calculatorTabs: ["scientific"], reference: "physics" },
};

export function subjectToolsConfig(apSubject: string | null | undefined): SubjectToolsConfig {
  return (apSubject && BY_SUBJECT[apSubject]) || DEFAULT_CONFIG;
}
