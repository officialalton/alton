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

describe("splitLearningContent — 통화 기호 $ (2026-10-02 UAT C3)", () => {
  const kinds = (s: string) => splitLearningContent(s).map((p) => p.kind);
  const text = (s: string) => splitLearningContent(s).filter((p) => p.kind === "text").map((p) => (p as { value: string }).value).join("");

  it("$45 … $25 를 수식으로 묶지 않는다", () => {
    const s = "A landscaping company charges a flat fee of $45 for a site visit, plus $25 for each hour of work.";
    expect(kinds(s).every((k) => k === "text")).toBe(true);
    expect(text(s)).toBe(s);
  });
  it("금액 나열($5, $10, and $15)도 글자로 둔다", () => {
    const s = "Tickets cost $5, $10, and $15.";
    expect(kinds(s).every((k) => k === "text")).toBe(true);
    expect(text(s)).toBe(s);
  });
  it("통화와 진짜 수식이 섞여도 수식만 수식으로 그린다", () => {
    const parts = splitLearningContent("It costs $45 per visit and $x$ visits.");
    expect(parts.filter((p) => p.kind === "math")).toHaveLength(1);
    expect(text("It costs $45 per visit and $x$ visits.")).toBe("It costs $45 per visit and  visits.");
  });
  it("이스케이프 \\$ 는 글자 $ 로 보인다", () => {
    expect(kinds("costs \\$45 and \\$25 total")).not.toContain("math");
    expect(text("costs \\$45 and \\$25 total")).toBe("costs $45 and $25 total");
  });
  it("회귀: 숫자로 시작하는 진짜 수식은 그대로 수식이다", () => {
    expect(kinds("Solve $3x+1 = 7$ for x.")).toEqual(["text", "math", "text"]);
    expect(kinds("$x$")).toEqual(["math"]);
    expect(kinds("$2$ and $3$")).toEqual(["math", "text", "math"]);
    expect(kinds("$$\\frac{1}{2}$$")).toEqual(["math"]);
    expect(kinds("$\\frac{3}{4}$ of $12$")).toEqual(["math", "text", "math"]);
  });
});
