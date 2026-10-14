import { describe, expect, it } from "vitest";
import { breakOptionAnalysis } from "./explanation-format";

describe("breakOptionAnalysis", () => {
  it("선택지 설명을 줄로 나눈다(A 는 문장 중간이라 그대로)", () => {
    const t = "The passage says the angle matches. That makes A the answer. B ignores the rule. C correctly says the angle shifts, but gives a wrong reason. D says the dance shows only distance.";
    expect(breakOptionAnalysis(t)).toBe(
      "The passage says the angle matches. That makes A the answer.\nB ignores the rule.\nC correctly says the angle shifts, but gives a wrong reason.\nD says the dance shows only distance.",
    );
  });
  it("선택지 문자가 하나뿐이면 건드리지 않는다", () => {
    const t = "The answer is correct. B is wrong. That is all.";
    expect(breakOptionAnalysis(t)).toBe(t);
  });
  it("관사 A 로 시작하는 문장은 나누지 않는다", () => {
    const t = "A block slides down. A ramp is smooth. B ignores friction. C adds mass.";
    expect(breakOptionAnalysis(t)).toBe("A block slides down. A ramp is smooth.\nB ignores friction.\nC adds mass.");
  });
  it("정답 문장 뒤의 \"A swaps …\" 처럼 동사형 A 설명도 나눈다", () => {
    const t = "The answer is B. A swaps the claim. C turns something. D is the opposite.";
    expect(breakOptionAnalysis(t)).toBe("The answer is B.\nA swaps the claim.\nC turns something.\nD is the opposite.");
  });
  it("한국어 조사형도 나눈다", () => {
    const t = "정답은 A이다. B는 조건을 무시한다. C는 계산이 틀렸다.";
    expect(breakOptionAnalysis(t)).toBe("정답은 A이다.\nB는 조건을 무시한다.\nC는 계산이 틀렸다.");
  });
  it("수식·표가 든 해설은 줄만 나눈다(내용 보존)", () => {
    const t = "Compute $x=2$. B uses $x=3$. C uses $x=4$.";
    expect(breakOptionAnalysis(t).replace(/\n/g, " ")).toBe(t);
  });
});
