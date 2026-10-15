import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import MockExamSetContentViewer from "./MockExamSetContentViewer";
import { litPassageDisplay, wrapParagraph } from "@/lib/ap-exam/passage-lines";

const P = "The inspector arrived on a wet Tuesday with a leather satchel, a folding rule, and the polite impatience of a man who had examined forty schools before breakfast and expected the forty-first to be no different from the rest of them.";
const passage = litPassageDisplay({ title: "Slates", stanzas: [wrapParagraph(P)] });
const stem = "The phrase (lines 1-2) and line 5 suggest";
const item = { setItemId: "i1", section: "rw" as const, position: 1, problemId: "p1", satDomain: "Craft", skillCode: null, difficulty: "medium", format: "mc" as const, passage, question: stem, options: ["A one", "B two"], figure: null, correctIndex: 0, answers: null, explanation: "See lines 1-2 and line 5." };
beforeEach(() => {
  Range.prototype.getClientRects = function (this: Range) { const row = Math.floor((this.startOffset + 4) / 30); return [{ top: row * 24, height: 20 }] as unknown as DOMRectList; };
  Element.prototype.getBoundingClientRect = function () { return { top: 0, height: 0 } as DOMRect; };
});
afterEach(cleanup);

describe("admin set viewer: legacy line references follow the displayed numbering", () => {
  it("rewrites 'lines a-b' in the question and the explanation, because the passage and its question share one scope", () => {
    const { container } = render(<MockExamSetContentViewer items={[item]} />);
    const text = container.textContent!;
    expect(text).not.toContain("The phrase (lines 1-2) and line 5 suggest");
    expect(text).not.toContain("See lines 1-2 and line 5.");
  });
});
