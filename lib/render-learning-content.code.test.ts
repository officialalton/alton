import { describe, expect, it } from "vitest";
import { splitLearningBlocks, splitLearningContent } from "./render-learning-content";
import { autoMathExplanation } from "./ap-exam/explanation-math";
import { apPassageForDisplay } from "./ap-exam/stimulus-display";

// 코드 블록·한 줄 코드(2026-10-13, AP Computer Science A): Java 글자($, _, ^, <, |, 백슬래시)가 수식·밑줄·표 구문으로 해석되지 않아야 한다.
const JAVA = ["int total = 0;", "for (int i = 0; i <= n; i++) {", "    total += a[i] ^ 1;  // price in $ and my__var", "}", "System.out.println(total | 2);"];
const fence = (lines: string[], lang = "java") => "```" + lang + "\n" + lines.join("\n") + "\n```";

describe("splitLearningBlocks — 코드 블록", () => {
  it("펜스 안은 코드 블록(줄 단위, 원문 그대로), 밖은 기존 규칙", () => {
    const src = `Consider the following code segment.\n${fence(JAVA)}\nWhat is printed?`;
    const blocks = splitLearningBlocks(src);
    expect(blocks).toEqual([
      { kind: "paragraph", text: "Consider the following code segment." },
      { kind: "code", language: "java", lines: JAVA },
      { kind: "paragraph", text: "What is printed?" },
    ]);
  });
  it("코드 안의 파이프 줄·들여쓰기·빈 줄을 표나 목록으로 바꾸지 않는다", () => {
    const lines = ["| a | b |", "|---|---|", "- not a list", "", "    indented();"];
    expect(splitLearningBlocks(fence(lines))).toEqual([{ kind: "code", language: "java", lines }]);
  });
  it("코드 블록 앞뒤의 마크다운 표는 그대로 표", () => {
    const src = `| x | y |\n|---|---|\n| 1 | 2 |\n${fence(["a();"])}`;
    expect(splitLearningBlocks(src).map((b) => b.kind)).toEqual(["table", "code"]);
  });
  it("닫히지 않은 펜스는 코드가 아니라 글로 둔다(내용이 사라지지 않는다)", () => {
    const blocks = splitLearningBlocks("```java\nint x = 1;");
    expect(blocks.some((b) => b.kind === "code")).toBe(false);
    expect(JSON.stringify(blocks)).toContain("int x = 1;");
  });
  it("두 개의 코드 블록과 언어 표시 없는 펜스", () => {
    const blocks = splitLearningBlocks(`${fence(["a();"])}\ntext\n\`\`\`\nplain\n\`\`\``);
    expect(blocks.filter((b) => b.kind === "code").map((b) => (b as { language: string }).language)).toEqual(["java", "text"]);
  });
  it("펜스가 없으면 이전과 같은 결과(표 회귀 없음)", () => {
    expect(splitLearningBlocks("그냥 글")).toEqual([{ kind: "paragraph", text: "그냥 글" }]);
  });
});

describe("splitLearningContent — 한 줄 코드", () => {
  it("백틱 코드는 code 조각이며 안의 $·__ 는 수식·밑줄이 아니다", () => {
    const parts = splitLearningContent("Use `x$y` and `a__b` then $x^2$ and __key__.");
    expect(parts.map((p) => p.kind)).toEqual(["text", "code", "text", "code", "text", "math", "text", "underline", "text"]);
    expect(parts.filter((p) => p.kind === "code").map((p) => (p as { value: string }).value)).toEqual(["x$y", "a__b"]);
  });
  it("백틱이 없으면 기존 동작", () => {
    expect(splitLearningContent("A __key sentence__ and $x$.").map((p) => p.kind)).toEqual(["text", "underline", "text", "math", "text"]);
  });
  it("짝이 맞지 않는 백틱은 글자로 둔다", () => {
    expect(splitLearningContent("a ` b").map((p) => p.kind)).toEqual(["text"]);
  });
});

describe("autoMathExplanation·apPassageForDisplay — 코드를 수식으로 바꾸지 않는다", () => {
  it("코드 블록과 한 줄 코드 안의 ^·<=·_ 는 그대로", () => {
    const t = `The loop uses \`i <= n\`.\n${fence(["x = a ^ b;", "if (i <= 3) { y_1 = 2 ^ 10; }"])}\nBut e^{-0.25t} is math.`;
    const out = autoMathExplanation(t);
    expect(out).toContain("x = a ^ b;");
    expect(out).toContain("if (i <= 3) { y_1 = 2 ^ 10; }");
    expect(out).toContain("`i <= n`");
    expect(out).toContain("$e^{-0.25t}$");
  });
  it("코드 자료는 본문과 단어가 겹쳐도 숨기지 않는다", () => {
    const passage = fence(["int count = 0;", "count++;"]);
    expect(apPassageForDisplay(passage, "What is the value of count after the code segment executes?")).toContain("count++;");
  });
});
