import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LearningText from "./LearningText";
import { PassageRefsScope } from "@/app/components/PassageRefs";
import { flatWithBreaks, litPassageDisplay, wrapParagraph } from "@/lib/ap-exam/passage-lines";

const P = "The inspector arrived on a wet Tuesday with a leather satchel, a folding rule, and the polite impatience of a man who had examined forty schools before breakfast and expected the forty-first to disappoint him in some new and instructive way. Nobody in the schoolroom moved.";
const text = litPassageDisplay({ title: "Slates", stanzas: [wrapParagraph(P)] });
let cols = 30;
beforeEach(() => {
  // jsdom 에는 레이아웃이 없다 → 열 폭(cols 자)으로 접는 가짜 Range 측정. 행 높이 24px.
  Range.prototype.getClientRects = function (this: Range) { const off = this.startOffset; const row = Math.floor((off + 4) / cols); return [{ top: row * 24, height: 20 }] as unknown as DOMRectList; };
  Element.prototype.getBoundingClientRect = function () { return { top: 0, height: 0 } as DOMRect; };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("PassageBlock responsive prose numbering", () => {
  it("numbers every 5 measured rows, aria-hidden, and keeps natural selectable text", () => {
    const { container } = render(<LearningText text={text} />);
    const live = screen.getByTestId("lit-passage");
    expect(live.getAttribute("data-live")).toBe("1");
    const nums = screen.getAllByTestId("passage-number");
    expect(nums.map((n) => n.textContent)).toEqual(["5", "10"]);
    nums.forEach((n) => expect(n.getAttribute("aria-hidden")).toBe("true"));
    expect(screen.getByTestId("passage-para").textContent).toBe(P);
    expect(container.textContent).toContain(P);
  });
  it("rewrites literal line references in stems to the displayed numbers inside a scope; unchanged outside", () => {
    const stem = "The phrase (lines 1-2) and line 5 suggest";
    const { container } = render(<PassageRefsScope><LearningText text={text} /><LearningText text={stem} className="stem" /></PassageRefsScope>);
    const rewritten = container.querySelector(".stem")!.textContent!;
    expect(rewritten).not.toBe(stem);
    expect(rewritten).toMatch(/line/);
    cleanup();
    const out = render(<LearningText text={stem} />);
    expect(out.container.textContent).toBe(stem);
  });
  it("falls back to the stored 56-char rows when layout cannot be measured", () => {
    Range.prototype.getClientRects = (() => []) as unknown as Range["getClientRects"];
    render(<LearningText text={text} />);
    expect(screen.queryByTestId("passage-number")).toBeNull();
    expect(screen.getAllByTestId("passage-line").length).toBe(wrapParagraph(P).length);
  });
  it("leaves verse untouched (legacy markup, original lines)", () => {
    render(<LearningText text={litPassageDisplay({ title: "V", stanzas: [["a", "b"], ["c"]] })} />);
    expect(screen.getByTestId("lit-passage").getAttribute("data-live")).toBeNull();
    void flatWithBreaks;
  });
});
