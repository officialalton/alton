// 모의고사용 신규 문항 생성 계획 (2026-09-29). DB 접근 없음 — 순수 계산.
// 실행: npx tsx scripts/mock-exam-generation/plan.ts [--supply path.json] [--topup path/to/shortage.json]
//   --supply  : { "<skill>": { easy, medium, hard } } 현재 공개 가능 문항 수(난이도 실측). 없으면 skill별 총량(분류 보고서 A)을
//               목표 난이도 비율로 나눈 것으로 가정한다(원격 난이도 실측 불가 — 보고서 '가정' 참조).
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { allocateCounts } from "../../lib/mock-exam/assemble";

type Diff = "easy" | "medium" | "hard";
const DIFFS: Diff[] = ["easy", "medium", "hard"];

// 3배 풀 요구량(풀 요구량 보고서 2절).
const POOL = {
  sat_rw: { total: 243, diff: { easy: 54, medium: 162, hard: 27 } },
  sat_math: { total: 198, diff: { easy: 42, medium: 132, hard: 24 } },
};
// 영역 3배 풀(보고서 3절)과 영역 안 skill 비중(SAT 공식 비중 근사, 한 skill 50% 상한 안).
export const DOMAINS: { domain: string; system: "sat_rw" | "sat_math"; pool: number; skills: { code: string; w: number; format?: "mc" | "spr" }[] }[] = [
  { domain: "rw_information_ideas", system: "sat_rw", pool: 63, skills: [{ code: "central_ideas_details", w: 30 }, { code: "inferences", w: 25 }, { code: "command_of_evidence_text", w: 25 }, { code: "command_of_evidence_quant", w: 20 }] },
  { domain: "rw_craft_structure", system: "sat_rw", pool: 69, skills: [{ code: "words_in_context", w: 45 }, { code: "text_structure_purpose", w: 35 }, { code: "cross_text_connections", w: 20 }] },
  { domain: "rw_expression_ideas", system: "sat_rw", pool: 48, skills: [{ code: "rhetorical_synthesis", w: 50 }, { code: "transitions", w: 50 }] },
  { domain: "rw_standard_english", system: "sat_rw", pool: 63, skills: [{ code: "boundaries", w: 50 }, { code: "form_structure_sense", w: 50 }] },
  { domain: "algebra", system: "sat_math", pool: 69, skills: ["linear_equations_one_var", "linear_functions", "linear_equations_two_var", "systems_linear", "linear_inequalities"].map((code) => ({ code, w: 20 })) },
  { domain: "advanced_math", system: "sat_math", pool: 69, skills: ["equivalent_expressions", "nonlinear_equations_systems", "nonlinear_functions"].map((code) => ({ code, w: 100 / 3 })) },
  { domain: "problem_solving_data", system: "sat_math", pool: 30, skills: ["ratios_rates_units", "percentages", "one_variable_data", "two_variable_data", "probability", "inference_margin_error", "evaluating_statistical_claims"].map((code) => ({ code, w: 100 / 7 })) },
  { domain: "geometry_trig", system: "sat_math", pool: 30, skills: [{ code: "area_volume", w: 26 }, { code: "lines_angles_triangles", w: 26 }, { code: "right_triangles_trigonometry", w: 26 }, { code: "circles", w: 22 }] },
];

// 현재 공개 가능(A) skill별 총량 — docs/qa/2026-09-29-problem-bank-classification.md 3절.
export const SUPPLY_A: Record<string, number> = {
  area_volume: 32, boundaries: 0, central_ideas_details: 1, circles: 19, command_of_evidence_quant: 2, command_of_evidence_text: 0,
  cross_text_connections: 1, equivalent_expressions: 8, evaluating_statistical_claims: 5, form_structure_sense: 0, inference_margin_error: 4,
  inferences: 1, linear_equations_one_var: 13, linear_equations_two_var: 1, linear_functions: 22, linear_inequalities: 10,
  lines_angles_triangles: 0, nonlinear_equations_systems: 2, nonlinear_functions: 15, one_variable_data: 10, percentages: 9, probability: 7,
  ratios_rates_units: 6, rhetorical_synthesis: 1, right_triangles_trigonometry: 8, systems_linear: 5, text_structure_purpose: 2, transitions: 3,
  two_variable_data: 8, words_in_context: 0,
};

export const OVERSHOOT = 1.5;

export type Cell = { system: "sat_rw" | "sat_math"; domain: string; skill: string; difficulty: Diff; target: number; supply: number; shortfall: number; generate: number };

export function buildPlan(supplyByDiff?: Record<string, Partial<Record<Diff, number>>>): Cell[] {
  const cells: Cell[] = [];
  for (const d of DOMAINS) {
    const pool = POOL[d.system];
    const skillTargets = allocateCounts(d.skills.map((s) => ({ key: s.code, weightPct: s.w })), d.pool);
    for (const s of d.skills) {
      const diffTargets = allocateCounts(DIFFS.map((k) => ({ key: k, weightPct: pool.diff[k] })), skillTargets[s.code]);
      // 가정: 난이도 실측이 없으면 skill 총량을 풀 난이도 비율로 나눈다(내림, 나머지는 medium).
      const supply: Record<Diff, number> = { easy: 0, medium: 0, hard: 0 };
      if (supplyByDiff?.[s.code]) for (const k of DIFFS) supply[k] = supplyByDiff[s.code][k] ?? 0;
      else {
        const tot = SUPPLY_A[s.code] ?? 0;
        supply.easy = Math.floor((tot * pool.diff.easy) / pool.total);
        supply.hard = Math.floor((tot * pool.diff.hard) / pool.total);
        supply.medium = tot - supply.easy - supply.hard;
      }
      for (const k of DIFFS) {
        const shortfall = Math.max(0, diffTargets[k] - supply[k]);
        cells.push({ system: d.system, domain: d.domain, skill: s.code, difficulty: k, target: diffTargets[k], supply: supply[k], shortfall, generate: Math.ceil(shortfall * OVERSHOOT) });
      }
    }
  }
  return cells;
}

if (process.argv[1]?.endsWith("plan.ts")) {
  const i = process.argv.indexOf("--supply");
  const supply = i > 0 ? JSON.parse(readFileSync(process.argv[i + 1], "utf-8")) : undefined;
  const cells = buildPlan(supply);
  const out = path.resolve("data/mock-exam-generation/plan.json");
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ assumption: supply ? "supply by difficulty provided" : "supply difficulty assumed proportional to pool difficulty mix", overshoot: OVERSHOOT, cells }, null, 1));
  const sum = (sys: string, f: (c: Cell) => number) => cells.filter((c) => c.system === sys).reduce((a, c) => a + f(c), 0);
  for (const sys of ["sat_rw", "sat_math"]) console.log(sys, "target", sum(sys, (c) => c.target), "supply", sum(sys, (c) => c.supply), "shortfall", sum(sys, (c) => c.shortfall), "generate", sum(sys, (c) => c.generate));
}
