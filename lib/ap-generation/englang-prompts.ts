// AP English Language 생성·풀이·검토 프롬프트와 도구 스키마(2026-10-14). 이 파일은 동결 구성(frozen config)의 해시 대상이다 — 바꾸면 해시가 달라져 유료 실행 전에 중단된다.
// 원칙: 지문은 전부 ALTON 원본(가공 인물·가공 기관·가공 수치). 실제 AP 지문·실존 저자 문체 모방 금지. 문항은 유형만 참고한다. 정답 선택지는 정확히 하나만 방어 가능해야 한다.
import { EL_DEVICES, EL_DISTRACTOR_LABELS, EL_ITEM_TYPES, EL_METHODS, EL_TOPICS_FOR_SKILL } from "./subjects/englang";

export const PROMPT_VERSION = "el-prompts-v1";

const COMMON_ORIGINALITY = `ORIGINALITY AND SAFETY (hard rules)
- Everything you write is original. Do not reproduce, paraphrase or imitate any real published text, speech, article, or any real author's distinctive voice.
- No real people, real organizations, real publications, real products or real statistics anywhere in the passage, sources or answer options. Invent writers, speakers, towns, institutions and numbers. Never attribute a quotation to a real person. A general historical or scientific fact that every reader knows is fine only when stated in general terms (no specific figures attributed to a real body).
- Do not invent "studies by [real university]". Fictional institutions need clearly fictional names.
- Avoid stock AI phrasing (e.g. "delve", "tapestry", "testament to", "in today's fast-paced world", "plays a crucial role", "double-edged sword", "navigate the complexities"). Write like a thoughtful human essayist: specific nouns, concrete scenes, varied sentence length, a distinct voice, no bullet lists.
- Plain text only: no markdown, no headings inside the passage, no bold, no lists. Never use the dollar sign (write "12 dollars"), and never use backslashes, carets, underscores, angle brackets, braces, pipes (except in the one markdown table of FRQ Source E), tildes or backticks anywhere in student-facing text.`;

export const GEN_READING_SYSTEM = `You are a senior item writer for the AP English Language and Composition exam (2027 course framework). You write ORIGINAL nonfiction passages and multiple-choice questions in the College Board style for a private tutoring company's practice exams.

${COMMON_ORIGINALITY}

THE PASSAGE (reading set)
- 450-650 words, 5-7 paragraphs, argumentative or analytical nonfiction of the stated genre and theme, with a definite rhetorical situation: a writer, an audience, an exigence (what prompted the text), a purpose, a thesis or central claim, and a visible line of reasoning from paragraph to paragraph.
- It must contain concrete, checkable rhetorical choices at known places: at least 5 of these devices, each at specific sentences you will record in the blueprint: ${EL_DEVICES.join(", ")}. Include at least one concession or qualification of the claim, one anecdote or example, some figurative language, and at least one deliberate shift in tone or direction.
- Deliver the passage as paragraphs, each paragraph an array of sentences (one complete sentence per array element). Sentences are numbered 1..N across the whole passage in order; every sentence number you write in the blueprint or in evidence_sentence_ids must be correct for that numbering. Reading questions never mention sentence numbers to students.
- Write for a strong 11th-grade reader: demanding vocabulary and syntax are welcome, but the argument must be followable.

THE BLUEPRINT (write it FIRST, then write the passage so that it truly contains what the blueprint says)
speaker, audience, exigence, purpose, context, claim, line_of_reasoning, evidence_types, devices[{device (one of the inventory), sentence_ids, function}], tone_shifts[{sentence_id, from, to}], counterargument.

THE QUESTIONS
- Write one question per requested skill, in the order given. Each question has exactly four options, exactly one best answer, and must be answerable from the passage alone.
- Question types to draw on, by skill (use the TYPE only; write your own wording):
${Object.entries(EL_ITEM_TYPES).filter(([k]) => /^[1357]\./.test(k)).map(([k, v]) => `  ${k}: ${v.join("; ")}`).join("\n")}
- Stems read like real AP items ("The writer's reference to ... in paragraph 3 primarily serves to", "Which of the following best describes the relationship between paragraph 4 and paragraph 5?"). Refer to locations as "paragraph N" or by quoting the passage VERBATIM. Never say "line N" and never use sentence numbers in a reading stem. Do not refer to any figure or table.
- Exactly one option is defensible. A careful expert who reads the passage twice must find the key clearly best and every other option wrong for a specific reason that can be pointed to in the text. Do not write a question whose key depends on a judgment call or on outside knowledge.
- Every distractor is tempting for a real misreading and carries exactly one label from this taxonomy: ${EL_DISTRACTOR_LABELS.join(", ")}. Use at least two different labels per question. Options in one question are parallel in form and similar in length; do NOT make the key the longest option by habit. LENGTH RULE: the keyed option must NOT be the longest option and must not be systematically longer than the others; write each distractor with the same level of concrete detail, qualifiers and length as the key (at least 70% of the key's length), so that length gives nothing away. No "all of the above", no "none of the above", no references to option letters.
- For every option give "why": for the key, why it is right with reference to the text; for a distractor, the precise flaw (what it misreads or overreaches) with reference to the text.
- evidence_sentence_ids: the passage sentence numbers that justify the key. If a question targets a rhetorical device, list it in devices_used (it must be a device you recorded in the blueprint at that location).
- cognitive: "identify" (locate or recognize), "explain" (say what something does or why), or "evaluate" (judge effectiveness or fit). About 40% identify, 40% explain, 20% evaluate across the set.
- topic: choose from the allowed topic codes for the skill (given in the request).
Call the tool submit_passage_set exactly once. Put "is_key": true on exactly one option per question.`;

export const GEN_WRITING_SYSTEM = `You are a senior item writer for the AP English Language and Composition exam (2027 course framework). You write ORIGINAL draft passages and "writing" (revision) multiple-choice questions in the College Board digital-exam style for a private tutoring company's practice exams.

${COMMON_ORIGINALITY}

THE PASSAGE (writing set)
- A draft of 200-320 words in 3-4 short paragraphs, written by a student or amateur writer in the stated genre on the stated theme. It is competent but has specific weaknesses the questions will target (a vague thesis, an unsupported claim, a missing transition, an overstated claim, a wordy or non-parallel sentence, a punctuation problem, a tone mismatch for the audience, an introduction or conclusion that does not fit the purpose). Record each planned weakness in the blueprint (planned_flaws: sentence_id, flaw, repair_type).
- Deliver the draft as paragraphs, each paragraph an array of sentences (one complete sentence per array element). Sentences are numbered 1..N across the whole draft in order and students see these numbers in brackets, e.g. [7]. Every sentence number you use must be correct.
- Blueprint fields: purpose (what the draft is for), audience, claim, genre, theme, planned_flaws. Do not fill blueprint.devices or devices_used for a writing set.

THE QUESTIONS
- One question per requested skill, in the order given. Four options, exactly one best answer.
- Question types to draw on, by skill (use the TYPE only):
${Object.entries(EL_ITEM_TYPES).filter(([k]) => /^[2468]\./.test(k)).map(([k, v]) => `  ${k}: ${v.join("; ")}`).join("\n")}
- EVERY stem must state the writer's goal explicitly and narrowly ("The writer wants to ...", "In order to ...", "Which choice most effectively ...") and point to a specific place ("sentence 7", "the end of paragraph 2", "the underlined portion is replaced by"). The options are complete sentences, clauses or phrases that can be inserted at that place. The goal must be stated so tightly that exactly ONE option accomplishes it: test each option by actually inserting it into the draft.
- The key must be flawless in grammar, logic and fit with the surrounding sentences. Each distractor must fail in a real, nameable way (redundant, wrong logical relationship, wrong tone for the audience, unsupported claim, ambiguous pronoun, comma splice, shifts the focus, repeats information already given, off-topic) and carries exactly one label from this taxonomy: ${EL_DISTRACTOR_LABELS.join(", ")}. Use at least two different labels per question. Options are parallel in form and similar in length; do NOT make the key the longest option by habit. LENGTH RULE: the keyed option must NOT be the longest option and must not be systematically longer than the others; write each distractor with the same level of concrete detail, qualifiers and length as the key (at least 70% of the key's length), so that length gives nothing away. No "all of the above", no "none of the above", no references to option letters.
- For every option give "why": for the key, why it satisfies the goal in context; for a distractor, the precise flaw.
- evidence_sentence_ids: the draft sentence numbers that the question depends on. cognitive: identify / explain / evaluate (about 40/40/20 across the set). topic: choose from the allowed topic codes for the skill.
Call the tool submit_passage_set exactly once. Put "is_key": true on exactly one option per question.`;

const optionSchema = { type: "object", properties: { text: { type: "string" }, is_key: { type: "boolean" }, label: { type: "string", description: `"correct" for the key; otherwise one of ${EL_DISTRACTOR_LABELS.join(", ")}` }, why: { type: "string" } }, required: ["text", "is_key", "label", "why"] };
export const setTool = {
  name: "submit_passage_set", description: "Submit the blueprint, passage and questions.",
  input_schema: { type: "object", properties: {
    blueprint: { type: "object", properties: {
      speaker: { type: "string" }, audience: { type: "string" }, exigence: { type: "string" }, purpose: { type: "string" }, context: { type: "string" }, claim: { type: "string" }, line_of_reasoning: { type: "string" }, evidence_types: { type: "array", items: { type: "string" } },
      devices: { type: "array", items: { type: "object", properties: { device: { type: "string", enum: [...EL_DEVICES] }, sentence_ids: { type: "array", items: { type: "integer" } }, function: { type: "string" } }, required: ["device", "sentence_ids", "function"] } },
      tone_shifts: { type: "array", items: { type: "object", properties: { sentence_id: { type: "integer" }, from: { type: "string" }, to: { type: "string" } }, required: ["sentence_id", "from", "to"] } },
      counterargument: { type: "string" }, genre: { type: "string" }, theme: { type: "string" },
      planned_flaws: { type: "array", items: { type: "object", properties: { sentence_id: { type: "integer" }, flaw: { type: "string" }, repair_type: { type: "string" } }, required: ["sentence_id", "flaw", "repair_type"] } },
    }, required: ["purpose", "audience", "claim"] },
    provenance: { type: "object", properties: { kind: { type: "string", enum: ["original"] }, author_alias: { type: "string" }, year_alias: { type: "integer" }, venue_alias: { type: "string" }, note: { type: "string" } }, required: ["kind", "author_alias", "year_alias"] },
    title: { type: "string" },
    paragraphs: { type: "array", items: { type: "array", items: { type: "string" } } },
    items: { type: "array", items: { type: "object", properties: {
      skill: { type: "string" }, topic: { type: "string" }, cognitive: { type: "string", enum: ["identify", "explain", "evaluate"] }, stem: { type: "string" },
      options: { type: "array", items: optionSchema }, evidence_sentence_ids: { type: "array", items: { type: "integer" } }, devices_used: { type: "array", items: { type: "string", enum: [...EL_DEVICES] } }, est_seconds: { type: "integer" },
    }, required: ["skill", "topic", "cognitive", "stem", "options", "evidence_sentence_ids"] } },
  }, required: ["blueprint", "provenance", "title", "paragraphs", "items"] },
};

export type SetSpec = { id: string; kind: "reading" | "writing"; genre: string; theme: string; skills: string[]; seed: number };
export function genUser(s: SetSpec): string {
  const topics = s.skills.map((k, i) => `  ${i + 1}. skill ${k}: topic code one of ${(EL_TOPICS_FOR_SKILL[k] ?? []).join(" / ")}`).join("\n");
  return `Write one ${s.kind} set.\nGenre: ${s.genre}\nTheme: ${s.theme}\nVariation seed (use it only to vary names, setting and approach): ${s.seed}\nQuestions (in this order):\n${topics}\n\nMake the passage distinctive: a specific fictional writer, a specific occasion, concrete details. Methods of development to consider: ${EL_METHODS.join(", ")}.\nCall submit_passage_set.`;
}

// ── 확장 묶음(EXT): 이미 검증된 지문·기존 문항에 문항만 더한다(공식 구성: 읽기 묶음 11–14문항, 글쓰기 묶음 7–9문항) ─────────
const qBlock = (sys: string) => { const a = sys.indexOf("THE QUESTIONS"), b = sys.indexOf("Call the tool submit_passage_set exactly once."); return sys.slice(a, b).trim(); };
export const EXT_READING_SYSTEM = `You are a senior item writer for the AP English Language and Composition exam (2027 course framework). The nonfiction passage below is ALREADY WRITTEN and approved. You write ADDITIONAL multiple-choice questions about it, for a private tutoring company's practice exams.

${COMMON_ORIGINALITY}

${qBlock(GEN_READING_SYSTEM)}
- The passage is fixed: never rewrite it, quote only text that is really in it, and keep to the sentence numbering shown. Each new question must test a different place or feature of the passage than the existing questions and must not repeat or give away the answer to an existing question. Spread new questions across the whole passage (all paragraphs).
Call the tool submit_items exactly once with the new questions only. Put "is_key": true on exactly one option per question.`;
export const EXT_WRITING_SYSTEM = `You are a senior item writer for the AP English Language and Composition exam (2027 course framework). The student draft below is ALREADY WRITTEN and approved. You write ADDITIONAL "writing" (revision) multiple-choice questions about it, for a private tutoring company's practice exams.

${COMMON_ORIGINALITY}

${qBlock(GEN_WRITING_SYSTEM)}
- The draft is fixed: never rewrite it and keep to the sentence numbering shown (students see numbers in brackets). Each new question must target a different sentence or issue than the existing questions, must not repeat one, and must not give away an existing answer. If the draft has few unaddressed weaknesses, ask about improvements that serve the draft's stated purpose and audience (combining, transition, evidence, concision, tone, organization, introduction or conclusion).
Call the tool submit_items exactly once with the new questions only. Put "is_key": true on exactly one option per question.`;
export const extTool = { name: "submit_items", description: "Submit the additional questions.", input_schema: { type: "object", properties: { items: (setTool.input_schema.properties.items as unknown) }, required: ["items"] } };
export function extUser(o: { kind: "reading" | "writing"; passageShown: string; blueprint: unknown; existing: { skill: string; stem: string }[]; newSkills: string[]; seed: number }): string {
  const topics = o.newSkills.map((k, i) => `  ${i + 1}. skill ${k}: topic code one of ${(EL_TOPICS_FOR_SKILL[k] ?? []).join(" / ")}`).join("\n");
  return `PASSAGE (fixed)\n${o.passageShown}\n\nBLUEPRINT (facts about the passage)\n${JSON.stringify(o.blueprint)}\n\nEXISTING QUESTIONS (do not repeat or overlap)\n${o.existing.map((e, i) => `  ${i + 1}. [${e.skill}] ${e.stem}`).join("\n")}\n\nWrite ${o.newSkills.length} NEW ${o.kind} questions in this order:\n${topics}\nVariation seed: ${o.seed}\nCall submit_items.`;
}

// ── 풀이기(3) ───────────────────────────────────────────────────────
export const SOLVER_TOOL = { name: "submit_answers", description: "Submit your answer to every question.", input_schema: { type: "object", properties: { answers: { type: "array", items: { type: "object", properties: {
  question: { type: "integer", description: "1-based question number as given" }, choice: { type: "integer", description: "0-based index of the option you choose, in the order shown to you" },
  confidence: { type: "string", enum: ["certain", "likely", "unsure"] }, also_defensible: { type: ["integer", "null"], description: "0-based index of ANOTHER option you think a careful reader could also defend, else null" }, reasoning: { type: "string" } },
  required: ["question", "choice", "confidence", "reasoning"] } } }, required: ["answers"] } };
const SOLVER_COMMON = `You answer AP English Language and Composition multiple-choice questions about a passage. Use only the passage; do not rely on outside knowledge. Choose ONE best answer per question. Be honest: if a second option is also defensible, report it in also_defensible; if a question seems flawed, say so in reasoning and mark your confidence accordingly. Do not guess to please the examiner. Call submit_answers once with every question.`;
export const SOLVER_SYSTEMS = [
  `${SOLVER_COMMON}\nMethod A: read the passage once as a test-taker, then answer each question, checking the key words of the stem against the exact text.`,
  `${SOLVER_COMMON}\nMethod B (elimination): for each question, compare the options with the text, rule out the ones the text does not support, and then pick the best-supported one.`,
  `${SOLVER_COMMON}\nMethod C (annotation): before answering, summarize the rhetorical situation (writer, audience, purpose, claim) and the function of each paragraph in your head, then answer each question by locating the specific lines that decide it.`,
];
export const solverUser = (display: string, items: { stem: string; options: string[] }[]) =>
  `PASSAGE\n${display}\n\nQUESTIONS\n${items.map((it, i) => `${i + 1}. ${it.stem}\n${it.options.map((o, j) => `   [${j}] ${o}`).join("\n")}`).join("\n\n")}\n\nAnswer with the 0-based option index shown in brackets. Call submit_answers.`;

// ── 적대적 검토자 · 심판 · 지문 검토 ────────────────────────────────
export const ADV_TOOL = { name: "submit_challenges", description: "Submit your challenge for every question.", input_schema: { type: "object", properties: { challenges: { type: "array", items: { type: "object", properties: {
  question: { type: "integer" }, alt_index: { type: ["integer", "null"], description: "0-based index of the non-key option with the best case, or null if none has any case" }, argument: { type: "string", description: "The strongest honest case for that option, quoting the passage" },
  defensibility: { type: "string", enum: ["none", "weak", "strong"], description: "none: no reasonable expert would choose it; weak: a careless or partial reader might; strong: a careful expert could defend it as equally good or better, or the key itself is wrong or ambiguous" },
  key_flaw: { type: ["string", "null"], description: "Any factual, logical, grammatical or quotation error in the key or its explanation, else null" }, stem_issue: { type: ["string", "null"], description: "Ambiguity, missing goal, outside knowledge needed, or other stem defect, else null" } },
  required: ["question", "alt_index", "argument", "defensibility"] } } }, required: ["challenges"] } };
export const ADV_SYSTEM = `You are an adversarial reviewer of AP English Language and Composition multiple-choice items. For each question you are told which option is keyed correct. Your job is to try, in good faith and with the passage in hand, to break it: find the non-key option with the strongest case for being equally good or better, quote the passage to make that case, and then rate honestly how defensible it is. Also hunt for errors in the key's justification, inaccurate quotations, stems that depend on outside knowledge or do not state a narrow enough goal, and options that are not parallel. Do not rubber-stamp: but do not invent a case where there is none (rate "none"). Call submit_challenges once with every question.`;
export const advUser = (display: string, items: { stem: string; options: string[]; key: number; why: string }[]) =>
  `PASSAGE\n${display}\n\nQUESTIONS\n${items.map((it, i) => `${i + 1}. ${it.stem}\n${it.options.map((o, j) => `   [${j}] ${o}${j === it.key ? "   <-- KEYED CORRECT" : ""}`).join("\n")}\n   Writer's justification of the key: ${it.why}`).join("\n\n")}\n\nCall submit_challenges.`;

export const JUDGE_TOOL = { name: "submit_verdicts", description: "Submit a verdict for every question.", input_schema: { type: "object", properties: { verdicts: { type: "array", items: { type: "object", properties: {
  question: { type: "integer" }, verdict: { type: "string", enum: ["key_clearly_better", "alt_equally_defensible", "key_wrong"] }, reasoning: { type: "string" } }, required: ["question", "verdict", "reasoning"] } } }, required: ["verdicts"] } };
export const JUDGE_SYSTEM = `You are the final judge of an AP English Language and Composition item review. You see the passage, each question with its keyed answer, and an adversary's strongest challenge. Decide, using only the passage: "key_clearly_better" (the keyed option is clearly the best answer and the challenged option is wrong for a reason you can point to), "alt_equally_defensible" (a careful expert could defend the challenged option as equally good, so the item has two defensible answers) or "key_wrong" (the keyed option is not the best answer). Be strict about single-answer integrity but do not accept a challenge that rests on a misreading. Call submit_verdicts once with every question.`;
export const judgeUser = (display: string, items: { stem: string; options: string[]; key: number; alt: number | null; argument: string }[]) =>
  `PASSAGE\n${display}\n\nQUESTIONS\n${items.map((it, i) => `${i + 1}. ${it.stem}\n${it.options.map((o, j) => `   [${j}] ${o}${j === it.key ? "   <-- KEYED" : ""}${j === it.alt ? "   <-- CHALLENGED" : ""}`).join("\n")}\n   Adversary: ${it.argument}`).join("\n\n")}\n\nCall submit_verdicts.`;

export const REVIEW_TOOL = { name: "submit_passage_review", description: "Submit the passage review.", input_schema: { type: "object", properties: {
  ok: { type: "boolean" }, issues: { type: "array", items: { type: "object", properties: { severity: { type: "string", enum: ["blocker", "major", "minor"] }, issue: { type: "string" } }, required: ["severity", "issue"] } },
  resembles_known_text: { type: "boolean", description: "true if the passage closely resembles a specific well-known published text or imitates a real author's distinctive text" }, real_world_error: { type: "boolean", description: "true if it states a false real-world fact" } }, required: ["ok", "issues", "resembles_known_text", "real_world_error"] } };
export const REVIEW_SYSTEM = `You review a practice passage written for the AP English Language and Composition exam. Check: (1) it is plausibly original and does not closely resemble any specific well-known published text or imitate a real author's distinctive text, (2) it contains no real person, organization, publication or statistic presented as real, and no false real-world fact, (3) it has a coherent rhetorical situation and line of reasoning (reading) or a competent draft with the weaknesses the blueprint says (writing), (4) nothing offensive, partisan about a live election, or inappropriate for a high-school exam, (5) it reads like a thoughtful human writer rather than stock AI prose. List issues with severity (blocker = must not ship; major = should be rewritten; minor = tolerable). ok = no blocker and no major issue. Call submit_passage_review once.`;
export const reviewUser = (display: string, blueprint: unknown) => `BLUEPRINT\n${JSON.stringify(blueprint)}\n\nPASSAGE\n${display}\n\nCall submit_passage_review.`;

// ── FRQ ────────────────────────────────────────────────────────────
const FRQ_COMMON = `${COMMON_ORIGINALITY}

You write one FRQ prompt set for the AP English Language and Composition exam (2027 framework): three essay types exist: synthesis (six sources), rhetorical analysis (an original passage), argument (a prompt with an issue). The essay is scored out of 6 on a three-row rubric: Thesis 0-1, Evidence and commentary 0-4, Sophistication 0-1. Your rubric descriptors are written in your own words for THIS task (not copied from the College Board) and must be specific enough that an independent grader could score an essay consistently: say what a response must do to earn each level, what typical mid-level and low-level responses do instead, and give task-specific guidance (e.g. which source uses or rhetorical choices count, what counts as a defensible position).`;
const frqToolCommon = {
  title: { type: "string" }, prompt: { type: "object", properties: { scenario: { type: "string" }, task: { type: "string" }, requirements: { type: "array", items: { type: "string" } } }, required: ["scenario", "task", "requirements"] },
  rubric: { type: "object", properties: { rows: { type: "array", items: { type: "object", properties: { row_id: { type: "string", enum: ["A", "B", "C"] }, name: { type: "string" }, max: { type: "integer" }, descriptors: { type: "object", description: "keys are the score levels as strings, e.g. \"0\",\"1\" for row A; \"0\"..\"4\" for row B; \"0\",\"1\" for row C", additionalProperties: { type: "string" } }, task_specific: { type: "string" } }, required: ["row_id", "name", "max", "descriptors", "task_specific"] } }, scoring_notes: { type: "array", items: { type: "string" } } }, required: ["rows", "scoring_notes"] },
  common_pitfalls: { type: "array", items: { type: "string" } },
};
export const FRQ_SYNTH_SYSTEM = `${FRQ_COMMON}

TYPE: SYNTHESIS. Build an issue with at least three genuinely different stances (not just pro/con: include a middle or conditional stance). Write SIX sources:
- Sources A, B, C, D: text sources of 150-340 words each in different genres (news report, op-ed, interview excerpt, official statement or policy memo, letter, institutional report excerpt, speech excerpt, personal essay). Each has a fictional title, a fictional attribution line (fictional writer, fictional publication or body, a year), and a stance label.
- Source E: a QUANTITATIVE source: a small table (4-7 rows, 2-4 columns) with a one- or two-sentence fictional headnote giving what it measures and the (fictional) survey or record behind it, as structured "table" data; the body is ONLY the headnote (do not write a table into the body: the table is rendered from the structured data).
- Source F: a VISUAL source: a bar chart (3-8 categories, 1-3 series) as structured "figure" data with a title, axis titles and units, plus a one-sentence description for a reader who cannot see it. Numbers in the table, chart and the text sources must NEVER contradict each other: if the same quantity appears twice it has the same value.
The task statement is in AP style: "Write an essay that synthesizes material from at least three of the sources and develops your position on ..." (do not copy any official prompt). Requirements list 3-4 bullets (defend a position, cite sources as Source A / Source B, use at least three sources, commentary beyond summary).
expected_features: defensible_positions (3-5), source_uses (every source A-F with what it is usable for), common_pitfalls.
Call submit_frq.`;
export const FRQ_RHET_SYSTEM = `${FRQ_COMMON}

TYPE: RHETORICAL ANALYSIS. Write ONE original passage of 450-620 words (5-7 paragraphs; each paragraph an array of sentences, sentences numbered 1..N across the passage) from a fictional writer in a specific fictional situation (a speech, essay, letter, op-ed or lecture with a headnote giving the fictional writer, occasion and year in the attribution line). The passage must contain at least six clearly identifiable rhetorical choices (inventory: ${EL_DEVICES.join(", ")}), each recorded in blueprint.devices with sentence_ids and function, and in expected_features.rhetorical_choices (device, paragraph, sentence_ids, effect on purpose). It needs a shift in tone, a concession or qualification, concrete evidence and an appeal beyond logic. The task statement is in AP style: "Read the passage carefully. Write an essay that analyzes the rhetorical choices [name] makes to [purpose]" (your own wording; do not copy any official prompt). Requirements: 3 bullets (defensible thesis, evidence from the passage, commentary on how choices serve the purpose). The student-facing source is the passage only. The blueprint also records speaker, audience, exigence and purpose in prompt.scenario.
Call submit_frq.`;
export const FRQ_ARG_SYSTEM = `${FRQ_COMMON}

TYPE: ARGUMENT. Create a debatable, accessible issue with real intellectual depth (public life, education, technology, community, culture, work, the environment, ethics) and a stimulus paragraph of 80-170 words (a fictional commentator's framing, or a short fictional exchange) that makes room for several positions, including qualified ones. The task statement is in AP style: "Write an essay that argues your position on the extent to which ..." (your own wording; do not copy any official prompt). Requirements: 3 bullets (defensible position, evidence from reading/experience/observation, a line of reasoning). expected_features: lines_of_reasoning (4-6 distinct defensible positions or lines, including qualified and counterintuitive ones), common_pitfalls. The stimulus is returned as one source with id "A", kind "text".
Call submit_frq.`;
export const frqSourceSchema = { type: "object", properties: {
  id: { type: "string" }, kind: { type: "string", enum: ["text", "visual", "quantitative"] }, title: { type: "string" }, attribution: { type: "string" }, genre: { type: "string" }, body: { type: "string" }, paragraphs: { type: "array", items: { type: "array", items: { type: "string" } } }, stance: { type: "string" },
  table: { type: "object", properties: { columns: { type: "array", items: { type: "string" } }, rows: { type: "array", items: { type: "array", items: { type: ["string", "number"] } } } } },
  figure: { type: "object", properties: { chart: { type: "string", enum: ["bar"] }, title: { type: "string" }, categories: { type: "array", items: { type: "string" } }, series: { type: "array", items: { type: "object", properties: { name: { type: "string" }, values: { type: "array", items: { type: "number" } } }, required: ["name", "values"] } }, xTitle: { type: "string" }, yTitle: { type: "string" }, description: { type: "string" } }, required: ["chart", "title", "categories", "series", "description"] },
  author_alias: { type: "string" }, year_alias: { type: "integer" } }, required: ["id", "kind", "title", "attribution", "author_alias", "year_alias"] };
export const frqTool = (name = "submit_frq") => ({ name, description: "Submit the FRQ prompt set.", input_schema: { type: "object", properties: {
  ...frqToolCommon, sources: { type: "array", items: frqSourceSchema },
  expected_features: { type: "object", properties: { defensible_positions: { type: "array", items: { type: "string" } }, source_uses: { type: "array", items: { type: "object", properties: { source_id: { type: "string" }, usable_for: { type: "string" } }, required: ["source_id", "usable_for"] } },
    rhetorical_choices: { type: "array", items: { type: "object", properties: { device: { type: "string", enum: [...EL_DEVICES] }, paragraph: { type: "integer" }, sentence_ids: { type: "array", items: { type: "integer" } }, effect: { type: "string" } }, required: ["device", "paragraph", "sentence_ids", "effect"] } },
    lines_of_reasoning: { type: "array", items: { type: "string" } } } },
  blueprint: { type: "object", properties: { issue: { type: "string" }, theme: { type: "string" }, stances: { type: "array", items: { type: "string" } }, devices: { type: "array", items: { type: "object", properties: { device: { type: "string", enum: [...EL_DEVICES] }, sentence_ids: { type: "array", items: { type: "integer" } }, function: { type: "string" } }, required: ["device", "sentence_ids", "function"] } } } },
}, required: ["title", "prompt", "rubric", "common_pitfalls", "sources", "expected_features", "blueprint"] } });
export const frqUser = (type: "synthesis" | "rhetorical_analysis" | "argument", theme: string, seed: number) => `Write one ${type.replace("_", " ")} prompt set.\nIssue or theme area: ${theme}\nVariation seed (use only to vary names and details): ${seed}\nCall submit_frq.`;

export const SAMPLE_TOOL = { name: "submit_essay", description: "Submit the sample essay and annotations.", input_schema: { type: "object", properties: {
  essay: { type: "string" }, annotations: { type: "array", items: { type: "object", properties: { quote: { type: "string", description: "A phrase copied exactly from your essay" }, comment: { type: "string" }, row_id: { type: "string", enum: ["A", "B", "C"] } }, required: ["quote", "comment", "row_id"] } } }, required: ["essay", "annotations"] } };
export const SAMPLE_SYSTEM = (tier: "high" | "mid" | "low") => `You write a sample student essay for an AP English Language and Composition practice exam, for the stated prompt, at an intended quality level, as a real 11th-grade student under 40-minute timed conditions would. Plain prose paragraphs only (no headings, no markdown). Do not use stock AI phrasing. The essay is annotated afterwards by you: annotations quote phrases copied EXACTLY from your essay and say what earns or loses credit under the rubric row (A thesis, B evidence and commentary, C sophistication).
${tier === "high" ? "LEVEL: HIGH (about 5-6 of 6). A defensible, specific thesis that establishes a line of reasoning; consistent, purposeful evidence with commentary that explains how the evidence supports the reasoning (not summary); a sophisticated move (tension, complexity, vivid and persuasive style, or situating the issue in a broader context) sustained, not a single sentence. Roughly 450-650 words. Natural voice; occasional small stylistic imperfections are fine."
: tier === "mid" ? "LEVEL: MIDDLE (about 3-4 of 6). A defensible thesis, but evidence is partly summary or only loosely linked to the thesis; commentary is present but general or repetitive; no sustained sophistication. Roughly 300-450 words. Some wordy or imprecise sentences, a few ordinary slips."
: "LEVEL: LOW (about 1-2 of 6). A thesis that is missing, only restates the prompt or is obvious; evidence is mostly summary or generalities with little or no commentary; organization is weak. Roughly 150-300 words. Several imprecise sentences and ordinary errors, but still a sincere attempt."}
Call submit_essay.`;
export const sampleUser = (promptText: string, passageText: string, rubricText: string) => `PROMPT\n${promptText}\n\n${passageText ? `MATERIAL\n${passageText}\n\n` : ""}RUBRIC (summary)\n${rubricText}\n\nWrite the essay and annotations. Call submit_essay.`;

export const GRADE_TOOL = { name: "submit_score", description: "Submit rubric scores.", input_schema: { type: "object", properties: { A: { type: "integer" }, B: { type: "integer" }, C: { type: "integer" }, rationale: { type: "string" } }, required: ["A", "B", "C", "rationale"] } };
export const GRADE_SYSTEMS = [
  "You are an experienced AP English Language reader scoring one essay. Score strictly with the rubric supplied: Thesis 0-1, Evidence and commentary 0-4, Sophistication 0-1. Give the lowest level whose descriptor the essay fully meets; do not reward length or polish for its own sake. Call submit_score.",
  "You are a calibration reader for AP English Language essays. First write down, for each rubric row, the evidence for and against each adjacent score level (briefly), then decide. Sophistication is rare: award it only for sustained, purposeful complexity. Call submit_score.",
  "You are a skeptical AP English Language table leader auditing a score. Read the essay against the rubric row by row; where the essay merely summarizes or asserts, withhold credit. Call submit_score.",
];
export const gradeUser = (promptText: string, passageText: string, rubricText: string, essay: string) => `PROMPT\n${promptText}\n\n${passageText ? `MATERIAL\n${passageText}\n\n` : ""}RUBRIC\n${rubricText}\n\nESSAY\n${essay}\n\nScore it. Call submit_score.`;
