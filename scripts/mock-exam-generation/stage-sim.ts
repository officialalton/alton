// 단계 후보의 20세트 조립 시뮬레이션(2026-10-07). 칸(domain|difficulty|format)별 필요량을 세트에 균등 배분하고, 한 세트 안 같은 원형 1개·세트 쌍 공유 그룹 <= maxShared·그룹 총 출현 <= groupCap 으로 채울 수 있는지 본다.
// 실행: npx tsx scripts/mock-exam-generation/stage-sim.ts --clean items8.clean.json --targets targets.json --sets 20 [--max-shared 15] [--group-cap 6]
import { readFileSync } from "node:fs";
import { SKILL_BY_CODE } from "../../lib/problem-taxonomy";
const arg = (n: string, d?: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const recs = JSON.parse(readFileSync(arg("--clean")!, "utf-8")) as { gid: string; skill: string; difficulty: string; format: string; quality: { mockExamGeneration?: { archetypeId?: string } } }[];
const targets = JSON.parse(readFileSync(arg("--targets")!, "utf-8")) as Record<string, number>; // "domain|difficulty|format" -> 총 필요량(없으면 any)
const S = Number(arg("--sets", "20")), MAXS = Number(arg("--max-shared", "15")), CAP = Number(arg("--group-cap", "1000"));
const cellOf = (r: (typeof recs)[number]) => { const d = SKILL_BY_CODE.get(r.skill)!.domain; return targets[`${d}|${r.difficulty}|${r.format}`] != null ? `${d}|${r.difficulty}|${r.format}` : `${d}|${r.difficulty}|any`; };
const cells = new Map<string, typeof recs>(); for (const r of recs) { const c = cellOf(r); if (targets[c] != null) (cells.get(c) ?? cells.set(c, []).get(c)!).push(r); }
const sets: Set<string>[] = Array.from({ length: S }, () => new Set()); const pair = new Map<string, number>(); const use = new Map<string, number>(); const taken = new Set<string>();
const pk = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
const report: Record<string, unknown>[] = [];
for (const [c, pool] of [...cells].sort((a, b) => a[1].length / targets[a[0]] - b[1].length / targets[b[0]])) {
  const need = targets[c]; const per = Array.from({ length: S }, (_, s) => Math.floor(need / S) + (s < need % S ? 1 : 0)); let got = 0; const archs = new Set(pool.map((r) => r.quality.mockExamGeneration?.archetypeId ?? r.gid));
  for (let round = 0; round < Math.max(...per); round++) for (let s = 0; s < S; s++) { if (round >= per[s]) continue;
    let best: (typeof recs)[number] | null = null, bs = 1e9;
    for (const r of pool) { if (taken.has(r.gid)) continue; const g = r.quality.mockExamGeneration?.archetypeId ?? r.gid; if (sets[s].has(g)) continue; if ((use.get(g) ?? 0) >= CAP) continue;
      let ok = true, load = 0; for (let t = 0; t < S; t++) if (t !== s && sets[t].has(g)) { const v = (pair.get(pk(s, t)) ?? 0) + 1; if (v > MAXS) { ok = false; break; } load += v; }
      if (!ok) continue; const sc = (use.get(g) ?? 0) * 100 + load; if (sc < bs) { bs = sc; best = r; } }
    if (!best) continue; const g = best.quality.mockExamGeneration?.archetypeId ?? best.gid; for (let t = 0; t < S; t++) if (t !== s && sets[t].has(g)) pair.set(pk(s, t), (pair.get(pk(s, t)) ?? 0) + 1);
    sets[s].add(g); use.set(g, (use.get(g) ?? 0) + 1); taken.add(best.gid); got++; }
  report.push({ cell: c, need, candidates: pool.length, archetypes: archs.size, placed: got, short: need - got });
}
console.log(JSON.stringify({ sets: S, maxShared: MAXS, groupCap: CAP, maxPair: Math.max(0, ...pair.values()), avgPair: +(([...pair.values()].reduce((a, b) => a + b, 0)) / Math.max(1, S * (S - 1) / 2)).toFixed(1), maxGroupUse: Math.max(0, ...use.values()) }));
for (const r of report) console.log(JSON.stringify(r));
