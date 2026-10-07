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
const newCovered: string[] = []; const planSets: { versionId: string; position: number; problemId: string; moduleKey: string | null; route: string | null; section: string; skill: string | null; difficulty: string; domain: string; format: string; group: string | null }[][] = [];
// 커버리지 시딩(--cover): 이미 덮은 (skill,난이도) 칸이 많은 skill 의 '사용 수'를 미리 올려, 모듈 안 skill 균형 규칙(덜 쓴 skill 우선)이 빈 칸 skill 을 먼저 뽑게 한다.
const cover = process.argv.includes("--cover");
const seedUse = (section: string) => { const m = new Map<string, number>(); if (!cover) return m; for (const c of cands) { if ((section === "rw") !== RW.includes(c.satDomain)) continue; const k = `${c.satDomain}|${c.skillCode ?? ""}`; if (!m.has(k)) { let n = 0; for (const d of ["easy", "medium", "hard"]) if (cells.has(`${c.skillCode}|${d}`)) n++; m.set(k, n); } } return m; };
for (let s = 1; s <= SETS; s++) {
  const offs: Record<string, number> = { rw: 0, math: 0 };
  let planCur: (typeof planSets)[number] | undefined = undefined as never; planCur = [];
  const usedInSet = new Set<string>(), usedGroups = new Set<string>(), hardReused = new Set<string>(); const items: EligibleProblem[] = []; const shorts: unknown[] = [];
  for (const mod of mstModulePlans(true)) {
    const isRw = mod.section === "rw"; const w = isRw ? weights.rw : weights.math;
    const dws = w.difficultyWeights.filter((d: any) => difficultyAllowedForModule(mod, d.difficulty));
    const res = assembleSection({ section: mod.section, totalCount: mod.count, domainWeights: w.domainWeights, difficultyWeights: dws, candidates: cands.filter((c) => (isRw ? RW.includes(c.satDomain) : !RW.includes(c.satDomain)) && !usedInSet.has(c.problemId) && difficultyAllowedForModule(mod, c.difficulty)), excludeProblemIds: excludeIds, formatWeights: isRw ? undefined : MATH_FMT, hardIgnoreFormat: true, selection: { skillUse: seedUse(mod.section), usedGroups, hardExcludeIds: excludeIds, hardReused } } as never);
    for (const it of res.items) { usedInSet.add(it.problemId); items.push(it); (planCur ??= []).push({ versionId: it.problemVersionId, position: (it as { position: number }).position + offs[mod.section], problemId: it.problemId, moduleKey: mod.key, route: mod.route ?? null, section: mod.section, skill: it.skillCode ?? null, difficulty: it.difficulty, domain: it.satDomain, format: it.format ?? "mc", group: it.similarityGroup ?? null }); }
    offs[mod.section] += res.items.length; shorts.push(...res.shortfalls);
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
    swaps.push(`swap ${tgt.skill}|${d} -> ${sk}|${d}`); Object.assign(tgt, { versionId: repl.problemVersionId, problemId: repl.problemId, skill: repl.skillCode ?? null, group: repl.similarityGroup ?? null }); cells.add(`${sk}|${d}`); done = true; }
  if (!done) swaps.push(`NO_SWAP ${sk}|${d}`);
}
console.log(swaps.join("\n"));
const miss: string[] = []; for (const sk of ALL_SKILLS) for (const d of ["easy", "medium", "hard"]) if (!cells.has(`${sk}|${d}`)) miss.push(`${sk}|${d}`);
console.log(`스킬 ${ALL_SKILLS.length}개 × 3 = ${ALL_SKILLS.length * 3}칸 중 커버 ${ALL_SKILLS.length * 3 - miss.length}`); console.log("빈 칸:", miss.join(", ") || "없음");

// --save: 새 문항이 실제로 임포트된 뒤(덤프에 포함된 상태)에서만 쓴다. draft 세트 + 항목을 저장하고 readiness 를 기록한다. 공개 세트는 건드리지 않는다.
if (process.argv.includes("--save")) {
  (async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
    const { data: adm } = await db.from("profiles").select("id").eq("role", "admin").limit(1).maybeSingle();
    const prefix = arg("--name-prefix") ?? "Coverage Draft";
    for (let i = 0; i < planSets.length; i++) {
      const items = planSets[i];
      if (items.some((x) => x.problemId.startsWith("new-"))) throw new Error("새 문항(가짜 id)이 포함됐다 — 임포트 후 재덤프로 다시 실행");
      const { data: setRow, error } = await db.from("mock_exam_sets").insert({ name: `${prefix} ${i + 1}`, description: "빈 칸 커버리지 보충용 초안(공개 전 검수 필요)", difficulty_tier: "standard", status: "draft", format: "mst",
        module_time_limits: { rw_m1: 1920, rw_m2: 1920, break: 600, math_m1: 2100, math_m2: 2100 }, module_item_counts: { rw_m1: 27, rw_m2: 27, math_m1: 22, math_m2: 22 }, assembly_rules: { skillMaxSharePct: 50, enforceM1Eligibility: true, noSimilarGroupRepeat: true, routing: true },
        rw_time_limit_minutes: 64, math_time_limit_minutes: 70, created_by: adm!.id }).select("id").single();
      if (error) throw new Error(error.message);
      const rows = items.map((x) => ({ exam_set_id: setRow.id, section: x.section, position: x.position, problem_id: x.problemId, problem_version_id: x.versionId, sat_domain: x.domain, skill_code: x.skill, difficulty: x.difficulty, module_key: x.moduleKey, route: x.route }));
      const { error: e2 } = await db.from("mock_exam_set_items").insert(rows); if (e2) throw new Error(`${setRow.id}: ${e2.message}`);
      const { data: v } = await db.rpc("mock_exam_validate_mst_set", { p_exam_set_id: setRow.id });
      const { data: iss } = await db.rpc("mock_exam_set_item_issues", { p_set_id: setRow.id });
      const ready = (v as { ready: boolean }).ready;
      await db.from("mock_exam_sets").update({ readiness_status: ready ? "ready" : "incomplete", readiness_report: { ...(v as object), shortfalls: [], checkedAt: new Date().toISOString() }, readiness_checked_at: new Date().toISOString() }).eq("id", setRow.id);
      console.log(`저장 ${prefix} ${i + 1} id=${setRow.id} items=${rows.length} ready=${ready} issues=${(iss ?? []).filter((x: { issue: string | null }) => x.issue).length}`);
    }
  })().catch((e) => { console.error(e); process.exit(1); });
}
