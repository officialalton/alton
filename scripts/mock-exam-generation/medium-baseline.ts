// 기존 medium 컴파일러의 세부 패턴별 풀이 단계 수 실측(해설 문장 수 기준) — hard 원형 '추가 요구 사고'의 비교 기준. 실행: npx tsx scripts/mock-exam-generation/medium-baseline.ts
import { writeFileSync } from "node:fs";
import { runMathCompilerBatch } from "../../lib/problem-generation/math-compilers/batch";
import { MATH_SKILL_KINDS } from "../../lib/problem-generation/math-compilers/kind-catalog";
const orig = console.log; const rows: Record<string, { medium: number; hard: number; n: number }> = {};
const steps = (t: string) => t.split(/(?<=[.。])\s+|(?<=이다\.)\s*|\n+/).map((x) => x.trim()).filter((x) => x.length > 3).length;
(async () => {
  for (const [skill, kinds] of Object.entries(MATH_SKILL_KINDS)) for (const k of kinds) {
    const r: Record<string, number[]> = { medium: [], hard: [] };
    console.log = () => {};
    for (const diff of ["medium", "hard"] as const) for (let b = 0; b < 12; b++) { const res = await runMathCompilerBatch({ skillCode: skill as never, difficulty: diff, count: 10, kind: k.value }); for (const a of res.accepted) r[diff].push(steps((a.problem as never as { explanation: string }).explanation)); }
    console.log = orig;
    const avg = (x: number[]) => (x.length ? Math.round((x.reduce((a, b) => a + b, 0) / x.length) * 10) / 10 : 0);
    rows[`${skill}.${k.value}`] = { medium: avg(r.medium), hard: avg(r.hard), n: r.medium.length };
  }
  writeFileSync("data/mock-exam-generation/math-medium-baseline.json", JSON.stringify(rows, null, 1));
  for (const [k, v] of Object.entries(rows)) orig(k.padEnd(60), `medium ${v.medium}  hard(existing) ${v.hard}  n=${v.n}`);
})();
