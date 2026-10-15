// AP FRQ 전달 방식 단일 설정표(docs/ap/2027-exam-spec-table.md "전달 방식" 열이 출처).
//   paper   = 실제 시험에서 FRQ 를 종이 답안지에 손글씨로 쓴다(하이브리드: MC 디지털, FRQ 종이) → 파트별 "Handwrite" 제공.
//   digital = 완전 디지털(타이핑이 실제 형식) → 손글씨 UI 없음.
// DB 의 _ap_frq_paper_subject()(마이그레이션 570)가 같은 목록을 미러한다 — frq-handwriting.integration.test.ts 가 둘이 같은지 검사한다.
export type ApFrqDelivery = "paper" | "digital";
export const AP_FRQ_DELIVERY: Record<string, ApFrqDelivery> = {
  ap_calculus_ab: "paper",
  ap_calculus_bc: "paper",
  ap_physics_1: "paper",
  ap_biology: "paper",
  ap_chemistry: "paper",
  ap_microeconomics: "paper",
  ap_macroeconomics: "paper",
  ap_statistics: "digital",
  ap_computer_science_a: "digital",
  ap_english_language: "digital",
  ap_us_history: "digital", // AP Central: 완전 디지털(Bluebook), 2027 SAQ/LEQ 개편
  ap_english_literature: "digital", // 완전 디지털(Bluebook) — AP Central 시험 페이지(docs/ap/englit-facts.md)
  ap_psychology: "digital", // 서술형(Article Analysis·Evidence-Based) 타이핑 — 실제 전달 방식은 UNVERIFIED(docs/ap/psychology-facts.md)
};
export function apFrqIsPaper(subject: string | null | undefined): boolean {
  return !!subject && AP_FRQ_DELIVERY[subject] === "paper";
}
export const PAPER_FRQ_NOTICE = "On the real AP exam, free-response answers are handwritten in a paper booklet. Here you can handwrite or type your answer for practice.";
