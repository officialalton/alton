// AP Statistics FRQ 무료 결정적 설계 검사(LLM 없음). 2027 FRQ 는 4문항 × 10점, 채점 행은 전부 1점씩 10행(CED 샘플 4문항 공통)이다.
// 유형: Q1 복합 초점(Practice 1·2; 조사 질문 파트 = 스킬 1.A·토픽 1.10), Q2 자료 분석·모형(Practice 3·4), Q3 추론(가설·조건·검정통계량·결론), Q4 단원 통합.
// 통계 시험은 완전 디지털(키보드 입력)이므로 그리기·스케치 응답을 요구하는 파트는 허용하지 않는다. 모범 답안은 "공식 채점이 아님"을 밝히는 자기 점검용이다(convert.ts 가 면책 문구를 붙인다).
import type { FrqPack } from "./gates";

export const STATS_FRQ_TEMPLATES = ["q1_multifocus", "q2_regression", "q3_inference", "q4_integrated"] as const;
export type StatsFrqTemplate = (typeof STATS_FRQ_TEMPLATES)[number];
export const STATS_FRQ_POINTS = 10;
const DRAWING = /\b(sketch|draw|shade|construct (?:a|an|the) (?:histogram|boxplot|box plot|graph|dotplot|dot plot|scatterplot|plot)|label the axes|on your own paper)\b/i;
const unitOfTopic = (t: string) => t.split(".")[0];

export function gateStatsFrq(p: FrqPack): string[] {
  const r: string[] = [];
  const rows = p.parts.flatMap((x) => x.rubric_rows);
  if (p.total_points !== STATS_FRQ_POINTS) r.push(`stats_frq_points_${p.total_points}_not_10`);
  if (rows.length !== STATS_FRQ_POINTS) r.push(`stats_frq_rows_${rows.length}_not_10`);
  if (rows.some((x) => x.points !== 1)) r.push("stats_frq_row_not_one_point");
  if (p.parts.length < 3 || p.parts.length > 6) r.push(`stats_frq_parts_${p.parts.length}_not_3_to_6`);
  for (const pt of p.parts) {
    if (!["explain", "calculate"].includes(pt.response_mode)) r.push(`stats_frq_part_${pt.label}_mode_${pt.response_mode}_not_typed`);
    if (DRAWING.test(pt.prompt)) r.push(`stats_frq_part_${pt.label}_needs_drawing_input`);
    if (!pt.topic_codes?.length) r.push(`stats_frq_part_${pt.label}_no_topic`);
  }
  // 수치 파트는 구조화 기대값을 가져야 한다(독립 풀이 수치 비교 근거)
  const numericParts = new Set(p.parts.filter((x) => x.rubric_rows.some((y) => y.requires_numbers)).map((x) => x.label.toLowerCase()));
  const evParts = new Set((p.expected_values ?? []).map((e) => e.part.toLowerCase()));
  if (numericParts.size && !(p.expected_values ?? []).length) r.push("stats_frq_numeric_rows_without_expected_values");
  for (const e of p.expected_values ?? []) if (!numericParts.has(e.part.toLowerCase())) r.push(`stats_frq_expected_value_on_non_numeric_part_${e.part}`);
  void evParts;
  const skills = new Set(p.parts.flatMap((x) => x.skill_codes));
  const topics = p.parts.flatMap((x) => x.topic_codes ?? []);
  const t = p.template as StatsFrqTemplate;
  if (!(STATS_FRQ_TEMPLATES as readonly string[]).includes(t)) r.push(`stats_frq_unknown_template_${p.template}`);
  if (t === "q1_multifocus") {
    const inv = p.parts.find((x) => x.skill_codes.includes("1.A") && (x.topic_codes ?? []).includes("1.10"));
    if (!inv) r.push("q1_missing_investigative_question_part_1A_topic_1.10"); else if (inv.rubric_rows.length < 3) r.push("q1_investigative_question_needs_three_rows");
    if (!skills.has("2.A") && !skills.has("2.B")) r.push("q1_missing_practice_2");
  }
  if (t === "q2_regression") {
    if (topics.some((x) => unitOfTopic(x) !== "5")) r.push("q2_topic_outside_unit_5");
    if (![...skills].some((s) => s.startsWith("4."))) r.push("q2_missing_practice_4");
    if (![...skills].some((s) => s.startsWith("3."))) r.push("q2_missing_practice_3");
  }
  if (t === "q3_inference") {
    for (const s of ["2.E", "4.E", "3.E", "4.G"]) if (!skills.has(s)) r.push(`q3_missing_skill_${s}`);
    if (!p.parts.some((x) => x.rubric_rows.some((y) => /conditions?|random|10%|large counts|normal/i.test(y.criterion)))) r.push("q3_missing_conditions_row");
    if (!p.parts.some((x) => x.rubric_rows.some((y) => /context/i.test(y.criterion)))) r.push("q3_missing_context_conclusion_row");
  }
  if (t === "q4_integrated") {
    if (new Set(topics.map(unitOfTopic)).size < 2) r.push("q4_integrates_fewer_than_two_units");
  }
  return [...new Set(r)];
}
