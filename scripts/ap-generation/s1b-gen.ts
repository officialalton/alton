// S1b 구방식 대조군: 같은 셀(주제·스킬·계산기·구조)에 대해 LLM 이 문항 전체(보기·키·해설·루브릭·검증 코드)를 직접 쓴다. 이후 검증·검토는 pipeline2 의 동결 검토기를 그대로 쓴다.
//   npx tsx scripts/ap-generation/s1b-gen.ts gen     --from s1a --run s1b            # 최초 후보(셀 × 후보 수는 s1a 와 동일)
//   npx tsx scripts/ap-generation/s1b-gen.ts convert --run s1b                         # LLM 출력 → pipeline2 팩 + 자체 검증 코드 결과(extra_reasons.json)
//   npx tsx scripts/ap-generation/s1b-gen.ts repair  --from s1b --run s1b-r            # 실패 후보마다 피드백+이전 시도를 주고 전체 재작성 1회(후보당 수선 1회 상한)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { runBatch, toolInput, estimate, ledger, type BatchReq } from "../mock-exam-generation/batch-lib";
import { MODELS, subjectPrompt, toolFor, userPrompt, think } from "./prompts";
import { SAMPLE_PLAN, type Cell } from "./cells";
import type { ApCurriculumFile } from "../../lib/ap-curriculum/types";
import { loadEnvLocal } from "../keywords/db";

loadEnvLocal();
const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const stage = process.argv[2]; const RUN = arg("--run"); const FROM = arg("--from"); const SYNC = process.argv.includes("--sync");
const CAP = Number(process.env.AP_CAP_NEW ?? 11); const SUBJECT = "ap_calculus_ab";
const ROOT = path.resolve("data/ap/sample-2027"); const DIR = path.join(ROOT, RUN); mkdirSync(DIR, { recursive: true });
const PY = process.env.AP_PY ?? "/private/tmp/claude-501/-Users-jangjiman-Developer-ALTON/d05b2ffe-5d6e-4058-a909-5e3b8827cbe2/scratchpad/apvenv/bin/python";
type Json = Record<string, unknown>;
const rj = <T,>(f: string): T => JSON.parse(readFileSync(f, "utf-8")) as T;
const readJsonl = (f: string) => (existsSync(f) ? readFileSync(f, "utf-8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Json) : []);
const curr = rj<ApCurriculumFile>(path.resolve(`data/ap/curriculum-2027/${SUBJECT}.json`));
const topicTitle = new Map(curr.units.flatMap((u) => u.topics.map((t) => [t.code, t.title] as const))); const skillLabel = new Map(curr.skills.map((s) => [s.code, `${s.category}: ${s.label}`]));
type P2Cell = { cellId: string; archetype: string; kind: "mc" | "frq_bundle"; unitCode: string; topic: string; skill: string; calculator: string; candidates: number; extraTopics: string[] };
const toOld = (c: P2Cell): Cell => ({ cellId: c.cellId, subject: SUBJECT, kind: c.kind, unitCode: c.unitCode, keywordCode: c.topic, extraKeywordCodes: c.extraTopics, skill: c.skill, structure: c.kind === "mc" ? "standalone" : "frq_multipart", itemsPerCandidate: 1, candidates: c.candidates, calculator: c.calculator as Cell["calculator"],
  frqTemplate: c.kind === "mc" ? undefined : SAMPLE_PLAN.ap_calculus_ab.frq.find((f) => f.kw === c.topic)?.tpl });
const baseSpent = () => { const f = path.join(DIR, "baseline.json"); if (!existsSync(f)) writeFileSync(f, JSON.stringify({ spent: ledger(DIR).spent() })); return rj<{ spent: number }>(f).spent; };
const reqFor = (cell: Cell, i: number, id: string, extra = ""): BatchReq => ({ custom_id: id, params: { model: MODELS.gen, ...think(MODELS.gen), max_tokens: cell.kind === "frq_bundle" ? 9000 : 6000,
  system: [{ type: "text", text: subjectPrompt(SUBJECT), cache_control: { type: "ephemeral", ttl: "1h" } }], tools: [toolFor(cell)], tool_choice: { type: "auto" },
  messages: [{ role: "user", content: userPrompt(cell, topicTitle.get(cell.keywordCode) ?? "", skillLabel.get(cell.skill) ?? cell.skill, 4, i, "") + extra }] } });

async function gen() {
  const cells = rj<P2Cell[]>(path.join(ROOT, FROM, "cells.json")); writeFileSync(path.join(DIR, "cells.json"), JSON.stringify(cells, null, 1));
  const reqs: BatchReq[] = []; for (const c of cells) for (let i = 0; i < c.candidates; i++) reqs.push(reqFor(toOld(c), i, `${c.cellId}-k${i}`));
  const est = estimate(MODELS.gen, reqs.length, 3200, 3500); console.log(`s1b gen: ${reqs.length}건 추정 $${est.toFixed(2)} 상한 신규 $${CAP}`);
  await runBatch({ dir: DIR, name: "gen", requests: reqs, budgetUsd: baseSpent() + CAP, estimateUsd: est, sync: SYNC, syncConcurrency: 10 });
}
async function repair() {
  const cells = rj<P2Cell[]>(path.join(ROOT, FROM, "cells.json")); const verd = rj<{ key: string; passed: boolean; reasons: string[]; review?: Json | null; solver?: { answers?: { ambiguous_or_flawed?: boolean; flaw_note?: string }[] } | null }[]>(path.join(ROOT, FROM, "verdicts.json"));
  const prev = new Map(readJsonl(path.join(ROOT, FROM, "gen.results.jsonl")).filter((r) => r.ok).map((r) => [r.custom_id as string, toolInput(r as never) as Json | null]));
  const fbText = (v: (typeof verd)[number]) => { const parts = [`Rejection reasons: ${v.reasons.join("; ")}`]; const r = v.review as Json | null | undefined; if (r) { for (const k of ["scope_skill", "key_scoring", "stimulus_expression", "distractor_explanation", "exam_suitability"]) { const c = r[k] as { pass?: boolean; notes?: string } | undefined; if (c && c.pass === false) parts.push(`${k}: ${c.notes || "failed"}`); } if (typeof r.summary === "string") parts.push(`Reviewer summary: ${r.summary}`); } const fl = v.solver?.answers?.find((a) => a.ambiguous_or_flawed)?.flaw_note; if (fl) parts.push(`Independent solver flagged: ${fl}`); return parts.join("\n"); };
  const newCells: P2Cell[] = []; const reqs: BatchReq[] = []; const map: Record<string, string> = {};
  for (const v of verd.filter((x) => !x.passed)) {
    const m = v.key.match(/^(.*)-k(\d+)$/)!; const c = cells.find((x) => x.cellId === m[1])!; const i = Number(m[2]); const nid = `${m[1]}-r${i}`;
    newCells.push({ ...c, cellId: nid, candidates: 1 }); map[`${nid}-k0`] = v.key;
    const extra = `\n\nREPAIR (single attempt): your previous version of this item was rejected. Write ONE complete corrected item for the same cell (you may change anything, including the numbers and stimulus).\nPREVIOUS VERSION:\n${JSON.stringify(prev.get(v.key) ?? {})}\nREVIEW FEEDBACK:\n${fbText(v)}`;
    reqs.push(reqFor({ ...toOld(c), cellId: nid }, i, `${nid}-k0`, extra));
  }
  writeFileSync(path.join(DIR, "cells.json"), JSON.stringify(newCells, null, 1)); writeFileSync(path.join(DIR, "repair_map.json"), JSON.stringify(map, null, 1));
  const est = estimate(MODELS.gen, reqs.length, 5200, 3500); console.log(`s1b repair: ${reqs.length}건 추정 $${est.toFixed(2)}`);
  await runBatch({ dir: DIR, name: "gen", requests: reqs, budgetUsd: baseSpent() + CAP, estimateUsd: est, sync: SYNC, syncConcurrency: 10 });
}
function verify(code: string): { ok: boolean; out: Json | null; err: string } {
  const r = spawnSync(PY, ["-c", code], { encoding: "utf-8", timeout: 40000, maxBuffer: 8 * 1024 * 1024 }); if (r.status !== 0) return { ok: false, out: null, err: (r.stderr ?? "").slice(-160) };
  const line = (r.stdout ?? "").trim().split("\n").filter(Boolean).pop() ?? ""; try { return { ok: true, out: JSON.parse(line) as Json, err: "" }; } catch { return { ok: false, out: null, err: "no_json_output" }; }
}
function convert() {
  const cells = rj<P2Cell[]>(path.join(DIR, "cells.json")); const res = new Map(readJsonl(path.join(DIR, "gen.results.jsonl")).filter((r) => r.ok).map((r) => [r.custom_id as string, toolInput(r as never) as Json | null]));
  const packs: Record<string, unknown[]> = {}; const extra: Record<string, string[]> = {};
  for (const c of cells) {
    const key = `${c.cellId}-k0`; const idx = c.candidates; void idx;
    for (let i = 0; i < c.candidates; i++) {
      const k = `${c.cellId}-k${i}`; const p = res.get(k); packs[c.cellId] ??= [];
      if (!p) { (packs[c.cellId] as unknown[]).push({ archetype: "llm", topic: c.topic, skill: c.skill, calculator: c.calculator, stem: "", stimulus: { kind: "none", description: "", data: {} }, options: [], key_index: 0, est_seconds: 0, facts: [] }); extra[k] = ["generation_failed"]; continue; }
      const why: string[] = []; const code = String(p.verification_code ?? "");
      if (c.kind === "mc") {
        const opts = ((p.options as string[]) ?? []).map((t, n) => ({ text: String(t), why: ((p.option_rationale as string[]) ?? [])[n] ?? null, value: null }));
        packs[c.cellId].push({ archetype: "llm", topic: c.topic, skill: c.skill, calculator: (p.calculator_part as string) ?? c.calculator, stem: p.stem, stimulus: p.stimulus ?? { kind: "none", description: "", data: {} }, options: opts, key_index: p.key_index, est_seconds: p.est_seconds, facts: [], explanation_en: p.explanation_en });
        const v = verify(code); if (!v.ok) why.push(`verification_error:${v.err.slice(0, 60)}`); else if (v.out?.conceptual_only !== true && v.out?.computed_key_index !== p.key_index) why.push("verification_key_mismatch");
      } else {
        packs[c.cellId].push({ archetype: "llm", template: SAMPLE_PLAN.ap_calculus_ab.frq.find((f) => f.kw === c.topic)?.tpl ?? "", topic: c.topic, skill: c.skill, extra_topics: c.extraTopics, calculator: (p.calculator_part as string) ?? c.calculator, title: p.title, stimulus: p.stimulus, parts: p.parts, total_points: p.total_points, est_minutes: p.est_minutes, facts: [] });
        const v = verify(code); if (!v.ok) why.push(`verification_error:${v.err.slice(0, 60)}`);
      }
      if (why.length) extra[k] = why;
    }
    void key;
  }
  writeFileSync(path.join(DIR, "packs.json"), JSON.stringify(packs)); writeFileSync(path.join(DIR, "extra_reasons.json"), JSON.stringify(extra, null, 1));
  console.log(`convert: ${Object.values(packs).flat().length}팩, 자체 검증 코드 불일치/오류 ${Object.keys(extra).length}건`, extra);
}
(async () => { if (stage === "gen") await gen(); else if (stage === "repair") await repair(); else if (stage === "convert") convert(); else console.log("stage: gen | repair | convert"); })().catch((e) => { console.error(e); process.exit(1); });
