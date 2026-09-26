import { describe, expect, it } from "vitest";
import { stripInlineOptions, stripOptionSelfLabels } from "./problem-text";

describe("stripInlineOptions — 지문 끝의 선택지 줄을 뗀다", () => {
  const options = ["harsh and unadorned", "sudden and violent", "generous and abundant", "faint and barely visible"];

  it("A)~D) 가 options 와 같으면 지문에서 뗀다", () => {
    const passage = `Coral reefs ... the word "stark" most nearly means\n\nA) harsh and unadorned\nB) sudden and violent\nC) generous and abundant\nD) faint and barely visible`;
    expect(stripInlineOptions(passage, options)).toBe(`Coral reefs ... the word "stark" most nearly means`);
  });

  it("(A) · A. · 대소문자·공백 차이도 같은 선택지로 본다", () => {
    const passage = `Q?\n(a)  Harsh and unadorned\nB. sudden and violent\nC) generous and abundant\nd) faint and barely visible\n`;
    expect(stripInlineOptions(passage, options)).toBe("Q?");
  });

  it("options 와 다른 내용이면 건드리지 않는다 — 본문일 수 있다", () => {
    const passage = "Step A) mix. Step B) heat.\nA) something else\nB) another";
    expect(stripInlineOptions(passage, options)).toBe(passage);
  });

  it("본문 중간의 A) 표기는 그대로다 — 끝에 붙은 묶음만 뗀다", () => {
    const passage = "A) is used in the text as a label.\nWhich choice?\nA) harsh and unadorned\nB) sudden and violent\nC) generous and abundant\nD) faint and barely visible";
    expect(stripInlineOptions(passage, options)).toBe("A) is used in the text as a label.\nWhich choice?");
  });

  it("options 가 없으면 선택지처럼 보이는 줄이 2개 이상 연속일 때만 뗀다", () => {
    expect(stripInlineOptions("Q\nA) one\nB) two")).toBe("Q");
    expect(stripInlineOptions("Q\nA) only one line")).toBe("Q\nA) only one line");
  });

  it("빈 값은 빈 문자열", () => {
    expect(stripInlineOptions(null, options)).toBe("");
  });
});

describe("stripOptionSelfLabels — 선택지 문자열 안의 자기 라벨을 뗀다(2026-09-15)", () => {
  it("B), (D), D. 처럼 앞에 붙은 라벨을 뗀다", () => {
    expect(stripOptionSelfLabels(["B) the decrease was substantial", "(D) something else", "D. another one"])).toEqual([
      "the decrease was substantial",
      "something else",
      "another one",
    ]);
  });
  it("라벨이 없으면 그대로 둔다", () => {
    expect(stripOptionSelfLabels(["expand, lengthen"])).toEqual(["expand, lengthen"]);
  });
  it("본문 중간의 A) 는 건드리지 않는다(맨 앞만 뗀다)", () => {
    expect(stripOptionSelfLabels(["Part A) of the plan failed"])).toEqual(["Part A) of the plan failed"]);
  });
});
