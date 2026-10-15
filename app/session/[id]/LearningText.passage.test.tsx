import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import LearningText from "./LearningText";
import { litPassageDisplay } from "@/lib/ap-exam/passage-lines";

afterEach(cleanup);
// AP English Literature(2026-10-14): ```passage 펜스는 줄 번호 블록으로 그려진다(빈 줄은 세지 않고 5줄마다만 번호).
describe("LearningText passage fence", () => {
  it("renders lines with a number only on every fifth counted line", () => {
    const text = litPassageDisplay({ title: "Salt", stanzas: [["l1", "l2", "l3"], ["l4", "l5", "l6"]] });
    const { container } = render(<LearningText text={text} />);
    const block = screen.getByTestId("lit-passage");
    const lines = block.querySelectorAll("[data-testid='passage-line']");
    expect(lines).toHaveLength(6);
    expect(lines[4].textContent).toBe("5l5");
    expect(lines[3].textContent).toBe("l4");
    expect(screen.queryByTestId("code-block")).toBeNull();
    expect(container.textContent).toContain("Salt");
  });
  it("wraps long lines with a hanging indent so a wrapped row never reads as a new numbered line (2026-10-15)", () => {
    render(<LearningText text={litPassageDisplay({ title: "T", stanzas: [["a very long original line that the narrow screen will wrap onto a second visual row", "short"]] })} />);
    const t = screen.getAllByTestId("passage-line-text")[0];
    expect(t.className).toContain("pl-6"); expect(t.className).toContain("-indent-6"); expect(t.className).toContain("whitespace-pre-wrap");
  });
  it("still renders ordinary code fences as code blocks", () => {
    render(<LearningText text={"```java\nint x = 1;\n```"} />);
    expect(screen.getByTestId("code-block")).toBeTruthy();
  });
});
