// 검수 결과 집계 (2026-09-29). DB 접근 없음.
// 실행: npx tsx scripts/mock-exam-generation/aggregate.ts --run <run-id> [--plan plan.json] [--next-round N]
//   출력(<run>/final/): passed.json(통과) · archive-candidates.json(보관 후보) · summary.json · summary.md(셀별 수량표)
//   --next-round N 이면 검수 통과 수가 부족한 셀만 모아 plan-roundN.json(생성량 = 부족분 × 1.5 올림)을 만든다.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { loadRun, evaluateAll } from "./aggregate-lib";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
type Cell = { system: string; domain: string; skill: string; difficulty: "easy" | "medium" | "hard"; target: number; supply: number; shortfall: number; generate: number };

const runId = arg("--run");
if (!runId) throw new Error("--run 필요");
const base = path.resolve("data/mock-exam-generation", runId);
const plan = JSON.parse(readFileSync(path.resolve(arg("--plan") ?? "data/mock-exam-generation/plan.json"), "utf-8")) as { cells: Cell[] };
const run = loadRun(base);
const weak = Object.fromEntries((arg("--weak") ?? "easy=4,medium=3,hard=2").split(",").map((x) => x.split("=")).map(([k, v]) => [k, Number(v)])) as Record<string, number>;
const final = evaluateAll(run, weak);
const raws = run.raws;
mkdirSync(path.join(base, "final"), { recursive: true });
const passed = final.filter((f) => f.verdict === "pass");
const archived = final.filter((f) => f.verdict === "archive");
// passed.json: 최종 라벨(finalDifficulty)을 difficulty 로 써서 임포트가 그대로 쓰게 한다(원래 라벨은 requestedDifficulty).
writeFileSync(path.join(base, "final/passed.json"), JSON.stringify(passed.map((f) => ({ ...f.raw, requestedDifficulty: f.raw.difficulty, difficulty: f.finalDifficulty, relabeled: f.relabeled, repaired: f.repaired, problem: { ...f.raw.problem, difficulty: f.finalDifficulty }, review: f.review })), null, 1));
writeFileSync(path.join(base, "final/archive-candidates.json"), JSON.stringify(archived.map((f) => ({ ...f.raw, archiveReasons: f.reasons, review: f.review })), null, 1));

const key = (skill: string, d: string) => `${skill}|${d}`;
const cnt = (arr: typeof final) => { const m = new Map<string, number>(); for (const f of arr) m.set(key(f.raw.skill, f.finalDifficulty), (m.get(key(f.raw.skill, f.finalDifficulty)) ?? 0) + 1); return m; };
const gen = cnt(final), pass = cnt(passed), arch = cnt(archived);
const reasonCount = new Map<string, number>();
for (const f of archived) for (const r of f.reasons) { const k = r.replace(/:.*/, ""); reasonCount.set(k, (reasonCount.get(k) ?? 0) + 1); }

// 종료 기준(총괄·오너 2026-09-29): 칸(skill×난이도)마다 최종 공개 가능 수 = 기존 공개 + 신규 검수 통과 ≥ 세트 3개 분량(target) + 여분 2.
const SPARE = Number(arg("--spare") ?? 2);
const rows = plan.cells.filter((c) => c.target > 0).map((c) => {
  const g = gen.get(key(c.skill, c.difficulty)) ?? 0, p = pass.get(key(c.skill, c.difficulty)) ?? 0, a = arch.get(key(c.skill, c.difficulty)) ?? 0;
  const required = c.target + SPARE;
  const finalCount = c.supply + p;
  return { ...c, required, generated: g, passed: p, archived: a, final: finalCount, spare: finalCount - c.target, missing: Math.max(0, required - finalCount) };
});
const sum = (sys: string, f: (r: (typeof rows)[number]) => number) => rows.filter((r) => r.system === sys).reduce((x, r) => x + f(r), 0);
const md: string[] = [`| 영역 | skill | 난이도 | 필요량(3세트 ${"+"}여분${SPARE}) | 기존 공개(가정) | 신규 생성(파이프라인 통과) | 신규 검수 통과 | 보관 후보 | 최종 | 여분(최종−3세트분) | 미달 |`, "|---|---|---|---|---|---|---|---|---|---|---|"];
for (const r of rows) md.push(`| ${r.domain} | ${r.skill} | ${r.difficulty} | ${r.required} | ${r.supply} | ${r.generated} | ${r.passed} | ${r.archived} | ${r.final} | ${r.spare} | ${r.missing || ""} |`);
for (const sys of ["sat_rw", "sat_math"]) md.push(`| **${sys} 합계** | | | ${sum(sys, (r) => r.required)} | ${sum(sys, (r) => r.supply)} | ${sum(sys, (r) => r.generated)} | ${sum(sys, (r) => r.passed)} | ${sum(sys, (r) => r.archived)} | ${sum(sys, (r) => r.final)} | ${sum(sys, (r) => r.spare)} | ${sum(sys, (r) => r.missing)} |`);
writeFileSync(path.join(base, "final/summary.md"), md.join("\n") + "\n\n보관 사유 집계: " + JSON.stringify(Object.fromEntries(reasonCount)) + "\n");
writeFileSync(path.join(base, "final/summary.json"), JSON.stringify({ spare: SPARE, rows, reasonCount: Object.fromEntries(reasonCount), totals: { generated: final.length, passed: passed.length, archived: archived.length, unreviewed: final.filter((f) => f.verdict === "unreviewed").length } }, null, 1));
console.log(md.join("\n"));
console.log("보관 사유:", Object.fromEntries(reasonCount));
console.log("합계", { generated: final.length, passed: passed.length, archived: archived.length });

const next = arg("--next-round");
if (next) {
  // 재생성량 = 미달분 / 통과율(칸 생성 4개 이상이면 칸 통과율, 아니면 skill 통과율; 하한 0.3) 올림 + 1. 칸당 상한 40.
  const skillRate = (skill: string) => { const g = rows.filter((r) => r.skill === skill).reduce((a, r) => a + r.generated, 0); const p = rows.filter((r) => r.skill === skill).reduce((a, r) => a + r.passed, 0); return g ? p / g : 0.5; };
  const cells = rows.filter((r) => r.missing > 0).map((r) => {
    const rate = Math.max(0.3, r.generated >= 4 ? r.passed / r.generated : skillRate(r.skill));
    return { system: r.system, domain: r.domain, skill: r.skill, difficulty: r.difficulty, target: r.target, supply: r.supply, shortfall: r.missing, generate: Math.min(40, Math.ceil(r.missing / rate) + 1) };
  });
  writeFileSync(path.join(base, `plan-round${next}.json`), JSON.stringify({ cells }, null, 1));
  console.log(`라운드 ${next} 계획: 셀 ${cells.length}개, 생성 ${cells.reduce((a, c) => a + c.generate, 0)}개`);
}
