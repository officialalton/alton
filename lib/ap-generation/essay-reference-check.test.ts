import { describe, expect, it } from "vitest";
import { checkEssayReference, parseSamples, proposedHeading } from "./essay-reference-check";

const guide = [
  "Scoring guide (ALTON reference). This question is worth 7 points.",
  "Thesis/claim (0-1): x",
  "Contextualization (0-1): x",
  "Evidence from the documents (0-2): x",
  "Evidence beyond the documents (0-1): x",
  "Sourcing (point of view, purpose, situation, audience) (0-1): x",
  "Complex understanding (0-1): x",
].join("\n");
const head = (total: number, c: number) => `Sample response, high score (${total}/7; Thesis/claim 1, Contextualization 1, Evidence from the documents 2, Evidence beyond the documents 1, Sourcing (point of view, purpose, situation, audience) 1, Complex understanding ${c}):`;

describe("checkEssayReference", () => {
  it("accepts a consistent 6/7 sample whose explanation denies the complexity point", () => {
    const t = `${guide}\n${head(6, 0)}\n   - "Sun took the opposite view." - Qualifies the thesis but briefly, so the complexity point is not earned. The response scores 6, not 7.`;
    expect(checkEssayReference(t)).toEqual([]);
  });
  it("flags 'no complexity' explanation with a full-score row and a mismatching total", () => {
    const t = `${guide}\n${head(7, 1)}\n   - "Sun took the opposite view." - This is brief, so no complexity point is earned.`;
    expect(checkEssayReference(t).map((v) => v.code)).toEqual(["expl_denies_but_full"]);
  });
  it("flags area scores that do not add up to the heading total", () => {
    const t = `${guide}\n${head(7, 0)}\n   - "Sun took the opposite view." - Fine.`;
    expect(checkEssayReference(t).map((v) => v.code)).toContain("area_sum_ne_total");
  });
  it("flags a credit explanation on a zero-score row but not a negated one", () => {
    const base = "Sample response, low score (1/6; Thesis/claim 0, Contextualization 0, Evidence 1, Analysis and reasoning 0):";
    const g = "Scoring guide (ALTON). This question is worth 6 points.\nThesis/claim (0-1): x\nContextualization (0-1): x\nEvidence (0-2): x\nAnalysis and reasoning (0-2): x";
    expect(checkEssayReference(`${g}\n${base}\n   - "Restates." - Restates the prompt, so the thesis point is not earned.`)).toEqual([]);
    expect(checkEssayReference(`${g}\n${base}\n   - "Claim." - A clear claim, so it earns the thesis point.`).map((v) => v.code)).toEqual(["expl_credits_but_zero"]);
  });
  it("flags 'earns 1 of 2' when the evidence row is 2", () => {
    const g = "Scoring guide (ALTON). This question is worth 6 points.\nThesis/claim (0-1): x\nContextualization (0-1): x\nEvidence (0-2): x\nAnalysis and reasoning (0-2): x";
    const t = `${g}\nSample response, middle score (5/6; Thesis/claim 1, Contextualization 1, Evidence 2, Analysis and reasoning 1):\n   - "A." - Second accurate example, but the evidence is only stated, so it earns 1 of 2.`;
    expect(checkEssayReference(t).map((v) => v.code)).toEqual(["expl_earns_n_mismatch"]);
  });
  it("parses the Row-letter EngLit format and proposes a corrected heading", () => {
    const g = "Scoring guide (6 points): Thesis 0-1, Evidence and commentary 0-4, Sophistication 0-1.\nThesis (0-1): x\nEvidence and commentary (0-4): x\nSophistication (0-1): x";
    const t = `${g}\nSample essay (low; scored 3/6: thesis 1, evidence 2, sophistication 0)\nbody\n- Row A: "Restates." - It only restates the prompt, so it does not earn the thesis point.`;
    const s = parseSamples(t);
    expect(s[0]).toMatchObject({ band: "low", total: 3, max: 6 });
    const v = checkEssayReference(t);
    expect(v.map((x) => x.code)).toEqual(["expl_denies_but_full"]);
    expect(proposedHeading(s[0].heading, v[0].proposal!)).toBe("Sample essay (low; scored 2/6: thesis 0, evidence 2, sophistication 0)");
  });
});
