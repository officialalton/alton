// 2026-09-17 — rhetorical_synthesis(자료 종합) 결정적 검증기.
//
// 이 스킬은 지문 대신 "notes"(불릿 목록)와 학생의 목표 문장을 주고, 그 notes를 학생 목표에 맞게
// 종합한 선택지를 고르게 한다. evidence-model/grammar-structure와 같은 설계로, AI가 "이 오답은
// 목표를 놓쳤다"고 자기보고하는 것을 신뢰하지 않고 (1) 오답 3개가 서로 다른 카테고리의 결함을
// 가졌는지(같은 결함 중복 금지 — evidence-model의 중복 태그 검사 재사용), (2) 정답의 핵심 내용이
// notes 중 특정 항목(들)에서 실제로 따라 나오는지(문자열 근사 검사)를 결정적으로 확인한다.

export const DISTRACTOR_ERROR_TYPES = [
  "IGNORES_GOAL",
  "MISUSES_ONE_NOTE_ONLY",
  "COMBINES_WRONG_NOTES",
  "ADDS_UNSUPPORTED_CLAIM",
] as const;
export type RhetoricalSynthesisDistractorErrorType = (typeof DISTRACTOR_ERROR_TYPES)[number];

export const RHETORICAL_SYNTHESIS_SKILLS = ["rhetorical_synthesis"] as const;
export type RhetoricalSynthesisSkill = (typeof RHETORICAL_SYNTHESIS_SKILLS)[number];

export function isRhetoricalSynthesisSkill(skillCode: string | null | undefined): skillCode is RhetoricalSynthesisSkill {
  return Boolean(skillCode) && (RHETORICAL_SYNTHESIS_SKILLS as readonly string[]).includes(skillCode as string);
}

export type RhetoricalSynthesisFields = {
  /** 정답이 실제로 근거로 삼는 note(들)의 설명(사람이 읽는 용도 — 검증은 correctOption과 notes를 직접 대조). */
  target: string | null;
  answerRationale: string | null;
  /** 오답(정답 제외) 옵션 순서대로 하나씩. */
  distractorErrorTypes: string[] | null;
};

export type RhetoricalSynthesisCheckResult = { ok: true } | { ok: false; reason: string };

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with", "that", "this", "is", "are",
  "was", "were", "be", "as", "by", "it", "its", "which", "who", "student", "wants", "goal", "note", "notes",
]);

function contentTokens(text: string): Set<string> {
  return new Set(normalize(text).split(" ").filter((t) => t.length > 2 && !STOPWORDS.has(t)));
}

/**
 * 정답 선택지의 핵심 내용이 notes 목록의 특정 항목(들)에서 실제로 따라 나오는지 근사 검사한다.
 * (수치 대조가 불가능한 자연어이므로 evidence-model의 "축자 검색"보다 느슨한 겹침 비율 휴리스틱을 쓴다 —
 * 지나치게 엄격하면 정상적인 종합·재구성 문장까지 거부하게 되므로, 임계값은 낮게 잡아 "완전히 새로 지어낸
 * 주장"만 걸러낸다.)
 */
function correctAnswerTracesToNotes(correctOption: string, notes: string[]): boolean {
  const correctTokens = contentTokens(correctOption);
  if (correctTokens.size === 0) return false;
  const noteTokens = notes.map((n) => contentTokens(n));
  const allNoteTokens = new Set<string>();
  for (const s of noteTokens) for (const t of s) allNoteTokens.add(t);
  let covered = 0;
  for (const t of correctTokens) if (allNoteTokens.has(t)) covered += 1;
  const coverageRatio = covered / correctTokens.size;
  return coverageRatio >= 0.3;
}

export function checkRhetoricalSynthesisFields(
  skillCode: string,
  fields: RhetoricalSynthesisFields,
  notes: string[],
  correctOption: string,
  distractorOptions: string[]
): RhetoricalSynthesisCheckResult {
  if (!isRhetoricalSynthesisSkill(skillCode)) return { ok: true };

  const target = (fields.target ?? "").trim();
  const answerRationale = (fields.answerRationale ?? "").trim();
  const distractorErrorTypes = fields.distractorErrorTypes ?? [];
  const allowed = new Set(DISTRACTOR_ERROR_TYPES as readonly string[]);

  if (!target) return { ok: false, reason: "rhetorical-synthesis: target이 비어 있습니다." };
  if (!answerRationale) return { ok: false, reason: "rhetorical-synthesis: answer_rationale이 비어 있습니다." };
  if (!notes.length) return { ok: false, reason: "rhetorical-synthesis: notes가 비어 있습니다 — 자료 종합 문항은 notes 목록이 필수입니다." };

  if (distractorErrorTypes.length !== distractorOptions.length) {
    return { ok: false, reason: `rhetorical-synthesis: distractor_error_types 개수(${distractorErrorTypes.length})가 오답 개수(${distractorOptions.length})와 다릅니다.` };
  }
  for (const tag of distractorErrorTypes) {
    if (!allowed.has(tag)) {
      return { ok: false, reason: `rhetorical-synthesis: distractor_error_types에 알 수 없는 태그 "${tag}"가 있습니다(허용: ${DISTRACTOR_ERROR_TYPES.join(", ")}).` };
    }
  }
  if (new Set(distractorErrorTypes).size !== distractorErrorTypes.length) {
    return { ok: false, reason: `rhetorical-synthesis: distractor_error_types에 중복된 오류 유형이 있습니다(${distractorErrorTypes.join(", ")}) — 오답끼리 서로 다른 방식으로 목표를 놓쳐야 변별력이 생깁니다.` };
  }

  // 정답의 핵심 내용이 notes에서 실제로 따라 나오는지 확인한다(지어낸 주장 방지).
  if (!correctAnswerTracesToNotes(correctOption, notes)) {
    return {
      ok: false,
      reason: `rhetorical-synthesis: 정답 선택지 "${correctOption.slice(0, 60)}"의 핵심 내용이 notes 목록 어디에서도 따라 나오지 않습니다 — 정답은 notes에 있는 정보만으로 학생의 목표를 종합해야 합니다(지문에 없는 주장을 지어내면 안 됩니다).`,
    };
  }

  // ADDS_UNSUPPORTED_CLAIM 태그가 붙은 오답은 실제로 notes에서 근거를 찾기 어려워야 한다(그래야 태그가 실제와 맞는다).
  for (let i = 0; i < distractorOptions.length; i += 1) {
    if (distractorErrorTypes[i] === "ADDS_UNSUPPORTED_CLAIM" && correctAnswerTracesToNotes(distractorOptions[i], notes)) {
      return {
        ok: false,
        reason: `rhetorical-synthesis: 오답 선택지 "${distractorOptions[i].slice(0, 60)}"는 ADDS_UNSUPPORTED_CLAIM으로 태그됐지만 내용이 notes에서 충분히 따라 나옵니다 — 태그가 실제 오답 성격과 어긋납니다.`,
      };
    }
  }

  return { ok: true };
}
