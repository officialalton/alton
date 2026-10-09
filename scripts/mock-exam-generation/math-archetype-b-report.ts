// B 담당(일차 계열 5 skill) 원형 보고: 원형별 5,000 시드 스윕 + skill×난이도 공급 가능 수량 + 30세트 배치 가능성(세트당 그룹 1문항).
// DB·네트워크·유료 API 없음. 실행: npx tsx scripts/mock-exam-generation/math-archetype-b-report.ts [--seeds 5000] [--out data/mock-exam-generation/math-archetype-B]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ARCHETYPES, EM_ARCHETYPES } from "../../lib/problem-generation/math-archetypes/registry";
import { sweepArchetype, bodyShingles, generateOne } from "../../lib/problem-generation/math-archetypes/sweep";
import { produceFromArchetypes, type PassedRecord } from "../../lib/problem-generation/math-archetypes/bulk";
import { shingles } from "../../lib/problem-generation/math-archetypes/sweep";
import type { Archetype } from "../../lib/problem-generation/math-archetypes/types";
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const seeds = Number(arg("--seeds") ?? 5000); const out = path.resolve(arg("--out") ?? "data/mock-exam-generation/math-archetype-B"); mkdirSync(out, { recursive: true });
const B = ["linear_equations_one_var", "linear_functions", "linear_equations_two_var", "systems_linear", "linear_inequalities"];
const plan = JSON.parse(readFileSync("data/mock-exam-generation/plan.json", "utf-8")) as { cells: { system: string; skill: string; difficulty: string; target: number }[] };
const need = (skill: string, d: string) => (plan.cells.find((c) => c.system === "sat_math" && c.skill === skill && c.difficulty === d)?.target ?? 0) * 10;
const hardB = ARCHETYPES.filter((a) => B.includes(a.skill)), emB = EM_ARCHETYPES.filter((a) => B.includes(a.skill));

// 1) 원형별 스윕
const sweeps = [...hardB, ...emB].map((a) => { const st = sweepArchetype(a, seeds, { independentCap: 400 }); return { id: a.id, skill: a.skill, kind: a.kind, difficulty: a.difficulty ?? "hard", operator: a.operator, seeds, produced: st.produced, genFail: st.genFail, thrown: st.thrown, verifyFail: st.verifyFail, independent: st.independent, variants: st.variants }; });
const bad = sweeps.filter((s) => s.verifyFail || s.thrown || s.independent < 30);
console.log(`sweep ${sweeps.length} archetypes x ${seeds} seeds: verifyFail ${sweeps.reduce((p, s) => p + s.verifyFail, 0)}, thrown ${sweeps.reduce((p, s) => p + s.thrown, 0)}, produced ${sweeps.reduce((p, s) => p + s.produced, 0)}, below30 ${bad.length}`);

// 2) 공급 가능 수량(skill×난이도): 그룹당 30 상한 + 유사도 0.6 미만, skill 전체 풀 공유
type Row = { skill: string; difficulty: string; need: number; groups: number; produced: number; minGroup: number; feasible30: boolean; perSet: number };
const rows: Row[] = [];
const cap: Record<string, number> = { easy: 300, medium: 450, hard: 150 };
for (const skill of B) {
  const pool = new Map<string, Set<string>[]>(); const recs: Record<string, PassedRecord[]> = {};
  for (const d of ["hard", "medium", "easy"] as const) {
    const archs: Archetype[] = d === "hard" ? hardB.filter((a) => a.skill === skill) : emB.filter((a) => a.skill === skill && a.difficulty === d);
    const r = produceFromArchetypes(archs, { runId: "b-report", count: cap[d], seedStart: 0, maxPerGroup: 30, existing: pool, maxAttemptsPerItem: 400 });
    recs[d] = r.records; const sh = pool.get(skill) ?? []; for (const x of r.records) sh.push(shingles(`${(x.problem as { stimulus: string }).stimulus} ${(x.problem as { question: string }).question} ${((x.problem as { options: string[] }).options).join(" ")}`)); pool.set(skill, sh);
  }
  // 30세트 배치: 세트마다 easy need/30, medium need/30, hard(필요 hard 수)를 서로 다른 그룹에서 1개씩.
  const take = (d: string, perSetN: number[]) => {
    const byG = new Map<string, number>(); for (const x of recs[d]) byG.set(x.subpattern, (byG.get(x.subpattern) ?? 0) + 1);
    let ok = true; for (const n of perSetN) { const gs = [...byG.entries()].filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]).slice(0, n); if (gs.length < n) { ok = false; break; } for (const [g] of gs) byG.set(g, byG.get(g)! - 1); }
    return { ok, groups: new Set(recs[d].map((x) => x.subpattern)).size, minGroup: Math.min(...[...new Set(recs[d].map((x) => x.subpattern))].map((g) => recs[d].filter((x) => x.subpattern === g).length), 0) };
  };
  for (const d of ["easy", "medium", "hard"] as const) {
    const total = need(skill, d), perSet = d === "hard" ? Array.from({ length: 30 }, (_, i) => (i < total ? 1 : 0)) : Array.from({ length: 30 }, () => total / 30);
    const t = take(d, perSet); rows.push({ skill, difficulty: d, need: total, groups: t.groups, produced: recs[d].length, minGroup: t.minGroup, feasible30: t.ok && recs[d].length >= total, perSet: d === "hard" ? total / 30 : total / 30 });
  }
}
for (const r of rows) console.log(`${r.skill.padEnd(26)} ${r.difficulty.padEnd(6)} need ${String(r.need).padStart(3)} produced ${String(r.produced).padStart(3)} groups ${String(r.groups).padStart(2)} minGroup ${String(r.minGroup).padStart(2)} 30세트배치 ${r.feasible30 ? "가능" : "불가"}`);
writeFileSync(path.join(out, "report.json"), JSON.stringify({ seeds, sweeps, supply: rows }, null, 1));
// 5000 시드 위반 요약은 표준 출력으로(실패 시 상세)
for (const b of bad) console.log("BAD", JSON.stringify(b));
