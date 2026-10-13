// 과목별 시험 도구 구성. 새 과목은 여기에 항목을 더하고 패널 컴포넌트만 꽂으면 된다
// (예: 물리 참조 정보, 화학 주기율표·데이터). 현재는 통계만 구현.
export type CalculatorTab = "statistics" | "desmos" | "scientific";
export type ReferenceKind = "statistics" | "physics" | "chemistry" | "java";
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
};

export function subjectToolsConfig(apSubject: string | null | undefined): SubjectToolsConfig {
  return (apSubject && BY_SUBJECT[apSubject]) || DEFAULT_CONFIG;
}
