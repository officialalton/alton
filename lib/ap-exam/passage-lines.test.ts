import { describe, expect, it } from "vitest";
import { countedLines, flatWithBreaks, lineNumberLabels, litPassageDisplay, locateQuote, rangeText, wrapParagraph } from "./passage-lines";

describe("passage-lines", () => {
  it("wraps prose to a fixed width with an indented first line", () => {
    const lines = wrapParagraph("The ferry leaves at dawn and returns after the tide has turned, carrying whoever has paid and whoever has not.", 40);
    expect(lines[0].startsWith("    ")).toBe(true);
    expect(lines.every((l) => l.length <= 40)).toBe(true);
    expect(lines.join(" ").replace(/\s+/g, " ").trim()).toContain("whoever has not.");
  });
  it("does not count blank lines and labels only every fifth counted line", () => {
    const st = [["a1", "a2", "a3"], ["b1", "b2", "b3", "b4"]];
    expect(countedLines(st)).toHaveLength(7);
    const lab = lineNumberLabels(flatWithBreaks(st));
    expect(lab).toEqual([null, null, null, null, null, 5, null, null]);
  });
  it("locates a quote across lines and rejects missing or ambiguous quotes", () => {
    const st = [["The kettle ticks", "above a low flame,"], ["the kettle ticks again"]];
    expect(locateQuote(st, "above a low flame")).toEqual({ ok: true, from: 2, to: 2 });
    expect(locateQuote(st, "ticks above a low flame, the kettle")).toEqual({ ok: true, from: 1, to: 3 });
    expect(locateQuote(st, "kettle ticks")).toEqual({ ok: false, reason: "ambiguous" });
    expect(locateQuote(st, "a cold stove")).toEqual({ ok: false, reason: "not_found" });
    expect(rangeText(3, 3)).toBe("line 3");
    expect(rangeText(3, 5)).toBe("lines 3-5");
  });
  it("builds the student passage string with the fence", () => {
    const s = litPassageDisplay({ title: "Salt", stanzas: [["one", "two"]] });
    expect(s.startsWith("ALTON original passage\nSalt\n")).toBe(true);
    expect(s).toContain("```passage\none\ntwo\n```");
  });
});
