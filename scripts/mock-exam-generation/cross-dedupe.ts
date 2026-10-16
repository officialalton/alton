// 후보 교차 중복 제거(2026-10-07). 이전 clean 파일들과 비교해 정확히 같은 문제·다른 원형과의 3-gram Jaccard>=0.6 인 후보를 뺀다(같은 원형 인스턴스는 허용 — import.ts 규칙과 동일).
// 실행: npx tsx scripts/mock-exam-generation/cross-dedupe.ts --in a.json,b.json --prior x.clean.json,y.clean.json --out merged.json
import { readFileSync, writeFileSync } from "node:fs";
import { shingles, jaccard, exactKey, findNearDuplicate, type PoolEntry } from "./dup-rule";
type R = { gid: string; skill: string; problem: { stimulus?: string; passage?: string; question?: string; options?: string[] | null }; quality: { mockExamGeneration?: { archetypeId?: string } } };
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const load = (l?: string) => (l ?? "").split(",").filter(Boolean).flatMap((f) => JSON.parse(readFileSync(f, "utf-8")) as R[]);
const stem = (r: R) => r.problem.stimulus ?? r.problem.passage ?? "";
const entry = (r: R): PoolEntry & { ek: string } => ({ problemId: r.gid, sh: shingles(`${stem(r)} ${r.problem.question ?? ""} ${(r.problem.options ?? []).join(" ")}`), group: r.quality.mockExamGeneration?.archetypeId ?? null, ek: exactKey(stem(r), r.problem.question ?? null, r.problem.options) });
const bySkill = new Map<string, (PoolEntry & { ek: string })[]>(); const exact = new Set<string>();
for (const r of load(arg("--prior"))) { const e = entry(r); (bySkill.get(r.skill) ?? bySkill.set(r.skill, []).get(r.skill)!).push(e); exact.add(e.ek); }
const out: R[] = []; const drop = { exact: 0, near: 0 };
for (const r of load(arg("--in"))) { const e = entry(r); if (exact.has(e.ek)) { drop.exact++; continue; } const pool = bySkill.get(r.skill) ?? bySkill.set(r.skill, []).get(r.skill)!; if (findNearDuplicate(e.sh, e.group, pool)) { drop.near++; continue; } pool.push(e); exact.add(e.ek); out.push(r); }
writeFileSync(arg("--out")!, JSON.stringify(out)); console.log(JSON.stringify({ kept: out.length, ...drop }));
void jaccard;
