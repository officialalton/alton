import { describe, expect, it } from "vitest";
import { allSweepCells, sweepCell } from "./sweep";

// 전 세부 패턴(75) + 카탈로그 밖 3종 × 난이도 3 = 234칸을 고정 시드로 스윕한다(CLI 는 scripts/mock-exam-generation/math-compiler-sweep.ts, 수천 시드).
// 예외·선택지 4개 미만/중복·정답 인덱스·오답 근거 인덱스 위반은 버그다. 검증기가 거절한 후보는 정상이라 세지 않는다.
describe("기존 계산형 컴파일러 시드 스윕", () => {
  it("모든 칸에서 120 시드 동안 불변식 위반이 0이다", () => {
    const origLog = console.log; console.log = () => {};
    try {
      const bugs: string[] = []; let accepted = 0;
      for (const cell of allSweepCells()) {
        let r = sweepCell(cell, 120);
        if (r.accepted === 0 && Object.keys(r.rejected).some((k) => k.includes("자료 필수"))) r = sweepCell({ ...cell, figurePolicy: "require_data" }, 120);
        accepted += r.accepted;
        for (const b of r.bugs) bugs.push(`${cell.skill}/${cell.kind}/${cell.difficulty} seed ${b.seed}: ${b.what}`);
      }
      expect(bugs).toEqual([]);
      expect(accepted).toBeGreaterThan(234 * 120 * 0.5);
    } finally { console.log = origLog; }
  }, 120_000);

  it("같은 시드는 같은 결과를 낸다(재현성)", () => {
    const origLog = console.log; console.log = () => {};
    try {
      const cell = { skill: "nonlinear_equations_systems", kind: "root", difficulty: "hard" as const };
      const a = sweepCell(cell, 40, 500), b = sweepCell(cell, 40, 500);
      expect(a.accepted).toBe(b.accepted);
      expect(a.rejected).toEqual(b.rejected);
    } finally { console.log = origLog; }
  });
});
