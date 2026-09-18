import { describe, expect, it } from "vitest";
import { evalBasicExpression } from "./MockExamMathTools";

describe("evalBasicExpression — 모의고사 기본 계산기", () => {
  it("사칙연산을 계산한다", () => {
    expect(evalBasicExpression("2+3*4")).toBe("14");
    expect(evalBasicExpression("(2+3)*4")).toBe("20");
    expect(evalBasicExpression("10/4")).toBe("2.5");
  });

  it("빈 입력은 빈 문자열", () => {
    expect(evalBasicExpression("")).toBe("");
  });

  it("악의적인 문자는 걸러내고 숫자·연산자·괄호만 남겨 계산한다", () => {
    // "alert(1)+2" 에서 문자를 제거하면 "(1)+2" 만 남는다(괄호는 계산식으로 허용).
    expect(evalBasicExpression("alert(1)+2")).toBe("3");
  });

  it("0으로 나누거나 잘못된 식은 오류를 표시한다", () => {
    expect(evalBasicExpression("1/0")).toBe("오류");
    expect(evalBasicExpression("1+")).toBe("오류");
  });
});
