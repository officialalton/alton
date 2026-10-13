import { describe, expect, it } from "vitest";
import { calibrateMc, type McPack } from "./gates";
import { auditLabel, difficultyBrief, difficultyContext, gateDifficultySignals, structuralBand, type DifficultySignals, type McWithSignals } from "./stats-difficulty";

const opt = (text: string, why = "names a misconception that is long enough") => ({ text, why, value: null });
const base = (sig?: DifficultySignals): McWithSignals => ({
  archetype: "st_t", topic: "4.4", skill: "4.E", calculator: "allowed", stem: "A researcher studies something with a few words in the stem.", stimulus: { kind: "none", description: "", data: {} },
  options: [opt("key option text"), opt("wrong one first", "first wrong misconception"), opt("wrong two second", "second wrong misconception"), opt("wrong three third", "third wrong misconception")],
  key_index: 0, est_seconds: 100, facts: [], difficulty_signals: sig,
});
const sig = (over: Partial<DifficultySignals> = {}): DifficultySignals => ({
  steps: ["decide the design from the scenario text", "identify which data must be checked", "apply the guideline to that data"], concepts: ["procedure choice for two groups", "normality condition for t procedures"], representations: 1,
  distractor_fail_step: { "wrong one first": 1, "wrong two second": 2, "wrong three third": 3 }, arithmetic: "none", ...over,
});

describe("Statistics structural difficulty signals", () => {
  it("accepts a declaration whose every step is the first failure point of some wrong option, and ignores items without a declaration", () => {
    expect(gateDifficultySignals(base(sig()))).toEqual([]);
    expect(gateDifficultySignals(base(undefined))).toEqual([]);
    expect(calibrateMc("ap_statistics", base(sig()) as McPack)).toEqual([]);
  });
  it("rejects inflated steps: a step that no wrong option fails at is not load-bearing", () => {
    const r = gateDifficultySignals(base(sig({ distractor_fail_step: { "wrong one first": 1, "wrong two second": 1, "wrong three third": 1 } })));
    expect(r).toContain("difficulty_signals_steps_not_load_bearing");
    const four = sig({ steps: [...sig().steps, "a fourth step that nothing in the options tests"], distractor_fail_step: { "wrong one first": 1, "wrong two second": 2, "wrong three third": 2 } });
    expect(gateDifficultySignals(base(four))).toContain("difficulty_signals_steps_not_load_bearing");
  });
  it("rejects malformed declarations: duplicate or short steps, too many concepts, a distractor map that does not match the wrong options, out-of-range steps", () => {
    expect(gateDifficultySignals(base(sig({ steps: ["same long step text here", "same long step text here", "another long step text"] })))).toContain("difficulty_signals_steps");
    expect(gateDifficultySignals(base(sig({ steps: ["short", "also short", "tiny"] })))).toContain("difficulty_signals_steps");
    expect(gateDifficultySignals(base(sig({ concepts: ["concept number one", "concept number two", "concept number three", "concept number four"] })))).toContain("difficulty_signals_concepts");
    expect(gateDifficultySignals(base(sig({ distractor_fail_step: { "wrong one first": 1, "wrong two second": 2 } })))).toContain("difficulty_signals_distractor_map_mismatch");
    expect(gateDifficultySignals(base(sig({ distractor_fail_step: { "wrong one first": 1, "wrong two second": 2, "wrong three third": 9 } })))).toContain("difficulty_signals_fail_step_out_of_range");
    const bp = { ...base(sig()), blueprint: { student_thinking: ["a", "b", "c", "d"] } } as McWithSignals;
    expect(gateDifficultySignals(bp)).toContain("difficulty_signals_fewer_steps_than_blueprint");
  });
  it("the structural band is exam_prep only for 3+ steps that combine 2+ concepts or sources; otherwise basic_learning (never advanced)", () => {
    expect(structuralBand(sig())).toBe("exam_prep");
    expect(structuralBand(sig({ concepts: ["a single concept here"], representations: 2 }))).toBe("exam_prep");
    expect(structuralBand(sig({ concepts: ["a single concept here"], representations: 1 }))).toBe("basic_learning");
    expect(structuralBand(sig({ steps: sig().steps.slice(0, 2), distractor_fail_step: { "wrong one first": 1, "wrong two second": 2, "wrong three third": 2 } }))).toBe("basic_learning");
  });
  it("the judge brief gives counts and the rubric but not the step wording or the key", () => {
    const b = difficultyBrief(sig());
    expect(b).toContain("required sequential steps: 3");
    expect(b).toContain("distinct concepts combined: 2");
    expect(b).toContain("fail only later: 2 of 3");
    expect(b).not.toContain("decide the design from the scenario text");
    const item = base(sig());
    expect(difficultyContext("ap_statistics", "mc", item)).toContain("CODE-COUNTED STRUCTURE");
    expect(difficultyContext("ap_calculus_ab", "mc", item)).toBe("");
    expect(difficultyContext("ap_statistics", "frq_bundle", item)).toBe("");
    expect(difficultyContext("ap_statistics", "mc", base(undefined))).toBe("");
  });
  it("auditing reports disagreement in both directions and never changes the label", () => {
    expect(auditLabel("basic_learning", sig())).toBe("judge_below_rubric");
    expect(auditLabel("exam_prep", sig())).toBe("agree");
    expect(auditLabel("exam_prep", sig({ concepts: ["a single concept here"] }))).toBe("judge_above_rubric");
    expect(auditLabel("advanced_supplement", sig())).toBe("agree");
    expect(auditLabel("basic_learning", undefined)).toBeNull();
  });
});
