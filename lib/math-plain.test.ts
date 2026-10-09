import { describe, expect, it } from "vitest";
import { mathToPlain } from "./math-plain";

describe("mathToPlain", () => {
  it("구분자를 지우고 흔한 TeX 를 읽기 쉽게 바꾼다", () => {
    expect(mathToPlain("$f$")).toBe("f");
    expect(mathToPlain("\\ln\\left(4x^{2}+4\\right)e^{0.5x}")).toBe("ln(4x^2+4)e^(0.5x)");
    expect(mathToPlain("If $\\frac{a+1}{b}\\le \\sqrt{x}$ then")).toBe("If (a+1)/(b)≤ √(x) then");
    expect(mathToPlain("$$\\int_0^1 x\\,dx$$")).toContain("∫");
  });
  it("수식이 없는 일반 문장은 그대로", () => {
    expect(mathToPlain("Which choice best states the main idea?")).toBe("Which choice best states the main idea?");
    expect(mathToPlain("Cost is $5 and $6")).toBe("Cost is 5 and 6");
  });
});
