// 2026-10-05 랜딩 v2 — 공개 카피 상수(오너 확정 문구). 근거 메모는 docs/briefs/landing-claims.md.
// 2026-10-08 — 모의고사 수는 DB 게시 수를 읽어 표시한다(lib/landing/practice-test-count.ts). AP는 게시본이 생기면 문구에 포함.
export function heroHeadline(count = 0, apCount = 0): { line1: string; line2: string; growing: string | null } {
  const kinds = apCount > 0 ? "SAT & AP" : "SAT";
  return {
    line1: count > 0 ? `${count} Free ${kinds} Practice Tests.` : `Free ${kinds} Practice Tests.`,
    line2: "Turn Every Mistake Into Progress.",
    growing: count > 0 ? "New tests are added regularly." : null,
  };
}
