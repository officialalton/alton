// 엄격 고유 세트 플래너(2026-10-07). **DB 접근 없음** — 덤프 JSON 만 읽는다.
// 오너 정책: 모의고사 세트 사이 문항 중복 0. 한 problem_id 는 전체 컬렉션에서 정확히 한 세트·한 모듈·한 경로에만 나온다.
//
// assemble-sim.ts 의 중복 원인(조사 결과):
//  1) selectForCells 의 excludeProblemIds 는 정렬 키의 2순위(소프트)일 뿐이다 — skill 균형(1순위)이 앞서 쉬운/보통 문항은
//     다른 세트에서 이미 쓴 문항도 그대로 뽑힌다. 하드 제외는 hard 후보뿐이고, 그마저 후보가 모자라면 `allowHardReuse` 로 재사용을 허용한다.
//  2) 스왑 보정(빈 칸 채우기)이 repl 후보를 `excludeIds` 에서만 거르는데, 세트 조립 중 쓴 문항은 조립이 끝난 뒤에야 excludeIds 에 들어간다
//     (세트 단위 갱신) — 같은 세트 안/뒤 세트의 문항과 겹칠 수 있고, 교체한 문항을 `excludeIds` 에 다시 넣지 않는다.
//  3) 시작 시 제외 집합이 "무료 공개 세트" 문항뿐이라 draft/tutoring 등 기존 세트 문항·기존 T4–T9 와는 애초에 겹침 검사를 하지 않는다.
//  4) 사후 단언이 없어 위 누수를 아무도 잡지 못했다. (경로: lower/higher 는 `usedInSet` 으로 서로 다른 문항을 쓰므로 세트 안 중복은 없다.)
// 이 플래너는 전역 `taken` 집합에서 한 번 뽑은 문항을 즉시 제거하고(구성상 보장), 마지막에 assertUnique 로 다시 검증한다.
//
// 실행: npx tsx scripts/mock-exam-generation/assemble-unique.ts --dump d.json --weights w.json --keep "SAT Practice Test 1,..." --n 6 [--first-index 4] [--fit] [--out dir]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { buildTargetCells, difficultyAllowedForModule, mstModulePlans, type EligibleProblem, type ProblemDifficulty } from "../../lib/mock-exam/assemble";

export const RW_DOMAINS = ["rw_information_ideas", "rw_craft_structure", "rw_expression_ideas", "rw_standard_english"];
const DIFFS: ProblemDifficulty[] = ["easy", "medium", "hard"];
const MATH_FMT = [{ format: "mc" as const, weightPct: 75 }, { format: "spr" as const, weightPct: 25 }];
const rank: Record<string, number> = { easy: 0, medium: 1, hard: 2 };

export type PlanItem = { versionId: string; position: number; problemId: string; moduleKey: string; route: string | null; section: string; skill: string | null; difficulty: string; domain: string; format: string; group: string | null };
export type Weights = { dom: { section: string; sat_domain: string; weight_pct: number }[]; diff: { section: string; problem_difficulty: string; weight_pct: number }[]; exp?: { problem_id: string; set_count: number; attempt_count: number }[] };
export type KeptItem = { setKey: string; problemId: string };
type Slot = { set: number; mod: ReturnType<typeof mstModulePlans>[number]; cell: { satDomain: string; difficulty: ProblemDifficulty; format?: "mc" | "spr"; targetCount: number } };

export function buildCandidates(dump: any, W: Weights): EligibleProblem[] {
  const V = new Map<string, any>(dump.versions.map((v: any) => [v.problem_id, v]));
  const exposure = new Map<string, number>((W.exp ?? []).map((r) => [r.problem_id, r.set_count + r.attempt_count]));
  const out: EligibleProblem[] = [];
  for (const p of dump.problems) {
    if (p.status !== "confirmed" || p.archived_at || p.usage_scope === "general" || !p.sat_domain) continue;
    const v = V.get(p.id); if (!v) continue; const d = String(v.difficulty ?? "").toLowerCase();
    if (!DIFFS.includes(d as never) || !["mc", "spr"].includes(p.format)) continue;
    out.push({ problemId: p.id, problemVersionId: v.id, satDomain: p.sat_domain, skillCode: p.skill_code, difficulty: d as never, format: p.format, similarityGroup: p.similarity_group ?? null, exposureCount: exposure.get(p.id) ?? 0 });
  }
  return out;
}

function weightsFor(W: Weights, section: string) {
  return {
    domainWeights: W.dom.filter((r) => r.section === section).map((r) => ({ satDomain: r.sat_domain, weightPct: Number(r.weight_pct) })),
    difficultyWeights: W.diff.filter((r) => r.section === section).map((r) => ({ difficulty: r.problem_difficulty as ProblemDifficulty, weightPct: Number(r.weight_pct) })),
  };
}

export function buildSlots(W: Weights, n: number, relaxFormat = false): Slot[] {
  const slots: Slot[] = [];
  for (let s = 0; s < n; s++) for (const mod of mstModulePlans(true)) {
    const w = weightsFor(W, mod.section);
    const cells = buildTargetCells(w.domainWeights, w.difficultyWeights.filter((d) => difficultyAllowedForModule(mod, d.difficulty)), mod.count, mod.section === "rw" || relaxFormat ? undefined : MATH_FMT, true);
    for (const cell of cells) if (cell.targetCount > 0) slots.push({ set: s, mod, cell });
  }
  return slots;
}
const poolKey = (c: { satDomain: string; difficulty: string; format?: string }) => `${c.satDomain}|${c.difficulty}|${c.format ?? "any"}`;

export type Shortfall = { domain: string; difficulty: string; format: string; demand: number; supply: number; extraNeeded: number };
export function demandVsSupply(pool: EligibleProblem[], slots: Slot[]): Shortfall[] {
  const dem = new Map<string, number>(); for (const sl of slots) dem.set(poolKey(sl.cell), (dem.get(poolKey(sl.cell)) ?? 0) + sl.cell.targetCount);
  const sup = new Map<string, number>(); for (const c of pool) for (const k of [poolKey({ ...c }), poolKey({ satDomain: c.satDomain, difficulty: c.difficulty })]) sup.set(k, (sup.get(k) ?? 0) + 1);
  const out: Shortfall[] = [];
  for (const [k, d] of dem) { const s = sup.get(k) ?? 0; if (s < d) { const [domain, difficulty, format] = k.split("|"); out.push({ domain, difficulty, format, demand: d, supply: s, extraNeeded: d - s }); } }
  return out.sort((a, b) => a.domain.localeCompare(b.domain) || a.difficulty.localeCompare(b.difficulty));
}
/** 풀(영역×난이도[×형식])별로 세트를 몇 개까지 댈 수 있는지 — 병목 파악용. */
export function maxNByPool(pool: EligibleProblem[], W: Weights, relax: boolean) {
  const dem = new Map<string, number>(); for (const sl of buildSlots(W, 1, relax)) dem.set(poolKey(sl.cell), (dem.get(poolKey(sl.cell)) ?? 0) + sl.cell.targetCount);
  return [...dem].map(([k, d]) => { const [domain, difficulty, format] = k.split("|"); const supply = pool.filter((c) => c.satDomain === domain && c.difficulty === difficulty && (format === "any" || c.format === format)).length; return { domain, difficulty, format, perSet: d, supply, maxSets: Math.floor(supply / d) }; }).sort((a, b) => a.maxSets - b.maxSets);
}
export function feasibleN(pool: EligibleProblem[], W: Weights, maxN: number, relax = false): number {
  let best = 0; for (let n = 1; n <= maxN; n++) { if (demandVsSupply(pool, buildSlots(W, n, relax)).length === 0) best = n; else break; } return best;
}

/** 전역 고유 선택. pool 은 이미 kept 문항이 빠진 후보. keptCov: 유지 세트가 이미 덮은 `skill|difficulty` 횟수. */
const cmpKey = (a: (number | string)[], b: (number | string)[]) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1; return 0; };
export type GroupLimits = { maxShared?: number; groupCap?: number; keptGroups?: Set<string>[] };
export function planUnique(pool: EligibleProblem[], W: Weights, n: number, keptCov: Map<string, number>, relaxFormat = false, limits: GroupLimits = {}) {
  const slots = buildSlots(W, n, relaxFormat);
  const maxShared = limits.maxShared ?? 15; const groupCap = limits.groupCap ?? Infinity; const kg = limits.keptGroups ?? [];
  const groupUse = new Map<string, number>(); for (const g of kg) for (const x of g) groupUse.set(x, (groupUse.get(x) ?? 0) + 1);
  // 새 세트 s 가 다른 세트(새 세트·유지 세트)와 공유하는 그룹 수 — 유사문항 그룹 g 를 s 에 추가해도 한도를 넘지 않는지.
  const shared = Array.from({ length: n }, () => new Map<string, number>()); // shared[s].get(other) ; other: `n${t}` | `k${t}`
  const others = (g: string, s: number) => { const o: string[] = []; setGroups.forEach((sg, t) => { if (t !== s && sg.has(g)) o.push(`n${t}`); }); kg.forEach((sg, t) => { if (sg.has(g)) o.push(`k${t}`); }); return o; };
  const groupOk = (g: string | null | undefined, s: number) => !g || ((groupUse.get(g) ?? 0) < groupCap && others(g, s).every((o) => (shared[s].get(o) ?? 0) + 1 <= maxShared));
  const groupAdd = (g: string | null | undefined, s: number, d: 1 | -1) => { if (!g) return; groupUse.set(g, (groupUse.get(g) ?? 0) + d); for (const o of others(g, s)) { shared[s].set(o, (shared[s].get(o) ?? 0) + d); if (o[0] === "n") { const t = Number(o.slice(1)); shared[t].set(`n${s}`, (shared[t].get(`n${s}`) ?? 0) + d); } } };
  const taken = new Set<string>(); const cov = new Map(keptCov);
  const setGroups: Set<string>[] = Array.from({ length: n }, () => new Set());
  const modSkill = new Map<string, number>(); // `${set}|${modKey}|${route}|${domain}|${skill}`
  const chosen = new Map<Slot, EligibleProblem[]>(); const failures: string[] = [];
  const byPool = new Map<string, Slot[]>(); for (const sl of slots) { const k = poolKey(sl.cell); (byPool.get(k) ?? byPool.set(k, []).get(k)!).push(sl); }
  for (const [k, group] of byPool) {
    const [domain, diff, fmt] = k.split("|");
    const cands = pool.filter((c) => c.satDomain === domain && c.difficulty === diff && (fmt === "any" || c.format === fmt));
    const left = new Map(group.map((sl) => [sl, sl.cell.targetCount])); let progress = true;
    while (progress) { progress = false;
      for (const sl of group) { if ((left.get(sl) ?? 0) <= 0) continue;
        const mk = (c: EligibleProblem) => `${sl.set}|${sl.mod.key}|${sl.mod.route}|${domain}|${c.skillCode ?? ""}`;
        let best: EligibleProblem | null = null, bk: (number | string)[] | null = null;
        for (const c of cands) { if (taken.has(c.problemId)) continue; if (c.similarityGroup && setGroups[sl.set].has(c.similarityGroup)) continue; if (!groupOk(c.similarityGroup, sl.set)) continue;
          const key: (number | string)[] = [cov.get(`${c.skillCode}|${diff}`) ?? 0, modSkill.get(mk(c)) ?? 0, c.similarityGroup ? groupUse.get(c.similarityGroup) ?? 0 : 0, c.exposureCount ?? 0, c.problemId];
          if (!bk || cmpKey(key, bk) < 0) { best = c; bk = key; } }
        if (!best) { left.set(sl, 0); failures.push(`${k} set${sl.set + 1} ${sl.mod.key}/${sl.mod.route ?? "-"}: no candidate left (group conflicts)`); continue; }
        taken.add(best.problemId); groupAdd(best.similarityGroup, sl.set, 1); if (best.similarityGroup) setGroups[sl.set].add(best.similarityGroup);
        modSkill.set(mk(best), (modSkill.get(mk(best)) ?? 0) + 1); cov.set(`${best.skillCode}|${diff}`, (cov.get(`${best.skillCode}|${diff}`) ?? 0) + 1);
        (chosen.get(sl) ?? chosen.set(sl, []).get(sl)!).push(best); left.set(sl, left.get(sl)! - 1); progress = true; } }
  }
  // 커버리지 보정: 빈 (skill,난이도) 칸을 같은 풀·같은 세트 안 중복 없는 미사용 후보로 바꾼다(이미 2회 이상 덮인 칸의 문항만 내보낸다).
  const swaps: string[] = [];
  const skills = [...new Set(pool.map((c) => c.skillCode).filter(Boolean))] as string[];
  for (const sk of skills) for (const d of DIFFS) { if ((cov.get(`${sk}|${d}`) ?? 0) > 0) continue;
    const repls = pool.filter((c) => c.skillCode === sk && c.difficulty === d && !taken.has(c.problemId)); let done = false;
    for (const r of repls) { if (done) break;
      for (const [sl, arr] of chosen) { if (done) break; if (sl.cell.difficulty !== d || sl.cell.satDomain !== r.satDomain) continue; if (sl.cell.format && sl.cell.format !== r.format) continue;
        const idx = arr.findIndex((it) => (cov.get(`${it.skillCode}|${d}`) ?? 0) >= 2); if (idx < 0) continue; const old = arr[idx];
        if (r.similarityGroup && r.similarityGroup !== old.similarityGroup && setGroups[sl.set].has(r.similarityGroup)) continue;
        if (r.similarityGroup !== old.similarityGroup && !(groupOk(r.similarityGroup, sl.set))) continue;
        taken.delete(old.problemId); taken.add(r.problemId); if (old.similarityGroup) { if (setGroups[sl.set].delete(old.similarityGroup)) groupAdd(old.similarityGroup, sl.set, -1); } if (r.similarityGroup) { groupAdd(r.similarityGroup, sl.set, 1); setGroups[sl.set].add(r.similarityGroup); }
        cov.set(`${old.skillCode}|${d}`, cov.get(`${old.skillCode}|${d}`)! - 1); cov.set(`${sk}|${d}`, 1); arr[idx] = r; swaps.push(`${old.skillCode}|${d} -> ${sk}|${d} (set${sl.set + 1})`); done = true; } } }
  // 모듈별 정렬·위치 부여(assemble-sim 과 같은 규칙: 난이도 오름차순·problemId, 섹션 안 모듈 오프셋 누적)
  const sets: PlanItem[][] = [];
  for (let s = 0; s < n; s++) { const offs: Record<string, number> = { rw: 0, math: 0 }; const items: PlanItem[] = [];
    for (const mod of mstModulePlans(true)) {
      const arr = slots.filter((sl) => sl.set === s && sl.mod === mod || (sl.set === s && sl.mod.key === mod.key && sl.mod.route === mod.route)).flatMap((sl) => chosen.get(sl) ?? []);
      arr.sort((a, b) => rank[a.difficulty] - rank[b.difficulty] || a.problemId.localeCompare(b.problemId));
      arr.forEach((it, i) => items.push({ versionId: it.problemVersionId, position: i + 1 + offs[mod.section], problemId: it.problemId, moduleKey: mod.key, route: mod.route, section: mod.section, skill: it.skillCode ?? null, difficulty: it.difficulty, domain: it.satDomain, format: it.format ?? "mc", group: it.similarityGroup ?? null }));
      offs[mod.section] += arr.length; }
    sets.push(items); }
  return { sets, failures, swaps, coverage: cov };
}

/** 최종 단언: (a) 새 세트 문항은 어떤 세트와도(유지 세트 포함) 겹치지 않는다 (b) 한 세트 안에서 한 문항은 한 번만 (c) 모듈 정원. 위반이면 throw. */
export function assertUnique(newSets: { problemId: string; moduleKey?: string; route?: string | null }[][], keptIds: Set<string>) {
  const seen = new Map<string, number>(); const errs: string[] = [];
  newSets.forEach((items, s) => { const inSet = new Set<string>();
    for (const it of items) { if (keptIds.has(it.problemId)) errs.push(`new set ${s + 1}: ${it.problemId} is used by a kept set`);
      if (inSet.has(it.problemId)) errs.push(`new set ${s + 1}: ${it.problemId} repeated within the set`); inSet.add(it.problemId);
      if (seen.has(it.problemId) && seen.get(it.problemId) !== s) errs.push(`${it.problemId} appears in new sets ${seen.get(it.problemId)! + 1} and ${s + 1}`); seen.set(it.problemId, s); } });
  if (errs.length) throw new Error(`uniqueness violated (${errs.length}): ${errs.slice(0, 5).join("; ")}`);
}
/** 오너 규칙 (3)(4): 새 세트 쌍·새-유지 세트 쌍이 공유하는 유사문항 그룹 수 <= maxShared, 같은 그룹의 전체 출현 횟수 <= groupCap. 위반이면 throw. */
export function assertGroupLimits(newSets: { group: string | null }[][], maxShared = 15, groupCap = Infinity, keptGroups: Set<string>[] = []) {
  const sets = [...keptGroups, ...newSets.map((it) => new Set(it.map((i) => i.group).filter(Boolean) as string[]))]; const errs: string[] = [];
  for (let a = 0; a < sets.length; a++) for (let b = a + 1; b < sets.length; b++) { if (a < keptGroups.length && b < keptGroups.length) continue; let c = 0; for (const g of sets[a]) if (sets[b].has(g)) c++; if (c > maxShared) errs.push(`sets ${a + 1}/${b + 1} share ${c} groups (> ${maxShared})`); }
  const use = new Map<string, number>(); for (const sg of sets) for (const g of sg) use.set(g, (use.get(g) ?? 0) + 1);
  for (const [g, c] of use) if (c > groupCap) errs.push(`group ${g} used in ${c} sets (> ${groupCap})`);
  if (errs.length) throw new Error(`group limits violated (${errs.length}): ${errs.slice(0, 5).join("; ")}`);
}
function countDupsAcross(sets: Map<string, string[]>) { const m = new Map<string, Set<string>>(); for (const [k, ids] of sets) for (const id of ids) (m.get(id) ?? m.set(id, new Set()).get(id)!).add(k); return [...m.entries()].filter(([, v]) => v.size > 1); }

// ---- 유지 세트(T1–T3) 안 중복 수리 계획 ----
export function repairPlan(dump: any, pool: EligibleProblem[], keptSets: { id: string; name: string }[]) {
  const P = new Map<string, any>(dump.problems.map((p: any) => [p.id, p]));
  const items = dump.items.filter((i: any) => keptSets.some((s) => s.id === i.exam_set_id));
  const firstSet = new Map<string, string>(); const repairs: any[] = []; const taken = new Set<string>();
  const groupsOf = (setId: string) => new Set<string>(items.filter((i: any) => i.exam_set_id === setId).map((i: any) => P.get(i.problem_id)?.similarity_group).filter(Boolean));
  const order = keptSets.map((s) => s.id);
  const sorted = [...items].sort((a: any, b: any) => order.indexOf(a.exam_set_id) - order.indexOf(b.exam_set_id) || a.position - b.position);
  for (const it of sorted) { if (!firstSet.has(it.problem_id)) { firstSet.set(it.problem_id, it.exam_set_id); continue; }
    const p = P.get(it.problem_id); const g = groupsOf(it.exam_set_id);
    const cands = pool.filter((c) => !taken.has(c.problemId) && c.satDomain === it.sat_domain && c.difficulty === it.difficulty && c.format === p.format && !(c.similarityGroup && g.has(c.similarityGroup)));
    const same = cands.filter((c) => c.skillCode === it.skill_code); const use = (same.length ? same : cands).sort((a, b) => (a.exposureCount ?? 0) - (b.exposureCount ?? 0) || a.problemId.localeCompare(b.problemId))[0];
    if (use) { taken.add(use.problemId); if (use.similarityGroup) g.add(use.similarityGroup); }
    repairs.push({ setId: it.exam_set_id, setName: keptSets.find((s) => s.id === it.exam_set_id)!.name, itemId: it.id, section: it.section, position: it.position, moduleKey: it.module_key, route: it.route, domain: it.sat_domain, skill: it.skill_code, difficulty: it.difficulty, format: p.format,
      keptInSet: keptSets.find((s) => s.id === firstSet.get(it.problem_id))!.name, oldProblemId: it.problem_id, oldVersionId: it.problem_version_id,
      newProblemId: use?.problemId ?? null, newVersionId: use?.problemVersionId ?? null, newSkill: use?.skillCode ?? null, sameSkill: !!same.length, status: use ? (same.length ? "ok" : "skill_fallback") : "NO_REPLACEMENT" }); }
  return { repairs, taken };
}

// ---- CLI ----
async function main() {
  const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
  const dump = JSON.parse(readFileSync(arg("--dump")!, "utf-8")); const W: Weights = JSON.parse(readFileSync(arg("--weights")!, "utf-8"));
  const N = Number(arg("--n") ?? 6); const first = Number(arg("--first-index") ?? 4); const out = arg("--out") ?? "data/mock-exam-generation/unique-sets-20261007"; mkdirSync(out, { recursive: true });
  const keepKeys = (arg("--keep") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const keptSets: { id: string; name: string }[] = keepKeys.map((k) => { const s = dump.sets.find((x: any) => x.id === k || x.id.startsWith(k) || x.name === k); if (!s) throw new Error(`keep set not found: ${k}`); return { id: s.id, name: s.name }; });
  const cands = buildCandidates(dump, W); const keptItems = dump.items.filter((i: any) => keptSets.some((s) => s.id === i.exam_set_id));
  const keptIds = new Set<string>(keptItems.map((i: any) => i.problem_id));
  let pool = cands.filter((c) => !keptIds.has(c.problemId));
  const rp = repairPlan(dump, pool, keptSets); for (const id of rp.taken) keptIds.add(id); pool = pool.filter((c) => !keptIds.has(c.problemId)); // 수리 교체분도 사용 처리
  const keptCov = new Map<string, number>(); for (const i of keptItems) { const k = `${i.skill_code}|${i.difficulty}`; keptCov.set(k, (keptCov.get(k) ?? 0) + 1); }
  for (const id of rp.taken) { const c = cands.find((x) => x.problemId === id)!; const k = `${c.skillCode}|${c.difficulty}`; keptCov.set(k, (keptCov.get(k) ?? 0) + 1); }
  const relax = process.argv.includes("--relax-format"); // 정책(math easy/medium SPR 25%)을 풀고 domain×난이도 총량만 맞춘다 — 오너 결정 필요
  const feas = feasibleN(pool, W, N, relax); const short = demandVsSupply(pool, buildSlots(W, N, relax));
  const useN = short.length === 0 ? N : process.argv.includes("--fit") ? feas : 0;
  const report: any = { requestedN: N, feasibleN: feas, kept: keptSets.map((s) => s.name), keptDuplicatesBetweenKept: countDupsAcross(new Map(keptSets.map((s) => [s.name, keptItems.filter((i: any) => i.exam_set_id === s.id).map((i: any) => i.problem_id)]))).length, maxNByPool: maxNByPool(pool, W, relax), formatRelaxed: relax, relaxedFeasibleN: feasibleN(pool, W, N, true), relaxedShortfallsAtRequestedN: demandVsSupply(pool, buildSlots(W, N, true)), shortfallsAtRequestedN: short, poolSize: pool.length };
  const skills = [...new Set(cands.map((c) => c.skillCode).filter(Boolean))] as string[];
  if (useN > 0) {
    const maxShared = Number(arg("--max-shared-groups") ?? 15); const groupCap = arg("--group-cap") ? Number(arg("--group-cap")) : Infinity;
    const P = new Map<string, any>(dump.problems.map((p: any) => [p.id, p])); const keptGroups = keptSets.map((ks) => new Set<string>(keptItems.filter((i: any) => i.exam_set_id === ks.id).map((i: any) => P.get(i.problem_id)?.similarity_group).filter(Boolean)));
    const r = planUnique(pool, W, useN, keptCov, relax, { maxShared, groupCap, keptGroups }); assertUnique(r.sets, keptIds);
    try { assertGroupLimits(r.sets, maxShared, groupCap, keptGroups); } catch (e) { report.groupLimitViolation = (e as Error).message; }
    const all = new Map<string, number>(); for (const it of r.sets.flat()) all.set(it.problemId, (all.get(it.problemId) ?? 0) + 1);
    const miss: string[] = []; for (const sk of skills) for (const d of DIFFS) if (!((r.coverage.get(`${sk}|${d}`)) ?? 0)) miss.push(`${sk}|${d}`);
    const unusedStock = (k: string) => { const [sk, d] = k.split("|"); return pool.filter((c) => c.skillCode === sk && c.difficulty === d && !all.has(c.problemId)).length; };
    Object.assign(report, { plannedSets: useN, names: r.sets.map((_, i) => `SAT Practice Test ${first + i}`), duplicateCount: [...all.values()].filter((v) => v > 1).length, itemsPerSet: r.sets.map((s) => s.length), cellsTotal: skills.length * 3, cellsCovered: skills.length * 3 - miss.length, missingCells: miss.map((k) => ({ cell: k, unusedStock: unusedStock(k) })), planFailures: r.failures, coverSwaps: r.swaps.length });
    writeFileSync(`${out}/new-sets.json`, JSON.stringify(r.sets)); writeFileSync(`${out}/new-sets-meta.json`, JSON.stringify({ names: report.names, firstIndex: first }));
  }
  report.repair = { total: rp.repairs.length, noReplacement: rp.repairs.filter((x) => x.status === "NO_REPLACEMENT").length, skillFallback: rp.repairs.filter((x) => x.status === "skill_fallback").length };
  writeFileSync(`${out}/repair-plan.json`, JSON.stringify(rp.repairs, null, 1)); writeFileSync(`${out}/plan-report.json`, JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1)); if (useN === 0) { console.error(`STOP: N=${N} infeasible (feasible N=${feas}); see shortfallsAtRequestedN`); process.exit(2); }
}
if (process.argv[1]?.endsWith("assemble-unique.ts")) main().catch((e) => { console.error(e); process.exit(1); });
