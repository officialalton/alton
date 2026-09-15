// Reading & Writing 구조화 자료 블록(2026-09-14 제품 오너 지시) — 표준 렌더링 엔진의 RW 쪽.
//
// AI 는 지문을 글로만 내고, ALTON 이 그 글을 **블록**으로 해석해 조판하고 검증한다. 새 유형은 없다 — 기존 11개 유형이
// 실제 시험처럼 보이도록 다음 구조를 인식·검증한다.
//   * Text 1 / Text 2       — 'Text 1' / 'Text 2' 제목 줄로 나눈 두 지문(Cross-Text Connections 전용)
//   * 메모 목록 + 목표       — "…the following notes:" 소개 줄 + '- ' 항목 + "The student wants to …" 문장(Rhetorical Synthesis)
//   * 빈칸(______)·밑줄(__문장__) — 문항이 가리키는 대상은 **정확히 하나**여야 하고 질문이 그것을 가리켜야 한다
//   * 질문                    — 마지막 단락(물음표로 끝나거나 SAT 문항 말투로 시작)
//   * 정량 근거(표·그래프)   — 마크다운 표가 아니라 figure(type:'data') 표준 렌더러
// `passage` 컬럼은 그대로 둔다(레거시 문제는 읽기만 하면 된다). 구조는 저장할 때 해석·검증되어 render_check 에 실리고,
// 통과하지 못하면 공개 게이트가 막는다. 세부 기술 코드가 없는 옛 문제는 의미를 확정할 수 없으므로 검사하지 않는다.
import type { FigureIssue } from "./problem-figures/templates/_layout";
import { splitLearningBlocks, splitLearningContent, type ContentBlock } from "./render-learning-content";
import { SKILL_CODES } from "./problem-taxonomy";

export type RwBlock =
  | { kind: "text"; title: string; body: string }
  | { kind: "notes"; intro: string; items: string[] }
  | { kind: "paragraph"; text: string }
  | { kind: "table"; header: string[]; rows: string[][] }
  | { kind: "list"; items: string[] }
  | { kind: "question"; text: string };

export type RwStimulus = {
  blocks: RwBlock[];
  /** Text 제목들(순서대로, 예: ["Text 1", "Text 2"]). */
  texts: string[];
  notes: { intro: string; items: string[] } | null;
  question: string | null;
  /** ______ 빈칸 수(질문·선택지 제외, 본문만). */
  blanks: number;
  /** __밑줄__ 수(본문만). */
  underlines: number;
  hasTable: boolean;
  /** RW 구조가 하나라도 인식됐는가(Text/메모/빈칸/밑줄, 또는 본문+질문 분리). */
  structured: boolean;
};

const TEXT_HEADING = /^\s*(?:\*\*|__)?\s*Text\s+([12])\s*(?:\*\*|__)?\s*:?\s*$/i;
const NOTES_INTRO = /\bnotes\s*:?\s*$/i;
const LIST_LINE = /^\s*[-•]\s+/;
const QUESTION_START = /^(Which|What|According to|Based on|As used|The student wants|Why|How|In the (?:text|passage)|The (?:author|text|passage|writer|main|primary)|Text [12])/;

/** ______ 빈칸 수 — 렌더러와 같은 토큰 분해(왼쪽부터)로 세어 밑줄 토큰(__문장__)과 헷갈리지 않는다. */
export function countBlanks(text: string): number {
  return splitLearningContent(text).filter((p) => p.kind === "blank").length;
}
export function countUnderlines(text: string): number {
  return splitLearningContent(text).filter((p) => p.kind === "underline").length;
}

function chunks(source: string): string[][] {
  // 빈 줄로 나눈 단락. 단락 안에서도 Text 제목 줄과 목록 시작은 경계다.
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const out: string[][] = [];
  let cur: string[] = [];
  const flush = () => { if (cur.length) out.push(cur); cur = []; };
  for (const line of lines) {
    if (line.trim() === "") { flush(); continue; }
    if (TEXT_HEADING.test(line)) { flush(); out.push([line]); continue; }
    const isList = LIST_LINE.test(line);
    if (cur.length && isList !== LIST_LINE.test(cur[cur.length - 1])) flush();
    cur.push(line);
  }
  flush();
  return out;
}

const QUESTION_SENTENCE = /(?:^|(?<=[.!?…"”_)])\s+)(Which choice|Which (?:finding|quotation|statement)|What (?:does|is|was|choice)|According to the text|Based on the texts?|As used in the text|The student wants to)\b/g;

/** 단락 끝의 질문 문장을 본문과 나눈다 — 본문이 앞에 붙어 있으면(빈 줄 누락) 마지막 질문 문장부터 질문. */
function splitTrailingQuestion(text: string): { body: string | null; question: string } {
  // 첫 질문 문장부터 질문이다 — Rhetorical Synthesis 처럼 "The student wants to … Which choice …?" 두 문장이 한 질문이다.
  QUESTION_SENTENCE.lastIndex = 0;
  const m = QUESTION_SENTENCE.exec(text);
  const idx = m ? m.index + m[0].length - m[1].length : -1;
  if (idx <= 0) return { body: null, question: text };
  return { body: text.slice(0, idx).trim() || null, question: text.slice(idx).trim() };
}

export function isQuestionParagraph(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/\?\s*$/.test(t)) return true;
  return QUESTION_START.test(t) && /\?/.test(t);
}

export function parseRwStimulus(passage: string): RwStimulus {
  const cs = chunks(passage ?? "");
  const blocks: RwBlock[] = [];
  const texts: string[] = [];
  let notes: RwStimulus["notes"] = null;
  let question: string | null = null;
  let hasTable = false;

  // 질문: 마지막 단락이 질문 모양이면 뗀다(Text 2 뒤에 오더라도 지문 본문이 아니다).
  // AI 가 본문과 질문 사이에 빈 줄을 빼먹으면 마지막 단락 안에서 SAT 문항 말투로 시작하는 마지막 문장부터 질문으로 나눈다.
  const last = cs[cs.length - 1];
  if (last && !TEXT_HEADING.test(last[0]) && !LIST_LINE.test(last[0])) {
    const text = last.join("\n").trim();
    if (isQuestionParagraph(text)) {
      const split = splitTrailingQuestion(text);
      question = split.question;
      cs.pop();
      if (split.body) cs.push(split.body.split("\n"));
    } else if (QUESTION_START.test(text) && cs.length >= 2) {
      // 물음표가 빠진 질문 단락("Which choice best describes … as a whole.") — 본문이 따로 있을 때만 질문으로 본다.
      question = text;
      cs.pop();
    }
  }

  let open: { kind: "text"; title: string; body: string } | null = null;
  const pushBody = (chunk: string[]) => {
    const text = chunk.join("\n");
    if (open) { open.body = open.body ? `${open.body}\n\n${text}` : text; return; }
    for (const b of splitLearningBlocks(text) as ContentBlock[]) {
      if (b.kind === "table") { hasTable = true; blocks.push(b); }
      else if (b.kind === "list") blocks.push(b);
      else blocks.push({ kind: "paragraph", text: b.text });
    }
  };

  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    const m = TEXT_HEADING.exec(c[0]);
    if (m && c.length === 1) {
      if (open) blocks.push(open);
      open = { kind: "text", title: `Text ${m[1]}`, body: "" };
      texts.push(open.title);
      continue;
    }
    // 메모: 소개 줄("…notes:") 바로 뒤에 오는 목록.
    if (!open && !LIST_LINE.test(c[0]) && NOTES_INTRO.test(c[c.length - 1]) && cs[i + 1] && LIST_LINE.test(cs[i + 1][0])) {
      const items = cs[i + 1].map((l) => l.replace(LIST_LINE, "").trim()).filter(Boolean);
      notes = { intro: c.join("\n").trim(), items };
      blocks.push({ kind: "notes", ...notes });
      i += 1;
      continue;
    }
    pushBody(c);
  }
  if (open) blocks.push(open);
  if (question) blocks.push({ kind: "question", text: question });

  const bodyText = blocks.filter((b) => b.kind !== "question").map((b) => (b.kind === "text" ? b.body : b.kind === "paragraph" ? b.text : b.kind === "notes" ? b.items.join("\n") : b.kind === "list" ? b.items.join("\n") : "")).join("\n");
  // 표 안 밑줄·빈칸은 세지 않는다.
  const blanks = countBlanks(bodyText);
  const underlines = countUnderlines(bodyText);
  for (const b of blocks) if (b.kind === "text") hasTable = hasTable || /^\s*\|.*\|\s*$/m.test(b.body);
  const structured = texts.length > 0 || notes !== null || blanks > 0 || underlines > 0 || (question !== null && blocks.length >= 2);
  return { blocks, texts, notes, question, blanks, underlines, hasTable, structured };
}

// ---------------------------------------------------------------------------------- 검증

const RW_SKILLS = new Set(SKILL_CODES.filter((s) => s.domain.startsWith("rw_")).map((s) => s.code));
const LEGACY_TO_CODE = new Map(SKILL_CODES.map((s) => [s.legacySkill, s.code]));

/** 세부 기술 코드(또는 옛 rw.* 코드)를 RW 표준 코드로. RW 가 아니면 null. */
export function rwSkillCode(input: string | null | undefined): string | null {
  if (!input) return null;
  const q = input.trim();
  if (RW_SKILLS.has(q)) return q;
  const mapped = LEGACY_TO_CODE.get(q);
  return mapped && RW_SKILLS.has(mapped) ? mapped : null;
}

const BLANK_SKILLS: Record<string, RegExp> = {
  words_in_context: /most logical and precise word or phrase/i,
  inferences: /most logically completes the text/i,
  boundaries: /conforms to the conventions of Standard English/i,
  form_structure_sense: /conforms to the conventions of Standard English/i,
  transitions: /most logical transition/i,
};

export function checkRwStructure(input: { skillCode: string | null | undefined; passage: string; options: string[] | null; figure?: unknown | null }): FigureIssue[] {
  const code = rwSkillCode(input.skillCode);
  if (!code) return [];
  const issues: FigureIssue[] = [];
  const s = parseRwStimulus(input.passage);
  const q = s.question ?? "";
  const opts = (input.options ?? []).map((o) => o.trim()).filter(Boolean);

  if (!s.question) issues.push({ code: "rw_question", message: "질문 문장을 인식하지 못했습니다 — 지문 마지막 단락이 SAT 문항처럼 물음표로 끝나야 합니다(예: \"Which choice …?\")." });
  if (opts.length && opts.length !== 4) issues.push({ code: "rw_options", message: `Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 ${opts.length}개).` });
  if (opts.some((o) => countBlanks(o) > 0)) issues.push({ code: "rw_target", message: "선택지 안에 빈칸(______)이 있습니다 — 빈칸은 지문에만 둡니다." });

  // Text 1 / Text 2
  if (code === "cross_text_connections") {
    if (s.texts.join("|") !== "Text 1|Text 2") issues.push({ code: "rw_texts", message: `Cross-Text Connections 는 'Text 1' 과 'Text 2' 제목 줄로 나눈 두 지문이 순서대로 있어야 합니다(지금: ${s.texts.length ? s.texts.join(", ") : "없음"}).` });
    for (const b of s.blocks) if (b.kind === "text" && b.body.trim().split(/\s+/).length < 20) issues.push({ code: "rw_texts", message: `${b.title} 본문이 너무 짧습니다(20단어 이상).` });
    if (q && !/\b(Text 1|Text 2|both texts|the texts|two texts)\b/i.test(q)) issues.push({ code: "rw_texts", message: "질문이 Text 1/Text 2(또는 'both texts')를 가리켜야 합니다." });
  } else if (s.texts.length) {
    issues.push({ code: "rw_texts", message: "'Text 1'/'Text 2' 두 지문 구조는 Cross-Text Connections 문항에서만 씁니다 — 세부 기술을 확인하세요." });
  }

  // 메모 목록 + 목표
  if (code === "rhetorical_synthesis") {
    if (!s.notes) issues.push({ code: "rw_notes", message: "Rhetorical Synthesis 는 \"…the following notes:\" 소개 줄 뒤에 '- ' 로 시작하는 메모 목록이 있어야 합니다." });
    else if (s.notes.items.length < 3 || s.notes.items.length > 6) issues.push({ code: "rw_notes", message: `메모는 3~6개여야 합니다(지금 ${s.notes.items.length}개).` });
    if (q && !/The student wants to/i.test(q)) issues.push({ code: "rw_notes", message: "질문에 목표 문장 \"The student wants to …\" 이 있어야 합니다." });
    if (q && !/\bnotes\b/i.test(q)) issues.push({ code: "rw_notes", message: "질문이 메모(notes)를 가리켜야 합니다(\"…uses relevant information from the notes…\")." });
  } else if (s.notes) {
    issues.push({ code: "rw_notes", message: "메모 목록 구조는 Rhetorical Synthesis 문항에서만 씁니다 — 세부 기술을 확인하세요." });
  }

  // 빈칸 대상 — 정확히 하나, 질문이 그것을 가리킨다.
  const blankRule = BLANK_SKILLS[code];
  if (blankRule) {
    const quoted = code === "words_in_context" ? q.match(/[“"]([^”"]+)[”"]/) : null;
    if (quoted) {
      // 인용 단어형: 빈칸 없이 지문에 그 단어가 있어야 한다.
      if (s.blanks > 0) issues.push({ code: "rw_target", message: "인용 단어형(As used in the text, …) 문항에는 빈칸을 두지 않습니다." });
      const word = quoted[1].trim();
      const body = s.blocks.filter((b) => b.kind !== "question").map((b) => (b.kind === "paragraph" ? b.text : b.kind === "text" ? b.body : "")).join("\n");
      if (!new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(body)) issues.push({ code: "rw_target", message: `질문이 인용한 단어 “${word}” 가 지문에 없습니다.` });
    } else {
      if (s.blanks !== 1) issues.push({ code: "rw_target", message: `빈칸(______)은 정확히 하나여야 합니다(지금 ${s.blanks}개).` });
      if (q && !blankRule.test(q)) issues.push({ code: "rw_question", message: `질문이 빈칸을 가리키는 표준 문구가 아닙니다 — ${skillQuestionHint(code)}` });
    }
    if (s.underlines > 0) issues.push({ code: "rw_target", message: "빈칸 문항에 밑줄(__…__)이 함께 있습니다 — 대상은 하나만." });
  }

  // 밑줄 대상 — Text Structure and Purpose 의 '밑줄 친 문장' 문항.
  if (code === "text_structure_purpose") {
    const asksUnderlined = /underlined/i.test(q);
    if (asksUnderlined && s.underlines !== 1) issues.push({ code: "rw_target", message: `질문이 밑줄 친 문장을 가리키는데 밑줄(__문장__)이 ${s.underlines}개입니다 — 정확히 하나여야 합니다.` });
    if (!asksUnderlined && s.underlines > 0) issues.push({ code: "rw_target", message: "지문에 밑줄이 있는데 질문이 'underlined' 를 가리키지 않습니다." });
    if (s.blanks > 0) issues.push({ code: "rw_target", message: "Text Structure and Purpose 문항에는 빈칸을 두지 않습니다." });
  } else if (!blankRule && s.underlines > 0) {
    issues.push({ code: "rw_target", message: "밑줄(__문장__)은 Text Structure and Purpose 의 '밑줄 친 문장' 문항에서만 씁니다." });
  }
  if (code === "command_of_evidence_quant" || code === "command_of_evidence_text") {
    // 근거 문항은 "…to complete the statement/example?" 형태로 문장 끝 빈칸 하나가 올 수 있다(실제 SAT). 둘 이상은 안 된다.
    if (s.blanks > 1) issues.push({ code: "rw_target", message: `빈칸(______)은 하나까지입니다(지금 ${s.blanks}개).` });
  } else if (!blankRule && s.blanks > 0 && code !== "text_structure_purpose") {
    issues.push({ code: "rw_target", message: `이 유형(${code})에는 빈칸(______)을 두지 않습니다.` });
  }

  // 정량 근거 — 표·그래프는 figure(type:'data').
  if (code === "command_of_evidence_quant") {
    if (s.hasTable) issues.push({ code: "rw_table", message: "표는 마크다운(| … |)이 아니라 figure(type:'data') 표준 자료로 넣습니다 — 'AI로 표·그래프 데이터 만들기'." });
    const fig = input.figure as { type?: string } | null | undefined;
    if (!fig || typeof fig !== "object") issues.push({ code: "rw_data", message: "Command of Evidence (Quantitative) 는 figure(type:'data') 표·그래프 자료가 있어야 합니다." });
    else if (fig.type !== "data" && fig.type !== "figure_set" && fig.type !== "image") issues.push({ code: "rw_data", message: `정량 근거 자료는 type:'data'(표·그래프)여야 합니다(지금 ${fig.type}).` });
  } else if (s.hasTable && code !== "command_of_evidence_text") {
    issues.push({ code: "rw_table", message: "마크다운 표가 있습니다 — 표·그래프 자료는 figure(type:'data') 로 넣고, 이 유형이 정량 근거 문항이면 세부 기술을 Command of Evidence (Quantitative) 로 두세요." });
  }

  return issues;
}

function skillQuestionHint(code: string): string {
  switch (code) {
    case "words_in_context": return "\"Which choice completes the text with the most logical and precise word or phrase?\"";
    case "inferences": return "\"Which choice most logically completes the text?\"";
    case "transitions": return "\"Which choice completes the text with the most logical transition?\"";
    default: return "\"Which choice completes the text so that it conforms to the conventions of Standard English?\"";
  }
}

/** 관리자 화면 한 줄 요약. */
export function describeRwStructure(s: RwStimulus): string {
  const parts: string[] = [];
  parts.push(s.texts.length ? s.texts.join("·") : "지문 1개");
  if (s.notes) parts.push(`메모 ${s.notes.items.length}`);
  parts.push(`빈칸 ${s.blanks}`);
  parts.push(`밑줄 ${s.underlines}`);
  if (s.hasTable) parts.push("마크다운 표");
  parts.push(s.question ? "질문 인식됨" : "질문 미인식");
  return parts.join(" · ");
}
