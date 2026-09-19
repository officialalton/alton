// 자료(그림·도형·표·그래프) 필요성 자동 판정(2026-09-14 제품 오너 지시).
//
// 관리자가 "이 문제에 그림이 필요한가"를 직접 판단하지 않도록, 세부 기술 코드·유형·질문 내용에서 시스템이 먼저 판정한다.
//   * required    자료 없이는 문제가 성립하지 않는다 → 표준 자료 유형을 기본 선택하고, 자료 없으면 저장·공개 불가
//   * recommended 자료가 있으면 더 적절하지만 텍스트형도 가능 → 제안·이유를 보여주고 관리자가 텍스트형으로 진행할 수 있다
//   * none        텍스트·수식·선택지만으로 충분
// 문항 체계에 갇히지 않는다 — Reading & Writing 의 Command of Evidence (Quantitative) 도 표·그래프 자료가 필수다.
// 판정과 이유를 함께 돌려주며, 회차 구성 화면의 안내에도 쓴다(자동 추가·제거 기준은 아니다).
import { GEOMETRY_TEMPLATE_TYPES } from "./problem-figures/spec";
import { SKILL_BY_CODE, skillLabel } from "./problem-taxonomy";

export type MaterialLevel = "required" | "recommended" | "none";
export type MaterialKind = "plane" | "geometry" | "data" | "figure_choice" | "figure_set";
export type GeometryTemplate = "parallel_transversal" | "triangle" | "circle" | "polygon" | "solid" | "composite";

export type MaterialNeed = {
  level: MaterialLevel;
  /** 기본 선택할 표준 자료 유형(없으면 null). */
  kind: MaterialKind | null;
  /** 기하일 때 어떤 도형 템플릿이 맞는지(질문 문장에서 읽은 것). 비어 있으면 관리자가 고른다. */
  geometry: GeometryTemplate[];
  /**
   * 이 세부 기술에서 실제로 나오는 자료 유형들(첫 번째가 기본 kind). 둘 이상이면 새 문제 패널이 유형을 고르게 한다 —
   * 예: Linear functions 는 좌표평면 그래프도, 함수표도 나온다. 세부 형태(막대/산점도, 삼각형/원)는 문항 내용에 따라 AI 가 정한다.
   */
  alternatives: MaterialKind[];
  reason: string;
};

export const MATERIAL_KIND_LABEL: Record<MaterialKind, string> = {
  plane: "좌표평면",
  geometry: "도형",
  data: "표·그래프",
  figure_choice: "그래프/도형 선택지 4개",
  figure_set: "복수 자료(A/B)",
};
export const MATERIAL_LEVEL_LABEL: Record<MaterialLevel, string> = { required: "자료 필수", recommended: "자료 권장", none: "자료 불필요" };

const CUE = {
  figureChoice: /\bwhich (?:of the following )?(?:graphs?|figures?|diagrams?)\b|\bgraphs? (?:below|shown)\b.*\b(?:which|represents)\b/i,
  plane: /\b(?:xy-plane|coordinate plane|graph of|the graph|graphed|plotted|intercept|slope of the line shown|shown in the xy)\b/i,
  data: /\b(?:table|bar graph|bar chart|histogram|scatterplot|scatter plot|box plot|boxplot|dot plot|line graph|frequency|data set|the chart|survey results|two-way)\b/i,
  /** "the graph shows" 는 자료 그래프일 수도, 함수 그래프일 수도 있다 — 세부 기술의 기본 자료 유형으로 가른다. */
  graphAmbiguous: /\b(?:the graph shows|graph below shows|graph above shows)\b/i,
  geometry: /\b(?:figure|diagram|as shown|shown above|shown below|triangle [A-Z]{3}|right triangle|circle [A-Z]\b|circle with center|arc|chord|tangent|angle [A-Z]{3}|parallel lines|transversal|rectangle|square [A-Z]{4}|parallelogram|trapezoid|polygon|hexagon|pentagon|cylinder|cone|sphere|prism|cube|pyramid|shaded region|inscribed)\b/i,
};

const GEOMETRY_CUE: [RegExp, GeometryTemplate][] = [
  [/\b(?:shaded region|inscribed|circumscribed)\b/i, "composite"],
  [/\b(?:parallel lines|transversal)\b/i, "parallel_transversal"],
  [/\b(?:cylinder|cone|sphere|prism|cube|pyramid|rectangular box|volume)\b/i, "solid"],
  [/\b(?:circle|arc|chord|tangent|sector|central angle|radius|diameter)\b/i, "circle"],
  [/\b(?:triangle|hypotenuse|right angle|isosceles|equilateral|sin|cos|tan)\b/i, "triangle"],
  [/\b(?:rectangle|square|parallelogram|rhombus|trapezoid|polygon|hexagon|pentagon|quadrilateral)\b/i, "polygon"],
];

/** 세부 기술의 기본 자료 유형(질문 문장에 단서가 없을 때). */
const SKILL_DEFAULT: Record<string, { kind: MaterialKind; level: MaterialLevel; why: string; alternatives?: MaterialKind[] }> = {
  linear_functions: { kind: "plane", level: "recommended", why: "기울기·절편은 좌표평면 그래프로 묻는 문항이 많고, 함수표(x, f(x))로 주어지는 문항도 있습니다", alternatives: ["plane", "data"] },
  linear_equations_two_var: { kind: "plane", level: "recommended", why: "두 변수 일차방정식은 직선 그래프로 묻는 문항이 많습니다" },
  systems_linear: { kind: "plane", level: "recommended", why: "연립방정식의 해는 두 직선의 교점 그래프로도, 그래프 선택지로도 나옵니다", alternatives: ["plane", "figure_choice"] },
  linear_inequalities: { kind: "plane", level: "recommended", why: "부등식의 해 영역은 음영 그래프로 묻는 문항이 있습니다" },
  nonlinear_functions: { kind: "plane", level: "recommended", why: "비선형 함수는 그래프(포물선·지수)를 읽는 문항과 '어느 그래프인가'를 고르는 문항이 많습니다", alternatives: ["plane", "figure_choice"] },
  nonlinear_equations_systems: { kind: "plane", level: "recommended", why: "비선형 연립은 교점 그래프로 묻는 문항이 있습니다" },
  ratios_rates_units: { kind: "data", level: "recommended", why: "비율·속도 문항은 표 자료로 주어지는 경우가 있습니다" },
  percentages: { kind: "data", level: "recommended", why: "백분율 문항은 표·막대그래프 자료로 주어지는 경우가 많습니다" },
  one_variable_data: { kind: "data", level: "required", why: "한 변수 자료(평균·중앙값·분포)는 숫자 목록·점도표·히스토그램 없이 성립하지 않습니다" },
  two_variable_data: { kind: "data", level: "required", why: "두 변수 자료(산점도·추세선·표)는 자료 없이 성립하지 않습니다" },
  probability: { kind: "data", level: "required", why: "확률·조건부확률은 양방향 표 자료로 묻는 문항입니다" },
  inference_margin_error: { kind: "data", level: "recommended", why: "표본 통계·오차범위는 문장형 자료(statement)로 주어질 수 있습니다" },
  evaluating_statistical_claims: { kind: "data", level: "recommended", why: "연구 설계 판단은 문장형 자료(statement)로 주어질 수 있습니다" },
  area_volume: { kind: "geometry", level: "recommended", why: "넓이·부피는 도형 그림이 있으면 더 적절하지만 치수만으로도 성립합니다" },
  lines_angles_triangles: { kind: "geometry", level: "required", why: "각·평행선·삼각형 문항은 도형 없이 성립하지 않습니다" },
  right_triangles_trigonometry: { kind: "geometry", level: "required", why: "직각삼각형·삼각비 문항은 도형 없이 성립하지 않습니다" },
  circles: { kind: "geometry", level: "recommended", why: "원 문항은 도형(현·호·접선)으로도, 좌표평면의 원의 방정식으로도 나옵니다", alternatives: ["geometry", "plane"] },
  command_of_evidence_quant: { kind: "data", level: "required", why: "정량 근거 문항은 표·그래프 자료 없이 성립하지 않습니다" },
};

export function judgeMaterialNeed(input: {
  examSystem: string | null | undefined;
  skillCode: string | null | undefined;
  /** 지문 + 질문 한 덩어리. */
  text: string;
  format?: string | null;
}): MaterialNeed {
  const text = input.text ?? "";
  const label = input.skillCode ? skillLabel(input.skillCode) ?? input.skillCode : null;
  const subject = label ? `${label} 문항` : "이 문항";

  if (input.examSystem === "ap") {
    return { level: "none", kind: null, geometry: [], alternatives: [], reason: "AP 문항 작성은 준비 중입니다 — 자료 판정을 하지 않습니다." };
  }

  const geometryHits = GEOMETRY_CUE.filter(([re]) => re.test(text)).map(([, t]) => t);
  const skill = input.skillCode ? SKILL_BY_CODE.get(input.skillCode) : undefined;
  const isRw = input.examSystem === "sat_rw" || (skill?.domain ?? "").startsWith("rw_");

  // 1) 질문 문장에 단서가 있으면 그것이 우선한다 — 관리자가 판단할 일이 아니다.
  const skillDefault = input.skillCode ? SKILL_DEFAULT[input.skillCode] : undefined;
  const skillDefaultKind = skillDefault?.kind ?? null;
  // 2026-09-19(제품 오너 발견) — CUE.plane("xy-plane", "intercept" 등)은 SAT 대수 문항의
  // 표준 문구("In the xy-plane, line f passes through...")에도 그냥 걸린다. 이 세부 기술이
  // 이미 "recommended"(자료 없이도 성립)로 선언돼 있으면(예: linear_functions의
  // slope_from_two_points, circles의 circle_equation_transform — 컴파일러가 애초에 자료 없이
  // 대수만으로 설계한 kind) 이 값싼 단어 매칭 하나로 "required"로 격상시키지 않는다 —
  // required는 그 세부 기술 자체가 required로 선언된 경우에만.
  const cueCanOverrideToRequired = !skillDefault || skillDefault.level === "required";
  if (CUE.graphAmbiguous.test(text) && !CUE.data.test(text) && !CUE.figureChoice.test(text)) {
    const m = text.match(CUE.graphAmbiguous)?.[0] ?? "graph";
    if (skillDefaultKind === "data" || isRw) return { level: "required", kind: "data", geometry: [], alternatives: ["data"], reason: `${subject}이 자료 그래프(${m})를 읽어야 풀 수 있으므로 표·그래프 자료가 필요합니다.` };
    return { level: "required", kind: "plane", geometry: [], alternatives: ["plane"], reason: `${subject}이 함수 그래프(${m})를 가리키므로 좌표평면 자료가 필요합니다.` };
  }
  if (CUE.figureChoice.test(text) && !isRw) {
    return { level: "required", kind: "figure_choice", geometry: [], alternatives: ["figure_choice"], reason: `${subject}이 "어느 그래프인가"를 묻으므로 그래프/도형 선택지 4개가 필요합니다.` };
  }
  if (CUE.data.test(text)) {
    const m = text.match(CUE.data)?.[0] ?? "table";
    return { level: "required", kind: "data", geometry: [], alternatives: ["data"], reason: `${subject}이 자료(${m})를 읽어야 풀 수 있으므로 표·그래프 자료가 필요합니다.` };
  }
  if (!isRw && cueCanOverrideToRequired && CUE.plane.test(text)) {
    const m = text.match(CUE.plane)?.[0] ?? "graph";
    return { level: "required", kind: "plane", geometry: [], alternatives: ["plane"], reason: `${subject}이 그래프(${m})를 가리키므로 좌표평면 자료가 필요합니다.` };
  }
  if (!isRw && CUE.geometry.test(text)) {
    const m = text.match(CUE.geometry)?.[0] ?? "figure";
    return { level: "required", kind: "geometry", geometry: geometryHits, alternatives: ["geometry"], reason: `${subject}이 도형(${m})을 가리키므로 도형 자료가 필요합니다.` };
  }

  // 2) 단서가 없으면 세부 기술의 기본 판정.
  const d = input.skillCode ? SKILL_DEFAULT[input.skillCode] : undefined;
  if (d) {
    if (d.level === "required") {
      return { level: "required", kind: d.kind, geometry: geometryHits, alternatives: d.alternatives ?? [d.kind], reason: `${d.why}. ${MATERIAL_KIND_LABEL[d.kind]} 자료가 필요합니다.` };
    }
    return { level: "recommended", kind: d.kind, geometry: geometryHits, alternatives: d.alternatives ?? [d.kind], reason: `${d.why}. ${MATERIAL_KIND_LABEL[d.kind]} 자료를 권장하지만 텍스트형으로도 만들 수 있습니다.` };
  }
  if (isRw) {
    return { level: "none", kind: null, geometry: [], alternatives: [], reason: `${subject}은 지문·질문·선택지만으로 충분합니다.` };
  }
  if (!input.skillCode) {
    return { level: "none", kind: null, geometry: [], alternatives: [], reason: "세부 기술을 고르면 자료 필요성을 판정합니다. 지금은 텍스트·수식만으로 진행합니다." };
  }
  return { level: "none", kind: null, geometry: [], alternatives: [], reason: `${subject}은 텍스트·수식·선택지만으로 충분합니다.` };
}

/** 저장된 그림 데이터가 판정한 자료 유형을 채우는가. */
export function figureSatisfies(kind: MaterialKind | null, figure: unknown): boolean {
  if (!kind) return true;
  const t = (figure as { type?: string } | null | undefined)?.type;
  if (!t) return false;
  if (t === "image") return true; // 올린 그림은 어떤 자료든 대신할 수 있다(alt 필수는 별도 검사)
  switch (kind) {
    case "plane": return t === "plane" || t === "figure_set";
    case "geometry": return (GEOMETRY_TEMPLATE_TYPES as readonly string[]).includes(t) || t === "figure_set";
    case "data": return t === "data" || t === "figure_set";
    case "figure_choice": return t === "figure_choice";
    case "figure_set": return t === "figure_set";
  }
}

/** 자료 필수인데 자료가 없을 때의 저장·공개 거부 사유. 아니면 null. */
export function materialBlocker(need: MaterialNeed, figure: unknown): string | null {
  if (need.level !== "required") return null;
  if (figureSatisfies(need.kind, figure)) return null;
  return `자료 필수 문항입니다 — ${need.reason} ${need.kind ? `'${MATERIAL_KIND_LABEL[need.kind]}' 자료를 만들거나 그림을 올린 뒤 저장하세요.` : ""}`.trim();
}

/** 회차 구성 화면 안내 — 기술 코드별 자료 현황(자동 추가·제거 기준이 아니다). */
export function materialStatusLines(problems: { skillCode: string | null; examSystem?: string | null; text: string; figure: unknown }[]): string[] {
  const buckets = new Map<string, { required: number; missing: number; withFigure: number }>();
  for (const p of problems) {
    const need = judgeMaterialNeed({ examSystem: p.examSystem ?? null, skillCode: p.skillCode, text: p.text });
    if (!need.kind) continue;
    const key = MATERIAL_KIND_LABEL[need.kind];
    const b = buckets.get(key) ?? { required: 0, missing: 0, withFigure: 0 };
    if (need.level === "required") { b.required += 1; if (!figureSatisfies(need.kind, p.figure)) b.missing += 1; }
    if (figureSatisfies(need.kind, p.figure) && p.figure) b.withFigure += 1;
    buckets.set(key, b);
  }
  const lines: string[] = [];
  for (const [label, b] of buckets) {
    lines.push(`${label} 자료 필수 문제 ${b.required}개${b.missing ? ` (자료 없음 ${b.missing})` : ""} · ${label} 자료 있는 문제 ${b.withFigure}개`);
  }
  return lines;
}
