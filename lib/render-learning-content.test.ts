import { describe, expect, it } from "vitest";
import { splitLearningContent, hasMath } from "./render-learning-content";

describe("splitLearningContent", () => {
  it("수식이 없으면 글 한 조각으로 그대로 둔다", () => {
    const parts = splitLearningContent("이차함수의 그래프를 그리시오.");
    expect(parts).toEqual([{ kind: "text", value: "이차함수의 그래프를 그리시오." }]);
  });

  it("인라인 수식을 글 사이에서 분리해 렌더링한다", () => {
    const parts = splitLearningContent("기울기가 $y = 2x + 1$ 인 직선");
    expect(parts.map((p) => p.kind)).toEqual(["text", "math", "text"]);
    const math = parts[1];
    expect(math.kind === "math" && math.display).toBe(false);
    expect(math.kind === "math" && math.html).toContain("katex");
  });

  it("블록 수식은 display 모드로 렌더링한다", () => {
    const parts = splitLearningContent("풀이:\n$$\\frac{1}{2}$$");
    const math = parts.find((p) => p.kind === "math");
    expect(math?.kind === "math" && math.display).toBe(true);
  });

  it("깨진 수식은 버리지 않고 원문을 그대로 보여준다", () => {
    const parts = splitLearningContent("$\\frac{1}{$");
    expect(parts.some((p) => p.kind === "math-error")).toBe(true);
    const err = parts.find((p) => p.kind === "math-error");
    expect(err?.kind === "math-error" && err.source).toContain("\\frac");
  });

  it("수식이 여러 개면 전부 분리한다", () => {
    const parts = splitLearningContent("$a$와 $b$");
    expect(parts.filter((p) => p.kind === "math")).toHaveLength(2);
  });

  it("달러 기호만 있는 문장을 수식으로 오해하지 않는다", () => {
    const parts = splitLearningContent("가격은 $5 입니다.");
    expect(parts.every((p) => p.kind === "text")).toBe(true);
  });

  it("hasMath는 수식 포함 여부를 알려준다", () => {
    expect(hasMath("$x$")).toBe(true);
    expect(hasMath("수식 없음")).toBe(false);
  });
});
