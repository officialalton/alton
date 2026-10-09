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

import { answerKeyError, draftBankGateError } from "./problem-text-guards";

describe("draftBankGateError / answerKeyError (2026-10-06 은행 게이트)", () => {
  const base = { examSystem: "sat_rw", usageScope: "mock_exam", passage: "p", question: "q", options: ["a", "b"], explanationEn: "En." };
  it("정상은 null", () => { expect(draftBankGateError(base)).toBeNull(); });
  it("sat_* 본문·선택지·영어 해설의 한글을 거부한다", () => {
    expect(draftBankGateError({ ...base, passage: "한글" })).toMatch(/passage/);
    expect(draftBankGateError({ ...base, options: ["a", "나"] })).toMatch(/options\[1\]/);
    expect(draftBankGateError({ ...base, explanationEn: "해설" })).toMatch(/explanation_en/);
  });
  it("AP 는 한글 검사를 하지 않는다", () => { expect(draftBankGateError({ ...base, examSystem: "ap", passage: "한글" })).toBeNull(); });
  it("mock_exam/both 는 영어 해설 필수, general 은 아님", () => {
    expect(draftBankGateError({ ...base, explanationEn: " " })).toMatch(/영어 해설/);
    expect(draftBankGateError({ ...base, usageScope: "both", explanationEn: null })).toMatch(/영어 해설/);
    expect(draftBankGateError({ ...base, usageScope: "general", explanationEn: null })).toBeNull();
  });
  it("정답 키: 범위·중복", () => {
    expect(answerKeyError(["a", "b"], 1)).toBeNull();
    expect(answerKeyError(["a", "b"], 2)).toMatch(/범위/);
    expect(answerKeyError(["a", "A "], 0)).toMatch(/중복/);
    expect(answerKeyError(["a"], 0)).toMatch(/2개/);
  });
});
