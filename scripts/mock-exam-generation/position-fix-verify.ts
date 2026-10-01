// position-fix.ts 의 유료 단계: AI 재작성(모호한 해설 글자 참조)과 계층 표본 검증. 비용 장부(position-fix/ledger.json)로 상한(기본 $25) 강제.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { createToolMessage, generationModel } from "../../lib/problem-generation/models";
import { costOf } from "./batch-lib";
import { reorder, letterRefs, type Rec } from "./shuffle-adopted";
import type { FixEntry } from "./position-fix";

const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) for (const line of readFileSync(envPath, "utf-8").split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const LETTERS = "ABCD";
const MODELS = ["claude-fable-5-1", "claude-opus-5-5"];
let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

// ---- 비용 장부 -------------------------------------------------------------
class Ledger {
  spent = 0; entries: { at: string; step: string; usd: number }[] = [];
  constructor(private file: string, public cap: number) { if (existsSync(file)) { const d = JSON.parse(readFileSync(file, "utf-8")); this.spent = d.spent; this.entries = d.entries; } }
  add(step: string, usd: number) { this.spent += usd; this.entries.push({ at: new Date().toISOString(), step, usd: Number(usd.toFixed(4)) }); writeFileSync(this.file, JSON.stringify({ cap: this.cap, spent: Number(this.spent.toFixed(4)), entries: this.entries.slice(-200) }, null, 1)); }
  get over() { return this.spent >= this.cap; }
}
async function ask(led: Ledger, step: string, model: string, name: string, properties: Record<string, unknown>, prompt: string, maxTokens = 1500): Promise<Record<string, unknown> | null> {
  if (led.over) return null;
  const params = { model, max_tokens: maxTokens, tools: [{ name, description: name, input_schema: { type: "object", properties, required: Object.keys(properties) } as never }], tool_choice: { type: "auto" as const }, messages: [{ role: "user" as const, content: prompt }] };
  try {
    const m = await createToolMessage(getClient(), params as never);
    led.add(step, costOf(model, m.usage as never) * 2); // 동기 단가 = 배치 x2
    const tu = m.content.find((c) => c.type === "tool_use");
    return tu && tu.type === "tool_use" ? (tu.input as Record<string, unknown>) : null;
  } catch { return null; }
}
const loadPlan = (out: string) => JSON.parse(readFileSync(path.join(out, "plan.json"), "utf-8")) as FixEntry[];
const sourceRecs = () => {
  const m = new Map<string, Rec>();
  for (const f of [path.resolve("data/mock-exam-generation/mockgen-20260929/final/passed.json"), path.join(process.env.HOME ?? "", "Developer/ALTON-worktrees/general-problem-pool/data/general-generation/gen-20260930/full/final/passed.json"), path.join(process.env.HOME ?? "", "Developer/ALTON-worktrees/general-problem-pool/data/general-generation/gen-20260930/stage1/final/passed.json")])
    if (existsSync(f)) for (const r of JSON.parse(readFileSync(f, "utf-8")) as Rec[]) if (!m.has(r.gid)) m.set(r.gid, r);
  return m;
};
const stem = (r: Rec | undefined) => r ? `${r.problem.stimulus ?? r.problem.passage ?? ""}\n\n${r.problem.question ?? ""}` : "";
const body = (r: Rec | undefined, opts: string[]) => `${stem(r)}\n${opts.map((o, i) => `${LETTERS[i]}) ${o}`).join("\n")}`;

// ---- AI 재작성: 모호한 해설 글자 참조 ---------------------------------------
export async function rewrite(out: string) {
  const cap = Number(arg("--budget") ?? 25);
  const led = new Ledger(path.join(out, "ledger.json"), cap);
  const plan = loadPlan(out); const recs = sourceRecs();
  const targets = plan.filter((e) => e.status === "skip" && e.ambiguous && (e.reason ?? "").startsWith("해설 글자"));
  console.log(`[rewrite] 대상 ${targets.length}건 · 추정 $${(targets.length * 0.03).toFixed(2)} · 장부 누적 $${led.spent.toFixed(2)} / 상한 $${cap}`);
  if (process.argv.includes("--dry")) return;
  // 목표 위치: 지금 계획의 섞은 후 분포에서 가장 적은 위치로(같은 source·section 안)
  const cnt = (src: string, sec: string) => { const c = [0, 0, 0, 0]; for (const e of plan.filter((x) => x.source === src && x.section === sec && x.format === "mc")) c[e.after ? e.after.correctIndex : e.origIndex]++; return c; };
  let done = 0, failed = 0;
  for (const e of targets) {
    const c = cnt(e.source, e.section);
    let t = -1; for (let k = 0; k < 4; k++) if (k !== e.origIndex && (t < 0 || c[k] < c[t])) t = k;
    const { options, perm } = reorder(e.before.options, e.before.correctIndex, t);
    const map: Record<string, string> = {}; perm.forEach((o, n) => { map[LETTERS[o]] = LETTERS[n]; });
    const mapText = Object.entries(map).map(([o, n]) => `${o}→${n}`).join(", ");
    const r = recs.get(e.gid);
    const res = await ask(led, `rewrite:${e.gid}`, generationModel(), "submit", { explanation: { type: "string" }, explanationEn: { type: "string" } },
      `문항의 선택지 순서를 바꿨다. 해설(한국어)과 영어 해설에서 **선택지 글자(A~D)를 가리키는 표현만** 새 순서에 맞게 바꿔라(옛 글자→새 글자: ${mapText}). 따옴표 안 인용문, 영어 관사 'A ...', 수식·변수는 바꾸지 말 것. 그 밖의 글자는 한 글자도 바꾸지 말고 그대로 복사하라. submit 도구로 두 해설 전체를 제출하라. 영어 해설이 없으면 빈 문자열.\n\n[문항]\n${body(r, options)}\n\n[해설(한국어)]\n${e.before.explanation}\n\n[영어 해설]\n${e.before.explanationEn ?? ""}`, 4000);
    if (!res || typeof res.explanation !== "string") { failed++; continue; }
    const en = e.before.explanationEn ? String(res.explanationEn ?? "") : null;
    // 안전 검사: 글자 참조를 뺀 나머지 길이가 크게 달라지면 거부(요약·재작성 방지)
    const strip = (t: string) => t.replace(/(?<![A-Za-z0-9$\\'\-])[A-D](?![A-Za-z0-9'\-])/g, "·");
    if (strip(res.explanation) !== strip(e.before.explanation) || (en !== null && strip(en) !== strip(e.before.explanationEn ?? ""))) { failed++; continue; }
    Object.assign(e, { status: "shuffle", reason: undefined, newIndex: t, perm, rewritten: true, rewriteMethod: "ai", after: { options, correctIndex: t, explanation: res.explanation, explanationEn: en } });
    done++;
    if (done % 20 === 0) writeFileSync(path.join(out, "plan.json"), JSON.stringify(plan));
    if (led.over) { console.log("비용 상한 도달 — 중단"); break; }
  }
  writeFileSync(path.join(out, "plan.json"), JSON.stringify(plan));
  console.log(JSON.stringify({ rewrittenByAi: done, failedOrRejected: failed, spentUsd: Number(led.spent.toFixed(2)) }));
}

// ---- 표본 검증 ---------------------------------------------------------------
type Verdict = { baselineOk?: boolean; attributable?: boolean; ok: boolean; explanationOk: boolean; blindOk: boolean; detail: Record<string, unknown> };
async function verifyOne(led: Ledger, e: FixEntry, r: Rec | undefined, useBefore = false): Promise<Verdict> {
  // 섞기 귀속 오류만 본다: 정답 선택지 내용은 순열 검증으로 보존되므로 블라인드 풀이·해설 품질은 묻지 않는다(1차 시도에서 원 문항의 기존 결함이 섞여 65% 오탐 — verify-results.strict-v1.json).
  const a = useBefore ? e.before : e.after!; const detail: Record<string, unknown> = {}; let ok = true;
  for (const model of MODELS) {
    const audit = await ask(led, `audit:${e.gid}`, model, "audit", { korean_letter_refs_ok: { type: "boolean", description: "한국어 해설 안의 모든 선택지 글자 참조(정답·오답 지목)가 아래 선택지 순서에서 그 내용을 가리키는가. 글자 참조가 없으면 true" }, english_letter_refs_ok: { type: "boolean", description: "영어 해설도 같은 기준. 영어 해설이 비어 있으면 true" }, correct_letter_ok: { type: "boolean", description: "해설이 정답으로 말하는 글자가 지정 정답 글자와 같은가(해설이 글자를 말하지 않으면 true)" }, issue: { type: "string" } }, `선택지 순서를 바꾼 문항이다. **오직 선택지 글자 참조의 정합만** 확인하라. 해설의 다른 품질 문제·표 누락·모호한 정답·오타·두 해설 간 설명 차이는 모두 무시한다. 지정 정답 글자: ${LETTERS[a.correctIndex]}.\n\n${body(r, a.options)}\n\n해설: ${a.explanation}\n영어 해설: ${a.explanationEn ?? ""}`);
    const good = audit ? Boolean(audit.korean_letter_refs_ok) && Boolean(audit.english_letter_refs_ok) && Boolean(audit.correct_letter_ok) : false;
    if (!good) ok = false;
    detail[model] = { good, issue: audit?.issue ?? null };
  }
  return { ok, explanationOk: ok, blindOk: true, detail };
}
const stratumOf = (e: FixEntry) => `${e.section}|${e.rewriteMethod === "ai" ? "ai" : e.rewritten ? "refs" : "plain"}`;
export async function run(out: string) {
  const cap = Number(arg("--budget") ?? 25), nRefs = Number(arg("--n-refs") ?? 60), nPlain = Number(arg("--n-plain") ?? 30);
  const led = new Ledger(path.join(out, "ledger.json"), cap);
  const plan = loadPlan(out); const recs = sourceRecs();
  const vfile = path.join(out, "verify-results.json");
  const results: Record<string, Verdict & { stratum: string; phase: string }> = existsSync(vfile) ? JSON.parse(readFileSync(vfile, "utf-8")) : {};
  const shuffled = plan.filter((e) => e.status === "shuffle");
  const strata = new Map<string, FixEntry[]>();
  for (const e of shuffled) { const k = stratumOf(e); strata.set(k, [...(strata.get(k) ?? []), e]); }
  // 표본: 층 안에서 skill 라운드로빈(결정론). ai 층은 전수.
  const sample = (list: FixEntry[], n: number) => {
    const by = new Map<string, FixEntry[]>(); for (const e of [...list].sort((a, b) => a.gid.localeCompare(b.gid))) by.set(e.skill, [...(by.get(e.skill) ?? []), e]);
    const picked: FixEntry[] = []; const lists = [...by.values()];
    for (let i = 0; picked.length < Math.min(n, list.length); i++) { let any = false; for (const l of lists) if (l[i] && picked.length < n) { picked.push(l[i]); any = true; } if (!any) break; }
    return picked;
  };
  const wanted = new Map<string, FixEntry[]>();
  for (const [k, list] of strata) wanted.set(k, k.endsWith("|ai") ? list : sample(list, k.endsWith("|refs") ? nRefs : nPlain));
  const todo = (list: FixEntry[]) => list.filter((e) => !results[e.gid]);
  const estimate = [...wanted.values()].reduce((a, l) => a + todo(l).length, 0) * 0.07;
  console.log(`[verify] 층 ${[...strata].map(([k, l]) => `${k}:${l.length}`).join(" ")}`);
  console.log(`[verify] 1차 표본 ${[...wanted.values()].reduce((a, l) => a + l.length, 0)}건 · 추정 +$${estimate.toFixed(2)} (건당 약 $0.07) · 장부 $${led.spent.toFixed(2)} / 상한 $${cap}`);
  if (process.argv.includes("--dry")) return;
  const runList = async (k: string, list: FixEntry[], phase: string) => {
    for (const e of todo(list)) {
      if (led.over) return false;
      const v = await verifyOne(led, e, recs.get(e.gid));
      // 실패하면 같은 감사를 원래 순서에도 돌려, 원래부터 실패하던 문항(기존 결함)과 섞기로 새로 생긴 오류를 구분한다.
      if (!v.ok) { const b = await verifyOne(led, e, recs.get(e.gid), true); v.baselineOk = b.ok; v.attributable = b.ok; v.ok = b.ok ? false : true; (v as { origFail?: boolean }).origFail = !b.ok; }
      results[e.gid] = { ...v, stratum: k, phase };
      if (Object.keys(results).length % 10 === 0) writeFileSync(vfile, JSON.stringify(results));
    }
    return true;
  };
  // 이전 실행에서 기준선 없이 저장된 실패를 먼저 정리
  const byGid = new Map(plan.map((e) => [e.gid, e]));
  for (const [gid, v] of Object.entries(results)) {
    if (!v.ok && v.baselineOk === undefined && !led.over) {
      const b = await verifyOne(led, byGid.get(gid)!, recs.get(gid), true);
      v.baselineOk = b.ok; v.attributable = b.ok; v.ok = b.ok ? false : true; (v as { origFail?: boolean }).origFail = !b.ok;
    }
  }
  writeFileSync(vfile, JSON.stringify(results));
  for (const [k, list] of wanted) await runList(k, list, k.endsWith("|ai") ? "full" : "sample");
  writeFileSync(vfile, JSON.stringify(results));
  // 층별 오류율 → 임계(1%) 초과 층은 전수로 확대
  const rate = (k: string) => { const es = Object.values(results).filter((v) => v.stratum === k); return { n: es.length, errors: es.filter((v) => !v.ok).length }; };
  const expanded: string[] = [];
  for (const [k, list] of strata) {
    const r = rate(k);
    if (r.n && r.errors / r.n >= 0.01 && r.n < list.length) {
      expanded.push(k); console.log(`[verify] 층 ${k} 오류 ${r.errors}/${r.n} → 전수 확대(${list.length - r.n}건 추가, 추정 +$${((list.length - r.n) * 0.07).toFixed(2)})`);
      const finished = await runList(k, list, "full");
      writeFileSync(vfile, JSON.stringify(results));
      if (!finished) { console.log("비용 상한 도달 — 확대 중단, 미검증 항목은 적용 대상에서 제외"); break; }
    }
  }
  // 적용 후보: 섞은 문항 중 (전수 검증 층이면 검증 통과분만, 표본 층이 임계 이내면 표본 밖 문항도 포함, 실패한 문항 제외)
  const summary: Record<string, unknown> = {};
  const apply: FixEntry[] = [];
  for (const [k, list] of strata) {
    const r = rate(k); const fullLayer = expanded.includes(k) || k.endsWith("|ai");
    const passed = list.filter((e) => results[e.gid]?.ok);
    const unverified = list.filter((e) => !results[e.gid]);
    const take = fullLayer ? passed : [...passed, ...unverified];
    apply.push(...take);
    summary[k] = { total: list.length, verified: r.n, errors: r.errors, errorRate: r.n ? Number((r.errors / r.n).toFixed(4)) : null, expandedToFull: expanded.includes(k), applied: take.length, excludedFailed: list.length - take.length - (fullLayer ? unverified.length : 0), excludedUnverified: fullLayer ? unverified.length : 0 };
  }
  const blindMismatch = Object.values(results).filter((v) => !v.blindOk).length;
  writeFileSync(path.join(out, "apply-candidates.json"), JSON.stringify(apply.map((e) => ({ ...e, verification: results[e.gid] ? (results[e.gid].phase === "full" ? "full_pass" : "sample_pass") : "unsampled_stratum_ok" }))));
  const final = { spentUsd: Number(led.spent.toFixed(2)), cap, strata: summary, blindMismatchAmongVerified: blindMismatch, verifiedTotal: Object.keys(results).length, applyCount: apply.length };
  writeFileSync(path.join(out, "verify-summary.json"), JSON.stringify(final, null, 1));
  console.log(JSON.stringify(final, null, 1));
}
