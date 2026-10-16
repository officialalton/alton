// 생성 품질 합격 검증 — (5) 세트 조립 · (6) 응시 종단 · (7) 난이도 점검 연계 (2026-10-01). **격리 스택 전용**(공유 로컬 DB 54422 사용 금지).
// 사전: `. /tmp/iso.env`(SUPABASE_TEST_DB_URL·NEXT_PUBLIC_SUPABASE_URL·SUPABASE_SECRET_KEY 가 격리 스택을 가리킴) 후 acc-import(=import.ts)로 생성 문항을 넣어 둔다.
// 실행: npx tsx scripts/mock-exam-generation/acc-set.ts [--sets 3]  -> data/mock-exam-generation/mockgen-20260929/acceptance/set-test.json
// 조립은 관리자 서버 액션 `assembleMockExamSet`(세션 필요)과 같은 순수 함수(lib/mock-exam/assemble)·같은 순서로 재현하고, DB 검증은 실제 RPC(mock_exam_validate_mst_set)를 쓴다.
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { assembleSection, difficultyAllowedForModule, mstModulePlans, type AssembledItem, type EligibleProblem } from "../../lib/mock-exam/assemble";
import { estimateScore } from "../../lib/mock-exam/score-estimate";
import { ADMIN_ID, DB_URL, answer as _unused, asUser, assign, createStudent, psql, routes, start, state, submitModule } from "../../test/mock-exam-routing-fixture";
void _unused;

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!/:(545\d\d)$/.test(URL) || /54421|54422/.test(URL + DB_URL)) throw new Error("격리 스택(545xx)이 아닙니다 — 중단");
const db = createClient(URL, process.env.SUPABASE_SECRET_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
const RW = ["rw_information_ideas", "rw_craft_structure", "rw_expression_ideas", "rw_standard_english"];
const MATH = ["algebra", "advanced_math", "problem_solving_data", "geometry_trig"];
const MATH_FMT = [{ format: "mc" as const, weightPct: 75 }, { format: "spr" as const, weightPct: 25 }];
const SETS = Number(process.argv[process.argv.indexOf("--sets") > 0 ? process.argv.indexOf("--sets") + 1 : 0] || 3);
const out: Record<string, unknown> = { sets: [] as unknown[] };

async function eligible(domains: string[]): Promise<EligibleProblem[]> {
  const res: EligibleProblem[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("problems").select("id, sat_domain, skill_code, format, similarity_group, problem_versions!problem_versions_problem_id_fkey!inner(id, status, difficulty)")
      .in("sat_domain", domains).eq("status", "confirmed").in("usage_scope", ["mock_exam", "both"]).is("archived_at", null).eq("problem_versions.status", "published").order("id").range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) { const v = (Array.isArray(row.problem_versions) ? row.problem_versions : [row.problem_versions])[0]; const d = String(v?.difficulty ?? "").toLowerCase(); if (!v || !row.sat_domain || !["easy", "medium", "hard"].includes(d) || !["mc", "spr"].includes(row.format)) continue; res.push({ problemId: row.id, problemVersionId: v.id, satDomain: row.sat_domain, skillCode: row.skill_code, difficulty: d as "easy", format: row.format, similarityGroup: row.similarity_group ?? null }); }
    if (!data || data.length < 1000) break;
  }
  return res;
}
async function weights(section: "rw" | "math") {
  const [{ data: dr }, { data: fr }] = await Promise.all([db.from("mock_exam_domain_weights").select("sat_domain, weight_pct").eq("difficulty_tier", "standard").eq("section", section), db.from("mock_exam_difficulty_weights").select("problem_difficulty, weight_pct").eq("difficulty_tier", "standard").eq("section", section)]);
  return { domainWeights: (dr ?? []).map((r) => ({ satDomain: r.sat_domain as string, weightPct: Number(r.weight_pct) })), difficultyWeights: (fr ?? []).map((r) => ({ difficulty: r.problem_difficulty as "easy", weightPct: Number(r.weight_pct) })) };
}

(async () => {
  const [rwPool, mathPool, rwW, mathW] = await Promise.all([eligible(RW), eligible(MATH), weights("rw"), weights("math")]);
  out.pool = { rw: rwPool.length, math: mathPool.length, domainWeightKeys: { rw: rwW.domainWeights.map((d) => d.satDomain), math: mathW.domainWeights.map((d) => d.satDomain) } };
  const usedAcrossSets = new Set<string>();
  const setIds: string[] = [];
  // 마지막 세트(n = SETS+1)는 Math 형식(mc/spr) 비중을 끈 '종단 시험용' 세트 — 기본 조립이 hard SPR 부족으로 incomplete 일 때도 응시 종단을 시험하려는 목적.
  for (let n = 1; n <= SETS + 1; n++) {
    const useFmt = n <= SETS;
    // 세트 안 중복 차단 + 세트 간: 관리자 액션과 같이 '이미 쓴 문항'을 excludeProblemIds(소프트 회피)로만 넘긴다.
    const usedInSet = new Set<string>(), usedGroups = new Set<string>();
    const offsets = { rw: 0, math: 0 };
    type MI = AssembledItem & { moduleKey: string; route: "higher" | "lower" | null };
    const items: MI[] = [];
    const shortfalls: unknown[] = [];
    for (const mod of mstModulePlans(true)) {
      const isRw = mod.section === "rw"; const w = isRw ? rwW : mathW;
      const dw = w.difficultyWeights.filter((d) => difficultyAllowedForModule(mod, d.difficulty));
      const r = assembleSection({ section: mod.section, totalCount: mod.count, domainWeights: w.domainWeights, difficultyWeights: dw, candidates: (isRw ? rwPool : mathPool).filter((c) => !usedInSet.has(c.problemId) && difficultyAllowedForModule(mod, c.difficulty)), excludeProblemIds: usedAcrossSets, formatWeights: isRw || !useFmt ? undefined : MATH_FMT, selection: { skillUse: new Map(), usedGroups } });
      for (const it of r.items) { usedInSet.add(it.problemId); items.push({ ...it, position: it.position + offsets[mod.section], moduleKey: mod.key, route: mod.route }); }
      offsets[mod.section] += r.items.length;
      shortfalls.push(...r.shortfalls.map((s) => ({ module: `${mod.key}${mod.route ? "/" + mod.route : ""}`, ...s })));
    }
    // 종단 시험용 세트만: 생성 문항만으로는 채울 수 없는 hard 칸(PSD·Geometry hard 등 — 실제 조립에서는 원격 공급이 채움)을 같은 모듈에 허용되는 medium 으로 채워 정원을 맞춘다.
    if (!useFmt) {
      for (const mod of mstModulePlans(true)) {
        const cur = items.filter((i) => i.moduleKey === mod.key && i.route === mod.route).length;
        let need = mod.count - cur;
        if (need <= 0) continue;
        const pool = (mod.section === "rw" ? rwPool : mathPool).filter((c) => !usedInSet.has(c.problemId) && !(c.similarityGroup && usedGroups.has(c.similarityGroup)) && difficultyAllowedForModule(mod, c.difficulty) && c.difficulty === "medium");
        for (const c of pool) { if (need <= 0) break; usedInSet.add(c.problemId); if (c.similarityGroup) usedGroups.add(c.similarityGroup); items.push({ ...c, section: mod.section, position: offsets[mod.section] + 1, moduleKey: mod.key, route: mod.route } as MI); offsets[mod.section] += 1; need--; }
      }
      shortfalls.push({ note: "종단 시험용 세트: 부족한 hard 칸을 medium 으로 보충" });
    }
    const { data: set, error } = await db.from("mock_exam_sets").insert({ name: `ACC-${Date.now()}-${n}${useFmt ? "" : "-nofmt"}`, difficulty_tier: "standard", status: "draft", format: "mst", module_time_limits: { rw_m1: 1920, rw_m2: 1920, break: 600, math_m1: 2100, math_m2: 2100 }, module_item_counts: { rw_m1: 27, rw_m2: 27, math_m1: 22, math_m2: 22 }, assembly_rules: { skillMaxSharePct: 50, enforceM1Eligibility: true, noSimilarGroupRepeat: true, routing: true }, rw_time_limit_minutes: 64, math_time_limit_minutes: 70, created_by: ADMIN_ID }).select("id").single();
    if (error) throw new Error(error.message);
    const { error: ie } = await db.from("mock_exam_set_items").insert(items.map((i) => ({ exam_set_id: set.id, section: i.section, position: i.position, problem_id: i.problemId, problem_version_id: i.problemVersionId, sat_domain: i.satDomain, skill_code: i.skillCode, difficulty: i.difficulty, module_key: i.moduleKey, route: i.route })));
    if (ie) throw new Error(ie.message);
    setIds.push(set.id);
    const { data: v } = await db.rpc("mock_exam_validate_mst_set", { p_exam_set_id: set.id });
    const report = v as { ready: boolean; duplicateCount: number; modules: { moduleKey: string; route: string | null; found: number; needed: number; ok: boolean }[]; skillViolations: unknown[]; skillWarnings: unknown[]; eligibilityViolations: unknown[]; similarityViolations: unknown[]; variantEligibilityViolations: unknown[]; routeShapeViolationCount: number; missingSnapshotCount: number };
    await db.from("mock_exam_sets").update({ readiness_status: report.ready ? "ready" : "incomplete", readiness_report: { ...report, shortfalls }, readiness_checked_at: new Date().toISOString() }).eq("id", set.id);
    // 자체 검사: 세트 안 유사 그룹 중복·난이도 배정·세트 간 중복
    const groups = new Map<string, number>();
    for (const it of items) if (it.similarityGroup) groups.set(it.similarityGroup, (groups.get(it.similarityGroup) ?? 0) + 1);
    const dupGroups = [...groups.values()].filter((c) => c > 1).length;
    const crossDup = items.filter((i) => usedAcrossSets.has(i.problemId)).length;
    const byModule: Record<string, Record<string, number>> = {};
    for (const it of items) { const k = `${it.moduleKey}${it.route ? "/" + it.route : ""}`; (byModule[k] ??= {}); byModule[k][it.difficulty] = (byModule[k][it.difficulty] ?? 0) + 1; }
    const elig = items.filter((it) => { const m = mstModulePlans(true).find((p) => p.key === it.moduleKey && p.route === it.route)!; return !difficultyAllowedForModule(m, it.difficulty); }).length;
    const skillCount = new Set(items.map((i) => i.skillCode)).size;
    for (const it of items) usedAcrossSets.add(it.problemId);
    (out.sets as unknown[]).push({ n, setId: set.id, itemCount: items.length, ready: report.ready, duplicateCount: report.duplicateCount, similarityViolations: report.similarityViolations.length, eligibilityViolations: report.eligibilityViolations.length + report.variantEligibilityViolations.length, routeShapeViolations: report.routeShapeViolationCount, missingSnapshot: report.missingSnapshotCount, skillWarnings: report.skillWarnings.length, moduleFound: report.modules.map((m) => `${m.moduleKey}${m.route ? "/" + m.route : ""}:${m.found}/${m.needed}`), shortfalls, ownChecks: { dupGroupsInSet: dupGroups, eligibilityViolations: elig, crossSetDuplicatesVsPrevious: crossDup, distinctSkills: skillCount, byModule } });
  }
  // (6) 응시 종단 — 첫 번째로 ready 인 세트.
  const readySetId = (out.sets as { setId: string; ready: boolean }[]).find((s) => s.ready)?.setId;
  out.readySetIsNoFormatVariant = (out.sets as { setId: string; ready: boolean; n: number }[]).find((s) => s.ready)?.n === SETS + 1;
  if (!readySetId) { out.attempt = { skipped: "ready 세트 없음(풀 부족) — 응시 종단 불가" }; }
  else {
    psql(`update mock_exam_sets set status = 'published' where id = '${readySetId}';`);
    const rows = JSON.parse(psql(`select coalesce(json_agg(json_build_object('id', i.id, 'module', i.module_key, 'route', i.route, 'format', p.format, 'ci', v.correct_index, 'answers', v.answers)), '[]') from mock_exam_set_items i join problem_versions v on v.id = i.problem_version_id join problems p on p.id = i.problem_id where i.exam_set_id = '${readySetId}';`)) as { id: string; module: string; route: string | null; format: string; ci: number | null; answers: string[] | null }[];
    const byId = new Map(rows.map((r) => [r.id, r]));
    const ids = (module: string, route: string | null) => rows.filter((r) => r.module === module && (r.route ?? null) === route).map((r) => r.id);
    const save = (sid: string, att: string, itemIds: string[], nCorrect: number) => itemIds.forEach((id, i) => { const r = byId.get(id)!; const right = r.format === "mc" ? String(r.ci ?? 0) : (r.answers?.[0] ?? "0"); const wrong = r.format === "mc" ? String(((r.ci ?? 0) + 1) % 4) : "-999"; asUser(sid, `select mock_exam_save_answer('${att}', '${id}', '${(i < nCorrect ? right : wrong).replace(/'/g, "''")}', 3);`); });
    const run = Math.random().toString(36).slice(2, 8);
    const res: Record<string, unknown> = {};
    for (const [label, rwFrac, mathFrac] of [["high", 1, 1], ["low", 0.3, 0.3]] as const) {
      const sid = createStudent(label, run); const att = assign(sid, readySetId); start(sid, att);
      const step = (mod: string, route: string | null, frac: number) => { const list = state(sid, att).items.map((i) => i.setItemId); const expected = new Set(ids(mod, route)); const match = list.length === expected.size && list.every((x) => expected.has(x)); save(sid, att, list, Math.round(list.length * frac)); submitModule(sid, att, mod); return match; };
      const checks: Record<string, unknown> = {};
      checks.rw_m1_items = step("rw_m1", null, rwFrac);
      const r1 = routes(att); checks.rwRoute = r1.rw;
      checks.rw_m2_items = step("rw_m2", r1.rw as "higher", rwFrac);
      submitModule(sid, att, "break");
      checks.math_m1_items = step("math_m1", null, mathFrac);
      const r2 = routes(att); checks.mathRoute = r2.math;
      checks.math_m2_items = step("math_m2", r2.math as "higher", mathFrac);
      const status = psql(`select status from mock_exam_attempts where id = '${att}';`);
      const mods = psql(`select json_agg(json_build_object('m', module_key, 'correct', raw_correct_count, 'n', item_count)) from mock_exam_attempt_modules where attempt_id = '${att}';`);
      const modArr = JSON.parse(mods) as { m: string; correct: number | null; n: number }[];
      const sum = (keys: string[]) => ({ total: modArr.filter((x) => keys.includes(x.m)).reduce((a, x) => a + x.n, 0), correct: modArr.filter((x) => keys.includes(x.m)).reduce((a, x) => a + (x.correct ?? 0), 0) });
      const rwS = sum(["rw_m1", "rw_m2"]), mS = sum(["math_m1", "math_m2"]);
      const est = estimateScore([{ section: "rw", ...rwS }, { section: "math", ...mathS(mS) }], { rw: r1.rw as "higher", math: r2.math as "higher" });
      res[label] = { ...checks, status, rw: rwS, math: mS, estimate: est, estimateSane: est ? est.total.low <= est.total.high && est.rw.low >= 200 && est.rw.high <= 800 && est.math.low >= 200 && est.math.high <= 800 : false };
    }
    out.attempt = { setId: readySetId, ...res };
  }
  // (7) 난이도 점검 연계 — 잠정 hard 가 목록에 보이고, 변경·이력이 반영되는지(RPC 는 관리자 액션과 같은 service_role 경로).
  const { data: list } = await db.rpc("problem_difficulty_review_list", { p_status: "provisional", p_limit: 5, p_offset: 0 });
  const l = list as { summary?: unknown; total?: number; rows?: { problemId: string; skillCode: string; difficulty: string }[] };
  const target = l?.rows?.[0];
  const d7: Record<string, unknown> = { listSummary: l?.summary, listTotal: l?.total };
  if (target) {
    const { data: detail } = await db.rpc("problem_difficulty_review_detail", { p_problem_id: target.problemId });
    const dj = (detail as { judge?: { hardJudge?: unknown; advisory?: unknown; recipeId?: unknown; generationStatus?: unknown } })?.judge;
    d7.detailHasHardJudge = Boolean(dj?.hardJudge); d7.detailHasAdvisory = Boolean(dj?.advisory); d7.detailRecipeId = dj?.recipeId ?? null; d7.detailGenerationStatus = dj?.generationStatus ?? null;
    const { data: ch1 } = await db.rpc("review_problem_difficulty", { p_problem_ids: [target.problemId], p_to: "medium", p_actor_id: ADMIN_ID, p_reason: "합격 검증: hard→medium 변경 시험" });
    const after = psql(`select p.difficulty || '|' || p.difficulty_status || '|' || v.difficulty from problems p join problem_versions v on v.id = p.published_version_id where p.id = '${target.problemId}';`);
    const hist = psql(`select count(*) from problem_difficulty_changes where problem_id = '${target.problemId}';`);
    const { data: ch2 } = await db.rpc("review_problem_difficulty", { p_problem_ids: [target.problemId], p_to: "confirm", p_actor_id: ADMIN_ID, p_reason: "합격 검증: 확정" }).then((r) => r, () => ({ data: null }));
    d7.change = { result: ch1, afterDifficultyStatusVersion: after, historyRows: hist, confirmResult: ch2 };
    // 조립 스냅샷 불변: 이미 세트에 들어간 문항의 set_items.difficulty 는 바뀌지 않는다.
    d7.setSnapshotUnchanged = psql(`select count(*) from mock_exam_set_items where problem_id = '${target.problemId}' and difficulty = 'hard';`);
  }
  out.difficultyReview = d7;
  writeFileSync(path.resolve("data/mock-exam-generation/mockgen-20260929/acceptance/set-test.json"), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
})();
function mathS(m: { total: number; correct: number }) { return m; }
