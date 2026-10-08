// 확정된 정답 누설 문항의 오답 재작성(2026-10-08, 로컬 산출물만 — DB 쓰기 없음). 정답·난이도·지문·질문·자료는 그대로 두고 오답 3개(와 해설)만 새로 쓴다.
//   npx tsx scripts/mock-exam-generation/answer-leak-rewrite.ts --dump tmp/rw-leak/dump.json --verdicts tmp/rw-leak/verdicts.json --out tmp/rw-leak/rewrites.json [--only <problemId,...>] [--budget 5.8]
// 검증(모두 통과해야 'ok'): 정답 문구 불변·선택지 고유 · 영어 전용(한글 없음, explanation_en 존재) · 감지기 강한 신호 없음 · distractorGate 통과 ·
//   독립 풀이 2종(sonnet-5 정식 검수, haiku-4-5 단순 풀이)이 모두 지정 정답 · 블라인드 재검사에서 '2회 high 정답'이 아님.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { analyzeLeak, buildIdf, type Idf } from "./answer-leak-detector";
import { blindGuess, blindLeaks } from "./answer-leak-blind";
import { distractorGate } from "../rw-generation/distractor-gate";
import { draftBankGateError, answerKeyError } from "../../lib/problem-text-guards";

const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) for (const line of readFileSync(envPath, "utf-8").split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const arg = (n: string, d?: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const LETTER = ["A", "B", "C", "D"];
const MAX_ATTEMPTS = Number(arg("--attempts", "2"));
export const PRICE: [string, number, number][] = [["claude-haiku", 1, 5], ["claude-sonnet", 3, 15], ["claude-opus", 15, 75], ["claude-fable", 15, 75]];
export const costOf = (model: string, i: number, o: number) => { const p = PRICE.find(([k]) => model.startsWith(k)) ?? PRICE[1]; return (i * p[1] + o * p[2]) / 1e6; };

/** 재작성 프롬프트(영어). 유형별 지시를 한 곳에 둔다 — 생성 프롬프트 가이드(docs/rw-distractor-parallelism.md)와 같은 원칙. */
export function rewritePrompt(i: { skill: string; passage: string; figureAlt: string; question: string; options: string[]; correctIndex: number; feedback: string[] }): string {
  const key = i.options[i.correctIndex];
  const kw = (key.match(/\S+/g) ?? []).length;
  const dataKind = i.skill === "command_of_evidence_quant";
  return `You are an expert digital-SAT Reading & Writing item writer. The item below has an ANSWER LEAK: a student can pick the correct option without reading the ${dataKind ? "table/graph" : "passage"}, because the correct option mirrors the question's wording/subject while the distractors are structurally different or obviously irrelevant.

Rewrite ONLY the three distractors. Keep the passage, question, figure, difficulty and the correct option EXACTLY as is.

Rules for the new distractors (real SAT style):
1. PARALLEL FRAME, DIFFERENT CONTENT: each distractor opens like the correct option (same kind of subject + verb, same clause order, similar length within ~15%, same kind of content${dataKind ? ": a statement that cites specific values from the table/graph" : ": a claim that echoes the key terms of the question"}).
2. SAME SUBJECT POOL: at least one distractor must also be about the entity/topic the question names (so the question's subject does not point to the key). Do not let only the key reuse the question's phrases.
3. WRONG OR IRRELEVANT ON VERIFICATION: ${dataKind ? "each distractor must be checkable against the data and fail: cite REAL values (copied exactly from the table/graph, at least one per distractor) from OTHER rows/columns that do not support the claim, compare the wrong pair, or state a true-but-irrelevant fact. Do not invent numbers that are absent from the data." : "each distractor echoes key words of the claim but is unsupported, contradicted, or off-point against the passage when checked; no distractor may be defensible as correct."}
3b. NOT NEAR-COPIES: the closing/comparison clause must differ among options and from the key (no two options may share more than ~50% of their content words; never copy the key's comparison clause into a distractor). Vary what is compared (different pair, different measure, different direction, different range), do not just swap the entity or a number.
4. Exactly one correct option. Do not hedge words (always/never/only) as the sole giveaway, no 'both A and B', no repeated options.
3c. LENGTH LIMITS (hard gate): the correct option has ${kw} words. Every distractor must have between ${Math.max(3, kw - 6)} and ${kw + 4} words, and at least ONE distractor must have ${Math.max(kw - 1, 3)} or more words (the key must not be the longest option by 2+ words). Longest/shortest option ratio <= 1.8.
3d. VOCABULARY LIMIT (hard gate): the share of shared content words (words of 3+ letters) between any distractor and the key, and between any two distractors, must stay under 55%. Use different nouns/verbs/numbers in the comparison part; repeat only the opening frame.
5. English only in options and explanation_en. 'explanation' is a short Korean explanation (2-4 sentences) of the same reasoning, referencing the data/passage, not letter positions that change.
${i.feedback.length ? `\nPrevious attempt failed these checks, fix them:\n- ${i.feedback.join("\n- ")}\n` : ""}
[Passage]
${i.passage}
${i.figureAlt ? `\n[Figure description]\n${i.figureAlt}\n` : ""}
[Question]
${i.question}

[Current options] (correct = ${LETTER[i.correctIndex]})
${i.options.map((o, k) => `${LETTER[k]}. ${o}`).join("\n")}

Return the full 4-option array in the SAME order with the correct option text unchanged at position ${LETTER[i.correctIndex]} (${JSON.stringify(key)}).`;
}

/** figure 안의 숫자 셀(문자열 아님)과 숫자 문자열 값을 모은다. */
export function figureNumbersOf(figure: unknown): Set<string> {
  const out = new Set<string>();
  const walk = (x: unknown) => {
    if (typeof x === "number") out.add(String(x));
    else if (typeof x === "string" && /^-?\d+(?:\.\d+)?$/.test(x.replace(/,/g, "").trim())) out.add(String(Number(x.replace(/,/g, ""))));
    else if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === "object") Object.values(x as Record<string, unknown>).forEach(walk);
  };
  walk(figure);
  return out;
}
export type CheckReport = { ok: boolean; failures: string[]; notes: string[] };
/** 코드로 판정 가능한 정적 검사(모델 호출 없음). 단위 테스트 대상. */
export function staticChecks(i: { skill: string; question: string; original: string[]; options: string[]; correctIndex: number; explanationEn: string; idf: Idf; /** 정량 근거 유형: 자료(figure)의 숫자 셀 값 문자열 집합 */ figureNumbers?: Set<string> }): CheckReport {
  const failures: string[] = [], notes: string[] = [];
  if (i.options.length !== 4) return { ok: false, failures: ["선택지가 4개가 아님"], notes };
  if (i.options[i.correctIndex] !== i.original[i.correctIndex]) failures.push("정답 선택지 문구가 바뀜");
  const keyErr = answerKeyError(i.options, i.correctIndex); if (keyErr) failures.push(keyErr);
  const hanErr = draftBankGateError({ examSystem: "sat_rw", usageScope: "mock_exam", question: i.question, options: i.options, explanationEn: i.explanationEn }); if (hanErr) failures.push(hanErr);
  const lk = analyzeLeak({ question: i.question, options: i.options, correctIndex: i.correctIndex, skill: i.skill }, i.idf);
  if (lk.strong) failures.push(`감지기 강한 신호: ${lk.reasons.join("; ")}`); else if (lk.flagged) notes.push(`감지기 약한 신호: ${lk.reasons.join("; ")}`);
  if (i.figureNumbers && i.skill === "command_of_evidence_quant") {
    // quant-evidence-check 와 같은 원칙: 오답의 수치는 임의의 숫자가 아니라 자료의 다른 행·열 값을 인용해야 그럴듯하다.
    i.options.forEach((o, k) => {
      if (k === i.correctIndex) return;
      const nums = (o.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/g) ?? []).map((n) => String(Number(n)));
      if (!nums.some((n) => i.figureNumbers!.has(n))) failures.push(`오답 ${LETTER[k]} 의 수치가 자료(표·그래프)의 값이 아님`);
    });
  }
  const g = distractorGate({ options: i.options, correct_letter: LETTER[i.correctIndex], question: i.question });
  if (!g.ok) failures.push(`오답 게이트: ${g.reasons.join("; ")}`);
  return { ok: failures.length === 0, failures, notes };
}

async function main() {
  const [models, core, rev, fa] = await Promise.all([import("../../lib/problem-generation/models"), import("../../lib/problem-generation/core"), import("../../lib/problem-generation/review"), import("../../lib/problem-figures/alt")]);
  const client = core.getAnthropic();
  const ledgerPath = path.resolve("tmp/rw-leak/ledger.json");
  const ledger: any[] = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, "utf-8")) : [];
  const spent = () => ledger.reduce((s, l) => s + l.usd, 0);
  const budget = Number(arg("--budget", "5.8"));
  const track = (stage: string, model: string, u: { input_tokens: number; output_tokens: number }) => { ledger.push({ at: new Date().toISOString(), stage, model, inTok: u.input_tokens, outTok: u.output_tokens, usd: Number(costOf(model, u.input_tokens, u.output_tokens).toFixed(4)) }); writeFileSync(ledgerPath, JSON.stringify(ledger, null, 1)); };
  let stage = "rewrite";
  const orig = client.messages.create.bind(client.messages);
  (client.messages as any).create = async (p: any, o?: any) => { if (spent() > budget) throw new Error(`예산 초과 $${spent().toFixed(2)} > $${budget}`); const m = await (orig as any)(p, o); track(stage, p.model, m.usage); return m; };

  const dump = JSON.parse(readFileSync(arg("--dump", "tmp/rw-leak/dump.json")!, "utf-8"));
  const byVer = new Map<string, any>(dump.versions.map((v: any) => [v.id, v]));
  const pv = new Map<string, any>(dump.problems.map((p: any) => [p.id, p]));
  const verdicts = (JSON.parse(readFileSync(arg("--verdicts", "tmp/rw-leak/verdicts.json")!, "utf-8")) as any[]).filter((v) => v.verdict === "confirmed");
  const only = arg("--only")?.split(",");
  const targets = verdicts.filter((v) => !only || only.includes(v.problemId));
  const outPath = path.resolve(arg("--out", "tmp/rw-leak/rewrites.json")!);
  const results: any[] = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf-8")) : [];
  const idfBySkill = new Map<string, Idf>();
  const idfOf = (sk: string) => idfBySkill.get(sk) ?? (idfBySkill.set(sk, buildIdf(dump.versions.filter((v: any) => Array.isArray(v.options) && pv.get(v.problem_id)?.skill_code === sk).flatMap((v: any) => [v.question ?? "", ...v.options]))), idfBySkill.get(sk)!);

  for (const t of targets) {
    if (results.some((r) => r.oldVersionId === t.versionId && r.ok)) continue;
    const v = byVer.get(t.versionId); const skill = pv.get(v.problem_id).skill_code as string;
    const ci = v.correct_index as number; const original: string[] = v.options;
    let alt = ""; try { alt = v.figure ? fa.figureAlt(v.figure) ?? "" : ""; } catch { alt = JSON.stringify(v.figure); }
    const feedback: string[] = []; let final: any = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !final?.ok; attempt++) {
      stage = "rewrite";
      const msg = await models.createToolMessage(client, { model: models.generationModel(), max_tokens: 1800, tools: [{ name: "submit", description: "Submit rewritten options and explanations", input_schema: { type: "object", properties: { options: { type: "array", items: { type: "string" } }, explanation_en: { type: "string" }, explanation: { type: "string" } }, required: ["options", "explanation_en", "explanation"] } as never }], tool_choice: { type: "tool", name: "submit" }, messages: [{ role: "user", content: rewritePrompt({ skill, passage: v.passage ?? "", figureAlt: alt, question: v.question ?? "", options: original, correctIndex: ci, feedback }) }] } as never);
      const tu = msg.content.find((c: any) => c.type === "tool_use") as any;
      const o = tu.input as { options: string[]; explanation_en: string; explanation: string };
      const options = o.options.map((x) => x.trim()); options[ci] = original[ci];
      const sc = staticChecks({ skill, question: v.question ?? "", original, options, correctIndex: ci, explanationEn: o.explanation_en, idf: idfOf(skill), figureNumbers: figureNumbersOf(v.figure) });
      const rec: any = { problemId: v.problem_id, oldVersionId: v.id, skill, difficulty: v.difficulty, attempt, correctIndex: ci, options, explanation: o.explanation, explanation_en: o.explanation_en, static: sc, ok: false };
      if (!sc.ok) { feedback.length = 0; feedback.push(...sc.failures, `Your last options were: ${JSON.stringify(options)}`); final = rec; continue; }
      // 독립 풀이 2종 + 블라인드 재검사
      stage = "validate";
      const solveArgs = { skillLabel: skill, examSystem: "sat_rw", format: "mc", stimulus: v.passage ?? "", question: v.question ?? "", options, statements: null, figure: v.figure ?? null, correctIndex: ci, answers: null, requestedDifficulty: v.difficulty ?? "medium" };
      process.env.REVIEW_MODEL = "claude-sonnet-5";
      const r1 = await rev.reviewProblemIndependently(solveArgs as never);
      const issues = rev.classifyReviewIssues(r1, v.difficulty ?? "medium", "mc");
      const h = await (client.messages as any).create({ model: "claude-haiku-4-5", max_tokens: 300, messages: [{ role: "user", content: `Solve this SAT question. ${v.passage ?? ""}\n${alt ? `\n[Figure]\n${alt}\n` : ""}\nQuestion: ${v.question}\n${options.map((x, k) => `${LETTER[k]}. ${x}`).join("\n")}\n\nReply JSON only: {"pick":"A|B|C|D"}` }] });
      const htxt = h.content.map((c: any) => c.text ?? "").join("");
      const pick = LETTER.indexOf((htxt.match(/"pick"\s*:\s*"([A-D])"/i)?.[1] ?? htxt.match(/\b([A-D])\b/)?.[1] ?? "").toUpperCase());
      const bl = await blindGuess(client as never, "claude-haiku-4-5", { question: v.question ?? "", options, correctIndex: ci });
      rec.validation = { solver1: { model: "claude-sonnet-5", picked: r1.pickedIndex, agrees: r1.agrees, confidence: r1.confidence, issues: issues.reasons, flags: r1.flags }, solver2: { model: "claude-haiku-4-5", picked: pick }, blind: { hit: bl.hit, high: bl.high } };
      const fails: string[] = [];
      if (!r1.agrees) fails.push(`독립 풀이 1(sonnet-5)이 다른 답(${r1.pickedIndex === null ? "?" : LETTER[r1.pickedIndex]})을 고름`);
      if (issues.reasons.length) fails.push(...issues.reasons);
      if (pick !== ci) fails.push(`독립 풀이 2(haiku)가 다른 답(${pick < 0 ? "?" : LETTER[pick]})을 고름`);
      if (blindLeaks(bl)) fails.push("블라인드 재검사에서 여전히 2회 high 로 정답을 맞힘");
      rec.ok = fails.length === 0; rec.failures = fails; final = rec;
      feedback.length = 0; feedback.push(...fails, `Your last options were: ${JSON.stringify(options)}`);
    }
    const prevIdx = results.findIndex((r) => r.oldVersionId === t.versionId);
    if (prevIdx >= 0) results.splice(prevIdx, 1);
    results.push(final);
    writeFileSync(outPath, JSON.stringify(results, null, 1));
    console.error(`${t.problemId.slice(0, 8)} ${skill} ok=${final.ok} attempt=${final.attempt} ${final.ok ? "" : (final.failures ?? final.static?.failures ?? []).join(" | ").slice(0, 160)} spent=$${spent().toFixed(2)}`);
  }
  console.log(`done: ok ${results.filter((r) => r.ok).length}/${results.length}, total spend $${spent().toFixed(2)}`);
}
if (process.argv[1]?.endsWith("answer-leak-rewrite.ts")) main().catch((e) => { console.error(e); process.exit(1); });
