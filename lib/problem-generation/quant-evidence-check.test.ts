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
    const r = checkQuantEvidenceFields("command_of_evidence_quant", baseFields, FIGURE, "Shift 4 had 5000 defective bottles", ["Shift 4 had 350 defective bottles", "Shift 4 had 9 defective bottles", "Shift 4 had 8 defective bottles"]);
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

  it("accepts a DIFFERENCE-based correct answer whose value is the gap between two real cells (2026-09-18 hard-tier fix)", () => {
    const r = checkQuantEvidenceFields(
      "command_of_evidence_quant",
      { ...baseFields, operation: "DIFFERENCE" },
      FIGURE,
      "shift 4 had 8 more defective bottles than shift 1",
      ["shift 4 had 5 more defective bottles than shift 1", "shift 4 had 6 more defective bottles than shift 1", "shift 4 had 2 more defective bottles than shift 1"]
    );
    expect(r.ok).toBe(true);
  });

  it("accepts a distractor that partially shares a number with the correct answer but differs on another (2026-09-18 hard-tier fix — comparative options with two data points shouldn't be rejected just for sharing one)", () => {
    const r = checkQuantEvidenceFields(
      "command_of_evidence_quant",
      baseFields,
      FIGURE,
      "Shift 1 had 6 defective bottles and shift 4 had 14 defective bottles",
      ["Shift 1 had 6 defective bottles and shift 4 had 9 defective bottles", "Shift 1 had 6 defective bottles and shift 4 had 8 defective bottles", "Shift 1 had 9 defective bottles and shift 4 had 8 defective bottles"]
    );
    expect(r.ok).toBe(true);
  });

  it("accepts a correct answer whose figure cell values are numeric strings rather than JSON numbers (2026-09-18 hard-tier fix — AI sometimes emits '\"4\"' instead of 4)", () => {
    const STRING_FIGURE = {
      type: "data",
      kind: "table",
      title: "Reef Site Data",
      columns: ["Site", "Average Depth (m)", "Survival Rate (%)"],
      rows: [
        ["Manta Ridge", "4", "71"],
        ["Kelso Wall", "18", "88"],
      ],
    };
    const r = checkQuantEvidenceFields(
      "command_of_evidence_quant",
      baseFields,
      STRING_FIGURE,
      "Kelso Wall had a survival rate of 88 percent",
      ["Kelso Wall had a survival rate of 71 percent", "Kelso Wall had a survival rate of 18 percent", "Kelso Wall had a survival rate of 4 percent"]
    );
    expect(r.ok).toBe(true);
  });

  it("accepts a DIFFERENCE answer computed across two rows of a single column (2026-09-18 hard-tier fix — e.g. a decrease from one category to the next in a one-column time series)", () => {
    const THRUSH_FIGURE = {
      type: "data",
      kind: "table",
      columns: ["Fat Score", "Number Banded", "Average Stopover Duration (days)"],
      rows: [["1", 22, 6.1], ["2", 35, 5.4], ["3", 48, 3.2], ["4", 41, 2.8], ["5", 30, 2.5]],
    };
    const r = checkQuantEvidenceFields(
      "command_of_evidence_quant",
      { ...baseFields, operation: "DIFFERENCE" },
      THRUSH_FIGURE,
      "duration dropped 2.2 days from score 2 to score 3, but only 0.4 and 0.3 days for the next two steps",
      ["duration dropped 1.9 days from score 2 to score 3, but only 0.4 and 0.3 days for the next two steps", "duration dropped 2.2 days from score 2 to score 3, but only 0.6 and 0.3 days for the next two steps", "duration dropped 2.2 days from score 2 to score 3, but only 0.4 and 0.5 days for the next two steps"]
    );
    expect(r.ok).toBe(true);
  });

  it("rejects an unknown operation value or unknown distractor tag", () => {
    expect(checkQuantEvidenceFields("command_of_evidence_quant", { ...baseFields, operation: "GUESS" }, FIGURE, "Shift 4 had 14 defective bottles", ["a", "b", "c"]).ok).toBe(false);
    expect(checkQuantEvidenceFields("command_of_evidence_quant", { ...baseFields, distractorErrorTypes: ["WRONG_ROW", "MADE_UP", "ADJACENT_CELL"] }, FIGURE, "Shift 4 had 14 defective bottles", ["Shift 4 had 350 defective bottles", "Shift 4 had 9 defective bottles", "Shift 4 had 8 defective bottles"]).ok).toBe(false);
  });
});
