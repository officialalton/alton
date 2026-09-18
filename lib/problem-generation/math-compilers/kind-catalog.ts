// 2026-09-18(제품 오너 지시) — Math 계산형 컴파일러의 "세부 패턴"(내부적으로 무작위
// 선택되던 questionKind/kind) 목록을 한곳에 모은다. 관리자 문제은행 화면이 skillCode를
// 고르면 이 목록으로 "세부 패턴" 드롭다운을 채우고, 고른 값을 forceKind로 배치 실행기에
// 넘긴다. 목록은 각 컴파일러 파일이 실제로 내부에서 쓰는 리터럴 유니온과 정확히 맞춰
// 유지한다 — 새 kind를 컴파일러에 추가하면 여기도 같이 늘려야 한다(자동 동기화 없음,
// 파일이 19개뿐이고 자주 안 바뀌어 하드코딩 목록으로 충분하다고 판단).
//
// R&W 세부 기술은 이 개념이 없다(질문 유형이 하나로 고정) — 카탈로그에 없는 skillCode는
// 그냥 빈 배열을 반환하고, UI는 드롭다운 자체를 숨긴다.

export type SkillKindEntry = { value: string; label: string };

export const MATH_SKILL_KINDS: Record<string, SkillKindEntry[]> = {
  area_volume: [
    { value: "rectangle_area", label: "직사각형 넓이" },
    { value: "triangle_area", label: "삼각형 넓이" },
    { value: "prism_volume", label: "각기둥 부피" },
    { value: "prism_missing_dimension", label: "각기둥 미지수 변" },
    { value: "cylinder_volume_radius", label: "원기둥 부피(반지름)" },
    { value: "cylinder_volume_diameter", label: "원기둥 부피(지름)" },
  ],
  circles: [
    { value: "circumference_radius", label: "원둘레(반지름)" },
    { value: "circumference_diameter", label: "원둘레(지름)" },
    { value: "arc_length", label: "호의 길이" },
    { value: "sector_area", label: "부채꼴 넓이" },
    { value: "central_from_inscribed", label: "원주각→중심각" },
    { value: "inscribed_from_central", label: "중심각→원주각" },
    { value: "circle_equation_transform", label: "원의 방정식 변형" },
  ],
  linear_equations_one_var: [
    { value: "solve", label: "방정식 풀기" },
    { value: "word_problem_translate", label: "문장제 → 방정식 세우기" },
    { value: "literal_rearrange", label: "리터럴 방정식 재배열" },
  ],
  linear_functions: [
    { value: "evaluate", label: "함수값 계산" },
    { value: "find_x_for_value", label: "함수값으로 x 역산" },
    { value: "slope_from_two_points", label: "두 점으로 기울기" },
    { value: "interpret_slope", label: "기울기 해석" },
    { value: "interpret_intercept", label: "절편 해석" },
  ],
  linear_inequalities: [
    { value: "solve_one_var", label: "한 변수 부등식 풀기" },
    { value: "point_in_solution", label: "해 영역에 점 포함 판정" },
    { value: "table_verification", label: "표로 부등식 검증" },
  ],
  linear_two_variables: [
    { value: "intersection_x", label: "교점 x좌표" },
    { value: "intersection_y", label: "교점 y좌표" },
    { value: "intersection_sum", label: "교점 좌표 합" },
    { value: "slope", label: "기울기" },
    { value: "intercept", label: "절편" },
    { value: "num_solutions", label: "해의 개수" },
  ],
  lines_angles_triangles: [
    { value: "triangle_angle_sum", label: "삼각형 내각의 합" },
    { value: "exterior_angle", label: "외각" },
    { value: "isosceles_base_angle", label: "이등변삼각형 밑각" },
    { value: "similar_triangles", label: "닮은 삼각형" },
  ],
  nonlinear_equations_systems: [
    { value: "root", label: "정수 근" },
    { value: "sum_of_roots", label: "근의 합(정수 근)" },
    { value: "product_of_roots", label: "근의 곱(정수 근)" },
    { value: "num_real_solutions", label: "실근의 개수" },
    { value: "irrational_sum_of_roots", label: "근의 합(무리수 근)" },
    { value: "irrational_product_of_roots", label: "근의 곱(무리수 근)" },
    { value: "irrational_root_radical_form", label: "근호 형태 근" },
    { value: "linear_quadratic_intersection", label: "일차·이차 연립 교점" },
    { value: "parameter_discriminant", label: "판별식 기반 매개변수" },
  ],
  nonlinear_functions: [
    { value: "evaluate", label: "함수값 계산" },
    { value: "vertex_x", label: "꼭짓점 x좌표" },
    { value: "vertex_y", label: "꼭짓점 y좌표" },
    { value: "find_x_for_value", label: "함수값으로 x 역산(지수)" },
    { value: "interpret_a", label: "계수 a 해석(지수)" },
    { value: "interpret_b", label: "밑 b 해석(지수)" },
  ],
  one_variable_data: [
    { value: "mean", label: "평균" },
    { value: "median", label: "중앙값" },
    { value: "range", label: "범위" },
    { value: "grouped_median_interval", label: "도수분포 중앙값 구간" },
  ],
  percentages: [
    { value: "percent_of", label: "~의 몇 %" },
    { value: "find_whole", label: "전체값 구하기" },
    { value: "percent_change", label: "증감률" },
    { value: "find_percent", label: "퍼센트 역산" },
    { value: "compound_change", label: "복합 증감" },
  ],
  probability: [
    { value: "simple", label: "단순 확률" },
    { value: "conditional", label: "조건부 확률" },
    { value: "sequential_without_replacement", label: "비복원 연속 시행" },
  ],
  ratios_rates_units: [
    { value: "proportion", label: "비례식" },
    { value: "chained_conversion", label: "연쇄 단위 환산" },
  ],
  right_triangles_trigonometry: [
    { value: "pythagorean_hypotenuse", label: "피타고라스(빗변)" },
    { value: "pythagorean_leg", label: "피타고라스(다른 변)" },
    { value: "trig_ratio", label: "삼각비" },
  ],
  two_variable_data: [
    { value: "cell", label: "이원표 셀 값" },
    { value: "row_total", label: "이원표 행 합계" },
    { value: "conditional_share", label: "조건부 비율" },
    { value: "scatter_equation", label: "산점도 회귀식" },
    { value: "scatter_predict", label: "산점도 예측값" },
    { value: "scatter_slope_context", label: "산점도 기울기 해석" },
    { value: "scatter_count_above", label: "산점도 기준선 위 개수" },
  ],
  equivalent_expressions: [
    { value: "polynomial_distribution", label: "다항식 분배·동류항" },
    { value: "rational_equivalence", label: "유리식 동치" },
  ],
  // 세부 패턴이 하나뿐이라 드롭다운이 필요 없는 스킬(참고용으로 명시):
  // systems_linear(linear_two_variables 재사용), inference_margin_error, evaluating_statistical_claims.
};

/** skillCode의 세부 패턴 목록. 카탈로그에 없거나 1개 이하면 빈 배열(드롭다운 숨김 기준은 호출부가 length>=2로 판단). */
export function getMathSkillKinds(skillCode: string | null | undefined): SkillKindEntry[] {
  if (!skillCode) return [];
  // systems_linear는 linear_two_variables 컴파일러를 그대로 재사용한다(batch.ts 참고).
  const lookupCode = skillCode === "systems_linear" ? "linear_two_variables" : skillCode;
  return MATH_SKILL_KINDS[lookupCode] ?? [];
}

/** value에 대응하는 한글 라벨. 카탈로그에 없으면 원본 값을 그대로 돌려준다(안전한 표시용). */
export function getMathKindLabel(skillCode: string | null | undefined, value: string | null | undefined): string | null {
  if (!value) return null;
  const entry = getMathSkillKinds(skillCode).find((k) => k.value === value);
  return entry?.label ?? value;
}
