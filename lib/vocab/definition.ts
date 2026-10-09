// 2026-10-05(제품 오너) — 단어 뜻은 영어 기본 + 한국어 토글. AI 생성·검증·표시 선택의 순수 로직.

const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;

export function hasHangul(s: string): boolean {
  return HANGUL.test(s);
}

export type VocabDefinitions = { definitionEn: string; definitionKo: string };

/** AI가 돌려준 뜻 두 개를 검증한다 — 영어는 한글 금지·최소 길이, 한국어는 한글 포함 필수. */
export function validateVocabDefinitions(raw: { definition_en?: unknown; definition?: unknown }):
  { ok: true; value: VocabDefinitions } | { ok: false; reason: "definition_en_missing" | "definition_en_has_hangul" | "definition_ko_missing" } {
  const en = typeof raw.definition_en === "string" ? raw.definition_en.trim() : "";
  const ko = typeof raw.definition === "string" ? raw.definition.trim() : "";
  if (en.length < 2) return { ok: false, reason: "definition_en_missing" };
  if (hasHangul(en)) return { ok: false, reason: "definition_en_has_hangul" };
  if (ko.length < 1 || !hasHangul(ko)) return { ok: false, reason: "definition_ko_missing" };
  return { ok: true, value: { definitionEn: en, definitionKo: ko } };
}

export const DEFINITION_EN_DESCRIPTION =
  "The word's meaning in one concise, student-friendly English definition (no Korean characters).";
export const DEFINITION_KO_DESCRIPTION = "이 단어의 뜻 — 간결한 한국어 설명";

export const VOCAB_ENTRY_TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    definition_en: { type: "string" as const, description: DEFINITION_EN_DESCRIPTION },
    definition: { type: "string" as const, description: DEFINITION_KO_DESCRIPTION },
    example: { type: "string" as const, description: "이 단어를 사용한 새로운 예문 (영단어면 영어 문장)" },
    similar: { type: "array" as const, items: { type: "string" as const }, description: "비슷한 뜻의 단어 3개" },
  },
  required: ["definition_en", "definition", "example", "similar"],
};

export function buildVocabEntryPrompt(word: string): string {
  return `SAT/AP 수업 교재를 읽던 학생이 모르는 단어 "${word}"를 단어장에 저장하려고 합니다. 이 단어의 영어 뜻(definition_en: 간결하고 학생이 이해하기 쉬운 영어 한 문장, 한글 금지), 한국어 뜻(definition), 예문, 비슷한 단어 3개를 정리해주세요.`;
}

export type DefinitionView = { text: string; hasToggle: boolean };

/** 표시할 뜻을 고른다. 영어가 있으면 기본 영어(토글로 한국어), 없으면(레거시) 한국어만 — 토글 없음. */
export function pickDefinition(en: string | null | undefined, ko: string | null | undefined, showKorean: boolean): DefinitionView {
  const e = en?.trim() || null;
  const k = ko?.trim() || null;
  if (!e) return { text: k ?? "", hasToggle: false };
  if (showKorean && k) return { text: k, hasToggle: true };
  return { text: e, hasToggle: !!k };
}
