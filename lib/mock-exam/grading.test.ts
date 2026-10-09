import { describe, expect, it } from "vitest";
import { autoGrade } from "./grading";

describe("autoGrade — 모의고사 mc/spr 자동 채점", () => {
  it("mc: 응답 인덱스가 정답 인덱스와 문자열로 같으면 정답", () => {
    expect(autoGrade("mc", "2", 2, null)).toBe(true);
    expect(autoGrade("mc", "1", 2, null)).toBe(false);
  });

  it("mc: 정답 인덱스가 없으면 채점 불가(null)", () => {
    expect(autoGrade("mc", "0", null, null)).toBeNull();
  });

  it("spr: 정답 목록 중 하나와 정규화(공백 제거) 후 일치하면 정답", () => {
    expect(autoGrade("spr", " 3/4 ", null, ["3/4"])).toBe(true);
    expect(autoGrade("spr", "0.75", null, ["3/4"])).toBe(false);
  });

  it("spr: 숫자로 비교해 근사 일치하면 정답", () => {
    expect(autoGrade("spr", "0.75", null, ["0.7500000001"])).toBe(true);
  });

  it("spr: 빈 응답은 오답", () => {
    expect(autoGrade("spr", "   ", null, ["5"])).toBe(false);
  });

  it("spr: 정답 목록이 없으면 채점 불가(null)", () => {
    expect(autoGrade("spr", "5", null, null)).toBeNull();
  });

  it("essay/math 는 자동 채점하지 않는다(null)", () => {
    expect(autoGrade("essay", "내 답", null, null)).toBeNull();
    expect(autoGrade("math", "풀이", null, null)).toBeNull();
  });
});
