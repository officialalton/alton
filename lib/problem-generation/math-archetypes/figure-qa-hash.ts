// 시각 검수 판정의 유효성 — 조합(항목)별 '현재 생성기·렌더 코드 해시'. 코드가 바뀌면 판정이 무효(stale)가 되어 재검수 대상이다.
//   해시 대상 = 그 항목의 원형 정의 파일 + 공용 빌더·장면 풀 + 쓰는 렌더러(figure type 별) + 앱 그림 컴포넌트(ProblemFigure). easy/medium 틀 파일도 포함한다(같은 렌더 경로를 쓰므로 보수적으로).
//   한 파일이 여러 항목을 정의하므로 그 파일을 고치면 같은 파일의 모든 항목이 재검수 대상이 된다(보수적).
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const QA_DIR = path.join("data", "mock-exam-generation", "figure-qa");
export const QA_HTML_DIR = path.join(QA_DIR, "_html");
const AR = "lib/problem-generation/math-archetypes";
const FG = "lib/problem-figures";
const COMMON = [`${AR}/figure-kit.ts`, `${AR}/figure-topics.ts`, `${AR}/skills/tvd-fig-levels.ts`, `${FG}/render.ts`, `${FG}/label-rule.ts`, `${FG}/templates/_layout.ts`, "app/session/[id]/ProblemFigure.tsx", `${AR}/figure-qa-snapshot.test.ts`, `${AR}/figure-qa-samples.ts`, "scripts/mock-exam-generation/figure-qa-render.mjs"];
const RENDERER: Record<string, string[]> = { data: [`${FG}/templates/data.ts`], plane: [`${FG}/templates/coordinate-plane.ts`], unit_circle: [`${FG}/templates/unit-circle.ts`], trig_curve: [`${FG}/templates/trig-curve.ts`], venn_tree: [`${FG}/templates/venn-tree.ts`], triangle_nested: [`${FG}/templates/triangle-nested.ts`], solid_x: [`${FG}/templates/solid-x.ts`], l_shape: [`${FG}/templates/l-shape.ts`], parallel_three: [`${FG}/templates/parallel-three.ts`], figure_bundle: [`${FG}/templates/figure-bundle.ts`, `${FG}/templates/figure-choice.ts`], figure_choice: [`${FG}/templates/figure-choice.ts`], figure_set: [`${FG}/templates/figure-choice.ts`] , number_line: [`${FG}/templates/number-line.ts`, `${FG}/templates/d-registry.ts`], stem_leaf: [`${FG}/templates/stem-leaf.ts`, `${FG}/templates/d-registry.ts`], pie: [`${FG}/templates/pie.ts`, `${FG}/templates/d-registry.ts`], freq_chart: [`${FG}/templates/freq-chart.ts`, `${FG}/templates/_chart.ts`, `${FG}/templates/d-registry.ts`], stacked_bar: [`${FG}/templates/stacked-bar.ts`, `${FG}/templates/_chart.ts`, `${FG}/templates/d-registry.ts`] };

/** 항목 id → 원형 정의 파일(이 파일럿의 two_variable_data 자료 원형). 새 skill 파일이 생기면 여기에 규칙을 더한다. */
/** 1단계 이후 규칙: 조합 하나 = 파일 하나(`skills/fig/items/<조합ID>.ts`) + 그 자료 계열의 공용 장면 키트. 조합 파일을 고쳐도 다른 조합의 판정은 유지된다. */
export const ITEM_DIR = `${AR}/skills/fig/items`;
const TRK = `${AR}/skills/fig/tri-kit.ts`, TK = `${AR}/skills/fig/table-kit.ts`, GK = `${AR}/skills/fig/graph-kit.ts`, DK = `${AR}/skills/fig/data-kit.ts`, HK = `${AR}/skills/fig/hist-kit.ts`;
export const FAMILY_KIT: Record<string, string[]> = { TB: [TK], FQ: [TK], TW: [TK], ST: [TK], LN: [GK, TK], FN: [GK, TK], DP: [DK, GK, TK], HG: [HK, DK, GK, TK], BX: [DK, GK, TK], BR: [DK, GK, TK, `${AR}/skills/fig/items/_t4-kit.ts`], TR: [TRK, GK, TK] };
/** 조합별 추가 키트(공용 FAMILY_KIT 로 묶기 어려운 조합 전용 장면 키트) — 이 파일을 고치면 그 조합만 재검수 대상이 된다. */
export const ITEM_KIT: Record<string, string[]> = { "percentages.compound_change.FN.P": [`${AR}/skills/fig/pure-fn-kit.ts`, `${AR}/skills/fig/pure-kit.ts`, `${AR}/skills/fig/items/_t5-kit.ts`], "nonlinear_functions.exponential_model.FN.P": [`${AR}/skills/fig/pure-fn-kit.ts`, `${AR}/skills/fig/pure-kit.ts`, `${AR}/skills/fig/items/_t5-kit.ts`], "linear_equations_one_var.word_problem_translate.LN.P": [`${AR}/skills/fig/graph-kit.ts`], "ratios_rates_units.chained_conversion.LN.P": [`${AR}/skills/fig/graph-kit.ts`], "ratios_rates_units.proportion.LN.P": [`${AR}/skills/fig/graph-kit.ts`], "systems_linear.word_system.LN.P": [`${AR}/skills/fig/graph-kit.ts`], "systems_linear.param_no_solution.LN.P": [`${AR}/skills/fig/pure-fn-kit.ts`, `${AR}/skills/fig/pure-kit.ts`], "systems_linear.elimination_value.LN.P": [`${AR}/skills/fig/pure-fn-kit.ts`, `${AR}/skills/fig/pure-kit.ts`], "systems_linear.substitution_solve.LN.P": [`${AR}/skills/fig/pure-fn-kit.ts`, `${AR}/skills/fig/pure-kit.ts`], "linear_inequalities.solve_one_var.LN.P": [`${AR}/skills/fig/pure-kit.ts`], "linear_equations_one_var.solve.LN.P": [`${AR}/skills/fig/pure-fn-kit.ts`, `${AR}/skills/fig/pure-kit.ts`], "linear_inequalities.point_in_solution.LN.P": [`${AR}/skills/fig/pure-fn-kit.ts`, `${AR}/skills/fig/pure-kit.ts`], "linear_inequalities.inequality_from_graph.LN.P": [`${AR}/skills/fig/pure-fn-kit.ts`, `${AR}/skills/fig/pure-kit.ts`], "systems_linear.system_from_graph.LN.P": [`${AR}/skills/fig/pure-fn-kit.ts`, `${AR}/skills/fig/pure-kit.ts`], "coordinate_geometry.parallel_perpendicular_slopes.LN.P": [`${AR}/skills/fig/pure-kit.ts`], "nonlinear_equations_systems.irrational_root_radical_form.FN.P": [`${AR}/skills/fig/pure-fn-kit.ts`, `${AR}/skills/fig/pure-kit.ts`, `${AR}/skills/fig/items/_t5-kit.ts`], "nonlinear_equations_systems.parameter_discriminant.FN.P": [`${AR}/skills/fig/pure-fn-kit.ts`, `${AR}/skills/fig/pure-kit.ts`, `${AR}/skills/fig/items/_t5-kit.ts`], "nonlinear_functions.interpret_b.FN.P": [`${AR}/skills/fig/pure-fn-kit.ts`, `${AR}/skills/fig/pure-kit.ts`, `${AR}/skills/fig/items/_t5-kit.ts`], "nonlinear_functions.interpret_a.FN.P": [`${AR}/skills/fig/pure-fn-kit.ts`, `${AR}/skills/fig/pure-kit.ts`, `${AR}/skills/fig/items/_t5-kit.ts`], "nonlinear_equations_systems.linear_quadratic_intersection.FN.P": [`${AR}/skills/fig/pure-fn-kit.ts`, `${AR}/skills/fig/pure-kit.ts`, `${AR}/skills/fig/items/_t5-kit.ts`], "nonlinear_equations_systems.irrational_product_of_roots.FN.P": [`${AR}/skills/fig/pure-fn-kit.ts`, `${AR}/skills/fig/pure-kit.ts`, `${AR}/skills/fig/items/_t5-kit.ts`], "nonlinear_equations_systems.irrational_sum_of_roots.FN.P": [`${AR}/skills/fig/pure-fn-kit.ts`, `${AR}/skills/fig/pure-kit.ts`, `${AR}/skills/fig/items/_t5-kit.ts`], "nonlinear_equations_systems.num_real_solutions.FN.P": [`${AR}/skills/fig/pure-fn-kit.ts`, `${AR}/skills/fig/pure-kit.ts`, `${AR}/skills/fig/items/_t5-kit.ts`], "nonlinear_equations_systems.product_of_roots.FN.P": [`${AR}/skills/fig/pure-fn-kit.ts`, `${AR}/skills/fig/pure-kit.ts`, `${AR}/skills/fig/items/_t5-kit.ts`], "nonlinear_equations_systems.sum_of_roots.FN.P": [`${AR}/skills/fig/pure-fn-kit.ts`, `${AR}/skills/fig/pure-kit.ts`, `${AR}/skills/fig/items/_t5-kit.ts`], "nonlinear_equations_systems.root.FN.P": [`${AR}/skills/fig/pure-fn-kit.ts`, `${AR}/skills/fig/pure-kit.ts`, `${AR}/skills/fig/items/_t5-kit.ts`], "two_variable_data.model_choice_linear_quadratic_exponential.SC.C": [`${AR}/skills/fig/items/_model-kit.ts`, `${AR}/skills/fig/data-c-kit.ts`], "two_variable_data.model_choice_linear_quadratic_exponential.SC.P": [`${AR}/skills/fig/items/_model-kit.ts`], "two_variable_data.outlier_influence_on_fit.SC.C": [`${AR}/skills/fig/items/_sc-kit.ts`, `${AR}/skills/fig/data-c-kit.ts`], "two_variable_data.outlier_influence_on_fit.SC.P": [`${AR}/skills/fig/items/_sc-kit.ts`], "percentages.compound_change.LG.P": [`${AR}/skills/fig/items/_lg-kit.ts`, `${AR}/skills/fig/items/_t4-kit.ts`], "percentages.percent_change.LG.P": [`${AR}/skills/fig/items/_lg-kit.ts`, `${AR}/skills/fig/items/_t4-kit.ts`], "evaluating_statistical_claims.causal_vs_association.BR.P": [`${AR}/skills/fig/items/_t7-kit.ts`], "inference_margin_error.sample_size_effect.BR.P": [`${AR}/skills/fig/items/_t7bar-kit.ts`, `${AR}/skills/fig/items/_t7-kit.ts`], "inference_margin_error.population_estimate.BR.P": [`${AR}/skills/fig/items/_t7bar-kit.ts`, `${AR}/skills/fig/items/_t7-kit.ts`], "one_variable_data.grouped_median_interval.HG.C": [`${AR}/skills/fig/data-c-kit.ts`, `${AR}/skills/fig/hist-c-kit.ts`], "one_variable_data.spread_comparison.HG.C": [`${AR}/skills/fig/data-c-kit.ts`, `${AR}/skills/fig/hist-c-kit.ts`], "one_variable_data.median.BX.C": [`${AR}/skills/fig/data-c-kit.ts`], "one_variable_data.mean.DP.C": [`${AR}/skills/fig/data-c-kit.ts`], "one_variable_data.spread_comparison.DP.P": [`${AR}/skills/fig/dot2-kit.ts`], "one_variable_data.spread_comparison.HG.P": [`${AR}/skills/fig/hist2-kit.ts`], "linear_equations_two_var.slope.LN.P": [`${AR}/skills/fig/pure-kit.ts`], "linear_equations_two_var.intercept.LN.P": [`${AR}/skills/fig/pure-kit.ts`], "nonlinear_functions.vertex_y.FN.P": [`${AR}/skills/fig/pure-kit.ts`, `${AR}/skills/fig/items/_t5-kit.ts`], "nonlinear_functions.evaluate.FN.P": [`${AR}/skills/fig/pure-kit.ts`, `${AR}/skills/fig/items/_t5-kit.ts`], "nonlinear_functions.find_x_for_value.FN.P": [`${AR}/skills/fig/pure-kit.ts`, `${AR}/skills/fig/items/_t5-kit.ts`], "nonlinear_functions.vertex_x.FN.P": [`${AR}/skills/fig/pure-kit.ts`, `${AR}/skills/fig/items/_t5-kit.ts`] };
/** 수학 E(신규 렌더러 2차) 조합 전용 장면 키트 — 조합 접두(<skill>.<kind>.<fig>.<loc>)가 아닌 자료 코드 기준. */
const E_KIT: Record<string, string[]> = { UC: [`${AR}/skills/fig/uc-kit.ts`], TC: [`${AR}/skills/fig/tc-kit.ts`], VT: [`${AR}/skills/fig/vt-kit.ts`], TN: [`${AR}/skills/fig/tn-kit.ts`], SX: [`${AR}/skills/fig/sx-kit.ts`], LS: [`${AR}/skills/fig/ls-kit.ts`], P3: [`${AR}/skills/fig/tri-kit.ts`] };
export function archetypeSourceFor(itemId: string, root = process.cwd()): string[] {
  const [skill, kind, fig, loc] = itemId.split(".");
  const own = `${ITEM_DIR}/${itemId}.ts`;
  if (skill !== "two_variable_data" || existsSync(path.join(root, own))) {
    if (!existsSync(path.join(root, own))) throw new Error(`시각 검수 해시 규칙이 없는 조합(조합 파일 ${own} 없음): ${itemId}`);
    return [own, `${AR}/skills/fig/item-kit.ts`, ...(FAMILY_KIT[fig] ?? []), ...(E_KIT[fig] ?? []), ...(ITEM_KIT[itemId] ?? [])];
  }
  if (loc === "C" || kind === "association_direction_strength") return [`${AR}/skills/tvd-fig-choice.ts`];
  if (fig === "TW") return [`${AR}/skills/tvd-fig-tables.ts`];
  return [`${AR}/skills/tvd-fig-lines.ts`];
}
export function sourceFilesFor(itemId: string, figureTypes: string[], root = process.cwd()): string[] {
  const set = new Set<string>([...archetypeSourceFor(itemId, root), ...COMMON]);
  for (const t of figureTypes) for (const f of RENDERER[t] ?? []) set.add(f);
  return [...set].sort();
}
export function codeHash(itemId: string, figureTypes: string[], root = process.cwd()): { hash: string; files: string[] } {
  const files = sourceFilesFor(itemId, figureTypes, root); const h = createHash("sha256");
  for (const f of files) { h.update(f); h.update("\0"); h.update(readFileSync(path.join(root, f))); h.update("\0"); }
  return { hash: h.digest("hex"), files };
}

// ── math-B(기하) 공용 키트: PT·PG·CI·CM·CG·SO 조합은 geo-kit 를 해시에 포함한다. TR 은 기존 8조합의 판정을 보존하려고 새 조합만 개별 등록한다. ──
const GEO_KIT = `${AR}/skills/fig/geo-kit.ts`, GEO_PT_KIT = `${AR}/skills/fig/geo-pt-kit.ts`;
for (const code of ["PT", "PG", "CI", "CM", "CG", "SO"]) FAMILY_KIT[code] = [GEO_KIT, ...(FAMILY_KIT[code] ?? [])];
FAMILY_KIT.PT = [GEO_PT_KIT, ...FAMILY_KIT.PT];
FAMILY_KIT.SO = [`${AR}/skills/fig/so-kit.ts`, `${AR}/skills/fig/pg-kit.ts`, `${AR}/skills/fig/ext-kit.ts`, ...(FAMILY_KIT.SO ?? [])];
const CYL_KIT = `${AR}/skills/fig/cyl-kit.ts`; for (const id of ["area_volume.cylinder_volume_radius.SO.P", "area_volume.cylinder_volume_diameter.SO.P"]) ITEM_KIT[id] = [CYL_KIT, ...(ITEM_KIT[id] ?? [])];
FAMILY_KIT.PG = [`${AR}/skills/fig/pg-kit.ts`, `${AR}/skills/fig/ext-kit.ts`, ...FAMILY_KIT.PG];
FAMILY_KIT.CG = [`${AR}/skills/fig/cg-kit.ts`, `${AR}/skills/fig/cgc-kit.ts`, `${AR}/skills/fig/ext-kit.ts`, `${AR}/skills/fig/pg-kit.ts`, ...(FAMILY_KIT.CG ?? [])];
export const GEO_TR_ITEMS: string[] = ["lines_angles_triangles.similar_triangles.TR.P", "lines_angles_triangles.congruent_triangles.TR.P", "lines_angles_triangles.triangle_inequality.TR.P", "area_volume.triangle_area.TR.P", "lines_angles_triangles.exterior_angle.TR.P", "lines_angles_triangles.vertical_supplementary_angles.TR.P", "lines_angles_triangles.triangle_angle_sum.TR.C", "lines_angles_triangles.isosceles_base_angle.TR.C"];
for (const id of GEO_TR_ITEMS) ITEM_KIT[id] = [GEO_KIT, ...(ITEM_KIT[id] ?? [])];
const CR_KIT = `${AR}/skills/fig/geo-cr-kit.ts`;
for (const id of ["lines_angles_triangles.exterior_angle.PT.P", "lines_angles_triangles.triangle_angle_sum.PT.P"]) ITEM_KIT[id] = [CR_KIT, ...(ITEM_KIT[id] ?? [])];
const EXT_KIT = `${AR}/skills/fig/ext-kit.ts`, TRC_KIT = `${AR}/skills/fig/trc-kit.ts`;
for (const id of ["lines_angles_triangles.triangle_angle_sum.TR.C", "lines_angles_triangles.isosceles_base_angle.TR.C"]) ITEM_KIT[id] = [TRC_KIT, ...(ITEM_KIT[id] ?? [])];
for (const id of ["lines_angles_triangles.exterior_angle.TR.P", "lines_angles_triangles.vertical_supplementary_angles.TR.P"]) ITEM_KIT[id] = [EXT_KIT, ...(ITEM_KIT[id] ?? [])];

// ── 판정 파일 ──
export type ReviewChecklistKey = "figure_present" | "proportion_matches_values" | "labels_placed_and_legible" | "multi_figure_consistent" | "text_matches_figure_and_solvable" | "axes_ticks_units_legend" | "choice_distinct_one_rule" | "sat_visual_style" | "mobile_375_readable";
export type ReviewFile = {
  itemId: string; verdict: "pass" | "defect"; reviewedAt: string; reviewer: string; codeHash: string; samples: string[];
  checklist: Record<ReviewChecklistKey, "pass" | "fail" | "n/a">; defects: { sample: string; check: ReviewChecklistKey | "other"; description: string }[]; notes?: string;
};
export const REVIEW_KEYS: ReviewChecklistKey[] = ["figure_present", "proportion_matches_values", "labels_placed_and_legible", "multi_figure_consistent", "text_matches_figure_and_solvable", "axes_ticks_units_legend", "choice_distinct_one_rule", "sat_visual_style", "mobile_375_readable"];
export type QaMeta = { itemId: string; generatedAt: string; codeHash: string; sources: string[]; samples: { file: string; mobileFile: string; archetypeId: string; seed: number; signature: string; stimulus: string; question: string; options: string[]; correctIndex: number; answer: string; explanation: string; structuralIssues: { code: string; message: string }[] }[] };
export type ReviewState = "pass" | "defect" | "missing" | "stale" | "snapshot_stale" | "no_snapshot" | "incomplete" | "unimplemented";
const readJson = <T,>(p: string): T | null => { try { return JSON.parse(readFileSync(p, "utf-8")) as T; } catch { return null; } };
export const metaPath = (itemId: string) => path.join(QA_DIR, `${itemId}.meta.json`);
export const reviewPath = (itemId: string) => path.join(QA_DIR, `${itemId}.review.json`);
export const loadMeta = (itemId: string, root = process.cwd()) => readJson<QaMeta>(path.join(root, metaPath(itemId)));
export const loadReview = (itemId: string, root = process.cwd()) => readJson<ReviewFile>(path.join(root, reviewPath(itemId)));

/** 현재 코드 해시 기준 검수 상태. */
export function reviewStatus(itemId: string, current: { hash: string }, root = process.cwd()): { state: ReviewState; detail: string; review?: ReviewFile } {
  const meta = loadMeta(itemId, root); if (!meta) return { state: "no_snapshot", detail: "조합 샘플 PNG·메타가 없다(스냅샷 도구를 실행해야 함)" };
  if (meta.codeHash !== current.hash) return { state: "snapshot_stale", detail: "스냅샷이 현재 생성기·렌더 코드 해시와 다르다 — 스냅샷을 다시 만들고 재검수해야 한다" };
  const rv = loadReview(itemId, root); if (!rv) return { state: "missing", detail: "검수 판정 파일이 없다" };
  if (rv.codeHash !== current.hash) return { state: "stale", detail: "판정 이후 생성기·렌더 코드가 바뀌어 판정이 무효다 — 재검수 대상", review: rv };
  const want = meta.samples.map((s) => s.file).sort().join("|"), got = [...rv.samples].sort().join("|");
  if (want !== got || REVIEW_KEYS.some((k) => !rv.checklist?.[k])) return { state: "incomplete", detail: "판정이 모든 샘플·모든 체크리스트 항목을 덮지 않는다", review: rv };
  if (rv.verdict !== "pass" || Object.values(rv.checklist).includes("fail") || rv.defects.length) return { state: "defect", detail: `결함 ${rv.defects.length}건: ${rv.defects.map((d) => d.description).join(" / ").slice(0, 160)}`, review: rv };
  return { state: "pass", detail: `${rv.reviewer} · ${rv.reviewedAt}`, review: rv };
}

// 새 렌더러 계열(math-D) 공용 키트 — 계열 키트를 고치면 그 계열 조합만 재검수 대상이 된다.
FAMILY_KIT.SL = [`${AR}/skills/fig/sl-kit.ts`];
FAMILY_KIT.PI = [`${AR}/skills/fig/pi-kit.ts`];
FAMILY_KIT.NL = [`${AR}/skills/fig/nl-kit.ts`];
FAMILY_KIT.FO = [`${AR}/skills/fig/fo-kit.ts`];
FAMILY_KIT.SB = [`${AR}/skills/fig/sb-kit.ts`];
