// AP English Language 에세이 루브릭(공개 구조: 논지 0–1 · 증거와 해설 0–4 · 정교함 0–1, 합 6) — 문구는 ALTON 자체 표현(공식 SG 문구 복제 아님).
// 공식 SG PDF 직접 대조는 UNVERIFIED(docs/ap/englang-facts.md §2-1). 대조 후 바뀌면 RUBRIC_VERSION 을 올린다(새 행으로 재채점, 기존 점수 보존).
export const RUBRIC_VERSION = "englang-v2";
export const ESSAY_SCORE_LABEL = "AI estimated score (internal estimate — not an official AP score)";
export const ESSAY_DISCLAIMER = "Reference feedback only. Practice-test results are a learning diagnostic and are not equivalent to an official AP / College Board score. Score estimates are internal.";

export const RUBRIC_ROWS = [
  { key: "thesis", label: "Thesis", max: 1, guide: "1 if the essay states a defensible position or interpretation that answers the task (not a restatement of the prompt, not a bare summary); otherwise 0." },
  { key: "evidence", label: "Evidence & Commentary", max: 4, guide: "0 = no relevant evidence; 1 = the response mostly summarizes or paraphrases the task or sources, or offers evidence that is general, vague or off-task, with little or no commentary; 2 = the response gives specific, relevant evidence and some explanation of how it supports the claim, but the commentary is simple, generic or inconsistent (naming a source or quoting a line without explaining it stays at 1); 3 = specific, relevant evidence with commentary that explains how it supports the line of reasoning (synthesis: uses at least three sources); 4 = consistently specific evidence with commentary that explains how and why it supports a coherent line of reasoning, with the whole essay developed." },
  { key: "sophistication", label: "Sophistication", max: 1, guide: "1 only if the essay shows a nuanced understanding of the situation or tension (complexity, a counterargument handled well, or a vivid, persuasive style) sustained through the essay, not a single passing sentence; otherwise 0." },
] as const;
export type RubricKey = string;
export const MAX_TOTAL = RUBRIC_ROWS.reduce((s, r) => s + r.max, 0); // 6

// ───────── 루브릭 레지스트리 ─────────
// 영어(englang-v2)는 위 상수 그대로. AP U.S. History(ushistory-v1)는 과제 유형(SAQ/DBQ/LEQ)별 하위 루브릭을 쓴다 — 점수 행은 rubric_version 한 값(ushistory-v1) 아래 저장하고 과제 유형은 scores.taskType 에 남긴다.
// 문구는 ALTON 자체 표현(공개 AP History 루브릭 구조의 의역, 공식 문구·샘플 답안 복제 아님).
export type RubricRow = { key: string; label: string; max: number; guide: string };
export type RubricDef = {
  id: string; taskType?: UshTaskType; subject: string; /** 시스템 프롬프트 첫 두 줄 */ head: [string, string]; extraRules: string[];
  rows: readonly RubricRow[]; total: number; minWords: number; maxWords: number; maxChars: number; maxSourceChars: number;
  scoreLabel: string; perAttemptEnv: string; perAttemptDefault: number; maxInputTokens: number | null;
};
export type UshTaskType = "saq" | "dbq" | "leq";
export const USH_RUBRIC_ID = "ushistory-v1";
export const ENGLANG_RUBRIC_ID = RUBRIC_VERSION;
export const RUBRIC_IDS = [ENGLANG_RUBRIC_ID, USH_RUBRIC_ID] as const;
const sum = (rows: readonly { max: number }[]) => rows.reduce((n, r) => n + r.max, 0);

const ENGLISH_DEF: RubricDef = {
  id: ENGLANG_RUBRIC_ID, subject: "AP English Language and Composition",
  head: ["You are a careful AP English Language and Composition essay rater producing a REFERENCE estimate for a practice test.", "Score the essay with the three-row, six-point rubric below. Be consistent and conservative: when between two scores, choose the lower."],
  extraRules: [], rows: RUBRIC_ROWS, total: MAX_TOTAL, minWords: 50, maxWords: 1500, maxChars: 12_000, maxSourceChars: 14_000,
  scoreLabel: ESSAY_SCORE_LABEL, perAttemptEnv: "AI_ESSAY_PER_ATTEMPT_CAP", perAttemptDefault: 3, maxInputTokens: null,
};

const U_RULES = [
  "Each rubric point is earned independently of the others. Award a point only when the response clearly meets that row's requirement; do not give partial credit inside a point.",
  "Accuracy: award a point only if the historical content used for it is accurate. If the response's historical claims are false, do not credit them. Minor errors that do not detract from the response are tolerated.",
  "Clarity: grammar and spelling errors are not counted unless they obscure meaning.",
  "Use the question-specific scoring notes (if given) to decide what counts for this question.",
];
const ush = (taskType: UshTaskType, head: [string, string], rows: RubricRow[], minWords: number, extra: string[] = []): RubricDef => ({
  id: USH_RUBRIC_ID, taskType, subject: "AP U.S. History", head, extraRules: [...U_RULES, ...extra], rows, total: sum(rows), minWords, maxWords: 1500, maxChars: 12_000, maxSourceChars: 20_000,
  scoreLabel: ESSAY_SCORE_LABEL, perAttemptEnv: "AI_ESSAY_PER_ATTEMPT_CAP_USH", perAttemptDefault: 6, maxInputTokens: 16_000,
});
const partRow = (k: string): RubricRow => ({ key: k, label: `Part (${k.toUpperCase()})`, max: 1, guide: `1 if the response to part (${k.toUpperCase()}) correctly and specifically does what that part asks, as described by the question-specific scoring notes (a vague, restated or off-task answer earns 0); otherwise 0. Score this part independently of the other parts.` });

const USH_DEFS: Record<UshTaskType, RubricDef> = {
  saq: ush("saq", ["You are a careful AP U.S. History rater producing a REFERENCE estimate for a practice test.", "Score the short-answer response below, which answers parts A, B and C of one question, one point per part (three points total). Be consistent and conservative: when between two scores, choose the lower."],
    [partRow("a"), partRow("b"), partRow("c")], 10, ["The response is written as '(A) ... (B) ... (C) ...'; score each lettered part only on the text given for that part. Any stimulus excerpts appear in <source> tags."]),
  dbq: ush("dbq", ["You are a careful AP U.S. History rater producing a REFERENCE estimate for a practice test.", "Score the document-based essay with the six-row, seven-point rubric below. Be consistent and conservative: when between two scores, choose the lower."],
    [
      { key: "thesis", label: "Thesis", max: 1, guide: "1 if the essay states a historically defensible thesis that responds to the prompt and sets out a line of reasoning (not a restatement of the prompt, not a list of topics); otherwise 0." },
      { key: "context", label: "Contextualization", max: 1, guide: "1 if the essay describes a broader historical context relevant to the prompt (events, developments or processes before, during or after the period in question) in more than a phrase or a passing mention; otherwise 0." },
      { key: "docs", label: "Document use", max: 2, guide: "0 = fewer than three documents are described accurately; 1 = accurately describes the content of at least three documents (not just quoting them or naming them); 2 = uses the content of at least four documents to support an argument that answers the prompt." },
      { key: "outside", label: "Outside evidence", max: 1, guide: "1 if the essay brings in at least one additional piece of specific historical evidence beyond the documents that is relevant to the argument and is different from the evidence used for contextualization; otherwise 0." },
      { key: "sourcing", label: "Sourcing", max: 1, guide: "1 if, for at least two documents, the essay explains how or why the document's point of view, purpose, historical situation or audience is relevant to an argument (naming the author is not enough); otherwise 0." },
      { key: "complexity", label: "Complexity", max: 1, guide: "1 if the essay shows a complex understanding of the historical development through sophisticated argumentation (for example nuance, qualification, tension or multiple perspectives) and/or effective use of evidence to support it, sustained through the essay rather than in a single sentence; otherwise 0." },
    ], 50, ["The documents appear in <source> tags (documents 1-7; tables and charts are given as text). Document credit may be given only for documents that actually appear there."]),
  leq: ush("leq", ["You are a careful AP U.S. History rater producing a REFERENCE estimate for a practice test.", "Score the long essay with the four-row, six-point rubric below. Be consistent and conservative: when between two scores, choose the lower."],
    [
      { key: "thesis", label: "Thesis", max: 1, guide: "1 if the essay states a historically defensible thesis that responds to the prompt and sets out a line of reasoning (not a restatement of the prompt, not a list of topics); otherwise 0." },
      { key: "context", label: "Contextualization", max: 1, guide: "1 if the essay describes a broader historical context relevant to the prompt in more than a phrase or a passing mention; otherwise 0." },
      { key: "evidence", label: "Evidence", max: 2, guide: "0 = no specific historical evidence; 1 = identifies specific historical examples (at least two pieces of evidence) relevant to the prompt; 2 = uses at least two pieces of specific, relevant evidence to actually support an argument that answers the prompt." },
      { key: "analysis", label: "Analysis and reasoning", max: 2, guide: "0 = no historical reasoning; 1 = uses historical reasoning (comparison, causation, or continuity and change over time) to frame or structure the argument, even if the reasoning is uneven; 2 = demonstrates a complex understanding of the historical development through sophisticated argumentation and/or effective use of evidence, sustained through the essay." },
    ], 50),
};

/** 루브릭 조회. id 생략 = 영어. ushistory-v1 은 과제 유형이 필요하다. 알 수 없는 조합은 null(호출자가 채점을 건너뛴다). */
export function resolveRubric(id?: string | null, taskType?: string | null): RubricDef | null {
  if (!id || id === ENGLANG_RUBRIC_ID) return ENGLISH_DEF;
  if (id === USH_RUBRIC_ID && (taskType === "saq" || taskType === "dbq" || taskType === "leq")) return USH_DEFS[taskType];
  return null;
}
export const englishRubric = (): RubricDef => ENGLISH_DEF;
