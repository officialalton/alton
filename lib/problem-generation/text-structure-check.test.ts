import { describe, it, expect } from "vitest";
import { checkTextStructureFields, isTextStructureSkill } from "./text-structure-check";

const SOURCE = "Many scientists once believed the theory was correct. However, recent evidence has challenged this long-held view. Despite this, some researchers still defend the original theory.";

describe("isTextStructureSkill", () => {
  it("only text_structure_purpose is true", () => {
    expect(isTextStructureSkill("text_structure_purpose")).toBe(true);
    expect(isTextStructureSkill("transitions")).toBe(false);
    expect(isTextStructureSkill(null)).toBe(false);
  });
});

describe("checkTextStructureFields", () => {
  it("passes when evidence_span is a real substring and distractors are distinct non-matching roles", () => {
    const r = checkTextStructureFields(
      "text_structure_purpose",
      {
        target: "COUNTERARGUMENT",
        evidenceSpan: "However, recent evidence has challenged this long-held view.",
        answerRationale: "It introduces evidence against the earlier claim.",
        distractorErrorTypes: ["CLAIM", "EVIDENCE", "CONCLUSION"],
      },
      SOURCE,
      3
    );
    expect(r.ok).toBe(true);
  });

  it("is a no-op for non-target skills", () => {
    expect(checkTextStructureFields("transitions", { target: null, evidenceSpan: null, answerRationale: null, distractorErrorTypes: null }, SOURCE, 0).ok).toBe(true);
  });

  it("rejects when evidence_span is not found in the source text (fabricated quote)", () => {
    const r = checkTextStructureFields(
      "text_structure_purpose",
      { target: "COUNTERARGUMENT", evidenceSpan: "This sentence does not appear anywhere in the passage.", answerRationale: "x", distractorErrorTypes: ["CLAIM", "EVIDENCE", "CONCLUSION"] },
      SOURCE,
      3
    );
    expect(r.ok).toBe(false);
  });

  it("rejects an unknown target role", () => {
    const r = checkTextStructureFields(
      "text_structure_purpose",
      { target: "SUMMARY", evidenceSpan: "However, recent evidence has challenged this long-held view.", answerRationale: "x", distractorErrorTypes: ["CLAIM", "EVIDENCE", "CONCLUSION"] },
      SOURCE,
      3
    );
    expect(r.ok).toBe(false);
  });

  it("rejects a distractor tagged with the same role as the correct answer", () => {
    const r = checkTextStructureFields(
      "text_structure_purpose",
      { target: "COUNTERARGUMENT", evidenceSpan: "However, recent evidence has challenged this long-held view.", answerRationale: "x", distractorErrorTypes: ["COUNTERARGUMENT", "EVIDENCE", "CONCLUSION"] },
      SOURCE,
      3
    );
    expect(r.ok).toBe(false);
  });

  it("rejects duplicate distractor roles", () => {
    const r = checkTextStructureFields(
      "text_structure_purpose",
      { target: "COUNTERARGUMENT", evidenceSpan: "However, recent evidence has challenged this long-held view.", answerRationale: "x", distractorErrorTypes: ["CLAIM", "CLAIM", "CONCLUSION"] },
      SOURCE,
      3
    );
    expect(r.ok).toBe(false);
  });

  it("rejects mismatched distractor count", () => {
    const r = checkTextStructureFields(
      "text_structure_purpose",
      { target: "COUNTERARGUMENT", evidenceSpan: "However, recent evidence has challenged this long-held view.", answerRationale: "x", distractorErrorTypes: ["CLAIM"] },
      SOURCE,
      3
    );
    expect(r.ok).toBe(false);
  });
});
