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
  /** 문장-수식 의미 일치 검사용: 지문이 '<명사구> 는 <값>' 으로 서술하는 대응표. 명사구와 값이 같은 문장에서 서로 가장 가까워야 한다(verify.checkBindings). */
  phraseBindings?: { phrase: string; value: number }[];
  /**
   * 자료(그림·표). figure 객체(lib/problem-figures 규격) 또는 없음. 지문은 값을 되풀이하지 않고 "the table / the graph shown" 으로 가리키며,
   * verificationJs 는 이 figure 의 데이터를 `const FIGURE = {...};`(또는 선택지형은 `const CHOICES = [...]`)로 받아 읽는다.
   */
  figure?: unknown;
  /** 정답이 숫자("value", 기본)인지 선택지 번호("index": 선택지형 figure_choice·서술 선지)인지. index 이면 verificationJs 는 정답 선지 번호(0 기준)를 return 한다. */
  answerKind?: "value" | "index";
  /** 문항 형식. 생략하면 mc. spr 이면 options 는 [] 이고 answers 에 동치 정답 목록(그리드 입력 형식)이 있다. */
  format?: "mc" | "spr";
  answers?: string[];
  /** 선택지가 그림인 문항(figure_choice)의 오답 규칙 선언 — verify 의 일반 선택지 검증기가 쓴다. */
  choice?: ChoiceDecl;
};

/**
 * 선택지형 일반 검증기 입력. predicate 는 verificationJs 안에 있다(CHOICES 를 읽어 정답 하나만 참).
 * rules[i] 는 선택지 i 가 따르는 오답 규칙 id(정답 자리는 "correct"). diagnoseJs 는 `(c, ok, P)` → 규칙 id 를 return 하는 함수 본문이다.
 */
export type ChoiceDecl = { rules: string[]; diagnoseJs: string; params: Record<string, unknown> };

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
  /** 난이도. 생략하면 hard. easy/medium 원형은 hard 주장 검사(풀이 단계·결합 개념)를 면제받고 연산자는 "frame" 이다. */
  difficulty?: "easy" | "medium" | "hard";
  /** 같은 kind 의 medium 컴파일러 풀이 단계 수(비교 기준) */
  mediumSteps: number;
  /** SPR(주관식 단답) 변형 가능 여부와 사유(새 자료 원형은 필수; 옛 원형은 생략 시 시드 프로브로 판정). */
  spr?: { capable: boolean; reason: string };
  /** 자료 커버리지 매니페스트 항목 id(`<skill>.<kind>.<fig>.<loc>`). 있으면 대량 생성 전 커버리지 게이트 대상이다. */
  figureItem?: string;
  /** 유사문항 그룹 키의 기준 id(생략 시 id). mc/spr 변형이 같은 그룹을 공유하게 한다. */
  groupId?: string;
  generate(rng: Rng): Instance;
};
