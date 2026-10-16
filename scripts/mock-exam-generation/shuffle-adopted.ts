// 채택 hard 정답 위치 균등화 (2026-10-01). 원본 보존: final/adopted-hard-all.json 은 건드리지 않고 .shuffled.json 과 .shuffle-log.json 을 만든다. DB 접근 없음.
// 실행: npx tsx scripts/mock-exam-generation/shuffle-adopted.ts [--dry] [--budget 8] [--skip-verify]
//  1) 정답 위치 배정: 섹션별로 A~D 가 고르게(각 25%±) 나오도록 순환 배정. 숫자 선택지(오름차순 관례)·선택지 안에 글자 토큰이 있는 문항은 섞지 않는다(사유 기록).
//  2) 선택지 재배치: 정답을 목표 위치로 옮기고 나머지는 원래 상대 순서를 유지(병렬 구조·관례 보존).
//  3) 해설의 선택지 글자 참조를 새 순서로 결정론 치환(따옴표 안 인용문·영어 관사 'A single…' 는 건드리지 않음). 글자 토큰이 있던 문항은 전부 재검증 대상.
//  4) 재검증: Fable 5.1·Opus 5.5 가 각각 섞은 문항을 정답 없이 풀어(블라인드) 새 정답과 일치하고, 해설 감사에서 정답·해설 정합이 통과해야 채택. 실패하면 원래 순서로 되돌리고 기록.
//  5) quality 에 positionShuffled·originalCorrectIndex·permutation·explanationRewritten 을 기록(hardJudge 등 다른 필드는 유지).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { createToolMessage } from "../../lib/problem-generation/models";
import { costOf } from "./batch-lib";

const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) for (const line of readFileSync(envPath, "utf-8").split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const RUN = path.resolve("data/mock-exam-generation/mockgen-20260929");
const LETTERS = "ABCD";
export type Rec = { gid: string; skill: string; examSystem: string; format: string; problem: { passage?: string; stimulus?: string; question?: string; options: string[]; correctIndex: number; explanation: string; [k: string]: unknown }; quality: Record<string, unknown>; [k: string]: unknown };

// ---- 해설 글자 참조 치환 ----------------------------------------------------
export const LETTER = /(?<![A-Za-z0-9$\\'\-])([A-D])(?![A-Za-z0-9'\-])/g;
/** 따옴표("…", “…”, '…' 는 제외 — 소유격과 혼동) 안의 구간 마스크. */
export function quotedMask(s: string): boolean[] {
  const mask = new Array(s.length).fill(false);
  let open = false, start = -1, closer = '"';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (!open && (c === '"' || c === "“")) { open = true; start = i; closer = c === '"' ? '"' : "”"; }
    else if (open && (c === closer || (closer === '"' && c === "”"))) { for (let k = start; k <= i; k++) mask[k] = true; open = false; }
  }
  return mask;
}
/** 글자 토큰이 선택지 참조인지: 따옴표 밖이고, 뒤에 공백 + 영어 소문자 단어가 오는 관사형("A single …")이 아니다. */
export function letterRefs(s: string): { index: number; letter: string }[] {
  const mask = quotedMask(s);
  const out: { index: number; letter: string }[] = [];
  for (const m of s.matchAll(LETTER)) {
    const i = m.index!;
    if (mask[i]) continue;
    const after = s.slice(i + 1, i + 12);
    const before = s.slice(Math.max(0, i - 14), i);
    if (m[1] === "A" && /(?:choices?|options?|answers?|letters?|statements?|보기|선택지|\(|\/|,|\band|\bor|\bnor|\bneither|\bboth|\beither|\bvs\.?|\bthan|\bthrough|\bto)\s*$/i.test(before)) { out.push({ index: i, letter: m[1] }); continue; }
    if (/^\s+[a-z]{2,}/.test(after) && m[1] === "A" && !/^\s+(?:is|was|are|were|and|or|but|nor|does|doesn't|has|would|could|also|correctly|incorrectly|fails|states|says|provides|gives)\b/.test(after)) continue; // "A single boat" 류 관사
    out.push({ index: i, letter: m[1] });
  }
  return out;
}
export function remapExplanation(s: string, map: Record<string, string>): string {
  const refs = letterRefs(s);
  let out = "", last = 0;
  for (const r of refs) { out += s.slice(last, r.index) + (map[r.letter] ?? r.letter); last = r.index + 1; }
  return out + s.slice(last);
}

// ---- 위치 배정·재배치 -------------------------------------------------------
// 숫자(분수·퍼센트·단위 붙은 수) 선택지는 SAT 관례상 오름차순으로 제시하므로 섞지 않는다. 변수가 들어간 식(y = 2x + 1 등)은 숫자 선택지가 아니다.
export const isNumericOptions = (opts: string[]) => opts.every((o) => {
  const t = o.replace(/\$/g, "").replace(/\\(?:d|t)?frac\{([^}]*)\}\{([^}]*)\}/g, "$1/$2").replace(/\\(?:text|mathrm)\{([^}]*)\}/g, "$1").replace(/\\[a-zA-Z]+/g, "").replace(/[{}]/g, "").trim();
  return /^[-+]?\s*\d[\d.,/]*\s*(?:%|°|[a-zA-Z²³ /]{0,14})$/.test(t) || /^[-+]?\d[\d.,/]*\s*(?:<|>|≤|≥)\s*[-+]?\d[\d.,/]*$/.test(t);
});
function plan(recs: Rec[]) {
  const skip = new Map<string, string>();
  for (const r of recs) {
    if (r.format !== "mc") skip.set(r.gid, "mc 아님");
    else if (r.examSystem === "sat_math" && isNumericOptions(r.problem.options)) skip.set(r.gid, "숫자 선택지(오름차순 관례 유지)");
    else if (r.problem.options.some((o) => letterRefs(o).length > 0)) skip.set(r.gid, "선택지 안에 글자 참조");
  }
  const target = new Map<string, number>();
  for (const system of ["sat_rw", "sat_math"]) {
    const sys = recs.filter((r) => r.examSystem === system);
    const counts = [0, 0, 0, 0];
    for (const r of sys) if (skip.has(r.gid)) counts[r.problem.correctIndex]++;
    // 결정론 순서: gid 정렬, 매번 가장 적은 위치(동률이면 원래 위치가 아닌 쪽, 그다음 앞 글자)
    for (const r of sys.filter((x) => !skip.has(x.gid)).sort((a, b) => a.gid.localeCompare(b.gid))) {
      let best = 0;
      for (let k = 1; k < 4; k++) if (counts[k] < counts[best] || (counts[k] === counts[best] && best === r.problem.correctIndex && k !== r.problem.correctIndex)) best = k;
      counts[best]++;
      target.set(r.gid, best);
    }
  }
  return { skip, target };
}
export function reorder(options: string[], correctIndex: number, targetIndex: number): { options: string[]; perm: number[] } {
  const others = options.map((_, i) => i).filter((i) => i !== correctIndex);
  const order: number[] = [];
  let k = 0;
  for (let pos = 0; pos < options.length; pos++) order.push(pos === targetIndex ? correctIndex : others[k++]);
  return { options: order.map((i) => options[i]), perm: order }; // perm[newIndex] = oldIndex
}

// ---- 재검증(Fable·Opus 블라인드 풀이 + 감사) --------------------------------
let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));
let spent = 0;
async function ask(model: string, name: string, properties: Record<string, unknown>, prompt: string): Promise<Record<string, unknown> | null> {
  const params = { model, max_tokens: 1500, tools: [{ name, description: name, input_schema: { type: "object", properties, required: Object.keys(properties) } as never }], tool_choice: { type: "auto" as const }, messages: [{ role: "user" as const, content: prompt }] };
  try {
    const m = await createToolMessage(getClient(), params as never);
    spent += costOf(model, m.usage as never) * 2; // 동기 단가 = 배치 x2
    const tu = m.content.find((c) => c.type === "tool_use");
    return tu && tu.type === "tool_use" ? (tu.input as Record<string, unknown>) : null;
  } catch { return null; }
}
const body = (r: Rec, opts: string[]) => `${r.problem.stimulus ?? r.problem.passage ?? ""}\n\n${r.problem.question ?? ""}\n${opts.map((o, i) => `${LETTERS[i]}) ${o}`).join("\n")}`;
async function verify(r: Rec, opts: string[], correct: number, explanation: string) {
  const out: Record<string, unknown> = {};
  for (const model of ["claude-fable-5-1", "claude-opus-5-5"]) {
    const blind = await ask(model, "solve", { picked_letter: { type: "string", enum: ["A", "B", "C", "D"] }, other_defensible: { type: "boolean" } }, `디지털 SAT 독립 채점자로서 정답 표시 없이 직접 풀고 solve 도구로 제출하라.\n\n${body(r, opts)}`);
    const audit = await ask(model, "audit", { answer_correct: { type: "boolean", description: "지정 정답이 실제로 옳은가" }, explanation_consistent: { type: "boolean", description: "해설의 선택지 글자 참조(정답·오답 설명)가 아래 선택지 순서와 정확히 일치하고 해설 논리에 모순이 없는가" }, issue: { type: "string" } }, `문항 감사: 정답 글자 ${LETTERS[correct]} 이다. 특히 해설이 가리키는 선택지 글자와 내용이 아래 선택지와 맞는지 확인하고 audit 도구로 제출하라.\n\n${body(r, opts)}\n\n지정 정답: ${LETTERS[correct]}\n해설: ${explanation}`);
    out[model] = { blindOk: blind ? blind.picked_letter === LETTERS[correct] && !blind.other_defensible : false, auditOk: audit ? Boolean(audit.answer_correct) && Boolean(audit.explanation_consistent) : false, issue: audit?.issue ?? null };
  }
  const ok = Object.values(out).every((v) => (v as { blindOk: boolean; auditOk: boolean }).blindOk && (v as { auditOk: boolean }).auditOk);
  return { ok, detail: out };
}

async function main() {
  const src = JSON.parse(readFileSync(path.join(RUN, "final/adopted-hard-all.json"), "utf-8")) as Rec[];
  const before = (recs: Rec[], sys?: string) => { const c = [0, 0, 0, 0]; for (const r of recs.filter((x) => !sys || x.examSystem === sys)) c[r.problem.correctIndex]++; return c; };
  const { skip, target } = plan(src);
  const budget = Number(arg("--budget") ?? 8);
  const verifyTargets = src.filter((r) => target.has(r.gid) && letterRefs(r.problem.explanation).length > 0);
  console.log(`[shuffle] 문항 ${src.length} · 섞기 대상 ${target.size} · 제외 ${skip.size} · 해설 글자 참조 있어 재검증 ${verifyTargets.length} · 재검증 추정 $${(verifyTargets.length * 0.14).toFixed(2)} · 상한 $${budget}`);
  console.log("전 분포 RW", before(src, "sat_rw"), "Math", before(src, "sat_math"));
  if (process.argv.includes("--dry")) return;
  if (verifyTargets.length * 0.14 > budget * 1.2) throw new Error("추정이 상한을 크게 넘음");

  const log: Record<string, unknown>[] = [];
  const out: Rec[] = [];
  for (const r of src) {
    const t = target.get(r.gid);
    if (t === undefined) { out.push({ ...r, quality: { ...r.quality, positionShuffled: false, positionShuffleSkipped: skip.get(r.gid) ?? "대상 아님", originalCorrectIndex: r.problem.correctIndex } }); log.push({ gid: r.gid, skipped: skip.get(r.gid) }); continue; }
    const { options, perm } = reorder(r.problem.options, r.problem.correctIndex, t);
    const letterMap: Record<string, string> = {}; // 옛 글자 → 새 글자
    perm.forEach((oldIdx, newIdx) => { letterMap[LETTERS[oldIdx]] = LETTERS[newIdx]; });
    const refs = letterRefs(r.problem.explanation).length;
    const explanation = refs ? remapExplanation(r.problem.explanation, letterMap) : r.problem.explanation;
    let verified: { ok: boolean; detail: unknown } | null = null;
    if (refs && !process.argv.includes("--skip-verify")) {
      if (spent > budget) throw new Error(`재검증 예산 초과: $${spent.toFixed(2)}`);
      verified = await verify(r, options, t, explanation);
    }
    const accept = !refs || process.argv.includes("--skip-verify") || verified?.ok === true;
    log.push({ gid: r.gid, skill: r.skill, from: r.problem.correctIndex, to: t, perm, explanationRewritten: refs > 0, letterMap, verification: verified, accepted: accept, explanationBefore: r.problem.explanation, explanationAfter: explanation });
    if (!accept) { out.push({ ...r, quality: { ...r.quality, positionShuffled: false, positionShuffleSkipped: "재검증 실패 — 원래 순서 유지", originalCorrectIndex: r.problem.correctIndex } }); continue; }
    out.push({ ...r, problem: { ...r.problem, options, correctIndex: t, explanation }, quality: { ...r.quality, positionShuffled: true, originalCorrectIndex: r.problem.correctIndex, permutation: perm, explanationRewritten: refs > 0, shuffleVerifiedBy: refs > 0 ? ["claude-fable-5-1", "claude-opus-5-5"] : null } });
  }
  writeFileSync(path.join(RUN, "final/adopted-hard-all.shuffled.json"), JSON.stringify(out, null, 1));
  writeFileSync(path.join(RUN, "final/adopted-hard-all.shuffle-log.json"), JSON.stringify({ spentUsd: +spent.toFixed(3), before: { rw: before(src, "sat_rw"), math: before(src, "sat_math") }, after: { rw: before(out, "sat_rw"), math: before(out, "sat_math") }, log }, null, 1));
  const pct = (c: number[]) => c.map((x) => `${Math.round((x / Math.max(1, c.reduce((a, b) => a + b, 0))) * 100)}%`).join("/");
  console.log(JSON.stringify({ spentUsd: +spent.toFixed(3), shuffled: out.filter((r) => r.quality.positionShuffled).length, skipped: out.filter((r) => !r.quality.positionShuffled).length, rewritten: out.filter((r) => r.quality.explanationRewritten).length, failedVerify: log.filter((l) => (l as { accepted?: boolean }).accepted === false).length, afterRw: before(out, "sat_rw"), afterMath: before(out, "sat_math"), afterRwPct: pct(before(out, "sat_rw")), afterMathPct: pct(before(out, "sat_math")) }, null, 1));
}
if (process.argv[1]?.endsWith("shuffle-adopted.ts")) main().catch((e) => { console.error(e); process.exit(1); });
