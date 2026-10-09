import { describe, expect, it } from "vitest";
import { armReport, canRepair, costPerUsableUnique, firstPassRate, manifestIssues, POLICY, postRepairPassRate, shouldStopTemplate, type CandidateRecord } from "./pipeline-policy";
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

describe("armReport", () => {
  const mk = (cellId: string, attempt: 0 | 1, passed: boolean, skill = "2.B", structure = "mc", cost = 0.03): any => ({ templateId: "t", cellId, attempt, seed: 1000, passed, reasons: [], costUsd: cost, calls: 4, skill, structure });
  it("수선 행은 최초 후보 수에 섞이지 않고 비용에는 포함된다", () => {
    const rs = [mk("c1", 0, true), mk("c2", 0, false), mk("c2", 1, true, "2.B", "mc", 0.02), mk("c3", 0, false, "3.C", "frq")];
    const [all] = armReport(rs, "all");
    expect(all.firstCandidates).toBe(3); expect(all.firstPass).toBe(1); expect(all.postRepairPass).toBe(2); expect(all.totalCostUsd).toBeCloseTo(0.11, 5);
    expect(armReport(rs, "skill").map((g) => g.group)).toEqual(["2.B", "3.C"]);
  });
});
