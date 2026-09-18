import { describe, it, expect } from "vitest";
import { checkGrammarStructureFields, isGrammarStructureSkill, GRAMMAR_RULES_BY_SKILL, GRAMMAR_STRUCTURE_SKILLS } from "./grammar-structure-check";

describe("isGrammarStructureSkill", () => {
  it("exactly boundaries/form_structure_sense are true", () => {
    for (const s of GRAMMAR_STRUCTURE_SKILLS) expect(isGrammarStructureSkill(s)).toBe(true);
    expect(isGrammarStructureSkill("transitions")).toBe(false);
    expect(isGrammarStructureSkill(null)).toBe(false);
  });
  it("boundaries and form_structure_sense taxonomies do not overlap", () => {
    const a = new Set(GRAMMAR_RULES_BY_SKILL.boundaries);
    const b = new Set(GRAMMAR_RULES_BY_SKILL.form_structure_sense);
    for (const r of a) expect(b.has(r)).toBe(false);
  });
});

describe("checkGrammarStructureFields — boundaries", () => {
  it("passes for a well-formed comma-splice item", () => {
    const r = checkGrammarStructureFields(
      "boundaries",
      { grammarRule: "COMMA_SPLICE", distractorErrorTypes: ["COMMA_SPLICE", "SEMICOLON_COLON", "SUBJECT_VERB_AGREEMENT"] },
      "the museum closed early, and visitors left disappointed",
      ["the museum closed early, visitors left disappointed", "the museum closed early; and visitors left disappointed", "the museum closed early, visitors leaves disappointed"]
    );
    expect(r.ok).toBe(true);
  });

  it("is a no-op for non-target skills", () => {
    const r = checkGrammarStructureFields("linear_functions", { grammarRule: null, distractorErrorTypes: null }, "x", []);
    expect(r.ok).toBe(true);
  });

  it("rejects a grammar_rule tag borrowed from form_structure_sense's taxonomy (disambiguation)", () => {
    const r = checkGrammarStructureFields(
      "boundaries",
      { grammarRule: "DANGLING_MODIFIER", distractorErrorTypes: ["DANGLING_MODIFIER", "SEMICOLON_COLON", "SUBJECT_VERB_AGREEMENT"] },
      "correct option",
      ["a", "b", "c"]
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/taxonomy/);
  });

  it("rejects when the correct option itself contains the tagged defect (comma splice, cheap regex heuristic)", () => {
    const r = checkGrammarStructureFields(
      "boundaries",
      { grammarRule: "COMMA_SPLICE", distractorErrorTypes: ["COMMA_SPLICE", "SEMICOLON_COLON", "SUBJECT_VERB_AGREEMENT"] },
      "the museum closed early, it upset visitors",
      ["a", "b", "c"]
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/결함 패턴/);
  });

  it("rejects when no distractor shares the target's grammar_rule tag (no discriminating pair)", () => {
    const r = checkGrammarStructureFields(
      "boundaries",
      { grammarRule: "COMMA_SPLICE", distractorErrorTypes: ["SEMICOLON_COLON", "SUBJECT_VERB_AGREEMENT", "APOSTROPHE_POSSESSIVE"] },
      "correct option",
      ["a", "b", "c"]
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/변별력/);
  });

  it("rejects an unknown distractor tag and a mismatched distractor count", () => {
    expect(
      checkGrammarStructureFields("boundaries", { grammarRule: "COMMA_SPLICE", distractorErrorTypes: ["COMMA_SPLICE", "MADE_UP", "SEMICOLON_COLON"] }, "x", ["a", "b", "c"]).ok
    ).toBe(false);
    expect(
      checkGrammarStructureFields("boundaries", { grammarRule: "COMMA_SPLICE", distractorErrorTypes: ["COMMA_SPLICE"] }, "x", ["a", "b", "c"]).ok
    ).toBe(false);
  });
});

describe("checkGrammarStructureFields — form_structure_sense", () => {
  it("passes for a well-formed parallelism item", () => {
    const r = checkGrammarStructureFields(
      "form_structure_sense",
      { grammarRule: "FAULTY_PARALLELISM", distractorErrorTypes: ["FAULTY_PARALLELISM", "DANGLING_MODIFIER", "PRONOUN_AGREEMENT"] },
      "the team plans to write, revise, and publish the report",
      ["the team plans on writing, revising, and to publish the report", "having finished, the report was published", "everyone submitted their draft"]
    );
    expect(r.ok).toBe(true);
  });

  it("rejects a grammar_rule tag borrowed from boundaries's taxonomy", () => {
    const r = checkGrammarStructureFields(
      "form_structure_sense",
      { grammarRule: "COMMA_SPLICE", distractorErrorTypes: ["COMMA_SPLICE", "DANGLING_MODIFIER", "PRONOUN_AGREEMENT"] },
      "x",
      ["a", "b", "c"]
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/taxonomy/);
  });
});
