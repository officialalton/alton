import { describe, it, expect } from "vitest";
import { checkRhetoricalSynthesisFields, isRhetoricalSynthesisSkill } from "./rhetorical-synthesis-check";

const NOTES = [
  "The bridge was completed in 1932 after four years of construction.",
  "It was designed by engineer Ralph Modjeski.",
  "The bridge spans 1.8 miles across the strait.",
  "It remains one of the longest cantilever bridges in North America.",
];

describe("isRhetoricalSynthesisSkill", () => {
  it("only rhetorical_synthesis is true", () => {
    expect(isRhetoricalSynthesisSkill("rhetorical_synthesis")).toBe(true);
    expect(isRhetoricalSynthesisSkill("transitions")).toBe(false);
    expect(isRhetoricalSynthesisSkill(null)).toBe(false);
  });
});

describe("checkRhetoricalSynthesisFields", () => {
  it("passes when the correct option traces to notes and distractors have distinct error tags", () => {
    const r = checkRhetoricalSynthesisFields(
      "rhetorical_synthesis",
      { target: "notes 1 and 3", answerRationale: "combines completion date and length", distractorErrorTypes: ["IGNORES_GOAL", "MISUSES_ONE_NOTE_ONLY", "ADDS_UNSUPPORTED_CLAIM"] },
      NOTES,
      "Completed in 1932, the bridge spans 1.8 miles across the strait.",
      ["Ralph Modjeski was a famous engineer of his era.", "The bridge was completed in 1932.", "The structure attracts millions of tourists every summer."]
    );
    expect(r.ok).toBe(true);
  });

  it("is a no-op for non-target skills", () => {
    expect(checkRhetoricalSynthesisFields("transitions", { target: null, answerRationale: null, distractorErrorTypes: null }, [], "x", []).ok).toBe(true);
  });

  it("rejects when notes are missing", () => {
    const r = checkRhetoricalSynthesisFields(
      "rhetorical_synthesis",
      { target: "note 1", answerRationale: "x", distractorErrorTypes: [] },
      [],
      "Completed in 1932.",
      []
    );
    expect(r.ok).toBe(false);
  });

  it("rejects duplicate distractor error tags", () => {
    const r = checkRhetoricalSynthesisFields(
      "rhetorical_synthesis",
      { target: "notes 1 and 3", answerRationale: "combines completion date and length", distractorErrorTypes: ["IGNORES_GOAL", "IGNORES_GOAL", "ADDS_UNSUPPORTED_CLAIM"] },
      NOTES,
      "Completed in 1932, the bridge spans 1.8 miles across the strait.",
      ["Ralph Modjeski was a famous engineer of his era.", "The bridge was completed in 1932.", "The bridge is the longest in the entire world."]
    );
    expect(r.ok).toBe(false);
  });

  it("rejects an unknown distractor error type", () => {
    const r = checkRhetoricalSynthesisFields(
      "rhetorical_synthesis",
      { target: "notes 1 and 3", answerRationale: "x", distractorErrorTypes: ["MADE_UP_TAG", "MISUSES_ONE_NOTE_ONLY", "ADDS_UNSUPPORTED_CLAIM"] },
      NOTES,
      "Completed in 1932, the bridge spans 1.8 miles across the strait.",
      ["a", "b", "c"]
    );
    expect(r.ok).toBe(false);
  });

  it("rejects a correct option that invents unsupported content not traceable to notes", () => {
    const r = checkRhetoricalSynthesisFields(
      "rhetorical_synthesis",
      { target: "note 1", answerRationale: "x", distractorErrorTypes: ["IGNORES_GOAL", "MISUSES_ONE_NOTE_ONLY", "COMBINES_WRONG_NOTES"] },
      NOTES,
      "The bridge was funded entirely by private donations from local business owners.",
      ["a", "b", "c"]
    );
    expect(r.ok).toBe(false);
  });

  it("rejects a distractor tagged ADDS_UNSUPPORTED_CLAIM whose content actually does trace to notes", () => {
    const r = checkRhetoricalSynthesisFields(
      "rhetorical_synthesis",
      { target: "notes 1 and 3", answerRationale: "x", distractorErrorTypes: ["ADDS_UNSUPPORTED_CLAIM", "MISUSES_ONE_NOTE_ONLY", "COMBINES_WRONG_NOTES"] },
      NOTES,
      "Completed in 1932, the bridge spans 1.8 miles across the strait.",
      ["The bridge was completed in 1932 after four years of construction.", "b", "c"]
    );
    expect(r.ok).toBe(false);
  });

  it("rejects mismatched distractor count", () => {
    const r = checkRhetoricalSynthesisFields(
      "rhetorical_synthesis",
      { target: "notes 1 and 3", answerRationale: "x", distractorErrorTypes: ["IGNORES_GOAL"] },
      NOTES,
      "Completed in 1932, the bridge spans 1.8 miles across the strait.",
      ["a", "b", "c"]
    );
    expect(r.ok).toBe(false);
  });
});
