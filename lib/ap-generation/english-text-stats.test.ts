import { describe, expect, it } from "vitest";
import { countWords, passageViolations, textStats } from "./english-text-stats";

describe("english text stats", () => {
  const t = "The harbor was quiet. Nobody spoke of the storm, though everyone remembered it.\n\nBy noon the boats were out again.";
  it("counts words, sentences, paragraphs", () => {
    const s = textStats(t);
    expect(s.words).toBe(20); expect(s.sentences).toBe(3); expect(s.paragraphs).toBe(2);
    expect(s.maxSentenceWords).toBe(9);
  });
  it("flags out-of-range passages", () => {
    const b = { minWords: 300, maxWords: 600, minAvgSentence: 15, maxAvgSentence: 30, minGrade: 10, maxGrade: 16 };
    expect(passageViolations(t, b).length).toBeGreaterThanOrEqual(2);
    expect(passageViolations(t, { minWords: 10, maxWords: 30, minAvgSentence: 5, maxAvgSentence: 10, minGrade: -5, maxGrade: 20 })).toEqual([]);
  });
  it("countWords", () => { expect(countWords("  a b\nc ")).toBe(3); expect(countWords("")).toBe(0); });
});
