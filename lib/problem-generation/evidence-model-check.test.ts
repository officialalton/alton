import { describe, it, expect } from "vitest";
import { checkEvidenceModelFields, verifyEvidenceSpanInSource, isEvidenceModelSkill, DISTRACTOR_ERROR_TYPES, EVIDENCE_MODEL_SKILLS } from "./evidence-model-check";

const PASSAGE = "The city's new transit system, launched in 2019, initially struggled with low ridership. However, by 2022 ridership had tripled, a shift researchers attribute to expanded evening service.";

describe("isEvidenceModelSkill", () => {
  it("exactly the 5 target skills are true", () => {
    for (const s of EVIDENCE_MODEL_SKILLS) expect(isEvidenceModelSkill(s)).toBe(true);
    expect(isEvidenceModelSkill("linear_functions")).toBe(false);
    expect(isEvidenceModelSkill("rhetorical_synthesis")).toBe(false);
    expect(isEvidenceModelSkill(null)).toBe(false);
  });
});

describe("verifyEvidenceSpanInSource", () => {
  it("finds an exact substring", () => {
    expect(verifyEvidenceSpanInSource("ridership had tripled", PASSAGE)).toBe(true);
  });
  it("finds with whitespace/punctuation normalization", () => {
    expect(verifyEvidenceSpanInSource("ridership had tripled,", PASSAGE)).toBe(true);
    expect(verifyEvidenceSpanInSource("ridership  had   tripled", PASSAGE)).toBe(true);
  });
  it("rejects a paraphrase not actually present verbatim", () => {
    expect(verifyEvidenceSpanInSource("usage grew threefold", PASSAGE)).toBe(false);
  });
  it("rejects empty or too-short spans", () => {
    expect(verifyEvidenceSpanInSource("", PASSAGE)).toBe(false);
    expect(verifyEvidenceSpanInSource("a", PASSAGE)).toBe(false);
  });
});

describe("checkEvidenceModelFields", () => {
  const baseFields = {
    target: "what caused the rise in ridership",
    evidenceSpan: "ridership had tripled, a shift researchers attribute to expanded evening service",
    answerRationale: "The tripling is explicitly linked to expanded evening service, supporting the causal claim.",
    distractorErrorTypes: ["OVERREACH", "OPPOSITE", "IRRELEVANT_DETAIL"],
  };

  it("passes for a well-formed inferences candidate", () => {
    const r = checkEvidenceModelFields("inferences", baseFields, [PASSAGE], 3);
    expect(r.ok).toBe(true);
  });

  it("is a no-op (ok) for non-target skills", () => {
    const r = checkEvidenceModelFields("linear_functions", { target: null, evidenceSpan: null, answerRationale: null, distractorErrorTypes: null }, [PASSAGE], 3);
    expect(r.ok).toBe(true);
  });

  it("rejects when evidence_span is not a verbatim substring (AI self-report cannot substitute for the search)", () => {
    const r = checkEvidenceModelFields("inferences", { ...baseFields, evidenceSpan: "usage grew due to evening trains" }, [PASSAGE], 3);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/evidence_span/);
  });

  it("rejects an unknown distractor error type tag (no free text allowed)", () => {
    const r = checkEvidenceModelFields("inferences", { ...baseFields, distractorErrorTypes: ["OVERREACH", "MADE_UP_TAG", "IRRELEVANT_DETAIL"] }, [PASSAGE], 3);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/distractor_error_types/);
  });

  it("rejects duplicate distractor error type tags (2026-09-17 버그 수정 — 오답 3개가 서로 다른 오류 유형이어야 하는데 중복 검사가 없었다)", () => {
    const r = checkEvidenceModelFields("command_of_evidence_text", { ...baseFields, distractorErrorTypes: ["IRRELEVANT_QUOTE", "IRRELEVANT_QUOTE", "CONTRADICTS_CLAIM"] }, [PASSAGE], 3);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/중복/);
  });

  it("rejects mismatched distractor tag count vs distractor options", () => {
    const r = checkEvidenceModelFields("inferences", { ...baseFields, distractorErrorTypes: ["OVERREACH", "OPPOSITE"] }, [PASSAGE], 3);
    expect(r.ok).toBe(false);
  });

  it("rejects empty target/answer_rationale/evidence_span", () => {
    expect(checkEvidenceModelFields("inferences", { ...baseFields, target: "" }, [PASSAGE], 3).ok).toBe(false);
    expect(checkEvidenceModelFields("inferences", { ...baseFields, answerRationale: "  " }, [PASSAGE], 3).ok).toBe(false);
    expect(checkEvidenceModelFields("inferences", { ...baseFields, evidenceSpan: "" }, [PASSAGE], 3).ok).toBe(false);
  });

  it("rejects when the AI echoes evidence_span into target or answer_rationale", () => {
    const r1 = checkEvidenceModelFields("inferences", { ...baseFields, target: baseFields.evidenceSpan }, [PASSAGE], 3);
    expect(r1.ok).toBe(false);
    const r2 = checkEvidenceModelFields("inferences", { ...baseFields, answerRationale: baseFields.evidenceSpan }, [PASSAGE], 3);
    expect(r2.ok).toBe(false);
    const r3 = checkEvidenceModelFields("inferences", { ...baseFields, answerRationale: baseFields.target }, [PASSAGE], 3);
    expect(r3.ok).toBe(false);
  });

  it("for cross_text_connections, accepts a span found in either candidate text", () => {
    const text1 = "Text 1: Some economists argue automation reduces net employment.";
    const text2 = "Text 2: Other researchers find automation creates new categories of jobs that offset losses.";
    const fields = {
      target: "how the two authors differ on automation's effect on jobs",
      evidenceSpan: "automation creates new categories of jobs that offset losses",
      answerRationale: "Text 2's claim directly counters Text 1's net-loss claim, showing the disagreement.",
      distractorErrorTypes: ["SINGLE_TEXT_ONLY", "REVERSED_RELATIONSHIP", "MISATTRIBUTED_STANCE"],
    };
    const r = checkEvidenceModelFields("cross_text_connections", fields, [text1, text2], 3);
    expect(r.ok).toBe(true);
  });

  it("defines a fixed enum per all 5 skills with no overlap-by-accident emptiness", () => {
    for (const skill of EVIDENCE_MODEL_SKILLS) {
      expect(DISTRACTOR_ERROR_TYPES[skill].length).toBeGreaterThanOrEqual(4);
    }
  });
});
