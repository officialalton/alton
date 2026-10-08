// 과목 가이드 기반 결정적 게이트(범위·계산기·노테이션·원형 일치). 가이드 설정은 lib/ap-generation/subjects/<과목>.ts.
import type { McPack, FrqPack } from "./gates";
import type { SubjectGuide } from "./subjects/types";

export function gateGuideMc(g: SubjectGuide, p: McPack): string[] {
  const r: string[] = [];
  const a = g.archetypes.find((x) => x.id === p.archetype);
  if (!a) return ["archetype_not_in_guide"];
  if (a.topic !== p.topic || a.skill !== p.skill) r.push("archetype_topic_skill_differs_from_guide");
  if (a.calculator !== p.calculator) r.push("calculator_flag_differs_from_guide");
  const text = `${p.stem} ${p.options.map((o) => o.text).join(" ")} ${p.explanation_en ?? ""}`;
  for (const b of g.bannedTerms) if (new RegExp(b.pattern, "i").test(text)) r.push(`banned_term:${b.why}`);
  if (!/\$/.test(p.stem) && /[=^]|\\frac|\\int|\\lim/.test(p.stem)) r.push("math_not_in_latex_delimiters");
  if (p.calculator === "required") { if (!p.options.every((o) => /\$-?\d+\.\d{2,3}\$|\$-?\d+\.\d+\$|\$[^$]*\d[^$]*\$/.test(o.text))) r.push("calculator_item_options_not_numeric"); }
  const unit = p.topic.split(".")[0];
  if (!g.units.some((u) => u.unit === unit)) r.push("unit_not_in_ab_scope");
  return r;
}
export function gateGuideFrq(g: SubjectGuide, p: FrqPack): string[] {
  const r: string[] = [];
  const t = g.frqTemplates.find((x) => x.id === p.archetype);
  if (!t) return ["frq_template_not_in_guide"];
  if (t.template !== p.template || t.skill !== p.skill) r.push("template_differs_from_guide");
  if (p.total_points !== t.points) r.push("points_differ_from_guide");
  const text = p.parts.map((x) => `${x.prompt} ${x.model_answer}`).join(" ");
  for (const b of g.bannedTerms) if (new RegExp(b.pattern, "i").test(text)) r.push(`banned_term:${b.why}`);
  const rows = p.parts.flatMap((x) => x.rubric_rows);
  if (!rows.some((x) => x.units_row) && p.calculator === "required" && p.template === "table_rate_context_calc") r.push("rate_context_without_units_row");
  const numericRows = rows.filter((x) => x.requires_numbers);
  if (numericRows.length < 2) r.push("too_few_numeric_rows");
  return r;
}
