// 공식 digital SAT 모듈 안 문항 순서 규칙(2026-10-19). 근거: docs/qa/sat-official-item-order-2026-10-19.md
// (docs/2026-09-17-collegeboard-coverage-map.md 공식 7종 14모듈 분류표 실측).
//   R&W : 영역 블록이 엄격히 고정 — Craft & Structure → Information & Ideas → Standard English Conventions → Expression of Ideas.
//         블록 안은 skill 순서(공식 위치 중앙값), 같은 skill 안은 난이도 오름차순.
//   Math: 영역 블록 없음(0/14 일치). 느슨한 순서 — skill 공식 평균 위치 오름차순(1차), 같은 skill 안 난이도 오름차순(2차).
// 순수 함수. 조립(assemble-unique·rebalance-sets·MST 조립)과 세트 버전 SQL 생성기가 모두 이 표 하나를 쓴다.

export const RW_BLOCK_ORDER = ["craft_structure", "information_ideas", "standard_english", "expression_ideas"] as const;
export const RW_SAT_DOMAIN_BLOCK: Record<string, number> = { rw_craft_structure: 0, rw_information_ideas: 1, rw_standard_english: 2, rw_expression_ideas: 3 };

/** R&W skill -> [블록, 블록 안 순서]. 표준 영어(form_structure_sense/boundaries)는 공식에서 서로 섞여 나오므로 같은 순서(0)로 두고 난이도·원래 순서로 정한다. */
export const RW_SKILL_ORDER: Record<string, [number, number]> = {
  words_in_context: [0, 0], text_structure_purpose: [0, 1], cross_text_connections: [0, 2],
  central_ideas_details: [1, 0], command_of_evidence_quant: [1, 1], command_of_evidence_text: [1, 2], inferences: [1, 3],
  form_structure_sense: [2, 0], boundaries: [2, 0],
  transitions: [3, 0], rhetorical_synthesis: [3, 1],
};

/** 우리 Math skill_code -> 공식 분류표 skill 이름. */
export const MATH_SKILL_TO_OFFICIAL: Record<string, string> = {
  probability: "probability",
  inference_margin_error: "inference_from_sample",
  evaluating_statistical_claims: "inference_from_sample",
  two_variable_data: "two_variable_data",
  linear_equations_one_var: "linear_equations_one_var",
  linear_functions: "linear_functions",
  linear_inequalities: "linear_inequalities",
  equivalent_expressions: "equivalent_expressions",
  ratios_rates_units: "ratios_rates",
  percentages: "percentages",
  lines_angles_triangles: "lines_angles_triangles",
  linear_equations_two_var: "linear_two_variables",
  systems_linear: "linear_two_variables",
  nonlinear_functions: "nonlinear_functions",
  one_variable_data: "one_variable_data",
  nonlinear_equations_systems: "nonlinear_equations_systems",
  area_volume: "area_volume",
  right_triangles_trigonometry: "right_triangles_trigonometry",
  circles: "circles",
};

/** 공식 skill 평균 위치(14모듈 분류표, 27문항 척도). */
export const MATH_OFFICIAL_MEAN_POSITION: Record<string, number> = {
  probability: 3.5, inference_from_sample: 8.3, two_variable_data: 9.4, linear_equations_one_var: 9.7, linear_functions: 11.3,
  linear_inequalities: 12.3, equivalent_expressions: 13.2, ratios_rates: 14.8, percentages: 14.8, lines_angles_triangles: 14.8,
  linear_two_variables: 15.1, nonlinear_functions: 15.6, one_variable_data: 16.8, nonlinear_equations_systems: 17.1, area_volume: 17.1,
  right_triangles_trigonometry: 19.1, circles: 19.5,
};

const DIFF: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
export type OrderableItem = { skill: string | null | undefined; difficulty: string };

/** 정렬 키(작을수록 앞). 모르는 skill 은 맨 뒤. */
export function officialOrderKey(section: "rw" | "math", it: OrderableItem): [number, number, number] {
  const d = DIFF[it.difficulty] ?? 1;
  if (section === "rw") { const o = RW_SKILL_ORDER[it.skill ?? ""]; return o ? [o[0], o[1], d] : [99, 0, d]; }
  const off = MATH_SKILL_TO_OFFICIAL[it.skill ?? ""]; const pos = off ? MATH_OFFICIAL_MEAN_POSITION[off] : 99;
  return [pos, 0, d];
}

/** 모듈 하나의 문항을 공식 순서로 정렬한 새 배열(안정 정렬 — 같은 키는 입력 순서 유지). */
export function sortModuleOfficial<T extends OrderableItem>(section: "rw" | "math", items: readonly T[]): T[] {
  return items.map((it, i) => ({ it, i, k: officialOrderKey(section, it) }))
    .sort((a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1] || a.k[2] - b.k[2] || a.i - b.i).map((x) => x.it);
}

/** R&W 모듈이 영역 블록 순서(비내림차순)인지. 일치율 측정용. */
export function isRwBlockOrdered(items: readonly OrderableItem[]): boolean {
  let prev = -1; for (const it of items) { const b = RW_SKILL_ORDER[it.skill ?? ""]?.[0] ?? 99; if (b < prev) return false; prev = b; } return true;
}
/** Math 모듈이 (skill 위치, 난이도) 비내림차순인지. */
export function isMathOfficialOrdered(items: readonly OrderableItem[]): boolean {
  const ks = items.map((it) => officialOrderKey("math", it)); for (let i = 1; i < ks.length; i++) { const a = ks[i - 1], b = ks[i]; if (a[0] > b[0] || (a[0] === b[0] && a[2] > b[2])) return false; } return true;
}

/**
 * 한 세트의 모든 모듈(moduleKey+route 단위)을 공식 순서로 다시 정렬하고, 그 모듈이 쓰던 position 값 집합을 오름차순으로 다시 나눠 준다
 * (모듈의 position 범위·문항 수·라우팅 구조는 그대로). 입력은 변경하지 않고 새 배열을 돌려준다.
 */
export function reorderSetModulesOfficial<T extends OrderableItem & { section: string; moduleKey: string; route: string | null; position: number }>(items: readonly T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const it of items) { const k = `${it.moduleKey}|${it.route ?? ""}`; (groups.get(k) ?? groups.set(k, []).get(k)!).push(it); }
  const out: T[] = [];
  for (const g of groups.values()) {
    const byPos = [...g].sort((a, b) => a.position - b.position); const slots = byPos.map((x) => x.position);
    sortModuleOfficial(byPos[0].section === "rw" ? "rw" : "math", byPos).forEach((it, i) => out.push({ ...it, position: slots[i] }));
  }
  return out.sort((a, b) => (a.section === b.section ? a.position - b.position : a.section < b.section ? 1 : -1));
}
