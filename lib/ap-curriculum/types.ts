// AP 커리큘럼 시드 데이터 형식(2026-10-08). 설계: docs/ap/curriculum-keyword-design.md
// 키워드 = 내용 축(단원·토픽·세부 키워드)만. 스킬·문항 구조는 별도 축이다.

export const AP_SUBJECT_CODES = [
  "ap_calculus_ab",
  "ap_calculus_bc",
  "ap_statistics",
  "ap_biology",
  "ap_chemistry",
  "ap_physics_1",
  "ap_computer_science_a",
  "ap_microeconomics",
  "ap_macroeconomics",
  "ap_english_language",
] as const;
export type ApSubjectCode = (typeof AP_SUBJECT_CODES)[number];

export type SubKeywordKind = "concept" | "skill" | "misconception" | "representation";
export const SUB_KEYWORD_KINDS: readonly SubKeywordKind[] = ["concept", "skill", "misconception", "representation"];

export type ApSubKeyword = {
  /** 안정 코드: `<토픽코드>#<번호>` (예: "5.3#2"). 한 번 쓰면 바꾸지 않는다(이름은 바꿔도 됨). */
  code: string;
  /** 짧은 원문 아닌 자체 라벨(영문, 학생·교사 노출 가능). */
  label: string;
  kind: SubKeywordKind;
  /** 공식 스킬 코드(skills 목록에 있는 것). */
  skills: string[];
  /** 같은 과목 안에서 먼저 가르쳐야 하는 코드(토픽 코드 또는 세부 키워드 코드). */
  requires: string[];
  /** 개략 수업 횟수(1회 = 50분 개인 수업 기준 제안값, 내부 제안). */
  estLessons: number;
};

export type ApTopic = {
  /** 공식 토픽 코드 (예: "1.1"). 공식 코드가 없는 과목은 designNotes 에 근거를 적고 "U<단원>.<번호>" 형식. */
  code: string;
  title: string;
  /** both = AB·BC 공통 / bc_only = BC 전용 / 그 외 과목은 "both". */
  scope: "both" | "bc_only" | "ab_only";
  /** CED가 제시하는 권장 스킬(있을 때). */
  skills: string[];
  requires: string[];
  estLessons: number;
  subKeywords: ApSubKeyword[];
};

export type ApUnit = {
  code: string; // "1".."10"
  title: string;
  /** CED가 제시하는 단원 차시 범위(문자열, 예: "~22–23"). 없으면 null. */
  officialClassPeriods: string | null;
  topics: ApTopic[];
};

export type ApSkill = { code: string; category: string; label: string };

export type ApWeight = {
  axis: "unit" | "skill";
  /** 단원 번호 또는 스킬 범주 코드 */
  code: string;
  section: "mc" | "frq";
  min: number | null;
  max: number | null;
  /** 출처 설명(CED 쪽수/표 이름) */
  source: string;
};

export type ApCurriculumFile = {
  schemaVersion: 1;
  subject: {
    apCode: ApSubjectCode;
    name: string; // 관리자 과목 이름
    family: string; // 공유 토픽 연결용(calculus, statistics …)
    edition: string; // "ced-2027"
    cedVersion: string; // 예: "AP Calculus AB and BC CED (Fall 2026 clarifications)"
    examYear: 2027;
    sourceUrl: string;
    officialTopicCodes: boolean; // false 면 U<단원>.<번호> 임의 코드
    designNotes: string;
  };
  skills: ApSkill[];
  weights: ApWeight[];
  units: ApUnit[];
};
