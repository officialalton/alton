// AP Statistics S1 파일럿 결과 요약(무료·읽기 전용): 런별 통과·반려 사유, 독립 풀이 일치, 검토 5기준, 난이도 판정, 비용(원장 기준).
//   npx tsx scripts/ap-generation/stats-pilot-summary.ts [--runs stats-s1-l,stats-s1-m,stats-s1-h] [--json <경로>]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const RUNS = arg("--runs", "stats-s1-l,stats-s1-m,stats-s1-h").split(",");
const root = path.resolve("data/ap/sample-2027");
type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const rd = (f: string) => JSON.parse(readFileSync(f, "utf-8")) as J;
const rows: J[] = []; const cost: Record<string, number> = {};
for (const run of RUNS) {
  const dir = path.join(root, run);
  if (!existsSync(path.join(dir, "verdicts.json"))) continue;
  const verdicts = rd(path.join(dir, "verdicts.json")) as unknown as J[];
  const cells = new Map((rd(path.join(dir, "cells.json")) as unknown as J[]).map((c) => [c.cellId, c]));
  const packs = rd(path.join(dir, "packs.json"));
  let c = 0;
  for (const f of ["gen", "solve", "review", "review2", "review3", "review4", "difficulty"]) { const p = path.join(dir, `${f}.results.jsonl`); if (existsSync(p)) for (const l of readFileSync(p, "utf-8").split("\n").filter(Boolean)) { try { c += Number(JSON.parse(l).cost ?? 0); } catch { /* skip */ } } }
  cost[run] = Number(c.toFixed(4));
  for (const v of verdicts) {
    const cell = cells.get(v.cellId)!; const pk = (packs[v.cellId] ?? [])[0] ?? {};
    const sol = v.solver?.answers?.[0]; const agree = sol ? sol.choice_index === pk.key_index : null;
    const rev = v.review ?? {};
    rows.push({ run, archetype: cell.archetype, unit: cell.unitCode, topic: cell.topic, skill: cell.skill, passed: v.passed, reasons: v.reasons, solverAgrees: agree, solverFlag: sol?.ambiguous_or_flawed ?? null,
      fails: ["scope_skill", "key_scoring", "stimulus_expression", "distractor_explanation", "exam_suitability"].filter((k) => rev[k] && rev[k].pass === false), instantReject: rev.instant_reject ?? [], difficulty: v.difficulty?.difficulty ?? v.difficulty?.label ?? JSON.stringify(v.difficulty ?? {}).slice(0, 60), key: v.key });
  }
}
const pass = rows.filter((r) => r.passed).length;
console.log(`runs ${RUNS.join(",")}: 통과 ${pass}/${rows.length}`, cost);
for (const r of rows) console.log(`${r.passed ? "PASS" : "FAIL"} ${String(r.archetype).padEnd(26)} u${r.unit} ${String(r.topic).padEnd(5)} ${r.skill} solver=${r.solverAgrees} flag=${r.solverFlag} reviewFails=${r.fails.join("|") || "-"} reject=${(r.instantReject as string[]).join("|") || "-"} diff=${r.difficulty} ${(r.reasons as string[]).join(",")}`);
const j = arg("--json"); if (j) writeFileSync(j, JSON.stringify({ rows, cost, pass, total: rows.length }, null, 1));
