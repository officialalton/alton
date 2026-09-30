// 검수 결과 집계 (2026-09-29). DB 접근 없음.
// 실행: npx tsx scripts/mock-exam-generation/aggregate.ts --run <run-id> [--plan plan.json] [--next-round N]
//   출력(<run>/final/): passed.json(통과) · archive-candidates.json(보관 후보) · summary.json · summary.md(셀별 수량표)
//   --next-round N 이면 검수 통과 수가 부족한 셀만 모아 plan-roundN.json(생성량 = 부족분 × 1.5 올림)을 만든다.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { findDuplicates, deterministicIssues, type Raw, type ReviewResult } from "./review";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
type Cell = { system: string; domain: string; skill: string; difficulty: "easy" | "medium" | "hard"; target: number; supply: number; shortfall: number; generate: number };

const runId = arg("--run");
if (!runId) throw new Error("--run 필요");
const base = path.resolve("data/mock-exam-generation", runId);
const plan = JSON.parse(readFileSync(path.resolve(arg("--plan") ?? path.join(base, "plan-round1.json")), "utf-8")) as { cells: Cell[] };
const raws = readdirSync(path.join(base, "raw")).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(path.join(base, "raw", f), "utf-8")) as Raw);
const reviews = new Map<string, ReviewResult>();
const revDir = path.join(base, "review");
if (existsSync(revDir)) for (const f of readdirSync(revDir)) if (f.endsWith(".json")) { const r = JSON.parse(readFileSync(path.join(revDir, f), "utf-8")) as ReviewResult; reviews.set(r.gid, r); }

// 오답 제거 용이성 임계값(난이도별 '쉽게 지워지는 오답 수'가 이 값 이상이면 보관 후보). 기본: easy 4(=판정 안 함), medium 3, hard 2.
const weak = Object.fromEntries((arg("--weak") ?? "easy=4,medium=3,hard=2").split(",").map((x) => x.split("=")).map(([k, v]) => [k, Number(v)])) as Record<string, number>;
type Eff = { raw: Raw; verdict: "pass" | "archive" | "unreviewed"; reasons: string[]; review: ReviewResult | null };
const effective: Eff[] = raws.map((r) => {
  const rev = reviews.get(r.gid);
  if (!rev) return { raw: r, verdict: "unreviewed", reasons: ["not_reviewed"], review: null };
  // AI 판정 사유만 가져오고, 결정론 사유(원시 LaTeX 등)와 오답 제거 용이성은 여기서 현재 규칙으로 다시 계산한다.
  const DET = new Set(["weak_distractors", "difficulty_label_mismatch", "raw_latex_in_body", "unbalanced_dollar_in_body", "raw_latex_in_explanation", "unbalanced_dollar_in_explanation", "internal_field_name_exposed", "empty_explanation"]);
  const reasons = [...rev.reasons.filter((x) => !DET.has(x) && !x.startsWith("near_duplicate_of")), ...deterministicIssues(r)];
  if (!rev.blind) reasons.push(...rev.reasons.filter((x) => x.startsWith("near_duplicate_of")));
  const elim = (rev.blind?.easilyEliminated ?? []).filter((i) => i !== r.problem.correctIndex).length;
  if (r.format === "mc" && rev.blind && elim >= weak[r.difficulty]) reasons.push("weak_distractors");
  // 난이도 라벨: 블라인드 풀이가 라벨과 두 단계 이상 어긋나면(hard↔easy) 보관 후보. 단, 라벨이 hard 이고 파이프라인(설계 정보를 본 추정)이
  // hard 라고 본 문항은 두 추정이 갈리는 것이므로 통과시키고 difficulty_disputed 로 기록한다(풀이 모델은 대체로 SAT 문항을 쉽게 본다).
  if (rev.blind) {
    const ord = { easy: 0, medium: 1, hard: 2 } as Record<string, number>;
    if (Math.abs(ord[r.difficulty] - ord[rev.blind.estimatedDifficulty]) >= 2) {
      const pipeEst = (r.quality as { estimatedDifficulty?: string } | undefined)?.estimatedDifficulty;
      if (!(r.difficulty === "hard" && pipeEst === "hard")) reasons.push("difficulty_label_mismatch");
    }
  }
  return { raw: r, verdict: reasons.length ? "archive" : "pass", reasons, review: rev };
});
// 통과 후보끼리 다시 한 번 유사도 제거(라운드가 섞여도 먼저 생성된 문항을 남긴다).
const dups = findDuplicates(effective.filter((e) => e.verdict === "pass").map((e) => e.raw));
const final: Eff[] = effective.map((e) => {
  const d = dups.get(e.raw.gid);
  return e.verdict === "pass" && d ? { ...e, verdict: "archive", reasons: [`near_duplicate_of:${d.of}@${d.score}`] } : e;
});
mkdirSync(path.join(base, "final"), { recursive: true });
const passed = final.filter((f) => f.verdict === "pass");
const archived = final.filter((f) => f.verdict === "archive");
writeFileSync(path.join(base, "final/passed.json"), JSON.stringify(passed.map((f) => ({ ...f.raw, review: f.review })), null, 1));
writeFileSync(path.join(base, "final/archive-candidates.json"), JSON.stringify(archived.map((f) => ({ ...f.raw, archiveReasons: f.reasons, review: f.review })), null, 1));

const key = (skill: string, d: string) => `${skill}|${d}`;
const cnt = (arr: typeof final) => { const m = new Map<string, number>(); for (const f of arr) m.set(key(f.raw.skill, f.raw.difficulty), (m.get(key(f.raw.skill, f.raw.difficulty)) ?? 0) + 1); return m; };
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
