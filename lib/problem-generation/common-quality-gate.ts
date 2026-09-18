// 2026-09-17 — Step 6 "공통 품질 게이트"의 얇은 레이어.
//
// 이미 존재하는 유형별 검증(Math 컴파일러의 checkContent/checkFigure, R&W의
// evidence-model/grammar-structure/quant-evidence/transition-relationship/
// rhetorical-synthesis/text-structure 검증기)을 재해석하거나 대체하지 않는다.
// 그 검증들이 이미 다 돈 뒤, 아직 어디에도 없던 "교차 유형" 검사 두 가지만 더한다:
//   1) 금칙어(ALTON, 테스트 계정, 내부 운영·프롬프트 문구 노출)
//   2) 해설이 정답 도출에 쓰인 핵심 사실(모델이 이미 계산/확인한 값)을 실제로 담고 있는가
// 정답-선택지 일관성·중복 선택지는 checkContent(option_duplicate 등)와 evidence-model의
// distractor_error_types 중복 검사가 이미 커버한다(감사 결과, 아래 checkOptionCollision 참고).
// AI 호출도, 무제한 재시도도 추가하지 않는다 — 전부 문자열 검사다.
import type { FigureIssue } from "../problem-figures/templates/_layout";

/** Step 6 실패 코드 분류(제품 오너 지정) — 기존 코드(latex_leak 등)는 렌더링으로 묶고, 새 코드만 추가한다. */
export type FailureCategory = "answer_evidence" | "numeric_data" | "grammar_rule" | "rendering" | "forbidden_word" | "tag_consistency";

const RENDERING_CODES = new Set(["latex_leak", "math_parse", "math_unclosed", "figure_choice_placeholder"]);
const TAG_CODES = new Set(["option_count", "option_empty", "correct_index", "option_style", "statements", "answers", "tag_consistency"]);
const FORBIDDEN_CODES = new Set(["forbidden_word"]);
const ANSWER_EVIDENCE_CODES = new Set(["option_duplicate", "condition_ambiguous", "condition_no_match", "explanation_no_derivation", "evidence-model", "distractor_duplicate_type"]);

/** 코드 하나를 다섯 실패 분류 중 하나로 매핑한다. 알 수 없는 코드는 grammar_rule(유형별 규칙 위반 기본값)로 둔다. */
export function categorizeFailureCode(code: string): FailureCategory {
  if (RENDERING_CODES.has(code) || code.startsWith("render")) return "rendering";
  if (FORBIDDEN_CODES.has(code)) return "forbidden_word";
  if (TAG_CODES.has(code)) return "tag_consistency";
  if (ANSWER_EVIDENCE_CODES.has(code) || code.startsWith("evidence")) return "answer_evidence";
  if (code.includes("numeric") || code.includes("quant") || code.includes("data")) return "numeric_data";
  return "grammar_rule";
}

/**
 * 금칙어 사전. ALTON/내부 운영진 문구/테스트 계정 패턴/생성 스키마 필드명이 학생에게 그대로
 * 노출된 문구를 잡는다. 대소문자 무시, 부분 문자열 매칭 — 오탐보다 누락이 위험하므로 넓게 잡는다.
 */
const BANNED_LITERAL = [
  "alton", "앨튼",
  "테스트 계정", "test account", "admin-uat-", "@alton.education",
  "내부 검토용", "내부 검수용", "내부용", "학생에게 보이면 안", "학생에게 노출되면 안",
  "prompt:", "system:", "system prompt", "instructions:",
  "evidence_span", "distractor_error_types", "answer_rationale", "target_field",
  "as an ai", "as an ai language model",
];

export type BannedWordHit = { field: string; term: string };

/** 금칙어 하나라도 발견되면 즉시 실패(저장/공개 차단) — 별도 AI 판독 없이 순수 문자열 검사. */
export function findBannedWords(fields: Record<string, string | null | undefined>): FigureIssue[] {
  const issues: FigureIssue[] = [];
  for (const [field, raw] of Object.entries(fields)) {
    const text = (raw ?? "").toLowerCase();
    if (!text) continue;
    for (const term of BANNED_LITERAL) {
      if (text.includes(term.toLowerCase())) {
        issues.push({ code: "forbidden_word", message: `${field}에 금칙어/내부 문구가 포함되어 있습니다: "${term}"` });
      }
    }
  }
  return issues;
}

/** 숫자·핵심 용어 정규화(공백/통화기호/천단위 콤마 제거) — "40" 과 "$40" 과 "40.0" 을 같은 것으로 본다. */
function normalizeFact(s: string): string {
  return s.trim().toLowerCase().replace(/[$,\s]/g, "").replace(/\.0+$/, "");
}

/**
 * 2026-09-18 추가 — evidence_target은 스킬이 아니라 **문항마다** 한국어 서술문으로 나올 때도
 * 있고(central_ideas_details·cross_text_connections는 거의 항상) 영어 명제 문장으로 나올 때도
 * 있다(inferences·command_of_evidence_text 실측 배치에서 자주 확인, `scripts/evidence-model-verify.ts`
 * 실행 결과 — 같은 skill_code 안에서도 문항마다 갈렸다). 해설은 항상 한국어이므로, target이 영어일 때
 * 문자열/토큰 검사는 근본적으로 성립하지 않는다(원래 결함과 같은 문제가 evidence_span→target으로 옮겨갈
 * 뿐). 이 값싼 검사는 같은 언어끼리만 의미가 있으므로, target이 한국어가 아니면 이 검사 자체를
 * 건너뛴다(오탐 방지 우선 — 그 문항의 다른 검증(evidence-model-check의 축자 인용·에코 방지, 이후
 * 독립 AI 검사)은 그대로 돈다).
 */
export function isMostlyKorean(s: string): boolean {
  const letters = s.match(/[\p{L}]/gu) ?? [];
  if (!letters.length) return false;
  const hangul = s.match(/[가-힣]/gu) ?? [];
  return hangul.length / letters.length >= 0.3;
}

/**
 * 2026-09-18 수정 — R&W 근거 모델 5개 스킬 중 4개(central_ideas_details·inferences·
 * command_of_evidence_text·cross_text_connections)에서 이 검사가 거의 100% 오탐이던
 * 결함 수정.
 *
 * 원인: 호출부(pipeline.ts)가 evidence_span(지문에서 축자 인용한 **영어** 문장)을 keyFacts에
 * 넣고 한국어 해설이 그걸 그대로 포함하는지 보고 있었다 — 한국어 산문이 영어 문장을 통째로
 * 축자 인용할 리 없다. words_in_context만 근거가 짧은 영어 단어 하나라 우연히 통과했을 뿐,
 * 나머지 4개는 실측 300문항 배치(`docs/2026-09-18-problem-bank-full-reset-progress.jsonl`)
 * 에서 사실상 전부 이 단계에서 걸렸다(central_ideas_details 2/10, inferences 0/10 등).
 *
 * 제품 오너 정정: 이 검사의 원래 의도는 "해설이 질문을 재진술만 하고 실제 도출 과정이
 * 없는지"를 잡는 것이지, 영어 축어 인용을 요구하는 것이 아니다. 호출부는 evidence_span(영어)을
 * keyFacts에서 빼고 evidence_target(한국어로 합성된 "이 문항이 실제로 묻는 대상" 서술문,
 * `lib/problem-generation/evidence-model-check.ts` 참고)만 넘긴다.
 *
 * target도 완전 축어 포함을 요구하면 여전히 대부분 실패한다(한국어는 조사가 붙어 활용되고,
 * target 자체가 질문 대상을 요약한 별도 문장이라 해설이 그 문장을 그대로 옮기지 않는다).
 * 그래서 "완전 문자열 포함(숫자·짧은 인용 등 여전히 유효한 케이스는 그대로 통과)"이 실패하면
 * "target의 의미 있는 단어 중 상당수가 해설에 등장하는가"의 부분 일치로 완화한다.
 */
function normalizeForTokenMatch(s: string): string {
  return s.toLowerCase().normalize("NFKC");
}

/** 조사·접속어 등 실질적 의미가 없는 한국어 기능어 — 토큰 일치 검사에서 제외한다(오탐 방지용 노이즈 제거). */
const KOREAN_STOPWORDS = new Set([
  "이", "가", "은", "는", "을", "를", "의", "에", "에서", "와", "과", "도", "만", "로", "으로",
  "그", "그리고", "그런데", "또한", "즉", "이다", "것", "수", "때", "후", "전", "대한", "대해",
  "무엇인가", "어떤", "실제로", "진짜", "하는", "한다", "위해", "통해", "무엇", "이나",
]);

/** target 등 프로즈 사실을 의미 있는 단어(2음절 이상, 불용어 제외) 목록으로 쪼갠다. */
function significantTokens(fact: string): string[] {
  const words = normalizeForTokenMatch(fact).match(/[\p{L}\p{N}]+/gu) ?? [];
  return words.filter((w) => w.length >= 2 && !KOREAN_STOPWORDS.has(w));
}

/**
 * 정규화된 해설 문자열 안에 토큰이 (부분 문자열로) 있는지 본다. 한국어는 조사가 붙어 활용되므로
 * ("문어의" vs 해설의 "문어가") 토큰 전체 일치 대신, 토큰 자체 또는 마지막 한 글자를 뗀 어간이
 * 해설에 부분 문자열로 등장하면 일치로 본다(값싼 유사 어간 매칭 — 완전한 형태소 분석이 아니다).
 */
function tokenAppearsIn(token: string, normalizedExplanation: string): boolean {
  if (normalizedExplanation.includes(token)) return true;
  if (token.length >= 3) {
    const stem = token.slice(0, -1);
    if (stem.length >= 2 && normalizedExplanation.includes(stem)) return true;
  }
  return false;
}

/**
 * 부분 일치 임계값 — 실측(2026-09-18 재검증 배치, `scripts/evidence-model-verify.ts`)으로
 * 확인: 이보다 낮추면 질문만 재진술한 해설도 통과했고, 이보다 높이면 정상적으로 도출한
 * 한국어 의역 해설까지 거부했다.
 */
const TOKEN_MATCH_THRESHOLD = 0.5;

/**
 * fact를 해설이 "실제로 담고 있다"고 볼 근거가 있는지 판정한다.
 * 1) 완전 문자열 포함(숫자·짧은 인용 등 여전히 유효한 케이스) — 우선 시도.
 * 2) 실패하면 의미 있는 단어 중 TOKEN_MATCH_THRESHOLD 이상 비율이 해설에 등장하는지로 완화.
 *    의미 있는 단어가 하나도 없으면(전부 불용어) 완전 일치만으로 판정한다.
 */
function factIsDerivedIn(fact: string, explanation: string): boolean {
  const normExplanation = normalizeFact(explanation);
  if (normExplanation.includes(normalizeFact(fact))) return true;

  const tokens = significantTokens(fact);
  if (!tokens.length) return false;
  const normExplanationForTokens = normalizeForTokenMatch(explanation).replace(/[^\p{L}\p{N}]/gu, "");
  const matched = tokens.filter((t) => tokenAppearsIn(t, normExplanationForTokens)).length;
  return matched / tokens.length >= TOKEN_MATCH_THRESHOLD;
}

/**
 * 해설이 정답 도출에 실제로 쓰인 핵심 사실(모델이 이미 산출/확인한 값)을 담고 있는지 확인한다.
 * 의미 이해가 아니라 "이 문자열(또는 그 의미 있는 단어 상당수)들 중 최소 minHits개가 해설에
 * 등장하는가"의 값싼 검사다. keyFacts가 비어 있으면(핵심 값을 추출할 수 없는 유형) 판정을
 * 건너뛴다 — 오탐 방지.
 */
export function checkExplanationDerivation(
  explanation: string,
  keyFacts: string[],
  minHits = 1
): FigureIssue[] {
  const facts = keyFacts.map((f) => f.trim()).filter((f) => f.length > 0);
  if (!facts.length) return [];
  const hits = facts.filter((f) => factIsDerivedIn(f, explanation ?? ""));
  if (hits.length >= Math.min(minHits, facts.length)) return [];
  return [{
    code: "explanation_no_derivation",
    message: `해설이 정답 도출에 쓰인 핵심 값(${facts.slice(0, 5).join(", ")})을 담고 있지 않습니다 — 질문을 재진술했을 뿐 실제 도출 과정이 없을 수 있습니다.`,
  }];
}

export type TagConsistencyInput = {
  format: "mc" | "spr" | string;
  options: string[] | null;
  answers: string[] | null;
  skillCode?: string | null;
  validFormatsForSkill?: readonly string[] | null;
  requestedDifficulty?: string | null;
  estimatedDifficulty?: string | null;
};

/**
 * 저장 직전 태그 정합성 확인 — spr인데 options가 남아있거나 mc인데 answers가 채워진 경우,
 * skill_code가 그 과목·유형에서 허용된 format 밖인 경우를 잡는다. 난이도 요청/추정 불일치는
 * (기존 방침대로) 저장을 막지 않고 review 신호로만 쓴다 — 여기서는 tag_consistency 코드로
 * 표시만 하고 fatal로 취급하지 않는 건 호출자 몫이다.
 */
export function checkTagConsistency(input: TagConsistencyInput): FigureIssue[] {
  const issues: FigureIssue[] = [];
  if (input.format === "spr") {
    if (input.options && input.options.length > 0) issues.push({ code: "tag_consistency", message: "format이 spr인데 options(객관식 선택지)가 남아 있습니다." });
    if (!input.answers || input.answers.filter((a) => a.trim()).length === 0) issues.push({ code: "tag_consistency", message: "format이 spr인데 answers가 비어 있습니다." });
  } else if (input.format === "mc") {
    if (input.answers && input.answers.filter((a) => a.trim()).length > 0) issues.push({ code: "tag_consistency", message: "format이 mc인데 answers(SPR 정답)가 채워져 있습니다." });
    if (!input.options || input.options.length === 0) issues.push({ code: "tag_consistency", message: "format이 mc인데 options가 비어 있습니다." });
  }
  if (input.validFormatsForSkill && input.validFormatsForSkill.length > 0 && !input.validFormatsForSkill.includes(input.format)) {
    issues.push({ code: "tag_consistency", message: `skill_code(${input.skillCode ?? "?"})는 format "${input.format}"을 허용하지 않습니다(허용: ${input.validFormatsForSkill.join(", ")}).` });
  }
  return issues;
}

/** 관리자 화면에 노출할 "공개 가능 여부 + 보관 사유"만 — 내부 검증 원문(FigureIssue.message)은 넘기지 않는다. */
export function summarizeForAdmin(issues: FigureIssue[]): { publishable: boolean; archiveReasonLabel: string | null } {
  if (!issues.length) return { publishable: true, archiveReasonLabel: null };
  const categories = Array.from(new Set(issues.map((i) => categorizeFailureCode(i.code))));
  const LABEL: Record<FailureCategory, string> = {
    answer_evidence: "정답 근거 검증 실패",
    numeric_data: "수치·자료 검증 실패",
    grammar_rule: "문법·규칙 검증 실패",
    rendering: "렌더링 검증 실패(수식/그림)",
    forbidden_word: "금칙어 검출",
    tag_consistency: "태그 정합성 오류",
  };
  return { publishable: false, archiveReasonLabel: categories.map((c) => LABEL[c]).join(" · ") };
}
