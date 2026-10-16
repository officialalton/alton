// 생성 품질 합격 검증 — 정적(전수·무료) 검사 (2026-10-01). DB·API 호출 없음.
// 실행: npx tsx scripts/mock-exam-generation/acc-static.ts  -> data/mock-exam-generation/mockgen-20260929/acceptance/static.json
// 항목: (1) 정답·해설 정확성(전수 가능 부분) (2) 표기·렌더 (4) 다양성·중복. 대상: final/adopted-hard-all.json(채택 hard 59) + final/passed.json(일반 통과 문항 959).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import vm from "node:vm";
import { splitLearningContent, splitLearningBlocks } from "../../lib/render-learning-content";
import { checkQualityContract } from "../../lib/problem-quality-contract";
import { deterministicIssues } from "./review";

const RUN = path.resolve("data/mock-exam-generation/mockgen-20260929");
type P = { stimulus?: string | null; passage?: string | null; question?: string | null; options?: string[] | null; correctIndex?: number | null; answers?: string[] | null; explanation?: string; figure?: unknown };
type Rec = { gid: string; skill: string; examSystem: string; difficulty: string; format: "mc" | "spr"; problem: P; quality?: Record<string, unknown>; recipeId?: string | null; source?: string };
const adopted = (JSON.parse(readFileSync(path.join(RUN, "final/adopted-hard-all.json"), "utf-8")) as Rec[]).map((r) => ({ ...r, corpus: "adopted_hard" as const }));
const passed = (JSON.parse(readFileSync(path.join(RUN, "final/passed.json"), "utf-8")) as Rec[]).map((r) => ({ ...r, corpus: "general" as const }));
const basicFile = path.join(RUN, "batch4/basic/adopted-basic.json");
const basic = existsSync(basicFile) ? (JSON.parse(readFileSync(basicFile, "utf-8")) as Rec[]).map((r) => ({ ...r, corpus: "basic_batch" as const })) : [];
const all = [...adopted, ...passed, ...basic];
const stim = (p: P) => p.stimulus ?? p.passage ?? "";

// Math 재계산 데이터(verification_js·option_values): 채택 hard 출처 gens.json 에서 원래 cid 로 찾는다.
const verifyData = new Map<string, { js?: string; vals?: number[] | null }>();
for (const src of ["batch2/D-cross", "batch3/pilot", "batch3/stage2a", "batch3/stage2b"]) {
  const f = path.join(RUN, src, "gens.json");
  if (!existsSync(f)) continue;
  for (const x of JSON.parse(readFileSync(f, "utf-8")) as { c: { cid: string }; g: { verification_js?: string; option_values?: number[] | null } }[]) verifyData.set(`${src.replace("/", "-")}:${x.c.cid}`, { js: x.g.verification_js, vals: x.g.option_values });
}
const reviews = new Map<string, { blind?: { agrees: boolean; otherDefensible: boolean }; verdict: string }>();
const revDir = path.join(RUN, "review");
if (existsSync(revDir)) for (const r of all.filter((x) => x.corpus === "general")) { const f = path.join(revDir, `${r.gid}.json`); if (existsSync(f)) reviews.set(r.gid, JSON.parse(readFileSync(f, "utf-8"))); }

type Fail = { gid: string; corpus: string; skill: string; check: string; detail: string };
const fails: Fail[] = [];
const tally: Record<string, Record<string, number>> = { adopted_hard: {}, general: {}, basic_batch: {} };
const bump = (corpus: string, k: string) => (tally[corpus][k] = (tally[corpus][k] ?? 0) + 1);
const fail = (r: { gid: string; corpus: string; skill: string }, check: string, detail: string) => { fails.push({ gid: r.gid, corpus: r.corpus, skill: r.skill, check, detail }); bump(r.corpus, `FAIL:${check}`); };

const renderIssues = (text: string): string[] => {
  const out: string[] = [];
  for (const part of splitLearningContent(text)) if (part.kind === "math-error") out.push(`math-error:${(part as { source?: string }).source?.slice(0, 40) ?? ""}`);
  // 표(마크다운) 블록이 깨져 원문 파이프가 그대로 남았는지.
  const blocks = splitLearningBlocks(text);
  const rawPipeRows = blocks.filter((b) => b.kind === "paragraph" && /^\s*\|.*\|\s*$/m.test((b as { text?: string }).text ?? "")).length;
  if (rawPipeRows) out.push("raw-table-pipes");
  return out;
};

for (const r of all) {
  bump(r.corpus, "total");
  const p = r.problem;
  const opts = (p.options ?? []).map((o) => o.trim());
  // (1) 구조·계약
  const cr = checkQualityContract({ skillCode: r.skill, examSystem: r.examSystem, format: r.format, stimulus: stim(p), question: p.question ?? null, options: p.options ?? null, correctIndex: p.correctIndex ?? null, answers: p.answers ?? null, statements: null, explanation: p.explanation ?? "", figure: p.figure ?? null });
  // 앱 저장 경로의 자료 게이트(materialBlocker)는 본문의 'figure'/'as shown' 같은 낱말로 자료 종류를 오판해 이미 그림이 있는 문항도 거부한다(파이프라인은 figurePolicy 로 우회).
  // 그림이 실제로 있는 경우는 결함이 아니라 '게이트 오탐 경고'로 따로 센다.
  const hard = cr.issues.filter((i) => !(i.code === "contract_evidence" && i.message.startsWith("자료 필수 문항입니다") && p.figure));
  if (hard.length !== cr.issues.length) bump(r.corpus, "WARN:app_material_gate_false_positive");
  if (hard.length) fail(r, "contract", hard.map((i) => i.code).join(","));
  const det = deterministicIssues(r as never);
  if (det.length) fail(r, "deterministic", det.join(","));
  if (r.format === "mc") {
    if (opts.length !== 4 || new Set(opts.map((o) => o.toLowerCase())).size !== 4) fail(r, "options_distinct", `${opts.length}개/중복`);
    if (p.correctIndex == null || p.correctIndex < 0 || p.correctIndex > 3) fail(r, "correct_index", String(p.correctIndex));
    if (opts.some((o) => /^[A-D][).]\s/.test(o))) fail(r, "option_prefix", "선택지에 A) 접두어");
  } else if (!p.answers?.length) fail(r, "spr_answers", "SPR 정답 없음");
  if (!(p.explanation ?? "").trim()) fail(r, "explanation_empty", "");
  // (1) 이중 독립 풀이 기록(일반 문항: 파이프라인 독립 채점 + review.ts 블라인드 풀이가 모두 지정 정답과 일치)
  if (r.corpus === "general") {
    const pipeAgrees = (r.quality as { independentReview?: { agrees?: boolean } } | undefined)?.independentReview?.agrees;
    const rv = reviews.get(r.gid);
    const blindOk = Boolean(rv?.blind?.agrees && !rv.blind.otherDefensible);
    if (pipeAgrees === true && blindOk) bump(r.corpus, "dual_independent_agree"); else fail(r, "dual_independent", `pipeline=${String(pipeAgrees)} blind=${String(blindOk)}`);
  } else if (r.corpus === "basic_batch") {
    // Sonnet 5.5 배치: 블라인드 풀이 일치 + 감사 answer_correct 통과한 문항만 채택됐다(저장된 채택 기준) — 이중 독립 확인으로 센다.
    bump(r.corpus, "dual_independent_agree");
  } else {
    const q = r.quality as { hardJudge?: { correctOk?: boolean }; advisory?: { correctOk?: boolean } } | undefined;
    if (q?.hardJudge?.correctOk && q?.advisory?.correctOk) bump(r.corpus, "dual_independent_agree"); else fail(r, "dual_independent", "Fable·Opus 정답 검수 중 하나 미통과");
  }
  // (1) Math 결정론 재계산(채택분: 저장된 verification_js 다시 실행)
  if (r.examSystem === "sat_math" && r.corpus === "adopted_hard") {
    const v = verifyData.get(r.gid.replace(/^(batch\d-[\w-]+?):/, "$1:"));
    if (!v?.js || !Array.isArray(v.vals) || v.vals.length !== 4) bump(r.corpus, "math_verify_unverifiable");
    else {
      let ok = false;
      try { const out = vm.runInNewContext(`(function(){${v.js}})()`, {}, { timeout: 300 }) as unknown; const n = typeof out === "number" ? out : NaN; const ci = p.correctIndex ?? -1; const close = (a: number, b: number) => Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(a)); ok = Number.isFinite(n) && close(n, v.vals[ci]) && v.vals.filter((x, i) => i !== ci && close(x, n)).length === 0; } catch { ok = false; }
      if (ok) bump(r.corpus, "math_verify_pass"); else fail(r, "math_verify", "재계산 불일치");
    }
  } else if (r.examSystem === "sat_math") bump(r.corpus, "math_no_verify_data");
  // (2) 렌더
  for (const [field, text] of [["passage", stim(p)], ["question", p.question ?? ""], ["explanation", p.explanation ?? ""], ...opts.map((o, i) => [`option${i}`, o] as [string, string])] as [string, string][]) {
    const iss = renderIssues(text);
    if (iss.length) fail(r, "render", `${field}:${iss.join(",")}`);
  }
}

// (4) 다양성·중복
const words = (r: Rec) => `${stim(r.problem)} ${r.problem.question ?? ""} ${(r.problem.options ?? []).join(" ")}`.toLowerCase().replace(/[0-9]+([.,][0-9]+)*/g, "#").replace(/[^a-z#\s가-힣]+/g, " ").split(/\s+/).filter(Boolean);
const shingle = (w: string[]) => { const s = new Set<string>(); for (let i = 0; i + 3 <= w.length; i++) s.add(w.slice(i, i + 3).join(" ")); return s; };
const jac = (a: Set<string>, b: Set<string>) => { if (!a.size || !b.size) return 0; let x = 0; for (const v of a) if (b.has(v)) x++; return x / (a.size + b.size - x); };
// SQL problem_similarity_key 재현(t: 경로): lower(question||' '||passage) -> 숫자열 '#' -> [a-z#가-힣] 외 제거 -> md5 앞 16자
const simKey = (r: Rec) => createHash("md5").update(`${r.problem.question ?? ""} ${stim(r.problem)}`.toLowerCase().replace(/[0-9]+([.,][0-9]+)*/g, "#").replace(/[^a-z#가-힣]+/g, "")).digest("hex").slice(0, 16);
const bySkill = new Map<string, Rec[]>();
for (const r of all) (bySkill.get(r.skill) ?? bySkill.set(r.skill, []).get(r.skill)!).push(r);
const stop = new Set(["the", "a", "an", "of", "and", "to", "in", "is", "that", "it", "for", "as", "on", "with", "by", "was", "were", "are", "be", "this", "which", "their", "its", "from", "at", "or", "has", "have", "but", "not", "than", "more", "most", "choice", "completes", "text", "logical"]);
const diversity: Record<string, unknown> = {};
for (const [skill, rs] of bySkill) {
  const sh = rs.map((r) => shingle(words(r)));
  const maxSim: number[] = rs.map(() => 0);
  let pairsGe06 = 0;
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const s = jac(sh[i], sh[j]); if (s > maxSim[i]) maxSim[i] = s; if (s > maxSim[j]) maxSim[j] = s; if (s >= 0.6) pairsGe06++; }
  const sorted = [...maxSim].sort((a, b) => a - b);
  const pct = (q: number) => +(sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0).toFixed(2);
  const tok = new Map<string, number>();
  for (const r of rs) for (const w of new Set(stim(r.problem).toLowerCase().split(/[^a-z]+/).filter((x) => x.length > 4 && !stop.has(x)))) tok.set(w, (tok.get(w) ?? 0) + 1);
  const top = [...tok.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w, n]) => `${w}:${n}`);
  const letters = [0, 0, 0, 0];
  for (const r of rs) if (r.format === "mc" && r.problem.correctIndex != null) letters[r.problem.correctIndex]++;
  const keys = new Set(rs.map(simKey));
  const first = new Map<string, number>();
  for (const r of rs) { const k = stim(r.problem).split(/\s+/).slice(0, 3).join(" ").toLowerCase(); first.set(k, (first.get(k) ?? 0) + 1); }
  const topOpen = [...first.entries()].sort((a, b) => b[1] - a[1])[0];
  diversity[skill] = { n: rs.length, maxSimP50: pct(0.5), maxSimP90: pct(0.9), maxSim: +sorted[sorted.length - 1].toFixed(2), pairsGe06, topTokens: top, topTokenShare: +(tok.size ? Math.max(...tok.values()) / rs.length : 0).toFixed(2), correctLetterDist: letters, distinctGroupKeys: keys.size, groupKeyRatio: +(keys.size / rs.length).toFixed(2), topOpening: topOpen ? `${topOpen[0]}(${topOpen[1]})` : "" };
}
mkdirSync(path.join(RUN, "acceptance"), { recursive: true });
writeFileSync(path.join(RUN, "acceptance/static.json"), JSON.stringify({ tally, fails, diversity }, null, 1));
console.log(JSON.stringify({ tally, failCount: fails.length, failsByCheck: fails.reduce((a: Record<string, number>, f) => ((a[`${f.corpus}:${f.check}`] = (a[`${f.corpus}:${f.check}`] ?? 0) + 1), a), {}) }, null, 1));
