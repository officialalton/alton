// Micro FRQ 무료 결정적 검사(오너 2026-10-09): 점수·스킬 오류를 LLM 호출 없이 잡는다. Bio 와 같은 의미 기반 루브릭 규칙 + 프롬프트↔루브릭 일치 + 계산기·응답 방식 일치.
import { meaningRubricIssues, type BioIssue } from "./bio-frq-checks";
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const num = (s: string) => /\d/.test(String(s));
export function gateMicroFrq(p: Json, ctx: { topics: Set<string>; skills: Set<string> }): BioIssue[] {
  const out: BioIssue[] = [...meaningRubricIssues(p)]; const add = (code: string, message: string) => out.push({ code, message });
  for (const t of [p.topic, ...(p.parts ?? []).flatMap((x: Json) => x.topic_codes ?? [])]) if (t && !ctx.topics.has(t)) add("nonexistent_topic", `공식 토픽이 아니다: ${t}`);
  const parts: Json[] = p.parts ?? [];
  for (const pt of parts) {
    for (const s of pt.skill_codes ?? []) if (!ctx.skills.has(s)) add("unknown_skill", `파트 ${pt.label}: ${s}`);
    const rows: Json[] = pt.rubric_rows ?? []; const asksWhy = /\b(explain|justify|why|reason)\b/i.test(pt.prompt ?? "");
    // 프롬프트가 설명·정당화를 요구하면 그 추론을 채점하는 행이 있어야 한다(LLM 문장 다듬기가 요구를 추가해도 채점과 어긋나지 않게)
    if (asksWhy && !rows.some((r) => /explain|reason|because|incentive|link|justif|shows? that|argu|state[s]? that|identif/i.test(r.criterion ?? "") && (r.required_elements ?? []).some((e: string) => String(e).length >= 25))) add("explain_prompt_without_reasoning_row", `파트 ${pt.label}: 설명을 요구하지만 추론 채점 행이 없다`);
    if (pt.response_mode === "calculate" && !rows.some((r) => r.requires_numbers || /answer/i.test(r.criterion ?? ""))) add("calculate_part_without_numeric_row", `파트 ${pt.label}: 계산 파트에 수치 행이 없다`);
    if (pt.response_mode === "calculate" && !rows.some((r) => (r.required_elements ?? []).some(num))) add("calculate_part_no_numbers", `파트 ${pt.label}: 계산 파트인데 수가 없다`);
  }
  // 계산기: 계산 파트가 없으면 'allowed' 를 쓰지 않는다
  if (p.calculator === "allowed" && !parts.some((x) => x.response_mode === "calculate")) add("calculator_allowed_without_calculation", "계산 파트가 없는데 계산기 허용으로 표시");
  // 스킬: 대표 스킬은 과반 파트가 평가해야 한다(번들 라벨과 파트가 따로 노는 것 방지)
  if (p.representative_skill) { const n = parts.filter((x) => (x.skill_codes ?? []).includes(p.representative_skill)).length; if (n < Math.ceil(parts.length / 2)) add("representative_skill_minority", `대표 스킬 ${p.representative_skill} 를 평가하는 파트가 ${n}/${parts.length}`); }
  return out;
}
