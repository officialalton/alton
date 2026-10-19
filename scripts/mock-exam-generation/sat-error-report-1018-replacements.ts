// 외부 검수 SAT Math 오류 신고(2026-10-18) — 고친 결정형 컴파일러로 같은 skill·세부 패턴의 대체 문항 후보를 만든다(유료 API 없음, DB 쓰기 없음).
// 공개 문항 교체가 필요하고 옛 틀 패치(lib/audit-fix/sat-error-report-1018.ts)로 풀리지 않는 항목(G-manual, 예: 신고 15번)에 쓴다.
//   npx tsx scripts/mock-exam-generation/sat-error-report-1018-replacements.ts --out data/mock-exam-generation/sat-error-report-1018/replacement-candidates.json
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { attemptOne } from "../../lib/problem-generation/math-compilers/batch";
import { hasGraphAndExpressionForSameCurves } from "../../lib/problem-generation/graph-expression-redundancy";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
type Spec = { report: string; skill: Parameters<typeof attemptOne>[0]; kind?: string; figurePolicy?: string; count: number };
const SPECS: Spec[] = [
  { report: "(1) 10·11·15·19 그래프 읽기 — 일차함수 함수값(그래프만)", skill: "linear_functions", kind: "evaluate", figurePolicy: "require_plane", count: 2 },
  { report: "(1) 일차함수 x 역산(그래프만)", skill: "linear_functions", kind: "find_x_for_value", figurePolicy: "require_plane", count: 2 },
  { report: "(1) 일차함수 기울기(그래프만)", skill: "linear_functions", kind: "slope_from_two_points", figurePolicy: "require_plane", count: 2 },
  { report: "(1) 이차함수 꼭짓점 x(그래프만)", skill: "nonlinear_functions", kind: "vertex_x", figurePolicy: "require_plane", count: 2 },
  { report: "(1) 이차함수 꼭짓점 y(그래프만)", skill: "nonlinear_functions", kind: "vertex_y", figurePolicy: "require_plane", count: 2 },
  { report: "(1) 이차함수 함수값(식만)", skill: "nonlinear_functions", kind: "evaluate", count: 2 },
  { report: "(1) 일차·이차 교점(그래프만)", skill: "nonlinear_equations_systems", kind: "linear_quadratic_intersection", figurePolicy: "require_plane", count: 3 },
  { report: "(1) 연립 일차방정식 교점·기울기(식만)", skill: "linear_equations_two_var", kind: "intersection_x", count: 2 },
  { report: "(1) 원의 방정식(그래프만)", skill: "circles", kind: "circle_equation_transform", figurePolicy: "require_plane", count: 3 },
  { report: "(1) 부등식 해 판정(식만)", skill: "linear_inequalities", kind: "point_in_solution", count: 2 },
  { report: "(2)(13) 삼각비 sin B 표기", skill: "right_triangles_trigonometry", kind: "trig_ratio", count: 3 },
  { report: "(3)(14) 표본 추정 성질 명시", skill: "inference_margin_error", count: 3 },
];

const out: Record<string, unknown>[] = [];
for (const spec of SPECS) {
  let made = 0;
  for (let tries = 0; tries < 200 && made < spec.count; tries++) {
    let r: ReturnType<typeof attemptOne>;
    try { r = attemptOne(spec.skill, "medium", { compileMs: 0, renderCheckMs: 0 }, spec.figurePolicy, "mc", spec.kind); } catch { continue; }
    if (!r.ok) continue;
    const p = r.problem as unknown as { passage: string; stimulus?: string; question: string; options: string[]; correctIndex: number; figure: unknown };
    const dup = hasGraphAndExpressionForSameCurves(p.figure as never, String(p.stimulus ?? p.passage));
    if (dup) continue;
    out.push({ report: spec.report, skill: spec.skill, kind: spec.kind ?? null, figurePolicy: spec.figurePolicy ?? null, graphAndExpressionDuplicate: dup, problem: r.problem });
    made++;
  }
  console.error(`${spec.skill}/${spec.kind ?? "-"}: ${made}/${spec.count}`);
}
const file = arg("--out");
if (file) { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), generator: "scripts/mock-exam-generation/sat-error-report-1018-replacements.ts", note: "새 problem_versions 후보. 공개 문항·원격 DB 는 직접 수정하지 않는다.", count: out.length, candidates: out }, null, 1)); }
