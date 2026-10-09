// 2026-10-05 랜딩 v2 — 공개 카피 상수(오너 확정 문구). 근거 메모는 docs/briefs/landing-claims.md.
// 2026-10-09 — 숫자는 게시된 무료 세트를 SAT 와 AP 로 나눠 읽어 표시한다(lib/landing/practice-test-count.ts).
//   헤드라인의 숫자는 SAT 세트만 센다(AP 세트가 섞여 "17 Free SAT" 로 나오던 오류 수정). AP 는 별도 줄로 알린다.
export function heroHeadline(count = 0, apCount = 0): { line1: string; line2: string; growing: string | null } {
  return {
    line1: count > 0 ? `${count} Free SAT Practice Tests.` : "Free SAT Practice Tests.",
    line2: "Turn Every Mistake Into Progress.",
    growing: count > 0 || apCount > 0
      ? `${apCount > 0 ? `Plus ${apCount} AP practice ${apCount === 1 ? "set" : "sets"}. ` : ""}New tests are added regularly.`
      : null,
  };
}
