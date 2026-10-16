import { describe, expect, it } from "vitest";
import { solveMip, type Problem } from "./ilp";

describe("ilp(밀집 단체법 + 분기한정)", () => {
  it("LP: 최소화 x+y s.t. x+2y>=4, 3x+y>=6 → 해 (1.6,1.2) 목적 2.8", () => {
    const p: Problem = { n: 2, obj: [1, 1], integer: [false, false], cons: [{ coef: [[0, 1], [1, 2]], sense: ">=", rhs: 4 }, { coef: [[0, 3], [1, 1]], sense: ">=", rhs: 6 }] };
    const r = solveMip(p); expect(r.status).toBe("optimal"); expect(r.obj).toBeCloseTo(2.8, 6);
  });
  it("정수: 최소화 x+y s.t. x+2y>=4, 3x+y>=6 → 3", () => {
    const p: Problem = { n: 2, obj: [1, 1], integer: [true, true], cons: [{ coef: [[0, 1], [1, 2]], sense: ">=", rhs: 4 }, { coef: [[0, 3], [1, 1]], sense: ">=", rhs: 6 }] };
    const r = solveMip(p); expect(r.status).toBe("optimal"); expect(r.obj).toBe(3);
  });
  it("불가능: x>=2, x<=1", () => {
    const p: Problem = { n: 1, obj: [1], integer: [true], cons: [{ coef: [[0, 1]], sense: ">=", rhs: 2 }, { coef: [[0, 1]], sense: "<=", rhs: 1 }] };
    expect(solveMip(p).status).toBe("infeasible");
  });
  it("이진 배정: 3개 항목을 2개 세트에, 항목당 1세트·세트당 정확히 1~2개, 비용 최소", () => {
    // x[i][s] = 3i+s... n=6 (i=0..2, s=0..1). 비용: item0 s0=1 s1=5, item1 s0=4 s1=2, item2 s0=3 s1=3
    const cost = [1, 5, 4, 2, 3, 3];
    const cons = [
      ...[0, 1, 2].map((i) => ({ coef: [[2 * i, 1], [2 * i + 1, 1]] as [number, number][], sense: "<=" as const, rhs: 1 })),
      { coef: [[0, 1], [2, 1], [4, 1]] as [number, number][], sense: "=" as const, rhs: 1 }, { coef: [[1, 1], [3, 1], [5, 1]] as [number, number][], sense: "=" as const, rhs: 2 },
    ];
    const r = solveMip({ n: 6, obj: cost, integer: new Array(6).fill(true), binary: new Array(6).fill(true), cons });
    expect(r.status).toBe("optimal"); expect(r.obj).toBe(1 + 2 + 3);
  });
});
