// 수학 hard 원형(archetype) 공통 타입 — 세부 패턴(kind) × 범용 hard 연산자(operator) 한 칸이 원형 하나다.
import type { DistractorKind } from "../review";
import type { Rng } from "./rng";

/** 범용 hard 연산자 8종 — docs/qa/2026-09-30-math-hard-archetypes.md 참고. */
export type OperatorId =
  | "param_condition" // 매개변수 조건(해의 개수·존재·동치 조건)
  | "inverse" // 역문제(결과를 주고 입력·계수·구성을 찾음)
  | "compose_kind" // 다른 세부 패턴과 합성(앞 결과가 다른 개념의 입력)
  | "chain2" // 2단계 연결(앞 단계 결과가 뒤 단계의 조건)
  | "unit_ratio" // 단위·비율 결합
  | "repr_shift" // 표현 변환(문장·표·도형 → 식)
  | "constraint_select" // 제약 추가 후 해 선택·개수(정수해·외래근·범위)
  | "compare_scenarios" // 두 경우 비교·임계점
  | "frame"; // easy/medium 문장 틀 원형(연산자 없음 — 같은 원형 프레임워크로 새 유사문항 그룹을 만든다)

export class GenFail extends Error {}

export type Instance = {
  /** 지문(수식은 $...$). 질문은 별도 필드. */
  stimulus: string;
  question: string;
  options: string[];
  correctIndex: number;
  /** 정답 재계산 결과와 대조할 값: 숫자 선택지는 문자열에서 파싱, 식 선택지는 evalAt 에서 평가한다(생성기가 넣은 값 아님 — verify 가 계산). */
  evalAt?: Record<string, number>;
  explanation: string;
  explanationEn: string;
  /** 외부 입력 없는 JS 함수 본문. 문제에 적힌 수치만으로 정답 값을 brute-force 등 다른 경로로 다시 계산해 return 한다. */
  verificationJs: string;
  /** 풀이 단계(한국어) — '추가 요구 사고' 증명에 쓰인다. */
  trace: string[];
  /** 같은 원형 안의 구조 변형 이름 — 유사문항 그룹(subpattern) 분산에 쓴다. */
  variant: string;
  distractors: { index: number; kind: DistractorKind; reason: string }[];
  /** 문장이 말하는 양(명사)과 그에 대응해 세운 수식의 선언 — 명사-수식 매핑 표 기반 기계 검사(둘레/넓이 혼동 방지)용. 선택. */
  semantics?: { noun: string; expr: string; parts: string[]; vars: Record<string, number> }[];
};

export type Archetype = {
  /** `<skill 약칭>.<kind>.<operator>` */
  id: string;
  skill: string;
  kind: string;
  operator: OperatorId;
  /** 풀이 구조 요약 */
  structure: string;
  /** 같은 kind 의 medium 대비 추가로 요구되는 사고(길이·숫자·계산량 증가는 인정하지 않는다). */
  extraThinking: string;
  /** 결합되는 개념(2개 이상) */
  concepts: string[];
  /** 같은 kind 의 medium 컴파일러 풀이 단계 수(비교 기준) */
  mediumSteps: number;
  /** 난이도. 생략하면 hard(파일럿 원형). easy/medium 원형은 hard 주장 검사(풀이 단계·결합 개념)를 면제받는다. */
  difficulty?: "easy" | "medium" | "hard";
  generate(rng: Rng): Instance;
};
