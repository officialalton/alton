// 라운드 5: RW 지문 150단어 초과 문항 정리 제안(모델 호출 + 기계 검사 + 독립 풀이 검증). DB 접근 없음(저장된 readout 만 읽는다).
//   ANTHROPIC_API_KEY=... npx tsx scripts/audit/r5-trim.ts [--over 160] [--only <problemId,..>] [--cap 6]
// 단계 1(제안): 모델이 "삭제만으로" 줄일 수 있으면 trim, 아니면 keep(이유). 단계 2(검사): lib/audit-fix/trim-check.ts(삭제만·구조·인용 보존·목표 단어 수).
// 단계 3(독립 풀이): 정답을 모르는 모델이 새 지문으로 풀어 정답이 같고 다른 선택지가 방어 가능하지 않은지 본다. 통과한 것만 accepted. 결과 → data/audit/2026-10-14-r5-trim-results.json (비용 포함).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import type Anthropic from "@anthropic-ai/sdk";
import { createToolMessage, reviewModel } from "../../lib/problem-generation/models";
import { checkTrim, wordCount, type TrimDecision } from "../../lib/audit-fix/trim-check";
import type { ProblemReadout } from "../../lib/audit-fix/plan";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const OVER = Number(arg("--over") ?? 160), TARGET = Number(arg("--target") ?? 150), CAP = Number(arg("--cap") ?? 6);
const OUT = "data/audit/2026-10-14-r5-trim-results.json";
const ro = JSON.parse(readFileSync("data/audit/2026-10-14-r5-readout.json", "utf-8")) as { problems: ProblemReadout[] };
const targets = JSON.parse(readFileSync("data/audit/2026-10-14-r5-targets.json", "utf-8")) as { over150Live: { problemId: string; words: number }[] };
const only = arg("--only")?.split(",");
const prev: Record<string, Result> = existsSync(OUT) ? Object.fromEntries((JSON.parse(readFileSync(OUT, "utf-8")) as { results: Result[] }).results.map((r) => [r.problemId, r])) : {};

type Result = { problemId: string; versionId: string; skill: string | null; wordsBefore: number; decision: "trim" | "keep" | "error"; reason: string; newPassage?: string; wordsAfter?: number; mechanical?: { ok: boolean; issues: string[] }; solver?: { pick: string; alsoDefensible: string[]; matchesKey: boolean; note: string }; accepted: boolean; usd: number };
let spent = 0; const tick = (u: Anthropic.Usage) => { const c = (u.input_tokens * 3 + u.output_tokens * 15) / 1e6; spent += c; return c; };

const TRIM_TOOL: Anthropic.Tool = { name: "propose", description: "Propose whether and how to shorten the passage.", input_schema: { type: "object", properties: { decision: { type: "string", enum: ["trim", "keep"] }, reason: { type: "string", description: "One or two sentences: what was removed and why the tested point and key are unaffected, or why no safe cut exists." }, new_passage: { type: "string", description: "Required when decision=trim: the full shortened passage." } }, required: ["decision", "reason"] } };
const SOLVE_TOOL: Anthropic.Tool = { name: "solve", description: "Answer the question.", input_schema: { type: "object", properties: { pick: { type: "string", enum: ["A", "B", "C", "D"] }, also_defensible: { type: "array", items: { type: "string", enum: ["A", "B", "C", "D"] }, description: "Other letters a careful expert could defend as correct (empty if the pick is clearly the only answer)." }, note: { type: "string" } }, required: ["pick", "also_defensible", "note"] } };

const fmtOpts = (o: string[]) => o.map((x, i) => `${"ABCD"[i]}) ${x}`).join("\n");
async function call(client: Anthropic, tool: Anthropic.Tool, system: string, user: string, max = 1500) {
  const msg = await createToolMessage(client, { model: reviewModel(), max_tokens: max, system, messages: [{ role: "user", content: user }], tools: [tool], tool_choice: { type: "tool", name: tool.name } });
  const t = msg.content.find((c) => c.type === "tool_use");
  return { input: (t && t.type === "tool_use" ? t.input : {}) as Record<string, unknown>, usd: tick(msg.usage) };
}

const SYS_TRIM = `You edit Digital SAT Reading & Writing items. Official Digital SAT passages run about 25 to 150 words (cross-text items two short texts of roughly 50 to 75 words each). This passage is too long. Decide whether it can be shortened to at most ${TARGET} words WITHOUT changing what the item tests or its answer.
Rules: (1) Only delete words, clauses, or whole sentences; never add, reword, or reorder words (small punctuation/capitalization repairs at the join are fine). (2) Keep every sentence or phrase the correct answer, the explanation, or the evidence span depends on, and keep every distractor's source detail that the item relies on to be wrong-but-tempting. (3) Keep blanks (______), "Text 1"/"Text 2" labels, and note bullets exactly. (4) Prefer cutting redundant background, second examples, parenthetical detail and adverbial modifiers. (5) If no cut gets the passage to ${TARGET} words or fewer without weakening the item, answer keep and say why. Never trade correctness for brevity.`;
const SYS_SOLVE = `You are an expert Digital SAT Reading & Writing tutor answering a practice item. Read the passage and choose the single best answer. Then list any OTHER options a careful expert could defend as also correct given only the text shown; be strict: an option counts as defensible only if it is supported (or not contradicted) by the passage as well as the pick is.`;

async function one(client: Anthropic, p: ProblemReadout): Promise<Result> {
  const pub = p.pub!; const passage = pub.passage ?? ""; const key = "ABCD"[pub.correct_index ?? 0];
  const base: Result = { problemId: p.problem_id, versionId: pub.id, skill: p.skill_code ?? null, wordsBefore: wordCount(passage), decision: "keep", reason: "", accepted: false, usd: 0 };
  try {
    const u = `Skill: ${p.skill_code}\n\nPASSAGE (${wordCount(passage)} words):\n${passage}\n\nQUESTION: ${pub.question}\n${fmtOpts(pub.options ?? [])}\nCORRECT ANSWER: ${key}\n\nEXPLANATION (shows what the key depends on):\n${pub.explanation_en}\n\nEVIDENCE SPAN (if any): ${pub.evidence_span ?? "(none)"}`;
    const a = await call(client, TRIM_TOOL, SYS_TRIM, u, 2500); base.usd += a.usd;
    const d = a.input as unknown as TrimDecision; base.decision = d.decision === "trim" ? "trim" : "keep"; base.reason = String(d.reason ?? "");
    if (d.decision !== "trim") return base;
    const mech = checkTrim(passage, d, { target: TARGET, refs: [pub.explanation_en, pub.explanation, pub.evidence_span] });
    base.newPassage = d.new_passage; base.wordsAfter = mech.words; base.mechanical = { ok: mech.ok, issues: mech.issues };
    if (!mech.ok) return base;
    const s = await call(client, SOLVE_TOOL, SYS_SOLVE, `PASSAGE:\n${d.new_passage}\n\nQUESTION: ${pub.question}\n${fmtOpts(pub.options ?? [])}`, 1200); base.usd += s.usd;
    const si = s.input as { pick?: string; also_defensible?: string[]; note?: string };
    base.solver = { pick: String(si.pick), alsoDefensible: si.also_defensible ?? [], matchesKey: si.pick === key, note: String(si.note ?? "") };
    base.accepted = base.solver.matchesKey && base.solver.alsoDefensible.filter((x) => x !== key).length === 0;
    return base;
  } catch (e) { return { ...base, decision: "error", reason: String((e as Error).message).slice(0, 200) }; }
}

(async () => {
  const key = process.env.ANTHROPIC_API_KEY?.trim(); if (!key) throw new Error("ANTHROPIC_API_KEY 가 환경에 없습니다.");
  const { default: AnthropicSDK } = await import("@anthropic-ai/sdk"); const client = new AnthropicSDK({ apiKey: key });
  const wc = new Map(targets.over150Live.map((x) => [x.problemId, x.words]));
  const rows = ro.problems.filter((p) => p.pub && (wc.get(p.problem_id) ?? 0) > OVER && (!only || only.includes(p.problem_id)) && !(p.problem_id in prev));
  console.log(`대상 ${rows.length}건 (이미 처리 ${Object.keys(prev).length})`);
  const results: Result[] = Object.values(prev); let i = 0;
  const worker = async () => { while (i < rows.length) { const p = rows[i++]; if (spent >= CAP) break; const r = await one(client, p); results.push(r); console.log(`${p.problem_id.slice(0, 8)} ${p.skill_code} ${r.wordsBefore}→${r.wordsAfter ?? "-"} ${r.decision} acc=${r.accepted} $${r.usd.toFixed(3)} ${r.mechanical?.issues.join(";") ?? ""}`); } };
  await Promise.all([worker(), worker(), worker(), worker()]);
  writeFileSync(OUT, JSON.stringify({ model: reviewModel(), over: OVER, target: TARGET, spentUsd: Number((Object.values(prev).reduce((n, r) => n + r.usd, 0) + spent).toFixed(4)), results }, null, 1) + "\n");
  const t = (f: (r: Result) => boolean) => results.filter(f).length;
  console.log(`accepted ${t((r) => r.accepted)} / trim-proposed ${t((r) => r.decision === "trim")} / keep ${t((r) => r.decision === "keep")} / error ${t((r) => r.decision === "error")}; 이번 실행 $${spent.toFixed(3)}`);
})();
