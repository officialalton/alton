// 2026-09-17 — boundaries / form_structure_sense 결정적 검증기.
//
// 두 세부 기술은 지금까지 checkRwStructure(BLANK_SKILLS)에서 완전히 같은 트리거 정규식(질문 문구)을
// 공유했다 — 실제 SAT도 두 기술의 질문 문구가 동일("...conforms to the conventions of Standard
// English?")하기 때문에 문구만으로는 구분할 수 없다. 여기서는 evidence-model-check.ts의 설계를 그대로
// 따라 "AI가 자기보고하는 태그"를 신뢰하지 않고, (1) 그 태그가 이 스킬 고유의 문법 규칙 taxonomy에 실제로
// 속하는지(boundaries·form_structure_sense는 서로 겹치지 않는 별개의 enum), (2) 정답 선택지는 그 결함이
// 없고 오답들은 결함이 있다는 것을 값싼 정규식 휴리스틱으로 교차검증한다.
//
// boundaries = 구두점·경계 수준 오류(콤마 스플라이스, 아포스트로피/소유격, 세미콜론/콜론, 주어-동사 수일치,
// 문장 경계/단편/런온).
// form_structure_sense = 문장 구조·절 결합 수준 오류(현수/미치 수식어, 병렬 구조, 종속/등위 연결, 수식어 뒤
// 동사형, 대명사 일치) — boundaries와 겹치지 않는다.

export const BOUNDARIES_RULES = [
  "COMMA_SPLICE",
  "APOSTROPHE_POSSESSIVE",
  "SUBJECT_VERB_AGREEMENT",
  "SEMICOLON_COLON",
  "SENTENCE_BOUNDARY",
] as const;
export type BoundariesRule = (typeof BOUNDARIES_RULES)[number];

export const FORM_STRUCTURE_RULES = [
  "DANGLING_MODIFIER",
  "FAULTY_PARALLELISM",
  "SUBORDINATION_COORDINATION",
  "VERB_FORM_AFTER_MODIFIER",
  "PRONOUN_AGREEMENT",
] as const;
export type FormStructureRule = (typeof FORM_STRUCTURE_RULES)[number];

export const GRAMMAR_STRUCTURE_SKILLS = ["boundaries", "form_structure_sense"] as const;
export type GrammarStructureSkill = (typeof GRAMMAR_STRUCTURE_SKILLS)[number];

export function isGrammarStructureSkill(skillCode: string | null | undefined): skillCode is GrammarStructureSkill {
  return Boolean(skillCode) && (GRAMMAR_STRUCTURE_SKILLS as readonly string[]).includes(skillCode as string);
}

/** 스킬별 고정 taxonomy — 두 스킬은 서로 겹치지 않는다(이것이 진짜 구조적 구분선). */
export const GRAMMAR_RULES_BY_SKILL: Record<GrammarStructureSkill, readonly string[]> = {
  boundaries: BOUNDARIES_RULES,
  form_structure_sense: FORM_STRUCTURE_RULES,
};

export type GrammarStructureFields = {
  /** 이 문항이 실제로 테스트하는 문법 규칙 태그(스킬 고유 enum 중 하나). */
  grammarRule: string | null;
  /** 오답(정답 제외) 옵션 순서대로 하나씩 — 그 오답이 담고 있는 결함 유형(같은 enum). */
  distractorErrorTypes: string[] | null;
};

export type GrammarStructureCheckResult = { ok: true } | { ok: false; reason: string };

/**
 * 값싼 정규식 휴리스틱 — AI 자기보고 태그를 문자열로 교차검증한다(완전한 문법 파서가 아니라 evidence-model의
 * "문자열 검색으로 직접 확인" 정신을 재현하는 감지 가능한 패턴만). 검출 안 되면 null(판단 보류 — 태그 신뢰).
 * true = 결함 패턴이 실제로 그 문자열 안에 있음, false = 명백히 없음(태그와 모순).
 */
function detectDefect(rule: string, text: string): boolean | null {
  const t = text.trim();
  switch (rule) {
    case "COMMA_SPLICE": {
      // "…verb…, subject verb…" 형태로 두 개의 완전한 절이 등위접속사 없이 콤마만으로 이어짐(근사 검사).
      const m = t.match(/,\s*(it|he|she|they|we|i|this|that|these|those)\s+\w+/i);
      if (!m) return null;
      const hasCoordinator = /,\s*(and|but|or|so|yet|for|nor)\b/i.test(t);
      return !hasCoordinator;
    }
    case "APOSTROPHE_POSSESSIVE": {
      if (/\bits'\b/.test(t) || /\b(it's)\s+\w+\s+(own|properties|features)\b/i.test(t)) return true;
      if (/\b\w+s's\b/.test(t)) return true; // 복수형에 's 오용(근사)
      return null;
    }
    case "SEMICOLON_COLON": {
      if (/;\s*(and|but|or)\b/i.test(t)) return true; // 세미콜론 뒤에 등위접속사(오용)
      if (/:\s*[a-z]/.test(t) && !/:\s*[A-Z"“]/.test(t)) return null;
      return null;
    }
    case "SUBJECT_VERB_AGREEMENT": {
      if (/\b(they|we|you)\s+(is|was|has)\b/i.test(t)) return true;
      if (/\b(he|she|it)\s+(are|were|have)\b/i.test(t)) return true;
      return null;
    }
    case "SENTENCE_BOUNDARY": {
      // 문장 조각(주어만 있고 정동사 없음)을 값싸게 잡기는 어렵다 — 태그만 신뢰(판단 보류).
      return null;
    }
    case "DANGLING_MODIFIER": {
      // 분사구로 시작 + 콤마 뒤 주어가 그 동작의 주체로 보이지 않는 패턴은 값싸게 못 잡는다 — 보류.
      return null;
    }
    case "FAULTY_PARALLELISM": {
      // "-ing, -ing, and to Verb" 처럼 목록 안에 형태가 섞이면 병렬 오류.
      const ing = (t.match(/\b\w+ing\b/g) ?? []).length;
      const toVerb = /,\s*and\s+to\s+\w+/i.test(t);
      if (ing >= 1 && toVerb) return true;
      return null;
    }
    case "SUBORDINATION_COORDINATION": {
      if (/\b(although|because|while|since)\b.*,\s*(so|therefore|thus)\b/i.test(t)) return true; // 종속+등위 중복
      return null;
    }
    case "VERB_FORM_AFTER_MODIFIER": {
      return null;
    }
    case "PRONOUN_AGREEMENT": {
      if (/\ba\s+\w+\s+.*\btheir\b/i.test(t) && /\ba\s+\w+\b/i.test(t)) return null; // 근사 어려움 — 보류
      return null;
    }
    default:
      return null;
  }
}

export function checkGrammarStructureFields(
  skillCode: string,
  fields: GrammarStructureFields,
  correctOption: string,
  distractorOptions: string[]
): GrammarStructureCheckResult {
  if (!isGrammarStructureSkill(skillCode)) return { ok: true };

  const grammarRule = (fields.grammarRule ?? "").trim();
  const distractorErrorTypes = fields.distractorErrorTypes ?? [];
  const allowed = new Set(GRAMMAR_RULES_BY_SKILL[skillCode]);

  if (!grammarRule) return { ok: false, reason: "grammar-structure: grammar_rule이 비어 있습니다." };
  if (!allowed.has(grammarRule)) {
    return {
      ok: false,
      reason: `grammar-structure: grammar_rule "${grammarRule}"이 ${skillCode}의 taxonomy에 없습니다(허용: ${Array.from(allowed).join(", ")}) — boundaries/form_structure_sense는 서로 다른 문법 규칙 taxonomy를 써야 합니다.`,
    };
  }

  if (distractorErrorTypes.length !== distractorOptions.length) {
    return { ok: false, reason: `grammar-structure: distractor_error_types 개수(${distractorErrorTypes.length})가 오답 개수(${distractorOptions.length})와 다릅니다.` };
  }
  for (const tag of distractorErrorTypes) {
    if (!allowed.has(tag)) {
      return { ok: false, reason: `grammar-structure: distractor_error_types에 알 수 없는 태그 "${tag}"가 있습니다(허용: ${Array.from(allowed).join(", ")}).` };
    }
  }

  // 정답 옵션은 grammarRule이 지목하는 결함을 담고 있으면 안 된다(값싼 정규식이 명확히 검출한 경우만 거부 — 오탐 방지).
  const correctHasDefect = detectDefect(grammarRule, correctOption);
  if (correctHasDefect === true) {
    return { ok: false, reason: `grammar-structure: 정답 선택지 "${correctOption.slice(0, 60)}"가 grammar_rule(${grammarRule})의 결함 패턴을 그대로 담고 있습니다 — 정답은 그 규칙을 올바르게 지켜야 합니다.` };
  }

  // 오답 중 정답과 같은 태그를 정확히 grammarRule로 다시 지목한 오답이 하나도 없으면(즉 그 규칙을 실제로 틀리게 보여주는 오답이 없으면) 문항이 그 규칙을 변별하지 못한다.
  if (!distractorErrorTypes.includes(grammarRule)) {
    return { ok: false, reason: `grammar-structure: 오답 중 grammar_rule(${grammarRule})과 같은 결함 유형을 가진 오답이 없습니다 — 정답과 최소 한 오답이 같은 규칙에서 갈려야 변별력이 생깁니다.` };
  }

  return { ok: true };
}
