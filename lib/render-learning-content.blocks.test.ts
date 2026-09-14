import { describe, expect, it } from "vitest";
import { splitLearningBlocks } from "./render-learning-content";

describe("splitLearningBlocks — 마크다운 파이프 표(2026-09-14 문제 템플릿 ②)", () => {
  it("헤더+구분줄+행을 표로, 나머지는 글로 나눈다", () => {
    const src = "The table shows values of f.\n| x | f(x) |\n|---|---|\n| 0 | 17 |\n| 1 | $x^2$ |\nWhich is true?";
    const blocks = splitLearningBlocks(src);
    expect(blocks).toEqual([
      { kind: "paragraph", text: "The table shows values of f." },
      { kind: "table", header: ["x", "f(x)"], rows: [["0", "17"], ["1", "$x^2$"]] },
      { kind: "paragraph", text: "Which is true?" },
    ]);
  });

  it("구분줄이 없는 파이프 줄은 표가 아니다 — 그대로 글", () => {
    expect(splitLearningBlocks("a | b\nc | d")).toEqual([{ kind: "paragraph", text: "a | b\nc | d" }]);
  });

  it("표가 없으면 한 덩어리", () => {
    expect(splitLearningBlocks("그냥 글")).toEqual([{ kind: "paragraph", text: "그냥 글" }]);
  });
});
