// 확장 묶음의 새 문항 후처리(2026-10-15): (1) 정답이 가장 긴 선지 단서 제거(오답 선지를 키 길이에 맞춤, 키·줄기·순서 불변), (2) 읽기 문항 해설의 숨은 문장 번호를 문단 번호·짧은 인용으로 교체.
// 기존(재사용) 문항은 건드리지 않는다. 변경 뒤 결정적 게이트가 새 위반을 내면 그 문항은 원래대로 되돌린다.
//   set -a; . ~/Developer/ALTON/.env.local; set +a; npx tsx scripts/ap-generation/el-long-rewrite.ts [--apply-only]
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import { runBatch, toolInput, estimate, ledger, type BatchReq } from "../mock-exam-generation/batch-lib";
import { ledgerTotal } from "./ledger-total";
import { passageDisplay, itemViolations, setViolations, type ElSetRaw } from "../../lib/ap-generation/englang-gates";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const F = "data/ap/stock/el-long-items.json", RAW = "data/audit/el-long-raw-rewrite.json", BAK = "data/audit/el-long-items.prerewrite.json", HARD = 228;
if (!existsSync(BAK)) copyFileSync(F, BAK);
const stock = JSON.parse(readFileSync(BAK, "utf-8")) as Json[];
const baseCount: Record<string, number> = {}; for (const r of ["englang-long-a", "englang-long-b"]) for (const s of JSON.parse(readFileSync(`data/ap/sample-2027/${r}/plan.json`, "utf-8")).specs as Json[]) baseCount[`ap_english_language-${s.id}-k0`] = s.baseCount;
const bcOf = (r: Json) => baseCount[String(r.stockKey).split(":").pop()!] ?? 0;
const W = (t: string) => t.trim().split(/\s+/).length;
const idOf = (k: string) => k.replace(/[^a-zA-Z0-9]/g, "_").slice(-48);
const explanationOf = (it: Json): string => { const key = it.options[it.key_index]; const lines = [`The correct answer is "${key.text}". ${key.why.trim()}`]; it.options.forEach((o: Json, i: number) => { if (i !== it.key_index) lines.push(`"${o.text}" is incorrect: ${o.why.trim()}`); }); return lines.join("\n"); };
const toRaw = (p: Json, items: Json[]): ElSetRaw => ({ kind: p.el_passage.kind, blueprint: p.blueprint, provenance: p.provenance, title: p.el_passage.title, paragraphs: p.el_passage.paragraphs, items: items.map((it) => ({ skill: it.skill, topic: it.topic, cognitive: it.cognitive, stem: it.stem, options: it.options.map((o: Json, j: number) => ({ text: o.text, is_key: j === it.key_index, label: o.label, why: o.why })), evidence_sentence_ids: it.evidence_sentence_ids ?? [], devices_used: it.devices_used ?? [], est_seconds: it.est_seconds ?? 75 })) });
const TOOL = { name: "submit_rewrite", description: "Return the rewritten questions.", input_schema: { type: "object", properties: { items: { type: "array", items: { type: "object", properties: { q: { type: "integer" }, options: { type: "array", description: "All four options in the ORIGINAL order; the keyed option text must be returned unchanged", items: { type: "object", properties: { text: { type: "string" }, why: { type: "string" } }, required: ["text", "why"] } } }, required: ["q", "options"] } } }, required: ["items"] } };
const SYS = `You are a psychometric item editor for AP English Language and Composition multiple-choice questions. You are given ONLY the questions that need editing. Two fixes, WITHOUT changing what any item tests:
1. LENGTH CUE. The keyed option is often the longest, most elaborated option, which lets test takers guess without reading. Rewrite each WRONG option so its word count is within about 85%-115% of the keyed option's word count, and in roughly 1 of every 3 questions make one wrong option slightly LONGER than the key. Lengthen by adding a specific, plausible-sounding but still wrong clause that fits the option's existing flaw (misreading, unsupported claim, reversed relation, wrong scope, wrong tone). If a wrong option is already as long as the key, leave it alone.
2. HIDDEN NUMBERS (reading passages only). Readers see paragraph numbers but NOT sentence numbers. In every "why", replace references like "sentence 14" or "(13-15)" with the paragraph number ("paragraph 4") or a short exact quotation from the passage. Keep the meaning.
Rules: do NOT change the stem, the order of options, or the keyed option's text. Keep every wrong option clearly wrong from the passage; never make a distractor more defensible or add a hedge that makes it true; keep options parallel in form. No option may exceed 46 words. No letters ("A", "both of the above"), no dollar sign, no markup characters. Keep each wrong option's flaw type unchanged; update its "why" only if you changed what the option claims or it contained a hidden number. For the writing (revision) questions keep sentence numbers as they are (students see them in brackets).
Call submit_rewrite once with every question given.`;
const keyLongest = (it: Json) => { const kw = W(it.options[it.key_index].text); return it.options.every((o: Json, j: number) => j === it.key_index || W(o.text) < kw); };
const keyLongestC = (it: Json) => { const k = it.options[it.key_index].text.length; return it.options.every((o: Json, j: number) => j === it.key_index || o.text.length < k); };
const hidden = (it: Json) => it.options.some((o: Json) => /\b[Ss]entences?\s+\d|\(\d+(?:\s*[-–]\s*\d+)?\)/.test(o.why));
(async () => {
  const reqs: BatchReq[] = [];
  for (const r of stock) { const p = r.payload; const bc = bcOf(r); const idx = p.items.map((_: Json, i: number) => i).filter((i: number) => i >= bc && (keyLongestC(p.items[i]) || keyLongest(p.items[i]) || (p.el_passage.kind === "reading" && hidden(p.items[i])))); if (!idx.length) continue;
    const disp = passageDisplay({ kind: p.el_passage.kind, title: p.el_passage.title, paragraphs: p.el_passage.paragraphs, provenance: p.provenance });
    const user = `PASSAGE\n${disp}\n\nQUESTIONS TO EDIT\n${idx.map((i: number) => { const it = p.items[i]; return `${i + 1}. ${it.stem}\n${it.options.map((o: Json, j: number) => `   [${j}] (${o.label}${j === it.key_index ? ", KEY" : ""}; ${W(o.text)} words) ${o.text}\n        why: ${o.why}`).join("\n")}`; }).join("\n\n")}\n\nCall submit_rewrite. Use the question numbers shown.`;
    reqs.push({ custom_id: `rw__${idOf(r.stockKey)}`, params: { model: "claude-opus-5-5", thinking: { type: "adaptive" }, output_config: { effort: "medium" }, max_tokens: 12000, system: [{ type: "text", text: SYS }], tools: [TOOL], tool_choice: { type: "auto" }, messages: [{ role: "user", content: user }] } as never });
  }
  let raw: Json = existsSync(RAW) ? JSON.parse(readFileSync(RAW, "utf-8")) : {};
  if (!process.argv.includes("--apply-only") && !Object.keys(raw).length) {
    const est = estimate("claude-opus-5-5", reqs.length, 4500, 6000); const t = ledgerTotal(); if (t.cumulativeUsd + est >= HARD) throw new Error("HARD STOP"); console.log(`cumulative ${t.cumulativeUsd}; est ${est.toFixed(2)}; ${reqs.length} requests`);
    const DIR = path.resolve("data/ap/sample-2027/englang-long-rw"); const got = await runBatch({ dir: DIR, name: "rewrite", requests: reqs, budgetUsd: ledger(DIR).spent() + 2, estimateUsd: est, pollMs: 20000 });
    for (const rq of reqs) { const g = got.get(rq.custom_id); raw[rq.custom_id] = g ? toolInput(g) : null; } writeFileSync(RAW, JSON.stringify(raw, null, 1));
  }
  const out: Json[] = JSON.parse(JSON.stringify(stock)); const log: Json[] = []; let b = { n: 0, c: 0, w: 0 }, a = { n: 0, c: 0, w: 0 };
  for (const r of out) { const p = r.payload; const bc = bcOf(r); const rw = raw[`rw__${idOf(r.stockKey)}`]; const L: Json = { key: r.stockKey, changed: 0, reverted: [] as string[] };
    p.items.forEach((it: Json, qi: number) => { if (qi < bc) return; b.n++; if (keyLongestC(it)) b.c++; if (keyLongest(it)) b.w++;
      const x = rw?.items?.find((y: Json) => y.q === qi + 1);
      if (x && Array.isArray(x.options) && x.options.length === it.options.length) {
        const keyOk = x.options[it.key_index].text.trim().replace(/\s+/g, " ") === it.options[it.key_index].text.trim().replace(/\s+/g, " ");
        const sizeOk = x.options.every((o: Json, j: number) => j === it.key_index || (W(o.text) <= 46 && W(o.text) >= 4));
        if (keyOk && sizeOk) {
          const old = JSON.parse(JSON.stringify(it.options)); x.options.forEach((o: Json, j: number) => { if (o.text.trim() !== it.options[j].text.trim() || o.why.trim() !== it.options[j].why.trim()) L.changed++; it.options[j].text = o.text.trim(); it.options[j].why = o.why.trim(); });
          const vOld = itemViolations(toRaw(stock.find((s) => s.stockKey === r.stockKey)!.payload, stock.find((s) => s.stockKey === r.stockKey)!.payload.items), toRaw(stock.find((s) => s.stockKey === r.stockKey)!.payload, [stock.find((s) => s.stockKey === r.stockKey)!.payload.items[qi]]).items[0]);
          const vNew = itemViolations(toRaw(p, p.items), toRaw(p, [it]).items[0]).filter((v) => !vOld.includes(v));
          if (vNew.length || (p.el_passage.kind === "reading" && hidden(it) && !hidden({ options: old }))) { it.options = old; L.reverted.push(`q${qi + 1}:gate:${vNew.join("|") || "hidden_ref"}`); }
        } else L.reverted.push(`q${qi + 1}:${keyOk ? "size" : "key_text_changed"}`);
      }
      it.explanation_en = explanationOf(it); a.n++; if (keyLongestC(it)) a.c++; if (keyLongest(it)) a.w++; });
    L.setViolations = setViolations(toRaw(p, p.items)); L.hiddenLeft = p.el_passage.kind === "reading" ? p.items.filter((it: Json, i: number) => i >= bc && hidden(it)).length : 0; log.push(L); }
  writeFileSync(F, JSON.stringify(out)); writeFileSync("data/audit/el-long-rewrite-log.json", JSON.stringify({ before: b, after: a, log }, null, 1));
  console.log(`new items ${b.n}: key strictly longest (chars) ${b.c} -> ${a.c}, (words) ${b.w} -> ${a.w}`); console.log(log.map((l) => `${l.key.split("-").slice(-2, -1)[0]} changed ${l.changed} reverted ${l.reverted.length} hiddenLeft ${l.hiddenLeft}`).join("\n"));
})();
