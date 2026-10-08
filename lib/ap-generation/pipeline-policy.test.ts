import { describe, expect, it } from "vitest";
import { canRepair, costPerUsableUnique, firstPassRate, manifestIssues, POLICY, postRepairPassRate, shouldStopTemplate, type CandidateRecord } from "./pipeline-policy";
const r = (cell: string, attempt: 0 | 1, seed: number, passed: boolean, reasons: string[] = [], tpl = "t1"): CandidateRecord => ({ templateId: tpl, cellId: cell, attempt, seed, passed, reasons, costUsd: 0.1, calls: 4 });
describe("approved production principles", () => {
  it("encodes the approved settings", () => { expect(POLICY.firstCandidatesPerCell).toBe(1); expect(POLICY.repairLimit).toBe(1); expect(POLICY.codeChecksBeforeLlm).toBe(true); expect(POLICY.independentVerification).toBe(true); expect(POLICY.denominator).toBe("first_candidates"); });
  it("first-pass rate uses first candidates only; repair attempts are not extra candidates", () => {
    const rs = [r("c1", 0, 1, true), r("c2", 0, 2, false, ["key_mismatch"]), r("c2", 1, 2, true), r("c3", 0, 3, false, ["scope"]), r("c3", 1, 3, false, ["scope"])];
    expect(firstPassRate(rs)).toBeCloseTo(1 / 3); expect(postRepairPassRate(rs)).toBeCloseTo(2 / 3);
  });
  it("stops a template when 2 of its first 4 first-candidates fail for the same reason (repairs not counted)", () => {
    const bad = [r("a", 0, 1, false, ["numeric_check_failed:b"]), r("b", 0, 2, true), r("c", 0, 3, false, ["numeric_check_failed:d"]), r("d", 0, 4, true)];
    expect(shouldStopTemplate(bad)).toEqual({ stop: true, reason: "numeric_check_failed" });
    const ok = [r("a", 0, 1, false, ["x"]), r("b", 0, 2, false, ["y"]), r("c", 0, 3, true), r("d", 0, 4, true), r("a", 1, 1, false, ["x"]), r("a", 1, 1, false, ["x"])];
    expect(shouldStopTemplate(ok).stop).toBe(false);
  });
  it("repair is allowed once per candidate", () => { expect(canRepair([r("a", 0, 1, false)], "a", 1)).toBe(true); expect(canRepair([r("a", 0, 1, false), r("a", 1, 1, false)], "a", 1)).toBe(false); });
  it("cost per usable unique item and manifest completeness", () => {
    expect(costPerUsableUnique(6, 12)).toBe(0.5); expect(costPerUsableUnique(6, 0)).toBe(Infinity);
    expect(manifestIssues({ run: "r" })).toContain("manifest missing generatorCommit"); expect(manifestIssues({ run: "r", subject: "s", generatorCommit: "abc", gateVersion: "g", reviewerPromptHash: "h", difficultyPromptHash: "h2", models: { gen: "m" }, frozenAt: "t" })).toEqual([]);
  });
});
