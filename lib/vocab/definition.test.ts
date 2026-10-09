import { describe, expect, it } from "vitest";
import { VOCAB_ENTRY_TOOL_SCHEMA, buildVocabEntryPrompt, hasHangul, pickDefinition, validateVocabDefinitions } from "./definition";

describe("validateVocabDefinitions", () => {
  it("영어·한국어 뜻이 모두 올바르면 통과한다", () => {
    const r = validateVocabDefinitions({ definition_en: " to lessen in intensity ", definition: "줄어들다" });
    expect(r).toEqual({ ok: true, value: { definitionEn: "to lessen in intensity", definitionKo: "줄어들다" } });
  });
  it("영어 뜻이 없거나 짧으면 거절한다(새 단어는 필수)", () => {
    expect(validateVocabDefinitions({ definition: "줄어들다" })).toEqual({ ok: false, reason: "definition_en_missing" });
    expect(validateVocabDefinitions({ definition_en: "a", definition: "줄어들다" })).toEqual({ ok: false, reason: "definition_en_missing" });
  });
  it("영어 뜻에 한글이 섞이면 거절한다", () => {
    expect(validateVocabDefinitions({ definition_en: "to 줄어들다", definition: "줄어들다" })).toEqual({ ok: false, reason: "definition_en_has_hangul" });
  });
  it("한국어 뜻이 없거나 한글이 아니면 거절한다", () => {
    expect(validateVocabDefinitions({ definition_en: "to lessen", definition: "" })).toEqual({ ok: false, reason: "definition_ko_missing" });
    expect(validateVocabDefinitions({ definition_en: "to lessen", definition: "to lessen" })).toEqual({ ok: false, reason: "definition_ko_missing" });
  });
});

describe("tool schema / prompt", () => {
  it("스키마가 definition_en 과 definition 을 둘 다 필수로 요구한다", () => {
    expect(VOCAB_ENTRY_TOOL_SCHEMA.required).toEqual(expect.arrayContaining(["definition_en", "definition", "example", "similar"]));
    expect(Object.keys(VOCAB_ENTRY_TOOL_SCHEMA.properties)).toContain("definition_en");
    expect(VOCAB_ENTRY_TOOL_SCHEMA.properties.definition_en.description).toMatch(/no Korean/i);
  });
  it("프롬프트가 영어 뜻을 요구한다", () => {
    const p = buildVocabEntryPrompt("abate");
    expect(p).toContain("abate");
    expect(p).toContain("definition_en");
  });
});

describe("pickDefinition", () => {
  it("영어가 있으면 기본 영어, 토글하면 한국어", () => {
    expect(pickDefinition("to lessen", "줄어들다", false)).toEqual({ text: "to lessen", hasToggle: true });
    expect(pickDefinition("to lessen", "줄어들다", true)).toEqual({ text: "줄어들다", hasToggle: true });
  });
  it("영어만 있고 한국어가 없으면 토글 없이 영어", () => {
    expect(pickDefinition("to lessen", null, true)).toEqual({ text: "to lessen", hasToggle: false });
  });
  it("레거시(영어 null)는 한국어만, 토글 없음", () => {
    expect(pickDefinition(null, "줄어들다", false)).toEqual({ text: "줄어들다", hasToggle: false });
    expect(pickDefinition("", "줄어들다", true)).toEqual({ text: "줄어들다", hasToggle: false });
  });
  it("hasHangul", () => {
    expect(hasHangul("abc")).toBe(false);
    expect(hasHangul("a가")).toBe(true);
  });
});
