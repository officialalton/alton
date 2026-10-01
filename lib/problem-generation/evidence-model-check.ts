// 2026-09-17 — "얇은 근거 모델"(Evidence Model) 결정적 검증기.
//
// R&W 5개 세부 기술(words_in_context, central_ideas_details, inferences,
// command_of_evidence_text, cross_text_connections)에 한해, AI가 함께 낸
// target/evidence_span/answer_rationale/distractor_error_types 네 필드를 사람이
// 보기 전에(생성 수락 게이트에서) 결정적으로 검사한다.
//
// Math가 "AI는 진실값을 결정하지 않는다"는 원칙을 계산 컴파일러로 지키듯, 여기서는
// evidence_span이 실제 지문에 있다는 사실 자체를 AI 자기 보고가 아니라 문자열
// 검색으로 확인한다 — AI가 "이 문장이 근거"라고 말해도 실제로 지문에 없으면 통과시키지 않는다.

export const EVIDENCE_MODEL_SKILLS = [
  "words_in_context",
  "central_ideas_details",
  "inferences",
  "command_of_evidence_text",
  "cross_text_connections",
] as const;
export type EvidenceModelSkill = (typeof EVIDENCE_MODEL_SKILLS)[number];

export function isEvidenceModelSkill(skillCode: string | null | undefined): skillCode is EvidenceModelSkill {
  return Boolean(skillCode) && (EVIDENCE_MODEL_SKILLS as readonly string[]).includes(skillCode as string);
}

/**
 * 오답 유형 태그 고정 enum(스킬별) — 실제 SAT R&W 오답 패턴에 근거한다.
 * AI는 이 목록 중 하나만 골라야 하고(자유 문구·환각 카테고리 금지), 검증기가 그대로 검사한다.
 */
export const DISTRACTOR_ERROR_TYPES: Record<EvidenceModelSkill, readonly string[]> = {
  // 어휘 문항: 사전적으로는 맞지만 이 문맥에 안 맞음 / 반대 뜻 / 관련은 있지만 다른 품사·뜻 / 지문과 무관.
  words_in_context: ["WRONG_SENSE", "OPPOSITE_CONNOTATION", "RELATED_BUT_WRONG_FIT", "UNRELATED_MEANING"],
  // 중심 생각·세부 정보: 세부만 맞고 중심 생각 아님 / 범위 과장 또는 축소 / 지문에 없는 내용 / 초점 대상 혼동.
  central_ideas_details: ["TOO_NARROW_DETAIL", "OVERGENERALIZED", "UNSUPPORTED_BY_TEXT", "WRONG_FOCUS"],
  // 추론: 지나친 비약 / 반대로 추론 / 사실이지만 질문에 답 안 함 / 지문의 다른 부분에 대한 추론.
  inferences: ["OVERREACH", "OPPOSITE", "IRRELEVANT_DETAIL", "WRONG_SCOPE"],
  // 근거 지목(텍스트): 질문과 무관한 인용 / 결론과 반대되는 인용 / 부분적으로만 뒷받침 / 지문에 없는 인용(환각).
  command_of_evidence_text: ["IRRELEVANT_QUOTE", "CONTRADICTS_CLAIM", "PARTIALLY_SUPPORTS", "FABRICATED_QUOTE"],
  // 교차 텍스트: 한쪽 텍스트만 반영 / 두 텍스트 관계를 반대로 서술 / 한쪽 저자 입장 오귀속 / 무관한 세부 결합.
  cross_text_connections: ["SINGLE_TEXT_ONLY", "REVERSED_RELATIONSHIP", "MISATTRIBUTED_STANCE", "IRRELEVANT_COMBINATION"],
};

export type EvidenceModelFields = {
  target: string | null;
  evidenceSpan: string | null;
  answerRationale: string | null;
  /** 오답(정답 제외) 옵션 순서대로 하나씩. */
  distractorErrorTypes: string[] | null;
};

export type EvidenceModelCheckResult = { ok: true } | { ok: false; reason: string };

/** 공백·구두점 차이를 허용하는 "사실상 동일" 비교를 위해 정규화한다(완전 일치가 아니라 근접 일치 허용). */
function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * evidence_span이 sourceText 안에 (공백/구두점 정규화 허용) 부분 문자열로 실제 존재하는지 검사한다.
 * AI의 자기 보고를 신뢰하지 않고 문자열 검색으로 직접 확인한다 — 이것이 "진실을 결정하는" 유일한 단계다.
 */
export function verifyEvidenceSpanInSource(evidenceSpan: string, sourceText: string): boolean {
  const needle = normalizeForMatch(evidenceSpan);
  if (!needle || needle.length < 3) return false;
  const haystack = normalizeForMatch(sourceText);
  return haystack.includes(needle);
}

/**
 * 결정적 검증 3종:
 *  1) evidence_span이 실제 지문(또는 cross_text_connections면 해당 Text)의 축자적(정규화 허용) 부분 문자열인가.
 *  2) distractor_error_types 각 태그가 그 스킬의 고정 enum에 있는가(자유 문구·환각 금지).
 *  3) target·answer_rationale이 비어 있지 않고, 서로 또는 evidence_span과 동일 문자열이 아닌가(에코 방지).
 *
 * sourceTexts: cross_text_connections는 Text 1/Text 2 중 근거가 있는 쪽만 맞으면 되므로 후보 배열을 받는다.
 * distractorCount: 옵션 중 오답 개수(보통 3) — distractor_error_types 길이가 이와 같아야 한다.
 */
/**
 * target이 질문 문장을 그대로 되풀이한 것인지 검사한다(cross_text_connections 전용,
 * 2026-09-17 검수에서 5/5 샘플이 질문 재진술로 나온 문제 발견 — 프롬프트 수정과 별개로
 * 값싼 방어선을 하나 더 둔다). 정규화된 토큰 집합의 겹침 비율이 높으면
 * "질문을 다른 말로 옮겨 적었을 뿐 합성된 명제가 아니다"로 보고 거부한다.
 * 임계값 0.6은 느슨하게 잡아 오탐(false positive)을 줄인다 — 정상적인 target도 질문과
 * 같은 고유명사·핵심 명사를 공유하기 마련이라, 살짝만 겹쳐도 거부하면 정상 케이스까지 막는다.
 */
function targetEchoesQuestion(target: string, question: string): boolean {
  const targetTokens = new Set(normalizeForMatch(target).split(" ").filter((t) => t.length > 1));
  const questionTokens = new Set(normalizeForMatch(question).split(" ").filter((t) => t.length > 1));
  if (targetTokens.size < 3 || questionTokens.size < 3) return false;
  let overlap = 0;
  for (const t of targetTokens) if (questionTokens.has(t)) overlap += 1;
  const overlapRatio = overlap / Math.min(targetTokens.size, questionTokens.size);
  return overlapRatio >= 0.6;
}

export function checkEvidenceModelFields(
  skillCode: string,
  fields: EvidenceModelFields,
  sourceTexts: string[],
  distractorCount: number,
  questionText?: string | null
): EvidenceModelCheckResult {
  if (!isEvidenceModelSkill(skillCode)) return { ok: true };

  const target = (fields.target ?? "").trim();
  const evidenceSpan = (fields.evidenceSpan ?? "").trim();
  const answerRationale = (fields.answerRationale ?? "").trim();
  const distractorErrorTypes = fields.distractorErrorTypes ?? [];

  if (!target) return { ok: false, reason: "evidence-model: target이 비어 있습니다." };
  if (!evidenceSpan) return { ok: false, reason: "evidence-model: evidence_span이 비어 있습니다." };
  if (!answerRationale) return { ok: false, reason: "evidence-model: answer_rationale이 비어 있습니다." };

  const normEq = (a: string, b: string) => normalizeForMatch(a) === normalizeForMatch(b) && normalizeForMatch(a).length > 0;
  if (normEq(target, answerRationale)) return { ok: false, reason: "evidence-model: target과 answer_rationale이 같은 문장입니다(에코 의심)." };
  if (normEq(target, evidenceSpan)) return { ok: false, reason: "evidence-model: target과 evidence_span이 같은 문장입니다(에코 의심)." };
  if (normEq(answerRationale, evidenceSpan)) return { ok: false, reason: "evidence-model: answer_rationale과 evidence_span이 같은 문장입니다(에코 의심)." };

  // 0) cross_text_connections 전용 — target이 질문 재진술이 아니라 합성된 명제인지(방어선, 2026-09-17).
  if (skillCode === "cross_text_connections" && questionText && targetEchoesQuestion(target, questionText)) {
    return { ok: false, reason: "evidence-model: target이 질문을 재진술한 것으로 보입니다(두 텍스트의 합성된 관계 명제여야 합니다)." };
  }

  // 1) 축자성 검사 — AI 자기 보고가 아니라 실제 지문 문자열 검색.
  const foundInAny = sourceTexts.some((t) => verifyEvidenceSpanInSource(evidenceSpan, t));
  if (!foundInAny) {
    return { ok: false, reason: `evidence-model: evidence_span("${evidenceSpan.slice(0, 80)}")이 실제 지문에서 찾아지지 않습니다(축자 인용이어야 합니다).` };
  }

  // 2) 오답 유형 태그 — 고정 enum만.
  const allowed = new Set(DISTRACTOR_ERROR_TYPES[skillCode]);
  if (distractorErrorTypes.length !== distractorCount) {
    return { ok: false, reason: `evidence-model: distractor_error_types 개수(${distractorErrorTypes.length})가 오답 개수(${distractorCount})와 다릅니다.` };
  }
  for (const tag of distractorErrorTypes) {
    if (!allowed.has(tag)) {
      return { ok: false, reason: `evidence-model: distractor_error_types에 알 수 없는 태그 "${tag}"가 있습니다(허용: ${Array.from(allowed).join(", ")}).` };
    }
  }
  // 2026-09-17 버그 수정 — 오답 3개는 서로 다른 오류 유형이어야 하는데(각 오답이 다른 방식으로
  // 틀려야 변별력이 있다), 이전엔 enum 소속 여부만 검사하고 서로 중복되는지는 보지 않아
  // 같은 태그(예: IRRELEVANT_QUOTE)가 두 오답에 겹쳐도 통과됐다.
  if (new Set(distractorErrorTypes).size !== distractorErrorTypes.length) {
    return { ok: false, reason: `evidence-model: distractor_error_types에 중복된 오류 유형이 있습니다(${distractorErrorTypes.join(", ")}) — 오답끼리 서로 다른 오류 유형이어야 합니다.` };
  }

  return { ok: true };
}
