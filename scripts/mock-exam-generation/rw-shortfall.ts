// R&W 부족 셀 점검 (읽기 전용). 원격 게시 문항 수(영역·skill·난이도)와 MST 세트 N개(기본 3)가 요구하는 수량을 비교한다.
// 실행: npx supabase projects api-keys --project-ref <ref> -o json | npx tsx scripts/mock-exam-generation/rw-shortfall.ts --url https://<ref>.supabase.co [--sets 3]
//   서비스 키는 stdin 으로만 받는다(저장·출력 금지).
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { buildTargetCells, mstModulePlans, difficultyAllowedForModule } from "../../lib/mock-exam/assemble";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const SETS = Number(arg("--sets") ?? 3);
const keys = JSON.parse(readFileSync(0, "utf-8")) as { name: string; api_key: string }[];
const key = keys.find((k) => k.name === "service_role")?.api_key;
if (!key || !arg("--url")) throw new Error("service_role 키(stdin)와 --url 필요");
const db = createClient(arg("--url")!, key, { auth: { autoRefreshToken: false, persistSession: false } });
const RW = ["rw_information_ideas", "rw_craft_structure", "rw_expression_ideas", "rw_standard_english"];

(async () => {
  const [{ data: dr }, { data: fr }] = await Promise.all([
    db.from("mock_exam_domain_weights").select("sat_domain, weight_pct").eq("difficulty_tier", "standard").eq("section", "rw"),
    db.from("mock_exam_difficulty_weights").select("problem_difficulty, weight_pct").eq("difficulty_tier", "standard").eq("section", "rw"),
  ]);
  const DW = (dr ?? []).map((r) => ({ satDomain: r.sat_domain as string, weightPct: Number(r.weight_pct) }));
  const FW = (fr ?? []).map((r) => ({ difficulty: r.problem_difficulty as "easy" | "medium" | "hard", weightPct: Number(r.weight_pct) }));
  const need: Record<string, number> = {};
  for (const mod of mstModulePlans(true)) {
    if (mod.section !== "rw") continue;
    const cells = buildTargetCells(DW as never, FW.filter((d) => difficultyAllowedForModule(mod, d.difficulty)) as never, mod.count);
    for (const c of cells) if (c.targetCount > 0) { const k = `${c.satDomain}|${c.difficulty}`; need[k] = (need[k] ?? 0) + c.targetCount * SETS; }
  }
  const have: Record<string, number> = {}, bySkill: Record<string, number> = {};
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("problems").select("sat_domain, skill_code, problem_versions!problem_versions_problem_id_fkey!inner(status, difficulty)")
      .in("sat_domain", RW).eq("status", "confirmed").in("usage_scope", ["mock_exam", "both"]).is("archived_at", null).eq("problem_versions.status", "published").order("id").range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) { const v = (Array.isArray(row.problem_versions) ? row.problem_versions : [row.problem_versions])[0]; const d = String(v?.difficulty ?? "").toLowerCase(); const k = `${row.sat_domain}|${d}`; have[k] = (have[k] ?? 0) + 1; const s = `${row.sat_domain}|${row.skill_code}|${d}`; bySkill[s] = (bySkill[s] ?? 0) + 1; }
    if (!data || data.length < 1000) break;
  }
  const rows = Object.keys({ ...need, ...have }).sort().map((k) => ({ cell: k, need: need[k] ?? 0, have: have[k] ?? 0, gap: (need[k] ?? 0) - (have[k] ?? 0) }));
  console.log(JSON.stringify({ sets: SETS, rows, bySkill }, null, 1));
})();
