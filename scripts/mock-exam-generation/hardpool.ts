// hard 판정 대상 선별 (2026-09-30): 난이도 외 검수를 통과한(또는 difficulty_unstable 만 걸린) 문항 중 아직 weak/ 판정이 없는 것.
// 실행: npx tsx scripts/mock-exam-generation/hardpool.ts --run <id> [--skills a,b] [--label hard|any]  -> <run>/hardpool-gids.json
//   --label hard(기본): 생성 라벨 hard 또는 현재 최종 라벨 hard 인 문항만. any: 모든 대상.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { evaluateAll, loadRun } from "./aggregate-lib";
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const base = path.resolve("data/mock-exam-generation", arg("--run")!);
const skills = arg("--skills") ? new Set(arg("--skills")!.split(",")) : null;
const label = arg("--label") ?? "hard";
const BAD = "eabd2b5b-8d5f-46a0-b1ce-732e5e4360b2";
const run = loadRun(base);
const ev = evaluateAll(run).filter((e) => (!skills || skills.has(e.raw.skill)) && e.raw.gid !== BAD && !run.weak?.has(e.raw.gid)
  && (e.verdict === "pass" || (e.reasons.length > 0 && e.reasons.every((r) => r === "difficulty_unstable")))
  && (label === "any" || e.raw.difficulty === "hard" || e.finalDifficulty === "hard"));
writeFileSync(path.join(base, "hardpool-gids.json"), JSON.stringify(ev.map((e) => e.raw.gid)));
console.log("대상", ev.length);
