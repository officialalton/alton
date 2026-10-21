// 목표 시험(2027년 5월) 공식 섹션 비중 레지스트리. 결과 화면의 "가중 합산 점수"가 쓰는 단일 출처다.
// 값은 저장소 문서(docs/ap/<과목>-facts.md, data/ap/curriculum-2027/*.json designNotes, docs/ap/2027-exam-spec-table.md)가
// CED·AP Central 을 인용해 기록한 것이며, 이 세션에서 1차 문서(CED PDF)와 다시 대조하지는 않았다(basis = "recorded").
// 레지스트리에 없는 과목은 가중 합산 점수를 만들지 않는다. 등급 경계점(1~5)은 여기에 없다 — docs/ap/grade-estimate-audit-2026-10-21.md.
export type ApWeightComponentId = "mc" | "frq" | "saq" | "dbq" | "leq";
export type ApExamWeights = {
  examYear: 2027;
  /** 섹션 구성 요소별 % (합 100). 풀 구성 시험에서만 쓴다. */
  components: { id: ApWeightComponentId; pct: number }[];
  /** recorded = 저장소 문서가 출처를 인용해 기록, owner = 오너 확인(원문 페이지 미기재). */
  basis: "recorded" | "owner";
  source: string;
  /** FRQ 내부 비중(%, FRQ 점수 대비): 문항 점수 비율이 이 값과 같아야 한다(예: Micro/Macro 10·5·5점 = 50·25·25%). */
  frqSplit?: number[];
};

const mcFrq = (mc: number, frq: number, source: string, basis: "recorded" | "owner" = "recorded"): ApExamWeights => ({ examYear: 2027, components: [{ id: "mc", pct: mc }, { id: "frq", pct: frq }], basis, source });
const HISTORY = (source: string): ApExamWeights => ({ examYear: 2027, components: [{ id: "mc", pct: 40 }, { id: "saq", pct: 20 }, { id: "dbq", pct: 25 }, { id: "leq", pct: 15 }], basis: "recorded", source });

export const AP_EXAM_WEIGHTS: Record<string, ApExamWeights> = {
  ap_calculus_ab: mcFrq(50, 50, "docs/ap/2027-exam-spec-table.md (AP Central)"),
  ap_calculus_bc: mcFrq(50, 50, "docs/ap/2027-exam-spec-table.md (AP Central)"),
  ap_biology: mcFrq(50, 50, "docs/ap/biology-facts.md; curriculum-2027/ap_biology.json (CED exam overview)"),
  ap_chemistry: mcFrq(50, 50, "docs/ap/chemistry-facts.md"),
  ap_physics_1: mcFrq(50, 50, "docs/ap/physics1-facts.md (CED p.17)"),
  ap_statistics: mcFrq(50, 50, "docs/ap/statistics-facts.md (CED p.156)"),
  ap_computer_science_a: mcFrq(55, 45, "curriculum-2027/ap_computer_science_a.json (CED exam overview)"),
  // 오너 확인(2026-10-21): Fall 2026 CED 기재 MC 66.65% · FRQ 33.35%(장문 1문항 50% · 단문 2문항 각 25%). CED 쪽수는 미기록 — 확인되면 source 에 추가.
  ap_microeconomics: { ...mcFrq(66.65, 33.35, "Fall 2026 CED (owner confirmation 2026-10-21; page number not recorded)", "owner"), frqSplit: [50, 25, 25] },
  ap_macroeconomics: { ...mcFrq(66.65, 33.35, "Fall 2026 CED (owner confirmation 2026-10-21; page number not recorded)", "owner"), frqSplit: [50, 25, 25] },
  ap_psychology: mcFrq(200 / 3, 100 / 3, "docs/ap/psychology-facts.md (CED p.147: 66.7% / 33.3%)"),
  ap_english_language: mcFrq(45, 55, "curriculum-2027/ap_english_language.json (CED exam overview)"),
  ap_english_literature: mcFrq(45, 55, "curriculum-2027/ap_english_literature.json (CED p.135)"),
  ap_us_history: HISTORY("docs/ap/ushistory-facts.md (CED p.497)"),
  ap_world_history: HISTORY("docs/ap/worldhistory-facts.md (CED p.195-198)"),
  ap_european_history: HISTORY("docs/ap/europeanhistory-groundwork.md (AP Central exam page)"),
  ap_physics_c_mechanics: mcFrq(50, 50, "owner confirmation 2026-10-20 (AP Central page)", "owner"),
  ap_physics_c_electricity_and_magnetism: mcFrq(50, 50, "curriculum-2027/ap_physics_c_electricity_and_magnetism.json (CED)"),
  ap_precalculus: mcFrq(62.5, 37.5, "docs/ap/precalculus-groundwork.md §1 (AP Central exam page)"),
};

export function apWeightsFor(subject: string | null | undefined): ApExamWeights | null {
  return (subject && AP_EXAM_WEIGHTS[subject]) || null;
}
