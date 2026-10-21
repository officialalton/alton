import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolveRubric, EURO_RUBRIC_ID, RUBRIC_IDS } from "./rubric";
import { buildPrompt } from "./prompt";
import { limits } from "./costs";
import { essayGradingSubject, essayScoringNotice, EURO_ESSAY_GRADING_VALIDATED, ESSAY_NOT_AVAILABLE_NOTICE } from "./subject";

describe("euro-v1 essay rubric (prepared, off)", () => {
  it("official point structure: SAQ 3 (a,b,c), DBQ 7 (6 rows), LEQ 6 (4 rows)", () => {
    expect([resolveRubric(EURO_RUBRIC_ID, "saq")!.total, resolveRubric(EURO_RUBRIC_ID, "dbq")!.total, resolveRubric(EURO_RUBRIC_ID, "leq")!.total]).toEqual([3, 7, 6]);
    expect(resolveRubric(EURO_RUBRIC_ID, "saq")!.rows.map((r) => r.key)).toEqual(["a", "b", "c"]);
    expect(resolveRubric(EURO_RUBRIC_ID, "dbq")!.rows.map((r) => `${r.key}:${r.max}`)).toEqual(["thesis:1", "context:1", "docs:2", "outside:1", "sourcing:1", "complexity:1"]);
    expect(resolveRubric(EURO_RUBRIC_ID, "leq")!.rows.map((r) => `${r.key}:${r.max}`)).toEqual(["thesis:1", "context:1", "evidence:2", "analysis:2"]);
    expect(resolveRubric(EURO_RUBRIC_ID)).toBeNull();
    expect(RUBRIC_IDS).toContain(EURO_RUBRIC_ID);
  });
  it("prompt names European History, not U.S. or World; per-attempt cap 5", () => {
    const { system } = buildPrompt({ taskPrompt: "t", sources: [], essay: "x", anchors: [], rubricId: EURO_RUBRIC_ID, taskType: "dbq" });
    expect(system).toContain("AP European History");
    expect(system).not.toContain("U.S. History");
    expect(system).not.toContain("World History");
    expect(limits(EURO_RUBRIC_ID).perAttemptEssays).toBe(5);
  });
  it("stays off: subject not gradable, student notice only for European History", () => {
    expect(EURO_ESSAY_GRADING_VALIDATED).toBe(false);
    expect(essayGradingSubject("ap_european_history")).toBe(false);
    expect(essayScoringNotice("ap_european_history")).toBe(ESSAY_NOT_AVAILABLE_NOTICE);
    expect(ESSAY_NOT_AVAILABLE_NOTICE).toMatch(/not available for this subject yet/);
    expect(essayScoringNotice("ap_world_history")).toBeNull();
    expect(essayScoringNotice("ap_calculus_ab")).toBeNull();
  });
  it("gate constant is a literal false in source", () => {
    expect(readFileSync("lib/essay-grading/subject.ts", "utf-8")).toContain("EURO_ESSAY_GRADING_VALIDATED: boolean = false");
  });
});
