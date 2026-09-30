import { describe, expect, it } from "vitest";
import { duplicateTargets, identityMapping, setTarget, shiftFrom, swapTargets } from "./pdf-tip-mapping";

describe("팁 가져오기 쪽 매핑", () => {
  it("기본값은 같은 쪽수이고, 새 버전에 없는 쪽은 건너뛴다", () => {
    expect(identityMapping([1, 3, 5], 4)).toEqual([
      { from: 1, to: 1 },
      { from: 3, to: 3 },
      { from: 5, to: null },
    ]);
  });

  it("N쪽부터 +1 밀기(삽입) — 앞쪽은 그대로, 범위를 넘으면 건너뛴다", () => {
    const rows = identityMapping([1, 2, 3, 4], 5);
    expect(shiftFrom(rows, 2, 1, 5)).toEqual([
      { from: 1, to: 1 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5 },
    ]);
    expect(shiftFrom(identityMapping([1, 2, 3], 3), 2, 1, 3)).toEqual([
      { from: 1, to: 1 },
      { from: 2, to: 3 },
      { from: 3, to: null },
    ]);
  });

  it("-1 밀기(삭제) — 1쪽 아래로 내려가면 건너뛴다. 이미 건너뛴 행은 그대로", () => {
    const rows = [{ from: 1, to: 1 }, { from: 2, to: null }, { from: 3, to: 3 }];
    expect(shiftFrom(rows, 1, -1, 3)).toEqual([
      { from: 1, to: null },
      { from: 2, to: null },
      { from: 3, to: 2 },
    ]);
  });

  it("두 페이지 맞바꾸기, 행별 대상 지정, 중복 대상 검출", () => {
    const rows = identityMapping([1, 2, 3], 3);
    expect(swapTargets(rows, 1, 3)).toEqual([{ from: 1, to: 3 }, { from: 2, to: 2 }, { from: 3, to: 1 }]);
    expect(swapTargets(rows, 1, 9)).toEqual(rows); // 없는 행은 무시
    const dup = setTarget(rows, 3, 2);
    expect(duplicateTargets(dup)).toEqual([2]);
    expect(duplicateTargets(setTarget(dup, 3, null))).toEqual([]);
    expect(duplicateTargets(swapTargets(rows, 1, 3))).toEqual([]);
  });
});
