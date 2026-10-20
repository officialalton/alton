// College Board 공식 문항 순서 규칙(2026-10-20 조사: docs/ap/ap-question-order-research-2026-10-20.md).
// 공식 Exam Overview 표가 FRQ 번호(Question 1, 2, …)별 유형을 명시한 과목만 여기에 둔다. MC 의 단원·난이도 순서는 어느 과목에서도 공표되지 않았으므로 규칙을 만들지 않는다.
// USH/WH(SAQ→DBQ→LEQ)는 각 조립기가 이미 템플릿 순서를 검사하고, 미적분은 섹션 레이아웃(파트 A→B)이 순서를 고정한다.
import { BIO_FRQ_TYPES } from "./full-set-rules";

type Rank = (frqType: string) => number; // 작을수록 앞. 알 수 없으면 -1
const listRank = (order: readonly string[]): Rank => (t) => order.indexOf(t);
const prefixRank = (prefixes: readonly string[]): Rank => (t) => prefixes.findIndex((p) => t.startsWith(p));

/** 과목 → FRQ 번호 순(공식). Economics 는 Q1 Long(10점), Q2·Q3 Short(5점) 이라 long 접두가 먼저, short 둘의 순서는 자유(안정 정렬). */
export const OFFICIAL_FRQ_ORDER: Record<string, { rank: Rank; source: string }> = {
  ap_biology: { rank: listRank(BIO_FRQ_TYPES), source: "Biology CED Exam Overview p.197 (Q1 Results 9 · Q2 Graphing 9 · Q3 Investigation 4 · Q4 Conceptual 4 · Q5 Model 4 · Q6 Data 4)" },
  ap_physics_1: { rank: listRank(["mr", "tbr", "lab", "qqt"]), source: "Physics 1 CED Exam Overview p.170 (Q1 MR · Q2 TBR · Q3 Experimental Design · Q4 QQT)" },
  ap_statistics: { rank: listRank(["q1_multifocus", "q2_regression", "q3_inference", "q4_integrated"]), source: "Statistics CED Exam Overview p.156/158 (Q1 Multi-Focus 1·2 · Q2 Multi-Focus 3·4 · Q3 Inference · Q4 Multi-Focus 2·3·4)" },
  ap_computer_science_a: { rank: listRank(["q1", "q2", "q3", "q4"]), source: "CSA CED Exam Overview (Q1 Methods/Control · Q2 Class · Q3 Data Analysis ArrayList · Q4 2D Array)" },
  ap_psychology: { rank: listRank(["aaq", "ebq"]), source: "Psychology CED Exam Overview (Q1 Article Analysis · Q2 Evidence-Based)" },
  ap_macroeconomics: { rank: prefixRank(["long", "short"]), source: "Macroeconomics CED Exam Overview (Q1 Long 10 · Q2 Short 5 · Q3 Short 5)" },
  ap_microeconomics: { rank: prefixRank(["long", "short"]), source: "Microeconomics CED Exam Overview (Q1 Long 10 · Q2 Short 5 · Q3 Short 5)" },
  ap_english_language: { rank: listRank(["q1", "q2", "q3"]), source: "English Language CED Exam Information p.107 (Q1 Synthesis · Q2 Rhetorical Analysis · Q3 Argument)" },
  ap_english_literature: { rank: listRank(["q1", "q2", "q3"]), source: "English Literature CED Exam Overview (Q1 Poetry · Q2 Prose Fiction · Q3 Literary Argument)" },
};

/**
 * FRQ 키를 공식 번호 순으로 안정 정렬한다. 규칙이 없는 과목이거나 유형을 알 수 없는 키가 하나라도 있으면 입력 순서를 그대로 돌려준다(추측 정렬 금지;
 * 유형 누락·중복은 각 조립기의 독립 검증이 거부한다).
 */
export function sortFrqByOfficialOrder(subject: string, keys: readonly string[], typeOf: (key: string) => string | null | undefined): string[] {
  const rule = OFFICIAL_FRQ_ORDER[subject];
  if (!rule) return [...keys];
  const ranked = keys.map((k, i) => ({ k, i, r: rule.rank(typeOf(k) ?? "") }));
  if (ranked.some((x) => x.r < 0)) return [...keys];
  return ranked.sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.k);
}

/** 위치 순서대로 나열된 FRQ 유형이 공식 번호 순인지(규칙 없는 과목은 null). */
export function frqOrderComplies(subject: string, typesInPositionOrder: readonly string[]): boolean | null {
  const rule = OFFICIAL_FRQ_ORDER[subject];
  if (!rule) return null;
  const r = typesInPositionOrder.map((t) => rule.rank(t));
  return r.every((x) => x >= 0) && r.every((x, i) => i === 0 || x >= r[i - 1]);
}
