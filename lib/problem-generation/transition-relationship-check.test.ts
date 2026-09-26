import { describe, it, expect } from "vitest";
import { checkTransitionRelationshipFields, isTransitionsSkill } from "./transition-relationship-check";

describe("isTransitionsSkill", () => {
  it("only transitions is true", () => {
    expect(isTransitionsSkill("transitions")).toBe(true);
    expect(isTransitionsSkill("boundaries")).toBe(false);
    expect(isTransitionsSkill(null)).toBe(false);
  });
});

describe("checkTransitionRelationshipFields", () => {
  it("passes when the correct transition's category matches its tag and distractors are from other categories", () => {
    const r = checkTransitionRelationshipFields(
      "transitions",
      { relationshipType: "CONTRAST", distractorRelationshipTypes: ["CAUSE_EFFECT", "ADDITION", "EXAMPLE"] },
      "However,",
      ["Therefore,", "Moreover,", "For example,"]
    );
    expect(r.ok).toBe(true);
  });

  it("is a no-op for non-target skills", () => {
    expect(checkTransitionRelationshipFields("boundaries", { relationshipType: null, distractorRelationshipTypes: null }, "x", []).ok).toBe(true);
  });

  it("rejects when the tagged relationship contradicts the correct word's real category", () => {
    const r = checkTransitionRelationshipFields(
      "transitions",
      { relationshipType: "CAUSE_EFFECT", distractorRelationshipTypes: ["CONTRAST", "ADDITION", "EXAMPLE"] },
      "However,",
      ["Therefore,", "Moreover,", "For example,"]
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/어긋납니다/);
  });

  it("rejects a distractor tagged with the same relationship as the correct answer", () => {
    const r = checkTransitionRelationshipFields(
      "transitions",
      { relationshipType: "CONTRAST", distractorRelationshipTypes: ["CONTRAST", "ADDITION", "EXAMPLE"] },
      "However,",
      ["Nevertheless,", "Moreover,", "For example,"]
    );
    expect(r.ok).toBe(false);
  });

  it("rejects a distractor whose real word category is actually the same as the correct answer's, even if mis-tagged", () => {
    const r = checkTransitionRelationshipFields(
      "transitions",
      { relationshipType: "CONTRAST", distractorRelationshipTypes: ["CAUSE_EFFECT", "ADDITION", "EXAMPLE"] },
      "However,",
      ["Nevertheless,", "Moreover,", "For example,"]
    );
    expect(r.ok).toBe(false);
  });

  it("rejects unknown relationship values and mismatched distractor counts", () => {
    expect(checkTransitionRelationshipFields("transitions", { relationshipType: "GUESS", distractorRelationshipTypes: ["CAUSE_EFFECT", "ADDITION", "EXAMPLE"] }, "However,", ["a", "b", "c"]).ok).toBe(false);
    expect(checkTransitionRelationshipFields("transitions", { relationshipType: "CONTRAST", distractorRelationshipTypes: ["CAUSE_EFFECT"] }, "However,", ["a", "b", "c"]).ok).toBe(false);
  });
});
