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
export type RubricKey = (typeof RUBRIC_ROWS)[number]["key"];
export const MAX_TOTAL = RUBRIC_ROWS.reduce((s, r) => s + r.max, 0); // 6
