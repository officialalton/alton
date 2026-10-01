import { describe, expect, it } from "vitest";
import { dedupeStem, excludeHangulStem, findHangulInStem } from "./problem-text-guards";

describe("dedupeStem (2026-10-02 UAT C2)", () => {
  const q = "Which expression is equivalent to $\\frac{x^2-9}{x+3}$, for $x \\neq -3$?";
  it("지문과 질문이 같으면 지문을 비운다", () => {
    expect(dedupeStem(q, q)).toBe("");
    expect(dedupeStem("Which expression is equivalent to \\frac{x^2-9}{x+3}, for x \\neq -3?", q)).toBe("");
  });
  it("짧은 지문이 질문을 끝에 포함하면 중복만 뺀다", () => {
    expect(dedupeStem(`Consider: ${q}`, q)).toBe("Consider:");
  });
  it("R&W 긴 지문은 질문을 포함해도 숨기지 않는다", () => {
    const passage = "In 1890, the botanist studied ferns across many islands and recorded their spore counts in detail. Which choice best states the main idea of the text?";
    expect(dedupeStem(passage, "Which choice best states the main idea of the text?")).toBe(passage);
  });
  it("관련 없는 지문·빈 값은 그대로", () => {
    expect(dedupeStem("If 3x + 5 = 20,", "what is x?")).toBe("If 3x + 5 = 20,");
    expect(dedupeStem(null, q)).toBe("");
    expect(dedupeStem("abc", null)).toBe("abc");
  });
});

describe("findHangulInStem / excludeHangulStem (C1)", () => {
  it("지문·질문·선택지 한글을 잡고 해설은 보지 않는다", () => {
    expect(findHangulInStem({ passage: "x는 정수이다", question: "What is x?", options: ["1", "이"] })).toEqual(["passage", "options[1]"]);
    expect(findHangulInStem({ passage: "x is 3", question: "What is x?", options: ["1"] })).toEqual([]);
  });
  it("조립 후보에서 한글 문항을 뺀다", () => {
    const rows = [{ id: 1, passage: "ok", question: "q" }, { id: 2, passage: "한글", question: "q" }];
    expect(excludeHangulStem(rows).map((r) => r.id)).toEqual([1]);
  });
});
