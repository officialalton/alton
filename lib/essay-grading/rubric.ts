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

// ── AP English Literature and Composition 루브릭(2026-10-14, 새 루브릭 id "englit") ──────────────────────────────────────────────────────
// 공개 구조는 Language 와 같다(논지 0–1 · 증거와 해설 0–4 · 정교함 0–1, 합 6 — CED V.1 Scoring Guidelines p.153–161). 안내 문구는 문학 분석(시·산문·문학 논증)에 맞춘 ALTON 자체 표현(공식 문구 복제 아님). Language 루브릭(위)은 건드리지 않는다.
// 공식 SG 직접 대조 결과 문구가 달라지면 RUBRIC_VERSION_ENGLIT 을 올린다(새 행으로 재채점, 기존 점수 보존).
export type RubricId = "englang" | "englit";
export const RUBRIC_VERSION_ENGLIT = "englit-v1";
export const RUBRIC_ROWS_ENGLIT = [
  { key: "thesis", label: "Thesis", max: 1, guide: "1 if the essay states a defensible interpretation that answers the prompt (of the poem, the passage, or the chosen work as a whole); 0 if it only restates the prompt, summarizes or describes the text, makes a general comment that does not respond to the prompt, or offers no claim that needs defending." },
  { key: "evidence", label: "Evidence & Commentary", max: 4, guide: "0 = restates the thesis or prompt, repeats given information, or is irrelevant; 1 = evidence is mostly general and the essay summarizes or paraphrases without explaining how the evidence supports an argument; 2 = some specific, relevant evidence mixed with generalities, with explanation of how some evidence relates to the argument but no established (or a faulty) line of reasoning; 3 = specific evidence for the claims in a line of reasoning, with commentary explaining how some evidence supports it, including how at least one literary element or technique contributes to meaning; 4 = specific evidence for every claim, commentary that consistently explains how the evidence supports the line of reasoning, and explanation of how multiple literary elements or techniques contribute to meaning. Naming a device or quoting a line without explaining its effect stays at 1-2. For the literary argument question the evidence must come accurately from the chosen work and the commentary must connect the named concept to an interpretation of the whole work, not retell the plot. Errors that interfere with communication prevent a 4." },
  { key: "sophistication", label: "Sophistication", max: 1, guide: "1 only if the essay shows sophistication of thought or a complex literary argument sustained through the essay: it explores tensions or complexities in the text, situates the interpretation in a broader context, accounts for alternative interpretations, or uses a consistently vivid and persuasive style. A single passing sentence, sweeping generalizations about humanity, merely hinting at other readings, or ornate language that does not advance the argument do not earn it; otherwise 0." },
] as const;
export const RUBRIC_SUBJECT_LABEL: Record<RubricId, string> = { englang: "AP English Language and Composition", englit: "AP English Literature and Composition" };
export const rubricIdForSubject = (subject: string | null | undefined): RubricId | null => (subject === "ap_english_language" ? "englang" : subject === "ap_english_literature" ? "englit" : null);
export const rubricVersionFor = (id: RubricId | undefined): string => (id === "englit" ? RUBRIC_VERSION_ENGLIT : RUBRIC_VERSION);
export const rubricRowsFor = (id: RubricId | undefined) => (id === "englit" ? RUBRIC_ROWS_ENGLIT : RUBRIC_ROWS);
