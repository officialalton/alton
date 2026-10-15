import { describe, expect, it } from "vitest";
import { PSYCH_FRQ_TYPES, PSYCH_SET_COUNT, PSYCH_SET_SIZE, psychPracticeBounds, psychUnitBounds, verifyPsychFrqExam, verifyPsychFullComposition, type PsychSetItem } from "./psych-rules";
import { fullPracticeUnitBounds } from "./full-set-rules";

describe("psych-rules (CED Fall 2025 ranges)", () => {
  it("MC bounds from the CED percentages (floor/ceil): 15-25 percent per unit of 75, practices 60-70 / 20-30 / 5-15", () => {
    expect(psychUnitBounds()).toEqual({ "1": { min: 11, max: 19 }, "2": { min: 11, max: 19 }, "3": { min: 11, max: 19 }, "4": { min: 11, max: 19 }, "5": { min: 11, max: 19 } });
    expect(psychPracticeBounds()).toEqual({ "1": { min: 45, max: 53 }, "2": { min: 15, max: 23 }, "3": { min: 3, max: 12 } });
    expect(fullPracticeUnitBounds("ap_psychology", "full_practice")).toEqual(psychUnitBounds());
    expect(fullPracticeUnitBounds("ap_psychology", "mc_practice")).toBeUndefined();
  });
  it("the FRQ exam is exactly one AAQ and one EBQ", () => {
    expect(verifyPsychFrqExam(["aaq", "ebq"])).toEqual([]);
    expect(verifyPsychFrqExam(["ebq", "aaq"])).toEqual([]);
    expect(verifyPsychFrqExam(["aaq", "aaq"]).join()).toMatch(/not_aaq\+ebq/);
    expect(verifyPsychFrqExam(["aaq"]).join()).toMatch(/frq_count_1\/2/);
  });
  const build = (over: Partial<{ skill: (i: number) => string; sets: number }> = {}): PsychSetItem[] => {
    const nSets = over.sets ?? PSYCH_SET_COUNT; const items: PsychSetItem[] = []; let pos = 1;
    const skillOf = over.skill ?? ((i: number) => (i % 4 === 0 ? "2.B" : i % 11 === 0 ? "3.A" : "1.A"));
    for (let s = 0; s < nSets; s++) for (let j = 0; j < PSYCH_SET_SIZE; j++) { items.push({ kind: "mc", unit: String((s % 5) + 1), skill: skillOf(pos), candidateKey: `set${s}`, position: pos }); pos++; }
    for (let i = 0; pos <= 75; i++) { items.push({ kind: "mc", unit: String((i % 5) + 1), skill: skillOf(pos), candidateKey: null, position: pos }); pos++; }
    items.push({ kind: "frq", unit: null, skill: null, candidateKey: "f1", position: 1, frqType: "aaq" }, { kind: "frq", unit: null, skill: null, candidateKey: "f2", position: 2, frqType: "ebq" });
    return items;
  };
  it("accepts a composition inside every range and rejects a 4.x skill, a wrong set count, a non-contiguous set, and a missing FRQ", () => {
    expect(verifyPsychFullComposition(build())).toEqual([]);
    expect(verifyPsychFullComposition(build({ skill: (i) => (i === 3 ? "4.A" : "1.A") })).join()).toMatch(/practice_4_not_assessed_in_mc/);
    expect(verifyPsychFullComposition(build({ sets: PSYCH_SET_COUNT - 1 })).join()).toMatch(/shared_sets_/);
    const broken = build(); broken[1] = { ...broken[1], position: 40 };
    expect(verifyPsychFullComposition(broken).join()).toMatch(/set_not_contiguous/);
    expect(verifyPsychFullComposition(build().filter((i) => i.kind === "mc")).join()).toMatch(/frq_count_0\/2/);
    expect(PSYCH_FRQ_TYPES).toEqual(["aaq", "ebq"]);
  });
});
