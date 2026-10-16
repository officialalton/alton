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

  // 2026-09-21(UAT 지적) — 과제 화면에서 표 마크다운이 줄바꿈 없이 한 줄로 눌려 붙어
  // 그대로("| x | y | |---|---| | 4 | -18 | ...") 노출된 사례. 생성 파이프라인 어딘가에서
  // 줄바꿈이 사라진 데이터도 화면에서 표로 되살려야 한다.
  it("표 전체가 줄바꿈 없이 한 줄로 눌려 붙어도 표로 되살린다", () => {
    const flattened = "| x | y | |---|---| | 4 | -18 | | -10 | 8 | | 7 | 4 |";
    expect(splitLearningBlocks(flattened)).toEqual([
      { kind: "table", header: ["x", "y"], rows: [["4", "-18"], ["-10", "8"], ["7", "4"]] },
    ]);
  });

  it("눌려 붙은 표 앞뒤에 다른 글이 있어도 표만 분리한다", () => {
    const src = "Consider the table.\n| x | y | |---|---| | 4 | -18 | | 7 | 4 |\nWhich is true?";
    expect(splitLearningBlocks(src)).toEqual([
      { kind: "paragraph", text: "Consider the table." },
      { kind: "table", header: ["x", "y"], rows: [["4", "-18"], ["7", "4"]] },
      { kind: "paragraph", text: "Which is true?" },
    ]);
  });

  it("'- ' 줄들은 목록 블록이 된다(메모 목록)", () => {
    expect(splitLearningBlocks("notes:\n- a\n- b\nQ?")).toEqual([
      { kind: "paragraph", text: "notes:" },
      { kind: "list", items: ["a", "b"] },
      { kind: "paragraph", text: "Q?" },
    ]);
  });
});
