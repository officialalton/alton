// 2026-10-05 랜딩 v2 — 공개 카피 상수(오너 확정 문구). 근거 메모는 docs/briefs/landing-claims.md.
export const PLANNED_PRACTICE_TEST_COUNT = 50;

export function heroHeadline(): { line1: string; line2: string } {
  return {
    line1: `${PLANNED_PRACTICE_TEST_COUNT} Free SAT & AP Practice Tests.`,
    line2: "Turn Every Mistake Into Progress.",
  };
}
