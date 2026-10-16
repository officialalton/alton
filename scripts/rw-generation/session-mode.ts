// 세션 모드(2026-10-01): 유료 API 대신 서브 에이전트(Opus 생성·Fable 판정·Opus/Fable 정답 검증)가 처리하는 작업 파일 입출력.
//   prepare        배치 계획 한 항목 -> 에이전트 1명이 처리하는 청크(10~25문항) 작업 파일 + 결과 저장 경로
//   ingest         에이전트가 쓴 결과 JSON -> 기존 코드 검증(스키마·선언·잔재·렌더·단어 수·정답 위치·소재 상한·오답 게이트·재진술·유사도) -> 통과분/탈락 사유
//   reviewPrepare  통과분 -> 판정 작업 파일(Fable hard-fit 판정·두 번째 모델 정답 풀이·해설/오답 점검)
//   reviewIngest   판정 결과 집계 -> 채택·탈락·재작성 후보('쉬움' 사유 한정 1회)
//   rewritePrepare 재작성 작업 파일(쉬움 한정 1회 + 단어 수 재요청 1회)
//   모든 단계의 비용은 'session'(API 0)과 'api'(달러)를 구분해 cost-ledger.json 에 기록한다. 이 모듈은 API 를 호출하지 않는다(순수 파일 입출력).
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { checkContent } from "../../lib/problem-content-check";
import { findResidue } from "../../lib/problem-generation/residue";
import { validatePassages, type LiteraryPassage } from "../../lib/rw-passages/schema";
import { DOMAINS } from "../mock-exam-generation/plan";
import { SimIndex, gate as simGate } from "../mock-exam-generation/diversity";
import { loadRecipesAll, type RecipesV3 } from "./recipe-v3";
import { expandBatch, evaluateGenerated, injectedPromptBlock, type CandidateSpec, type Generated } from "./candidate-pipeline";
import { UsageLedger } from "./usage-caps";
import type { PositionCounts, PositionKey, Letter } from "./answer-position";
import type { PlanBatch, LiteraryPlan } from "./batch-plan";
import { QTYPES, appSkillOf } from "./batch-plan";
import { composeProblemText } from "../../lib/problem-question";

export const TASK_SCHEMA = "rw-session-task/v1";
export const RESULT_SCHEMA = "rw-session-result/v1";
export type Mode = "session" | "api";
export type ModelHint = "opus" | "fable" | "sonnet";

// ---------- 파일 레이아웃 ----------
export const dirs = (root: string) => ({
  root,
  tasks: path.join(root, "tasks"),
  results: path.join(root, "results"),
  ingested: path.join(root, "ingested"),
  reports: path.join(root, "reports"),
  manifest: path.join(root, "manifest.json"),
  state: path.join(root, "state.json"),
  sim: path.join(root, "sim-index.jsonl"),
  cost: path.join(root, "cost-ledger.json"),
});
const readJson = <T>(f: string, fallback?: T): T => (existsSync(f) ? (JSON.parse(readFileSync(f, "utf-8")) as T) : (fallback as T));
const writeJson = (f: string, v: unknown) => { mkdirSync(path.dirname(f), { recursive: true }); writeFileSync(f, JSON.stringify(v, null, 1) + "\n"); };

export type ManifestTask = { taskId: string; kind: "generate" | "rewrite" | "review"; role?: ReviewRole; batchId?: string; path: string; resultPath: string; suggestedModel: ModelHint; items: number; status: "pending" | "ingested" };
export type Manifest = { runId: string; preparedBatches: string[]; tasks: ManifestTask[] };
type State = { ledger: ReturnType<UsageLedger["serialize"]>; positions: Record<PositionKey, PositionCounts>; counters: Record<string, number> };

const loadManifest = (root: string, runId = "run"): Manifest => readJson<Manifest>(dirs(root).manifest, { runId, preparedBatches: [], tasks: [] });
const saveManifest = (root: string, m: Manifest) => writeJson(dirs(root).manifest, m);
const loadState = (root: string): { st: State; ledger: UsageLedger } => {
  const st = readJson<State>(dirs(root).state, { ledger: new UsageLedger().serialize(), positions: {}, counters: {} });
  return { st, ledger: new UsageLedger().restore(st.ledger) };
};
const saveState = (root: string, st: State, ledger: UsageLedger) => writeJson(dirs(root).state, { ...st, ledger: ledger.serialize() });
const nextCounter = (st: State, key: string) => (st.counters[key] = (st.counters[key] ?? 0) + 1);

// ---------- 비용 장부: session(API 0) / api(달러) 구분 ----------
export type CostEntry = { step: string; model: string; mode: Mode; items: number; tasks: number; usd: number; note?: string };
export function recordCost(root: string, e: CostEntry) {
  const f = dirs(root).cost;
  const led = readJson<{ entries: CostEntry[] }>(f, { entries: [] });
  led.entries.push({ ...e, usd: e.mode === "session" ? 0 : e.usd });
  writeJson(f, led);
}
export function summarizeCost(root: string) {
  const led = readJson<{ entries: CostEntry[] }>(dirs(root).cost, { entries: [] });
  const out = { session: { tasks: 0, items: 0, usd: 0, byStep: {} as Record<string, { tasks: number; items: number }> }, api: { calls: 0, items: 0, usd: 0, byStep: {} as Record<string, { items: number; usd: number }> } };
  for (const e of led.entries) {
    if (e.mode === "session") { out.session.tasks += e.tasks; out.session.items += e.items; const b = (out.session.byStep[e.step] ??= { tasks: 0, items: 0 }); b.tasks += e.tasks; b.items += e.items; }
    else { out.api.calls += e.tasks; out.api.items += e.items; out.api.usd = Number((out.api.usd + e.usd).toFixed(4)); const b = (out.api.byStep[e.step] ??= { items: 0, usd: 0 }); b.items += e.items; b.usd = Number((b.usd + e.usd).toFixed(4)); }
  }
  return out;
}

// ---------- 공통 청크·프롬프트 ----------
/** 10~25문항 청크로 균등 분할(총 10 미만이면 한 청크). */
export function chunkEven<T>(items: T[], size = 20): T[][] {
  const s = Math.min(25, Math.max(10, size));
  if (items.length <= s) return items.length ? [items] : [];
  const n = Math.ceil(items.length / s);
  const base = Math.floor(items.length / n), extra = items.length % n;
  const out: T[][] = [];
  let i = 0;
  for (let k = 0; k < n; k++) { const len = base + (k < extra ? 1 : 0); out.push(items.slice(i, i + len)); i += len; }
  return out;
}

const COMMON_RULES = [
  "지문은 전부 새로 쓴 창작이다. 실제 작품의 문장·플롯·고유한 인물 설정을 쓰지 말고, 실존 작가·작품 이름이나 'From … by …' 같은 출처 머리글을 붙이지 않는다(발췌 지문 작업은 제공된 발췌를 한 글자도 바꾸지 않는다).",
  "지문·질문·선택지는 영어만 쓴다. 해설은 두 벌이다: explanation 은 한국어 3~5문장, explanation_en 은 같은 내용의 영어 3~5문장(한글이 한 글자도 없어야 하며 학생에게 설명하는 어조). 글자 참조는 선택지 글자(A~D)로만 한다. 영어 해설이 없거나 한글이 섞이면 탈락한다(오너 확정: 학생 화면은 영어 기본, 한글은 토글).",
  "선택지는 정확히 4개, 정답은 1개이고 정답 위치는 후보별 targetLetter 와 같아야 한다(어기면 코드가 선택지를 재배치하거나 탈락시킨다).",
  "선택지 길이·문체를 비슷하게 맞춘다. 정답이 가장 길거나 구체적이면 탈락한다. 오답 3개는 서로 다른 그럴듯한 오개념에서 나오게 하고 지문 표현을 일부 활용한다.",
  "정답이 지문 마지막 문장을 거의 그대로 바꿔 말한 것이면 탈락한다. 근거를 서로 떨어진 둘 이상의 문장에 둔다.",
  "후보별 names 에 있는 이름만 인물 이름으로 쓴다. 지정되지 않은 이름·'Tobias'·'Odalys'·'Wren' 은 쓰지 않는다. 후보별 openingStyle 을 따르고 첫 단어를 The·You·It·There 로 시작하지 않는다.",
  "지문 단어 수는 후보별 words.min~words.max 안이어야 한다(코드가 센다). 시는 줄바꿈을 \\n 으로 유지한다.",
  "XML 태그·마크다운·내부 메모·플레이스홀더·'As an AI' 류 문장을 출력에 넣지 않는다. 밑줄 표시는 앱 규격대로 두 밑줄 기호 __문장__ 만 쓴다. 출처·작가를 지어내지 않는다.",
  "선언: 모든 항목에 declaration 3개(original, noRealWorkQuoted, noCopyrightedSource)를 true 로 쓴다. 그럴 수 없는 항목은 만들지 말고 candidateId 만 빼라(탈락 처리된다).",
];
const GEN_OUTPUT_SCHEMA = {
  chunkId: "작업 파일의 chunkId 를 그대로",
  model: "당신의 모델 이름(예: opus)",
  items: [{
    candidateId: "후보의 candidateId 를 그대로",
    passage: "영어 지문(문항의 질문은 넣지 않는다)",
    question: "영어 질문 한 문장",
    options: ["선택지 A", "선택지 B", "선택지 C", "선택지 D"],
    correct_letter: "A|B|C|D (targetLetter 와 같게)",
    explanation: "한국어 해설 3~5문장",
    explanation_en: "같은 내용의 영어 해설 3~5문장(한글 없음)",
    tone: ["지문 어조 영어 단어 1~3개"],
    devices: ["쓰인 문학 장치 영어 단어"],
    declaration: { original: true, noRealWorkQuoted: true, noCopyrightedSource: true },
  }],
};

export type TaskCandidate = {
  candidateId: string; route: "excerpt" | "ai_passage"; skill: string; difficulty: "easy" | "medium" | "hard"; questionType: string; genre: string;
  targetLetter: Letter; words: { min: number; max: number }; recipeId: string | null; spec: CandidateSpec; promptBlock: string;
  excerpt?: { text: string; source: Record<string, unknown> };
  previous?: { passage: string; question: string; options: string[]; correct_letter: string; explanation: string; judgeNotes: string[]; reason: "too_easy" | "words" };
};
export type GenTask = { schema: string; kind: "generate" | "rewrite"; runId: string; taskId: string; chunkId: string; batchId: string; attempt: 0 | 1; suggestedModel: ModelHint; resultPath: string; instructions: string; outputSchema: unknown; candidates: TaskCandidate[] };

const QTIP: Record<string, string> = {
  narrator_attitude: "화자·서술자가 대상에 대해 취하는 태도를 묻는다.", main_idea_or_purpose: "지문 전체의 요지나 서술 목적을 묻는다.", character_motivation: "인물이 어떤 행동을 한 이유·동기를 묻는다.",
  tone_or_mood: "지문 전체의 어조나 분위기를 묻는다.", relationship_between_characters: "두 인물의 관계를 단서로 추론하게 한다.", symbolism: "반복·강조된 사물·이미지가 상징하는 바를 추론하게 한다.",
  figurative_language: "비유 표현이 문맥에서 전달하는 의미를 묻는다. 질문은 'As used in the text, the phrase “…” most nearly suggests …' 형식이고 인용한 구절이 지문에 있어야 하며, 지문 본문에는 따옴표(\" “ ”)를 쓰지 않는다(대사는 따옴표 없이 서술).", word_in_context: "지문에 빈칸 ______ 을 정확히 하나 두고 질문은 'Which choice completes the text with the most logical and precise word or phrase?' 로 한다.",
  tone_shift: "글 중간에서 어조가 바뀌는 지점과 의미를 묻는다.", text_structure: "글 전체의 구조(전개 순서·초점의 이동)를 묻는다.", underlined_portion_function: "지문의 한 문장을 __문장__ 처럼 두 밑줄 기호로 감싸 정확히 하나만 밑줄 표시하고, 질문에 'underlined' 를 넣어 그 문장이 글 전체에서 하는 기능을 묻는다.",
};
const DTIP: Record<string, string> = {
  easy: "easy: 단서가 한 문장 안에 비교적 직접 드러나고 오답이 분명히 틀리다.",
  medium: "medium: 단서를 두 군데 이상 연결해야 하고 오답 중 하나 이상이 그럴듯하다.",
  hard: "hard: 태도·동기가 직접 서술되지 않고 행동·대조·반복으로만 드러나며 근거가 떨어진 두 곳 이상에 흩어진다. 표면 해석(그럴듯한 오독)과 정답 해석이 갈린다.",
};

function candidateBlock(c: TaskCandidate): string {
  const head = `### ${c.candidateId} — skill ${c.skill} · 유형 ${c.questionType} · 난이도 ${c.difficulty} · 장르 ${c.genre} · targetLetter ${c.targetLetter}`;
  const tip = `유형 지시: ${QTIP[c.questionType] ?? c.questionType}\n난이도 지시: ${DTIP[c.difficulty]}`;
  if (c.route === "excerpt") return `${head}\n${tip}\n[발췌 지문 — 한 글자도 바꾸지 말고 passage 에 그대로 넣는다]\n${c.excerpt!.text}\n정답 위치: 정답 선택지는 ${c.targetLetter}.`;
  const prev = c.previous
    ? `\n[이전 시도(${c.previous.reason === "too_easy" ? "난이도가 쉽다고 판정됨" : "지문 단어 수 범위를 벗어남"})]\n지문: ${c.previous.passage}\n질문: ${c.previous.question}\n선택지: ${c.previous.options.join(" | ")}\n정답: ${c.previous.correct_letter}\n판정 메모: ${c.previous.judgeNotes.join(" / ") || "-"}\n→ ${c.previous.reason === "too_easy" ? "같은 장면·인물·정답 위치를 유지하되 근거를 더 흩어 놓고 오답을 더 그럴듯하게 고쳐 어렵게 다시 쓴다." : `지문을 ${c.words.min}~${c.words.max}단어로 다시 쓰고 문항 전체를 다시 제출한다.`}`
    : "";
  return `${head}\n${tip}\n${c.promptBlock}${prev}`;
}

function genInstructions(t: Omit<GenTask, "instructions">): string {
  const excerpt = t.candidates.some((c) => c.route === "excerpt");
  return [
    `당신은 디지털 SAT Reading & Writing 문학 지문 문항 출제 위원이다. 아래 ${t.candidates.length}개 후보 각각에 대해 문항 1개를 만들어 JSON 한 파일로 저장한다.`,
    `작업: ${t.kind === "rewrite" ? "재작성(1회)" : "새 문항 생성"} · 청크 ${t.chunkId}`,
    "규칙:", ...COMMON_RULES.map((r, i) => `${i + 1}. ${r}`),
    excerpt ? "발췌 작업: 제공된 발췌를 passage 에 그대로 넣고(공백 정규화만 허용), 질문·선택지·해설만 새로 만든다." : "지문과 문항을 함께 새로 쓴다.",
    `출력: Write 도구로 정확히 이 경로에 JSON 한 파일을 쓴다 → ${t.resultPath}`,
    `출력 JSON 스키마(예시 구조): ${JSON.stringify(GEN_OUTPUT_SCHEMA)}`,
    "허용 값: correct_letter ∈ {A,B,C,D}, options 길이 4, declaration 3개 모두 true. 후보의 candidateId 를 바꾸지 않는다. 항목 순서는 후보 순서를 따른다.",
    "금지: 결과 파일 외의 파일 생성·수정, 다른 명령 실행, 후보 임의 추가·삭제, 이 작업 파일 수정. 끝나면 'done <항목 수>' 한 줄만 답한다.",
    "", "## 후보", ...t.candidates.map(candidateBlock),
  ].join("\n");
}

const DOMAIN_OF = new Map(DOMAINS.flatMap((d) => d.skills.map((s) => [s.code, d.domain] as const)));

// ---------- prepare ----------
export type PrepareOptions = { root: string; runId: string; batch: PlanBatch; recipes?: RecipesV3; chunkSize?: number; excerpts?: { text: string; source: Record<string, unknown> }[]; suggestedModel?: ModelHint };
/** 배치 하나를 청크 작업 파일로 내보낸다. 같은 배치를 두 번 prepare 하면 장부가 이중 집계되므로 거부한다. */
export function prepare(o: PrepareOptions): ManifestTask[] {
  const d = dirs(o.root);
  const manifest = loadManifest(o.root, o.runId);
  if (manifest.preparedBatches.includes(o.batch.batchId)) throw new Error(`이미 prepare 한 배치입니다: ${o.batch.batchId}`);
  const { st, ledger } = loadState(o.root);
  const recipes = o.recipes ?? loadRecipesAll();
  const { specs, positions } = expandBatch(o.batch, { ledger, recipes, priorPositions: st.positions });
  const isExcerpt = o.batch.route === "excerpt";
  if (isExcerpt && (o.excerpts?.length ?? 0) < specs.length) throw new Error(`발췌 지문이 부족합니다: ${o.excerpts?.length ?? 0}/${specs.length}`);
  const cands: TaskCandidate[] = specs.map((s, i) => ({
    candidateId: s.candidateId, route: s.route, skill: s.skill, difficulty: s.difficulty, questionType: s.questionType, genre: s.genre, targetLetter: s.targetLetter, words: s.words, recipeId: s.recipeId, spec: s,
    promptBlock: isExcerpt ? "" : injectedPromptBlock(s, (recipes[s.skill] ?? []).find((r) => r.id === s.recipeId) ?? null),
    ...(isExcerpt ? { excerpt: o.excerpts![i] } : {}),
  }));
  const tasks: ManifestTask[] = [];
  for (const chunk of chunkEven(cands, o.chunkSize ?? 20)) {
    const n = nextCounter(st, `gen-${o.batch.batchId}`);
    const taskId = `gen-${o.batch.batchId}-${String(n).padStart(2, "0")}`;
    const resultPath = path.join(d.results, `${taskId}.result.json`);
    const base = { schema: TASK_SCHEMA, kind: "generate" as const, runId: o.runId, taskId, chunkId: taskId, batchId: o.batch.batchId, attempt: 0 as const, suggestedModel: o.suggestedModel ?? ("opus" as ModelHint), resultPath, outputSchema: GEN_OUTPUT_SCHEMA, candidates: chunk };
    const task: GenTask = { ...base, instructions: genInstructions(base) };
    const file = path.join(d.tasks, `${taskId}.task.json`);
    mkdirSync(d.results, { recursive: true }); // 에이전트가 결과를 바로 쓸 수 있게 폴더를 미리 만든다
    writeJson(file, task);
    tasks.push({ taskId, kind: "generate", batchId: o.batch.batchId, path: file, resultPath, suggestedModel: task.suggestedModel, items: chunk.length, status: "pending" });
  }
  st.positions = positions;
  manifest.preparedBatches.push(o.batch.batchId);
  manifest.tasks.push(...tasks);
  saveManifest(o.root, manifest);
  saveState(o.root, st, ledger);
  return tasks;
}

// ---------- ingest ----------
export type PassedItem = { candidateId: string; task: string; attempt: 0 | 1; spec: CandidateSpec; g: Generated; notes: string[]; tone: string[]; devices: string[]; producerModel: string; excerpt?: TaskCandidate["excerpt"]; wordRetries: number; rewrites: number };
export type Rejected = { candidateId: string; stage: string; reasons: string[] };
export type RetryWords = { candidateId: string; instruction: string; count: number };
export type IngestResult = { taskId: string; passed: PassedItem[]; rejected: Rejected[]; retryWords: RetryWords[]; extraIgnored: string[]; fileProblem?: string };

const normWs = (s: string) => s.replace(/\s+/g, " ").trim();
const HANGUL = /[가-힣]/;

function renderIssues(c: TaskCandidate, g: Generated): string[] {
  const composed = composeProblemText(g.passage, g.question);
  const issues = checkContent({ format: "mc", passage: composed, options: g.options, correctIndex: "ABCD".indexOf(g.correct_letter), explanation: g.explanation, skillCode: appSkillOf(c.questionType, c.skill) }).map((i) => `${i.code}:${i.message.slice(0, 80)}`);
  const res = findResidue({ stimulus: g.passage.replace(/<\/?u>/g, "").replace(/__/g, ""), question: g.question, options: g.options, explanation: g.explanation });
  return [...issues, ...res.map((r) => `residue:${r.field}:${r.match}`)];
}

type RawItem = Partial<Generated> & { explanation_en?: string; candidateId?: string; tone?: string[]; devices?: string[]; declaration?: Record<string, unknown> };

/** 에이전트 결과 파일 하나를 검증한다. 탈락 사유는 stage 와 사유 문자열로 기록한다. */
export function ingest(root: string, taskId: string, opts: { recordMode?: Mode } = {}): IngestResult {
  const d = dirs(root);
  const manifest = loadManifest(root);
  const mt = manifest.tasks.find((t) => t.taskId === taskId);
  if (!mt || (mt.kind !== "generate" && mt.kind !== "rewrite")) throw new Error(`생성·재작성 작업이 아닙니다: ${taskId}`);
  if (mt.status === "ingested") throw new Error(`이미 ingest 했습니다: ${taskId}`);
  const task = readJson<GenTask>(mt.path);
  const out: IngestResult = { taskId, passed: [], rejected: [], retryWords: [], extraIgnored: [] };
  if (!existsSync(mt.resultPath)) { out.fileProblem = "결과 파일 없음"; return out; }
  let raw: { chunkId?: string; model?: string; items?: RawItem[] };
  try { raw = JSON.parse(readFileSync(mt.resultPath, "utf-8")); } catch { out.fileProblem = "결과 파일 JSON 파싱 실패"; task.candidates.forEach((c) => out.rejected.push({ candidateId: c.candidateId, stage: "format", reasons: [out.fileProblem!] })); return finishIngest(root, manifest, mt, out, task, "unknown", opts); }
  if (raw.chunkId !== task.chunkId) out.fileProblem = `chunkId 불일치(${raw.chunkId} ≠ ${task.chunkId})`;
  const byId = new Map<string, RawItem>();
  for (const it of raw.items ?? []) { if (it.candidateId && task.candidates.some((c) => c.candidateId === it.candidateId)) { if (!byId.has(it.candidateId)) byId.set(it.candidateId, it); } else out.extraIgnored.push(String(it.candidateId)); }
  const { st, ledger } = loadState(root);
  const sim = new SimIndex(d.sim);
  const model = raw.model ?? task.suggestedModel;
  const today = "2026-10-01";
  // 같은 청크 안 지문 간 유사도·소재 중복(규격 검증기)은 청크 전체에 한 번 돌린다.
  const lit = task.candidates.filter((c) => c.route === "ai_passage" && byId.get(c.candidateId)?.passage).map((c) => ({ c, it: byId.get(c.candidateId)! }));
  const litIssues = new Map<string, string[]>();
  if (lit.length) {
    const recs: LiteraryPassage[] = lit.map(({ c, it }) => ({
      id: c.candidateId.toLowerCase(), batchId: c.spec.batchId, origin: "original_ai", producer: { model, session: "agent", date: today }, genre: c.genre as LiteraryPassage["genre"], styleEra: c.spec.seed.styleEra, pov: c.spec.seed.pov,
      topicSeed: c.spec.seed.topicSeed, text: String(it.passage), features: { tone: (it.tone?.length ? it.tone : ["unspecified"]) as string[], devices: it.devices ?? [], inferenceTargets: [c.questionType as never] }, intendedDifficulty: c.difficulty,
      declaration: { original: true, noRealWorkQuoted: true, noCopyrightedSource: true },
    }));
    // 단어 수는 규격 범위(60~220)보다 좁은 레시피 범위로 재요청 1회 규칙이 따로 판정하므로 여기서는 제외한다.
    for (const is of validatePassages(recs).issues.filter((x) => !(x.field === "text" && x.message.startsWith("단어 수")))) (litIssues.get(is.id) ?? litIssues.set(is.id, []).get(is.id)!).push(`${is.field}:${is.message}`);
  }
  for (const c of task.candidates) {
    const it = byId.get(c.candidateId);
    const rej = (stage: string, ...reasons: string[]) => out.rejected.push({ candidateId: c.candidateId, stage, reasons });
    if (!it) { rej("missing", "결과 파일에 항목 없음"); continue; }
    const g: Generated = { passage: String(it.passage ?? ""), question: String(it.question ?? ""), options: Array.isArray(it.options) ? it.options.map(String) : [], correct_letter: String(it.correct_letter ?? ""), explanation: String(it.explanation ?? ""), explanationEn: String(it.explanation_en ?? "").trim() };
    if (!g.passage || !g.question || g.options.length !== 4 || !/^[ABCD]$/.test(g.correct_letter) || !g.explanation.trim()) { rej("format", "지문·질문·선택지 4개·정답 글자·해설 필수"); continue; }
    if (!g.explanationEn || HANGUL.test(g.explanationEn)) { rej("format", "영어 해설(explanation_en) 필수이며 한글이 없어야 함"); continue; }
    const dcl = it.declaration as Record<string, unknown> | undefined;
    if (!dcl || dcl.original !== true || dcl.noRealWorkQuoted !== true || dcl.noCopyrightedSource !== true) { rej("declaration", "선언 3개가 모두 true 가 아님"); continue; }
    if (HANGUL.test(g.passage) || HANGUL.test(g.question) || g.options.some((o) => HANGUL.test(o))) { rej("format", "지문·질문·선택지에 한글 포함"); continue; }
    if (c.route === "excerpt" && normWs(g.passage) !== normWs(c.excerpt!.text)) { rej("format", "발췌 지문이 제공된 원문과 다름"); continue; }
    const rend = renderIssues(c, g);
    if (rend.length) { rej(rend.some((x) => x.startsWith("residue")) ? "residue" : "render", ...rend.slice(0, 4)); continue; }
    const ps = litIssues.get(c.candidateId.toLowerCase());
    if (ps?.length) { rej("passage_schema", ...ps.slice(0, 3)); continue; }
    const wordAttempt = task.attempt; // 재요청 작업이면 이미 한 번 재요청했다
    const v = evaluateGenerated(c.spec, g, { ledger, wordAttempt, excerpt: c.route === "excerpt" });
    if (v.action === "retry_words") { out.retryWords.push({ candidateId: c.candidateId, instruction: v.instruction, count: v.count }); continue; }
    if (v.action === "reject") { rej(v.stage, ...v.reasons); continue; }
    const text = SimIndex.textOf({ stimulus: v.g.passage, question: v.g.question, options: v.g.options });
    const own = c.candidateId;
    const tmp = new SimIndex(); tmp.entries = sim.entries.filter((e) => !e.id.startsWith(`${own}#`) && e.id !== own);
    const sg = simGate(tmp, c.skill, text);
    if (sg) { rej("similarity", sg); continue; }
    sim.add(`${own}#${task.attempt}`, c.skill, text);
    out.passed.push({ candidateId: c.candidateId, task: taskId, attempt: task.attempt, spec: c.spec, g: v.g, notes: v.notes, tone: it.tone ?? [], devices: it.devices ?? [], producerModel: model, excerpt: c.excerpt, wordRetries: c.previous?.reason === "words" ? 1 : 0, rewrites: c.previous?.reason === "too_easy" ? 1 : 0 });
  }
  saveState(root, st, ledger);
  return finishIngest(root, manifest, mt, out, task, model, opts);
}
function finishIngest(root: string, manifest: Manifest, mt: ManifestTask, out: IngestResult, task: GenTask, model: string, opts: { recordMode?: Mode }) {
  writeJson(path.join(dirs(root).ingested, `${mt.taskId}.json`), out);
  mt.status = "ingested";
  saveManifest(root, manifest);
  recordCost(root, { step: task.kind === "rewrite" ? "rewrite" : "generate", model, mode: opts.recordMode ?? "session", items: task.candidates.length, tasks: 1, usd: 0 });
  return out;
}

export const loadIngested = (root: string): IngestResult[] => {
  const d = dirs(root).ingested;
  return existsSync(d) ? readdirSync(d).filter((f) => f.endsWith(".json")).sort().map((f) => readJson<IngestResult>(path.join(d, f))) : [];
};

// ---------- review(판정) ----------
export type ReviewRole = "fable_judge" | "second_solver" | "explanation_audit";
const ROLE_MODEL: Record<ReviewRole, ModelHint> = { fable_judge: "fable", second_solver: "opus", explanation_audit: "sonnet" };
const ROLE_SCHEMA: Record<ReviewRole, unknown> = {
  fable_judge: { chunkId: "청크 ID", model: "fable", items: [{ candidateId: "id", picked_letter: "A|B|C|D", other_defensible: "정답 외 방어 가능한 선택지가 있으면 true", est_difficulty: "easy|medium|hard (실제 체감, 요청 난이도에 맞추지 말 것)", hard_fit: "실제 SAT hard 수준의 사고 단계가 필요하면 true(지문 길이·난어만이면 false)", plausible_distractors: "오답 3개가 모두 그럴듯하고 서로 다른 오개념에서 나왔으면 true", length_balanced: "네 선택지 길이·구체성이 비슷해 정답이 형식으로 드러나지 않으면 true", multi_answer_risk: "복수 정답 위험이 있으면 true", issues: "한 줄 메모" }] },
  second_solver: { chunkId: "청크 ID", model: "opus|fable", items: [{ candidateId: "id", picked_letter: "A|B|C|D", other_defensible: "boolean", confidence: "high|medium|low", note: "풀이 한 줄" }] },
  explanation_audit: { chunkId: "청크 ID", model: "sonnet", items: [{ candidateId: "id", answer_correct: "표시된 정답이 정말 정답이면 true", explanation_consistent: "해설이 정답·오답 판단과 일치하고 글자 참조가 맞으면 true", explanation_factual: "해설에 사실 오류가 없으면 true", issues: "한 줄 메모" }] },
};
const ROLE_INTRO: Record<ReviewRole, string> = {
  fable_judge: "당신은 디지털 SAT 독립 채점자다. 정답 표시가 없다. 먼저 문항을 직접 풀고(picked_letter), 이어서 난이도·hard 적합·오답 품질을 판정한다. 요청 난이도에 맞추려 하지 말고 실제로 느끼는 대로 답한다.",
  second_solver: "당신은 디지털 SAT 독립 채점자(두 번째 풀이자)다. 정답 표시가 없다. 직접 풀고 정답 외에 방어 가능한 선택지가 있는지 판정한다. 다른 풀이자의 답은 모른다.",
  explanation_audit: "당신은 문항 감사관이다. 표시된 정답과 해설을 받아, 정답이 맞는지·해설이 일관되고 사실에 맞는지 점검한다(고치지 않고 판정만).",
};
export type ReviewItem = { candidateId: string; attempt: number; skill: string; questionType: string; requestedDifficulty: string; passage: string; question: string; options: string[]; correct_letter?: string; explanation?: string; recipeBeyondMedium?: string };
export type ReviewTask = { schema: string; kind: "review"; role: ReviewRole; runId: string; taskId: string; chunkId: string; suggestedModel: ModelHint; resultPath: string; instructions: string; outputSchema: unknown; items: ReviewItem[] };

/** 아직 판정 작업을 만들지 않은 통과분(passed)을 청크로 나눠 세 역할의 작업 파일로 내보낸다. 블라인드 역할에는 정답·해설을 넣지 않는다. */
export function reviewPrepare(o: { root: string; runId: string; chunkSize?: number; candidateIds?: string[]; recipes?: RecipesV3; models?: Partial<Record<ReviewRole, ModelHint>> }): ManifestTask[] {
  const d = dirs(o.root);
  const manifest = loadManifest(o.root, o.runId);
  const { st, ledger } = loadState(o.root);
  const recipes = o.recipes ?? loadRecipesAll();
  const reviewed = new Set(readJson<{ ids: string[] }>(path.join(d.root, "review-queued.json"), { ids: [] }).ids);
  const latest = latestPassed(o.root);
  const pool = [...latest.values()].filter((p) => !reviewed.has(queueKey(p)) && (!o.candidateIds || o.candidateIds.includes(p.candidateId))).sort((a, b) => a.candidateId.localeCompare(b.candidateId));
  const tasks: ManifestTask[] = [];
  for (const chunk of chunkEven(pool, o.chunkSize ?? 20)) {
    const n = nextCounter(st, "review");
    const items: ReviewItem[] = chunk.map((p) => ({
      candidateId: p.candidateId, attempt: p.attempt, skill: p.spec.skill, questionType: p.spec.questionType, requestedDifficulty: p.spec.difficulty, passage: p.g.passage, question: p.g.question, options: p.g.options,
      recipeBeyondMedium: (recipes[p.spec.skill] ?? []).find((r) => r.id === p.spec.recipeId)?.beyondMedium,
    }));
    for (const role of ["fable_judge", "second_solver", "explanation_audit"] as ReviewRole[]) {
      const taskId = `rev-${role}-${String(n).padStart(3, "0")}`;
      const resultPath = path.join(d.results, `${taskId}.result.json`);
      const roleItems = items.map((it, i) => (role === "explanation_audit" ? { ...it, correct_letter: chunk[i].g.correct_letter, explanation: chunk[i].g.explanation } : it));
      const base = { schema: TASK_SCHEMA, kind: "review" as const, role, runId: o.runId, taskId, chunkId: taskId, suggestedModel: o.models?.[role] ?? ROLE_MODEL[role], resultPath, outputSchema: ROLE_SCHEMA[role], items: roleItems };
      const instructions = [
        ROLE_INTRO[role], `청크 ${taskId} — ${items.length}문항.`,
        `출력: Write 도구로 정확히 이 경로에 JSON 한 파일을 쓴다 → ${resultPath}`, `출력 JSON 스키마(예시 구조): ${JSON.stringify(ROLE_SCHEMA[role])}`,
        "허용 값: picked_letter ∈ {A,B,C,D}, 불리언 필드는 true/false, est_difficulty ∈ {easy,medium,hard}. candidateId 를 바꾸지 않고 모든 항목에 답한다.",
        "금지: 결과 파일 외의 파일 생성·수정, 다른 명령 실행, 문항 수정·재작성. 끝나면 'done <항목 수>' 한 줄만 답한다.", "", "## 문항",
        ...roleItems.map((it) => `### ${it.candidateId} — skill ${it.skill} · 유형 ${it.questionType}${role === "fable_judge" ? ` · 요청 난이도 ${it.requestedDifficulty}${it.recipeBeyondMedium ? ` · hard 기준: ${it.recipeBeyondMedium}` : ""}` : ""}\n[지문]\n${it.passage}\n\n[질문] ${it.question}\n${it.options.map((x, i) => `${"ABCD"[i]}) ${x}`).join("\n")}${role === "explanation_audit" ? `\n\n[표시된 정답] ${it.correct_letter}\n[해설]\n${it.explanation}` : ""}`),
      ].join("\n");
      const task: ReviewTask = { ...base, instructions };
      const file = path.join(d.tasks, `${taskId}.task.json`);
      mkdirSync(d.results, { recursive: true });
      writeJson(file, task);
      tasks.push({ taskId, kind: "review", role, path: file, resultPath, suggestedModel: task.suggestedModel, items: items.length, status: "pending" });
    }
    chunk.forEach((p) => reviewed.add(queueKey(p)));
  }
  writeJson(path.join(d.root, "review-queued.json"), { ids: [...reviewed].sort() });
  manifest.tasks.push(...tasks);
  saveManifest(o.root, manifest);
  saveState(o.root, st, ledger);
  return tasks;
}
const queueKey = (p: PassedItem) => `${p.candidateId}#${p.attempt}`;
/** 후보별 가장 최근 시도(재작성본이 있으면 그것)의 통과분. */
function latestPassed(root: string): Map<string, PassedItem> {
  const m = new Map<string, PassedItem>();
  for (const r of loadIngested(root)) for (const p of r.passed) { const cur = m.get(p.candidateId); if (!cur || p.attempt >= cur.attempt) m.set(p.candidateId, p); }
  return m;
}

export type ReviewResultItem = Record<string, unknown> & { candidateId: string };
const loadRoleResults = (root: string, role: ReviewRole): Map<string, ReviewResultItem> => {
  const m = new Map<string, ReviewResultItem>();
  for (const t of loadManifest(root).tasks.filter((x) => x.kind === "review" && x.role === role)) {
    if (!existsSync(t.resultPath)) continue;
    const attemptOf = new Map((readJson<ReviewTask>(t.path).items).map((i) => [i.candidateId, i.attempt] as const));
    try { for (const it of (JSON.parse(readFileSync(t.resultPath, "utf-8")) as { items?: ReviewResultItem[] }).items ?? []) { const k = `${it.candidateId}#${attemptOf.get(it.candidateId) ?? 0}`; if (it.candidateId && attemptOf.has(it.candidateId) && !m.has(k)) m.set(k, it); } } catch { /* 결과 파일 손상 — 해당 후보는 pending 으로 남는다 */ }
  }
  return m;
};
const RANK = { easy: 0, medium: 1, hard: 2 } as const;
export type Decision = { candidateId: string; status: "adopted" | "rejected" | "pending"; reasons: string[]; tooEasy: boolean; rewriteEligible: boolean; estDifficulty?: string; item: PassedItem };

/**
 * 판정 집계(운영 기준과 동일): Fable 블라인드 정답 일치·단일 정답, 두 번째 풀이자 일치·단일 정답, 해설 감사 통과, 오답 품질(그럴듯함·길이 균형·복수 정답 위험 없음),
 * 난이도(hard = Fable 추정 hard + hard_fit, medium·easy = 추정 난이도가 요청과 일치). 세 역할 중 하나라도 결과가 없으면 pending.
 */
export function reviewIngest(root: string): { decisions: Decision[]; summary: Record<string, number> } {
  const fable = loadRoleResults(root, "fable_judge"), second = loadRoleResults(root, "second_solver"), audit = loadRoleResults(root, "explanation_audit");
  const queued = new Set(readJson<{ ids: string[] }>(path.join(dirs(root).root, "review-queued.json"), { ids: [] }).ids);
  const decisions: Decision[] = [];
  for (const p of [...latestPassed(root).values()].sort((a, b) => a.candidateId.localeCompare(b.candidateId))) {
    if (!queued.has(queueKey(p))) continue;
    const f = fable.get(queueKey(p)), s = second.get(queueKey(p)), a = audit.get(queueKey(p));
    if (!f || !s || !a) { decisions.push({ candidateId: p.candidateId, status: "pending", reasons: [`판정 대기(${[!f && "fable", !s && "second", !a && "audit"].filter(Boolean).join(",")})`], tooEasy: false, rewriteEligible: false, item: p }); continue; }
    const reasons: string[] = [];
    const want = p.g.correct_letter;
    if (f.picked_letter !== want) reasons.push("fable_answer_mismatch");
    if (f.other_defensible === true) reasons.push("fable_multi_defensible");
    if (s.picked_letter !== want) reasons.push("second_answer_mismatch");
    if (s.other_defensible === true) reasons.push("second_multi_defensible");
    if (a.answer_correct !== true) reasons.push("audit_answer_incorrect");
    if (a.explanation_consistent !== true) reasons.push("explanation_inconsistent");
    if (a.explanation_factual === false) reasons.push("explanation_factual_error");
    const answerOk = reasons.length === 0;
    const quality: string[] = [];
    if (f.plausible_distractors !== true) quality.push("distractors_not_plausible");
    if (f.length_balanced !== true) quality.push("options_length_imbalance");
    if (f.multi_answer_risk === true) quality.push("multi_answer_risk");
    const est = String(f.est_difficulty) as keyof typeof RANK;
    const req = p.spec.difficulty;
    const diff: string[] = [];
    let tooEasy = false;
    if (!(est in RANK)) diff.push("difficulty_unreadable");
    else if (req === "hard") { if (est !== "hard") { diff.push(RANK[est] < RANK.hard ? "difficulty_too_easy" : "difficulty_mismatch"); tooEasy = RANK[est] < RANK.hard; } else if (f.hard_fit !== true) diff.push("hard_fit_failed"); }
    else if (est !== req) { diff.push(RANK[est] < RANK[req] ? "difficulty_too_easy" : "difficulty_too_hard"); tooEasy = RANK[est] < RANK[req]; }
    const all = [...reasons, ...quality, ...diff];
    // 재작성은 '쉬움'이 유일한 탈락 사유일 때, 1회에 한해, 지문을 새로 쓸 수 있는 AI 지문 후보(medium·hard)만.
    const onlyTooEasy = answerOkOnly(answerOk, quality, diff, tooEasy);
    decisions.push({ candidateId: p.candidateId, status: all.length ? "rejected" : "adopted", reasons: all, tooEasy, rewriteEligible: onlyTooEasy && p.rewrites === 0 && p.spec.route === "ai_passage" && req !== "easy", estDifficulty: est, item: p });
  }
  const summary: Record<string, number> = { adopted: 0, rejected: 0, pending: 0, rewriteEligible: 0 };
  for (const d of decisions) { summary[d.status]++; if (d.rewriteEligible) summary.rewriteEligible++; }
  return { decisions, summary };
}
const answerOkOnly = (answerOk: boolean, quality: string[], diff: string[], tooEasy: boolean) => answerOk && quality.length === 0 && tooEasy && diff.length === 1 && diff[0] === "difficulty_too_easy";

// ---------- 재작성 루프(쉬움 한정 1회 + 단어 수 재요청 1회) ----------
export function rewritePrepare(o: { root: string; runId: string; chunkSize?: number; recipes?: RecipesV3; suggestedModel?: ModelHint }): ManifestTask[] {
  const d = dirs(o.root);
  const manifest = loadManifest(o.root, o.runId);
  const { st, ledger } = loadState(o.root);
  const recipes = o.recipes ?? loadRecipesAll();
  const taken = new Set(readJson<{ ids: string[] }>(path.join(d.root, "rewrite-queued.json"), { ids: [] }).ids);
  const cands: TaskCandidate[] = [];
  const { decisions } = reviewIngest(o.root);
  for (const dec of decisions.filter((x) => x.rewriteEligible)) {
    const key = `${dec.candidateId}:too_easy`;
    if (taken.has(key)) continue;
    taken.add(key);
    const p = dec.item;
    cands.push(toRewriteCandidate(p, "too_easy", [`Fable 추정 난이도 ${dec.estDifficulty}`, ...(dec.reasons)], recipes));
  }
  for (const r of loadIngested(o.root)) for (const rw of r.retryWords) {
    const key = `${rw.candidateId}:words`;
    if (taken.has(key)) continue;
    const orig = originalGenerated(o.root, r.taskId, rw.candidateId);
    if (!orig) continue;
    taken.add(key);
    cands.push({ ...orig.cand, promptBlock: injectedPromptBlock(orig.cand.spec, (recipes[orig.cand.skill] ?? []).find((x) => x.id === orig.cand.recipeId) ?? null), previous: { ...orig.prev, judgeNotes: [rw.instruction], reason: "words" } });
  }
  const tasks: ManifestTask[] = [];
  for (const chunk of chunkEven(cands.sort((a, b) => a.candidateId.localeCompare(b.candidateId)), o.chunkSize ?? 15)) {
    const n = nextCounter(st, "rewrite");
    const taskId = `rewrite-${String(n).padStart(3, "0")}`;
    const resultPath = path.join(d.results, `${taskId}.result.json`);
    const base = { schema: TASK_SCHEMA, kind: "rewrite" as const, runId: o.runId, taskId, chunkId: taskId, batchId: chunk[0].spec.batchId, attempt: 1 as const, suggestedModel: o.suggestedModel ?? ("opus" as ModelHint), resultPath, outputSchema: GEN_OUTPUT_SCHEMA, candidates: chunk };
    const task: GenTask = { ...base, instructions: genInstructions(base) };
    const file = path.join(d.tasks, `${taskId}.task.json`);
    mkdirSync(d.results, { recursive: true }); // 에이전트가 결과를 바로 쓸 수 있게 폴더를 미리 만든다
    writeJson(file, task);
    tasks.push({ taskId, kind: "rewrite", batchId: task.batchId, path: file, resultPath, suggestedModel: task.suggestedModel, items: chunk.length, status: "pending" });
  }
  writeJson(path.join(d.root, "rewrite-queued.json"), { ids: [...taken].sort() });
  manifest.tasks.push(...tasks);
  saveManifest(o.root, manifest);
  saveState(o.root, st, ledger);
  return tasks;
}
function toRewriteCandidate(p: PassedItem, reason: "too_easy", notes: string[], recipes: RecipesV3): TaskCandidate {
  const s = p.spec;
  return { candidateId: s.candidateId, route: s.route, skill: s.skill, difficulty: s.difficulty, questionType: s.questionType, genre: s.genre, targetLetter: s.targetLetter, words: s.words, recipeId: s.recipeId, spec: s,
    promptBlock: injectedPromptBlock(s, (recipes[s.skill] ?? []).find((r) => r.id === s.recipeId) ?? null),
    previous: { passage: p.g.passage, question: p.g.question, options: p.g.options, correct_letter: p.g.correct_letter, explanation: p.g.explanation, judgeNotes: notes, reason } };
}
/** 단어 수 재요청 대상의 원래 생성물(결과 파일의 해당 항목)을 되살린다. */
function originalGenerated(root: string, taskId: string, candidateId: string): { cand: TaskCandidate; prev: Omit<NonNullable<TaskCandidate["previous"]>, "reason" | "judgeNotes"> } | null {
  const mt = loadManifest(root).tasks.find((t) => t.taskId === taskId);
  if (!mt || !existsSync(mt.resultPath)) return null;
  const task = readJson<GenTask>(mt.path);
  const cand = task.candidates.find((c) => c.candidateId === candidateId);
  const it = (readJson<{ items?: RawItem[] }>(mt.resultPath, { items: [] }).items ?? []).find((x) => x.candidateId === candidateId);
  if (!cand || !it) return null;
  return { cand, prev: { passage: String(it.passage ?? ""), question: String(it.question ?? ""), options: (it.options ?? []).map(String), correct_letter: String(it.correct_letter ?? ""), explanation: String(it.explanation ?? "") } };
}

// ---------- 채택 보고·결과 파일 ----------
/** 채택분을 기존 파이프라인의 adopted 레코드 모양(gid·problem·quality)으로 내보내고 보고서를 쓴다. hard 는 difficultyStatus=provisional_ai. */
export function writeAdoptionReport(root: string, runId: string) {
  const { decisions, summary } = reviewIngest(root);
  const ing = loadIngested(root);
  const rejectedGen = ing.flatMap((r) => r.rejected);
  const adopted = decisions.filter((x) => x.status === "adopted").map((x) => {
    const p = x.item, s = p.spec;
    const stage = QTYPES.find((t) => t.type === s.questionType);
    return {
      gid: `rwlit:${s.candidateId}`, runId, skill: appSkillOf(s.questionType, s.skill), planSkill: s.skill, domain: DOMAIN_OF.get(appSkillOf(s.questionType, s.skill)) ?? null, examSystem: "sat_rw", difficulty: s.difficulty, format: "mc", recipeId: s.recipeId,
      difficultyStatus: s.difficulty === "hard" ? "provisional_ai" : undefined,
      problem: { passage: composeProblemText(p.g.passage, p.g.question), stimulus: p.g.passage, question: p.g.question, options: p.g.options, correctIndex: "ABCD".indexOf(p.g.correct_letter), answers: null, explanation: p.g.explanation, explanationEn: p.g.explanationEn ?? null, figure: null, statements: null },
      quality: { generatedBy: `session:${p.producerModel}`, route: s.route, questionType: s.questionType, weakType: stage?.weak ?? false, genre: s.genre, targetLetter: s.targetLetter, positionEnforced: p.notes.length > 0, seed: s.route === "ai_passage" ? { topicSeed: s.seed.topicSeed, names: s.seed.names, locale: s.seed.locale } : undefined, sourceText: p.excerpt?.source, rewrites: p.rewrites, attempts: p.attempt + 1, estDifficulty: x.estDifficulty },
    };
  });
  const byReason: Record<string, number> = {};
  for (const r of rejectedGen) byReason[`gen:${r.stage}`] = (byReason[`gen:${r.stage}`] ?? 0) + 1;
  for (const x of decisions.filter((d) => d.status === "rejected")) for (const r of x.reasons) byReason[`review:${r}`] = (byReason[`review:${r}`] ?? 0) + 1;
  const rep = {
    runId, generated: loadManifest(root).tasks.filter((t) => t.kind === "generate").reduce((a, t) => a + t.items, 0), passedGenGates: latestPassed(root).size, awaitingReview: [...latestPassed(root).values()].filter((p) => !new Set(readJson<{ ids: string[] }>(path.join(dirs(root).root, "review-queued.json"), { ids: [] }).ids).has(queueKey(p))).length, review: summary, adopted: adopted.length,
    adoptedByDifficulty: Object.fromEntries(["easy", "medium", "hard"].map((k) => [k, adopted.filter((a) => a.difficulty === k).length])),
    rejectedByReason: Object.fromEntries(Object.entries(byReason).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
    rewriteEligible: decisions.filter((d) => d.rewriteEligible).map((d) => d.candidateId), cost: summarizeCost(root),
  };
  writeJson(path.join(dirs(root).reports, "adoption-report.json"), rep);
  writeJson(path.join(dirs(root).reports, "adopted-items.json"), adopted);
  writeJson(path.join(dirs(root).reports, "rejected.json"), { generation: rejectedGen, review: decisions.filter((d) => d.status === "rejected").map((d) => ({ candidateId: d.candidateId, reasons: d.reasons })) });
  return { report: rep, adopted };
}

// ---------- 상태·디스패치 ----------
export function status(root: string) {
  const m = loadManifest(root);
  const dispatch = m.tasks.filter((t) => t.status === "pending" && !existsSync(t.resultPath));
  const ingestable = m.tasks.filter((t) => t.status === "pending" && existsSync(t.resultPath) && t.kind !== "review");
  const reviewResultsReady = m.tasks.filter((t) => t.kind === "review" && existsSync(t.resultPath)).length;
  return { total: m.tasks.length, dispatch, ingestable, reviewResultsReady, reviewTasks: m.tasks.filter((t) => t.kind === "review").length };
}
/** 총괄이 서브 에이전트를 띄울 때 그대로 쓰는 짧은 프롬프트. */
export const dispatchPrompt = (t: ManifestTask) => `작업 파일 ${t.path} 을 끝까지 읽고 그 안의 instructions 를 그대로 수행해라. 결과는 ${t.resultPath} 에 JSON 한 파일로만 저장하고, 끝나면 'done <항목 수>' 한 줄만 답해라.`;
