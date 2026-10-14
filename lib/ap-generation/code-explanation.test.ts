import { describe, expect, it } from "vitest";
import { fenceCodeExplanation, fencesOnOwnLines } from "./code-explanation";

describe("fenceCodeExplanation", () => {
  const raw = "The correct answer is ```\nif (a <= b) {\n    x++;\n}\n```. It guards the update.\n```\nif (a < b) {\n    x++;\n}\n``` is incorrect: Uses a strict test.\n`7` is incorrect: Plain option.";
  it("moves mid-sentence fences onto their own lines", () => {
    expect(fencesOnOwnLines(raw)).toBe(false);
    const out = fenceCodeExplanation(raw);
    expect(fencesOnOwnLines(out)).toBe(true);
    expect(out).toContain("The correct answer is:\n```\nif (a <= b) {");
    expect(out).toContain("An incorrect option:\n```\nif (a < b) {");
    expect(out).toContain("```\nIt guards the update.");
    expect(out).toContain("```\nUses a strict test.");
    expect(out).toContain("`7` is incorrect: Plain option.");
  });
  it("keeps several blocks apart and wraps bare operators outside code", () => {
    const multi = "The correct answer is ```\nif (a <= b) {\n}\n```. Key why.\n```\nif (a < b) {\n}\n``` is incorrect: Refuses the last unit (uses < instead of <=).\n```\nx = 1;\n``` is incorrect: Assigns.";
    const out = fenceCodeExplanation(multi);
    expect(fencesOnOwnLines(out)).toBe(true);
    expect(out.match(/An incorrect option:/g)).toHaveLength(2);
    expect(out).toContain("The correct answer is:\n```\nif (a <= b) {");
    expect(out).toContain("(uses `<` instead of `<=`).");
    expect(out).toContain("if (a < b) {");
  });
  it("leaves text without fences and already clean text unchanged", () => {
    expect(fenceCodeExplanation("The correct answer is 12. Plain.")).toBe("The correct answer is 12. Plain.");
    const clean = fenceCodeExplanation(raw);
    expect(fenceCodeExplanation(clean)).toBe(clean);
  });
});
