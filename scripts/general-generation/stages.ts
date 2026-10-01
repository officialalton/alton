// 일반용(general) 문항 생성 계획 (2026-09-30). DB 접근 없음.
// 실행: npx tsx scripts/general-generation/stages.ts --run <run-id> --stage stage1|full [--per-skill 25] [--overshoot 1.4]
//   stage1: RW 3 skill + Math 3 skill × 목표 5건(easy 2 / medium 3). full: 26 skill × 목표 per-skill(easy 40% / medium 60%), stage1 통과분은 이미 있는 것으로 계산(--have).
//   hard 는 일반용 이번 범위에서 제외. 출력: data/general-generation/<run>/<stage>/plan.json (scripts/general-generation/generate.ts 입력).
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { DOMAINS } from "../mock-exam-generation/plan";

export const STAGE1_SKILLS = ["words_in_context", "central_ideas_details", "transitions", "linear_equations_one_var", "percentages", "linear_functions"];
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
type Diff = "easy" | "medium";
export type Cell = { system: string; domain: string; skill: string; difficulty: Diff; target: number; have: number; generate: number };

export function buildPlan(perSkill: number, overshoot: number, only?: string[], have: Record<string, Partial<Record<Diff, number>>> = {}): Cell[] {
  const cells: Cell[] = [];
  for (const d of DOMAINS) for (const s of d.skills) {
    if (only && !only.includes(s.code)) continue;
    const easy = Math.round(perSkill * 0.4);
    const t: Record<Diff, number> = { easy, medium: perSkill - easy };
    for (const k of ["easy", "medium"] as Diff[]) {
      const h = have[s.code]?.[k] ?? 0;
      cells.push({ system: d.system, domain: d.domain, skill: s.code, difficulty: k, target: t[k], have: h, generate: Math.max(0, Math.ceil((t[k] - h) * overshoot)) });
    }
  }
  return cells;
}
if (process.argv[1]?.endsWith("general-generation/stages.ts")) {
  const run = arg("--run"), stage = arg("--stage") ?? "stage1";
  if (!run) throw new Error("--run 필요");
  const haveFile = arg("--have");
  const have = haveFile && existsSync(haveFile) ? JSON.parse(readFileSync(haveFile, "utf-8")) : {};
  const cells = stage === "stage1" ? buildPlan(5, Number(arg("--overshoot") ?? 1.4), STAGE1_SKILLS) : buildPlan(Number(arg("--per-skill") ?? 25), Number(arg("--overshoot") ?? 1.4), undefined, have);
  const out = path.resolve("data/general-generation", run, stage, "plan.json");
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ cells }, null, 1));
  console.log(out, "cells", cells.length, "target", cells.reduce((a, c) => a + c.target, 0), "generate", cells.reduce((a, c) => a + c.generate, 0));
}
