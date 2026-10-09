import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InlineLearningText } from "./LearningText";

afterEach(cleanup);
describe("InlineLearningText(My Notebook 목록 미리보기)", () => {
  it("$...$ 를 수식으로 그리고 원문 구분자를 보이지 않는다", () => {
    const { container } = render(<InlineLearningText text={"Let $f$ be defined by $f(x)=\\dfrac{x^2+1}{x-3}$ for x > 3"} />);
    expect(container.querySelectorAll(".katex").length).toBeGreaterThanOrEqual(2);
    expect(container.textContent ?? "").not.toContain("$");
    expect(container.textContent ?? "").not.toContain("\\dfrac");
  });
});
