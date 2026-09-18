import { describe, it, expect } from "vitest";
import { checkQuantEvidenceFields, isQuantEvidenceSkill } from "./quant-evidence-check";

const FIGURE = {
  type: "data",
  kind: "table",
  title: "Bottle Inspection by Shift",
  columns: ["Shift", "Bottles Inspected", "Defective Bottles"],
  rows: [
    ["1", 240, 6],
    ["2", 300, 9],
    ["3", 280, 8],
    ["4", 350, 14],
  ],
};

describe("isQuantEvidenceSkill", () => {
  it("only command_of_evidence_quant is true", () => {
    expect(isQuantEvidenceSkill("command_of_evidence_quant")).toBe(true);
    expect(isQuantEvidenceSkill("command_of_evidence_text")).toBe(false);
    expect(isQuantEvidenceSkill(null)).toBe(false);
  });
});

describe("checkQuantEvidenceFields", () => {
  const baseFields = { operation: "EXACT_LOOKUP", answerRationale: "Shift 4 had 14 defective bottles per the table.", distractorErrorTypes: ["WRONG_ROW", "WRONG_COLUMN", "ADJACENT_CELL"] };

  it("passes when the correct option's number is an exact cell value and distractors are other real cell values", () => {
    const r = checkQuantEvidenceFields(
      "command_of_evidence_quant",
      baseFields,
      FIGURE,
      "Shift 4 had 14 defective bottles",
      ["Shift 4 had 350 defective bottles", "Shift 4 had 9 defective bottles", "Shift 4 had 8 defective bottles"]
    );
    expect(r.ok).toBe(true);
  });

  it("is a no-op for non-target skills", () => {
    expect(checkQuantEvidenceFields("linear_functions", { operation: null, answerRationale: null, distractorErrorTypes: null }, FIGURE, "x", []).ok).toBe(true);
  });

  it("rejects when the correct answer's number is not actually in the figure data (AI self-report cannot substitute)", () => {
    const r = checkQuantEvidenceFields("command_of_evidence_quant", baseFields, FIGURE, "Shift 4 had 20 defective bottles", ["Shift 4 had 350 defective bottles", "Shift 4 had 9 defective bottles", "Shift 4 had 8 defective bottles"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/자료/);
  });

  it("accepts a derived row-sum statistic as the correct answer's basis", () => {
    const r = checkQuantEvidenceFields(
      "command_of_evidence_quant",
      { ...baseFields, operation: "ROW_SUM" },
      FIGURE,
      "shifts 1 through 4 inspected a total of 1170 bottles",
      ["shifts 1 through 4 inspected a total of 240 bottles", "shifts 1 through 4 inspected a total of 300 bottles", "shifts 1 through 4 inspected a total of 350 bottles"]
    );
    expect(r.ok).toBe(true);
  });

  it("rejects a distractor whose number does not correspond to any real figure value (arbitrary number)", () => {
    const r = checkQuantEvidenceFields("command_of_evidence_quant", baseFields, FIGURE, "Shift 4 had 14 defective bottles", ["Shift 4 had 999 defective bottles", "Shift 4 had 9 defective bottles", "Shift 4 had 8 defective bottles"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/자료 어디에도/);
  });

  it("rejects a distractor with the same number as the correct answer", () => {
    const r = checkQuantEvidenceFields("command_of_evidence_quant", baseFields, FIGURE, "Shift 4 had 14 defective bottles", ["Shift 4 had 14 defective bottles", "Shift 4 had 9 defective bottles", "Shift 4 had 8 defective bottles"]);
    expect(r.ok).toBe(false);
  });

  it("rejects when no figure is present", () => {
    const r = checkQuantEvidenceFields("command_of_evidence_quant", baseFields, null, "Shift 4 had 14 defective bottles", ["a", "b", "c"]);
    expect(r.ok).toBe(false);
  });

  it("rejects an unknown operation value or unknown distractor tag", () => {
    expect(checkQuantEvidenceFields("command_of_evidence_quant", { ...baseFields, operation: "GUESS" }, FIGURE, "Shift 4 had 14 defective bottles", ["a", "b", "c"]).ok).toBe(false);
    expect(checkQuantEvidenceFields("command_of_evidence_quant", { ...baseFields, distractorErrorTypes: ["WRONG_ROW", "MADE_UP", "ADJACENT_CELL"] }, FIGURE, "Shift 4 had 14 defective bottles", ["Shift 4 had 350 defective bottles", "Shift 4 had 9 defective bottles", "Shift 4 had 8 defective bottles"]).ok).toBe(false);
  });
});
