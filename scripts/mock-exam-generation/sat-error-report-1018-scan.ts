// 외부 검수 SAT Math 오류 신고(2026-10-18) 결함 전수 점검 — 로컬 문항 데이터(data/mock-exam-generation 등)를 읽기 전용으로 훑는다. DB·API 호출 없음.
//   npx tsx scripts/mock-exam-generation/sat-error-report-1018-scan.ts [--out docs/qa/sat-error-report-1018-scan.json]
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { hasGraphAndExpressionForSameCurves } from "../../lib/problem-generation/graph-expression-redundancy";
import { barLineNeedsValueLabels, type DataSpec } from "../../lib/problem-figures/templates/data";

type Item = { gid: string; skill?: string; recipeId?: string | null; problem: Record<string, any>; _file: string };
const arg = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };

function loadAll(root = "data"): Map<string, Item> {
  const m = new Map<string, Item>();
  const visit = (x: any, p: string, depth = 0) => {
    if (depth > 3 || !x) return;
    if (Array.isArray(x)) { for (const y of x) { if (y && typeof y === "object" && y.problem && y.gid && /^sat_math/.test(String(y.examSystem))) { if (!m.has(y.gid)) m.set(y.gid, { ...y, _file: p }); } else visit(y, p, depth + 1); } }
    else if (typeof x === "object") for (const k of Object.keys(x)) visit(x[k], p, depth + 1);
  };
  const walk = (d: string) => { for (const e of readdirSync(d)) { const p = path.join(d, e); const s = statSync(p); if (s.isDirectory()) { if (e === "ap" || e === "audit") continue; walk(p); } else if (p.endsWith(".json") && s.size < 60e6) { try { visit(JSON.parse(readFileSync(p, "utf-8")), p); } catch { /* 문항 파일이 아니다 */ } } } };
  walk(root);
  return m;
}

const tpl = (r?: string | null) => (r ?? "").split(".").slice(0, 3).join(".") || "(compiler)";
const text = (i: Item) => `${i.problem.passage ?? ""}\n${i.problem.question ?? ""}`;
const checks: Record<string, (i: Item) => boolean> = {
  "graph_and_expression": (i) => hasGraphAndExpressionForSameCurves(i.problem.figure, String(i.problem.passage ?? "")),
  "trig_function_of_angle_paren": (i) => /\b(sin|cos|tan)\s*\(\s*(angle|∠)/i.test(text(i)),
  "same_characteristic_wording": (i) => /\bsame characteristic\b|\bthis characteristic\b/i.test(text(i)),
  "bar_line_values_unreadable": (i) => !!i.problem.figure && i.problem.figure.type === "data" && barLineNeedsValueLabels(i.problem.figure as DataSpec),
  "polynomial_highest_power_phrase(신고 원문)": (i) => /highest power of \$?x\$? is 2/i.test(String(i.problem.passage ?? "")),
  "polynomial_degree_redundant_with_standard_form": (i) => /highest power of \$?x\$? is 2|quadratic (polynomial|expression)|second-degree polynomial|polynomial[^.]*of degree 2/i.test(String(i.problem.passage ?? "")) && /ax\^2 \+ bx \+ c/.test(String(i.problem.passage ?? "")),
};

const items = loadAll();
const report: Record<string, { count: number; byTemplate: Record<string, number>; sample: string[] }> = {};
for (const [name, fn] of Object.entries(checks)) report[name] = { count: 0, byTemplate: {}, sample: [] };
for (const i of items.values()) for (const [name, fn] of Object.entries(checks)) {
  if (!fn(i)) continue;
  const r = report[name]; r.count++; const k = `${i.skill}|${tpl(i.recipeId)}`; r.byTemplate[k] = (r.byTemplate[k] ?? 0) + 1; if (r.sample.length < 5) r.sample.push(i.gid);
}
console.log(`scanned ${items.size} SAT math items`);
for (const [k, v] of Object.entries(report)) { console.log(`${v.count}\t${k}`); for (const [t, n] of Object.entries(v.byTemplate).sort((a, b) => b[1] - a[1])) console.log(`   ${n}\t${t}`); }
const out = arg("--out");
if (out) writeFileSync(out, JSON.stringify({ scanned: items.size, report }, null, 1));

// 세트 계획 파일(모듈 항목의 group 에 레시피 id 가 들어 있다)에서 결함 템플릿 노출 수를 센다.
// 컴파일러·구형 LLM 문항은 group 이 't:' 로 시작해 본문을 알 수 없으므로 skill 별 상한으로 센다.
const PLAN_FILES: Record<string, string> = {
  "unique-sets-20261007": "data/mock-exam-generation/unique-sets-20261007/new-sets.json",
  "rebalance-20261008": "data/mock-exam-generation/rebalance-20261008/final/new-sets.json",
  "sat-expand-20261015(T14~26 후보)": "data/mock-exam-generation/sat-expand-20261015/final/new-sets.json",
};
const COMPILER_SKILLS = new Set(["linear_equations_two_var", "systems_linear", "nonlinear_functions", "nonlinear_equations_systems", "linear_inequalities", "linear_functions", "circles", "right_triangles_trigonometry", "inference_margin_error"]);
for (const [label, file] of Object.entries(PLAN_FILES)) {
  try {
    const sets = JSON.parse(readFileSync(file, "utf-8")) as { section: string; skill: string; group: string; versionId: string }[][];
    const seen = new Set<string>(); let poly = 0, tUpper = 0, mathN = 0; const tBy: Record<string, number> = {};
    for (const set of sets) for (const x of set) {
      if (x.section !== "math" || seen.has(x.versionId)) continue;
      seen.add(x.versionId); mathN++;
      if (/ee\.polynomial_distribution\.TB/.test(x.group)) poly++;
      if (x.group.startsWith("t:") && COMPILER_SKILLS.has(x.skill)) { tUpper++; tBy[x.skill] = (tBy[x.skill] ?? 0) + 1; }
    }
    console.log(`[${label}] sets=${sets.length} mathItems=${mathN} polynomial_distribution.TB=${poly} compilerOriginUpperBound=${tUpper} ${JSON.stringify(tBy)}`);
  } catch (e) { console.log(`[${label}] 읽기 실패: ${(e as Error).message}`); }
}
