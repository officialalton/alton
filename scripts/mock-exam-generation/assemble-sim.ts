// 초안 세트 조립 모의 실행(2026-10-06). **DB 쓰기 없음** — 덤프 JSON(은행 후보·공개 세트 문항·가중치·노출)과 (선택) 새 문항 JSON 을 읽어
// app/admin/mock-exam-actions.ts assembleMockExamSet 의 mst+routing 경로와 같은 순수 함수·같은 순서로 N개 세트를 조립해
// 90칸(R&W 11 + Math 19 skill × easy/medium/hard) 커버리지를 계산한다. 새 문항은 가짜 id 로 후보에 넣는다(임포트 전 투영).
// 실행: npx tsx scripts/mock-exam-generation/assemble-sim.ts --dump bank.json --weights weights.json [--new a.json,b.json] [--sets 4]
import { readFileSync, existsSync } from "node:fs";
import { assembleSection, difficultyAllowedForModule, mstModulePlans, type EligibleProblem } from "../../lib/mock-exam/assemble";
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const dump = JSON.parse(readFileSync(arg("--dump")!, "utf-8")); const W = JSON.parse(readFileSync(arg("--weights")!, "utf-8"));
const SETS = Number(arg("--sets") ?? 4);
const RW = ["rw_information_ideas", "rw_craft_structure", "rw_expression_ideas", "rw_standard_english"];
const P = new Map<string, any>(dump.problems.map((p: any) => [p.id, p]));
const V = new Map<string, any>(dump.versions.map((v: any) => [v.problem_id, v]));
const exposure = new Map<string, number>((W.exp ?? []).map((r: any) => [r.problem_id, r.set_count + r.attempt_count]));
const cands: EligibleProblem[] = [];
for (const p of dump.problems) {
  if (p.status !== "confirmed" || p.archived_at || p.usage_scope === "general" || !p.sat_domain) continue;
  const v = V.get(p.id); if (!v) continue; const d = String(v.difficulty ?? "").toLowerCase();
  if (!["easy", "medium", "hard"].includes(d) || !["mc", "spr"].includes(p.format)) continue;
  cands.push({ problemId: p.id, problemVersionId: v.id, satDomain: p.sat_domain, skillCode: p.skill_code, difficulty: d as never, format: p.format, similarityGroup: p.similarity_group ?? null, exposureCount: exposure.get(p.id) ?? 0 } as EligibleProblem);
}
const newFiles = (arg("--new") ?? "").split(",").filter((f) => f && existsSync(f));
let nid = 0; const seenSub = new Set<string>();
for (const f of newFiles) for (const r of JSON.parse(readFileSync(f, "utf-8"))) {
  const sub = r.subpattern ?? r.gid; // 유사문항 그룹은 DB 트리거가 부여하므로 subpattern 으로 근사
  cands.push({ problemId: `new-${++nid}`, problemVersionId: `newv-${nid}`, satDomain: r.domain, skillCode: r.skill, difficulty: r.difficulty, format: r.format, similarityGroup: `sub:${r.skill}:${sub}`, exposureCount: 0 } as EligibleProblem); void seenSub;
}
const dw = (s: string) => ({ domainWeights: W.dom.filter((r: any) => r.section === s).map((r: any) => ({ satDomain: r.sat_domain, weightPct: Number(r.weight_pct) })), difficultyWeights: W.diff.filter((r: any) => r.section === s).map((r: any) => ({ difficulty: r.problem_difficulty, weightPct: Number(r.weight_pct) })) });
const weights = { rw: dw("rw"), math: dw("math") };
const free = dump.sets.filter((s: any) => s.status === "published" && s.access_tier === "free").map((s: any) => s.id);
const usedPub = new Set<string>(dump.items.filter((i: any) => free.includes(i.exam_set_id)).map((i: any) => i.problem_id));
const cells = new Set<string>(dump.items.filter((i: any) => free.includes(i.exam_set_id)).map((i: any) => `${i.skill_code}|${i.difficulty}`));
const ALL_SKILLS = [...new Set(cands.map((c) => c.skillCode).filter(Boolean))] as string[];
console.log("후보", cands.length, "공개 3세트 커버", cells.size, "공개 세트 사용 문항", usedPub.size);
const excludeIds = new Set(usedPub); const MATH_FMT = [{ format: "mc" as const, weightPct: 75 }, { format: "spr" as const, weightPct: 25 }];
const newCovered: string[] = []; const planSets: { problemId: string; moduleKey: string | null; route: string | null; section: string; skill: string | null; difficulty: string; domain: string; format: string; group: string | null }[][] = [];
// 커버리지 시딩(--cover): 이미 덮은 (skill,난이도) 칸이 많은 skill 의 '사용 수'를 미리 올려, 모듈 안 skill 균형 규칙(덜 쓴 skill 우선)이 빈 칸 skill 을 먼저 뽑게 한다.
const cover = process.argv.includes("--cover");
const seedUse = (section: string) => { const m = new Map<string, number>(); if (!cover) return m; for (const c of cands) { if ((section === "rw") !== RW.includes(c.satDomain)) continue; const k = `${c.satDomain}|${c.skillCode ?? ""}`; if (!m.has(k)) { let n = 0; for (const d of ["easy", "medium", "hard"]) if (cells.has(`${c.skillCode}|${d}`)) n++; m.set(k, n); } } return m; };
for (let s = 1; s <= SETS; s++) {
  let planCur: (typeof planSets)[number] | undefined = undefined as never; planCur = [];
  const usedInSet = new Set<string>(), usedGroups = new Set<string>(), hardReused = new Set<string>(); const items: EligibleProblem[] = []; const shorts: unknown[] = [];
  for (const mod of mstModulePlans(true)) {
    const isRw = mod.section === "rw"; const w = isRw ? weights.rw : weights.math;
    const dws = w.difficultyWeights.filter((d: any) => difficultyAllowedForModule(mod, d.difficulty));
    const res = assembleSection({ section: mod.section, totalCount: mod.count, domainWeights: w.domainWeights, difficultyWeights: dws, candidates: cands.filter((c) => (isRw ? RW.includes(c.satDomain) : !RW.includes(c.satDomain)) && !usedInSet.has(c.problemId) && difficultyAllowedForModule(mod, c.difficulty)), excludeProblemIds: excludeIds, formatWeights: isRw ? undefined : MATH_FMT, hardIgnoreFormat: true, selection: { skillUse: seedUse(mod.section), usedGroups, hardExcludeIds: excludeIds, hardReused } } as never);
    for (const it of res.items) { usedInSet.add(it.problemId); items.push(it); (planCur ??= []).push({ problemId: it.problemId, moduleKey: mod.key, route: mod.route ?? null, section: mod.section, skill: it.skillCode ?? null, difficulty: it.difficulty, domain: it.satDomain, format: it.format ?? "mc", group: it.similarityGroup ?? null }); }
    shorts.push(...res.shortfalls);
  }
  planSets.push(planCur!);
  for (const it of items) { excludeIds.add(it.problemId); cells.add(`${it.skillCode}|${it.difficulty}`); newCovered.push(`${it.skillCode}|${it.difficulty}`); }
  console.log(`세트 ${s}: 문항 ${items.length} 부족셀 ${shorts.length} 재사용hard ${hardReused.size} 신규문항 ${items.filter((i) => i.problemId.startsWith("new-")).length}`);
}
// 스왑 보정: 빈 칸 (skill,난이도) 마다 같은 영역·난이도·형식에서 이미 2번 이상 덮인 칸의 문항을 빈 칸 새 문항으로 바꾼다(모듈·경로 배정 규칙 유지).
const covCount = new Map<string, number>(); const bump = (k: string, n: number) => covCount.set(k, (covCount.get(k) ?? 0) + n);
for (const it of dump.items.filter((i: any) => free.includes(i.exam_set_id))) bump(`${it.skill_code}|${it.difficulty}`, 1);
for (const st of planSets) for (const it of st) bump(`${it.skill}|${it.difficulty}`, 1);
const swaps: string[] = []; const inPlan = new Set(planSets.flat().map((i) => i.problemId));
for (const sk of ALL_SKILLS) for (const d of ["easy", "medium", "hard"]) {
  if ((covCount.get(`${sk}|${d}`) ?? 0) > 0) continue;
  const repl = cands.find((c) => c.skillCode === sk && c.difficulty === d && !inPlan.has(c.problemId) && !excludeIds.has(c.problemId)); if (!repl) { swaps.push(`NO_CANDIDATE ${sk}|${d}`); continue; }
  let done = false;
  for (const st of planSets) { if (done) break; const groups = new Set(st.map((i) => i.group).filter(Boolean));
    const tgt = st.find((i) => i.domain === repl.satDomain && i.difficulty === d && i.format === (repl.format ?? "mc") && (covCount.get(`${i.skill}|${i.difficulty}`) ?? 0) >= 2 && !(repl.similarityGroup && groups.has(repl.similarityGroup) && repl.similarityGroup !== i.group));
    if (!tgt) continue;
    bump(`${tgt.skill}|${tgt.difficulty}`, -1); bump(`${sk}|${d}`, 1); inPlan.delete(tgt.problemId); inPlan.add(repl.problemId);
    swaps.push(`swap ${tgt.skill}|${d} -> ${sk}|${d}`); Object.assign(tgt, { problemId: repl.problemId, skill: repl.skillCode ?? null, group: repl.similarityGroup ?? null }); cells.add(`${sk}|${d}`); done = true; }
  if (!done) swaps.push(`NO_SWAP ${sk}|${d}`);
}
console.log(swaps.join("\n"));
const miss: string[] = []; for (const sk of ALL_SKILLS) for (const d of ["easy", "medium", "hard"]) if (!cells.has(`${sk}|${d}`)) miss.push(`${sk}|${d}`);
console.log(`스킬 ${ALL_SKILLS.length}개 × 3 = ${ALL_SKILLS.length * 3}칸 중 커버 ${ALL_SKILLS.length * 3 - miss.length}`); console.log("빈 칸:", miss.join(", ") || "없음");
