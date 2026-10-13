// 무료 배선 점검(LLM·DB·네트워크 없음): 파이프라인 plan/blueprint/check 가 끝난 런 폴더에 "완벽한" 풀이·검토·난이도 결과를 지어 넣고(원장에는 기록하지 않음)
// report 단계가 공유 세트(문항 3 → 세트 1 후보)와 단독 문항을 올바르게 합치는지 확인할 수 있게 한다. 유료 호출 전에 보고·내보내기 경로를 검증하는 용도.
//   npx tsx scripts/ap-generation/stats-dry-run.ts --run _dry-stats-s2a [--fail-member <문항 키>]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const run = arg("--run", "_dry-stats-s2a"); const failMember = arg("--fail-member");
const dir = path.resolve("data/ap/sample-2027", run);
type Json = Record<string, unknown>;
const cells = JSON.parse(readFileSync(path.join(dir, "cells.json"), "utf-8")) as { cellId: string; kind: string }[];
const packs = JSON.parse(readFileSync(path.join(dir, "packs.json"), "utf-8")) as Record<string, Json[]>;
const check = JSON.parse(readFileSync(path.join(dir, "check.json"), "utf-8")) as Record<string, { reasons: string[] }>;
const tool = (id: string, input: Json) => JSON.stringify({ custom_id: id, ok: true, model: "dry-run", message: { content: [{ type: "tool_use", input }] }, cost: 0 });
const solve: string[] = [], review: string[] = [], diff: string[] = [];
const crit = { pass: true, notes: "dry run" };
const rev = { scope_skill: crit, key_scoring: crit, stimulus_expression: crit, distractor_explanation: crit, exam_suitability: crit, instant_reject: [], matches_reference_pattern: true, resembles_known_exam_item: false, summary: "dry run" };
for (const c of cells) {
  if (c.kind !== "mc") { // FRQ 번들: 파트마다 기대값 수치를 넣은 풀이
    packs[c.cellId].forEach((p, i) => {
      const key = `${c.cellId}-k${i}`; if ((check[key]?.reasons.length ?? 1) > 0) return;
      const ev = (p.expected_values as { part: string; value: number }[] | undefined) ?? [];
      solve.push(tool(`s-${key}`, { answers: (p.parts as { label: string }[]).map((pt) => ({ item: pt.label, final_answer: ev.filter((e) => e.part === pt.label).map((e) => String(e.value)).join(", ") || "reasoned", brief_reasoning: "dry", ambiguous_or_flawed: false })) }));
      review.push(tool(`r-${key}`, rev)); diff.push(tool(`d-${key}`, { label: "exam_prep", rationale: "dry run", reading_load: "low", computation_load: "low", reasoning_steps: 3, difficulty_from_unfair_sources: false }));
    });
    continue;
  }
  packs[c.cellId].forEach((p, i) => {
    const members = Array.isArray(p.items) ? (p.items as Json[]).map((it, j) => ({ key: `${c.cellId}-k${i}-q${j + 1}`, k: it.key_index as number })) : [{ key: `${c.cellId}-k${i}`, k: p.key_index as number }];
    for (const m of members) {
      if ((check[m.key]?.reasons.length ?? 1) > 0) continue;
      const wrong = failMember === m.key;
      solve.push(tool(`s-${m.key}`, { answers: [{ item: "1", choice_index: wrong ? (m.k + 1) % 4 : m.k, final_answer: "dry", brief_reasoning: "dry", ambiguous_or_flawed: false }] }));
      review.push(tool(`r-${m.key}`, rev));
      diff.push(tool(`d-${m.key}`, { label: "exam_prep", rationale: "dry run", reading_load: "low", computation_load: "low", reasoning_steps: 2, difficulty_from_unfair_sources: false }));
    }
  });
}
for (const [n, rows] of [["solve", solve], ["review", review], ["difficulty", diff]] as const) writeFileSync(path.join(dir, `${n}.results.jsonl`), rows.join("\n") + (rows.length ? "\n" : ""));
console.log(`dry run 결과 기록: solve ${solve.length}, review ${review.length}, difficulty ${diff.length}${existsSync(path.join(dir, "check.json")) ? "" : " (check.json 없음)"}`);
