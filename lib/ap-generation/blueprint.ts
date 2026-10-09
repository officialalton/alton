// 문항 설계도(blueprint) — 문항·보기·해설을 쓰기 전에 만들고 결정적으로 검증하는 필수 층(오너 2026-10-09).
// 반복 유형 = 원형(코드 템플릿) + 설계도, 자유형 문항 = 설계도만. 설계도 검증 실패는 문항 생성·검토 호출을 쓰지 않는다.
// 설계도는 "문항을 먼저 쓰고 근거를 끼워 맞추는" 순서를 막는다: 개념·스킬, 학생이 거쳐야 할 사고, 키가 성립하는 조건과 근거, 필요한 자료, 오답별 오개념, FRQ 파트별 스킬·점수·허용 답·루브릭이 먼저 확정된다.
import { NOT_ASSESSED_MC } from "./gates";

export type KeyCondition = { condition: string; evidence: string };
export type Misconception = { id: string; description: string };
export type BlueprintPart = { label: string; skills: string[]; topics: string[]; points: number; accepted_answers: string[]; rubric_rows: { row_id: string; points: number; criterion: string; elements: string[] }[] };
export type BioExperiment = {
  fictional: boolean; control_rationale?: string; control_not_applicable?: string; design: "experimental" | "observational"; independent_variables: string[]; dependent_variable: string; controls: string[]; replicates_per_group: number;
  measurement: { variable: string; unit: string }; claims: { text: string; scope: "association" | "causation" }[]; ced_topics_used: string[];
};
export type MicroModel = { initial_state: string; changed_conditions: string[]; held_constant: string[]; checks: string[]; key_assumptions_id: string; explanation_assumptions_id: string };
export type Blueprint = {
  id: string; subject: string; kind: "mc" | "frq_bundle"; concept: string; topic: string; skill: string; student_thinking: string[];
  structure: string; response_mode: string; calculator: "required" | "not_allowed" | "allowed" | "na";
  key_conditions: KeyCondition[]; material: { type: string; must_include: string[] }; misconceptions: Misconception[];
  verification: { independent_path: string; method: string }; parts?: BlueprintPart[]; total_points?: number; experiment?: BioExperiment; model?: MicroModel;
};
export type BlueprintContext = { skills: Set<string>; topicUnit: Map<string, string> }; // 공식 CED 스킬 코드, 토픽 코드 → 단원
export type BlueprintIssue = { code: string; message: string };

const CAUSAL = /\b(causes?|caused|leads? to|results? in|is responsible for|produces?|makes?)\b/i;
const str = (v: unknown, min = 1) => typeof v === "string" && v.trim().length >= min;
const unitNo = (u: string) => Number(u);

export function validateBlueprint(bp: Partial<Blueprint> | null | undefined, ctx: BlueprintContext): BlueprintIssue[] {
  const out: BlueprintIssue[] = []; const add = (code: string, message: string) => out.push({ code, message });
  if (!bp) return [{ code: "missing_blueprint", message: "설계도가 없다" }];
  for (const k of ["id", "subject", "concept", "topic", "skill", "structure", "response_mode"] as const) if (!str(bp[k])) add(`missing_${k}`, `${k} 필요`);
  if (bp.kind !== "mc" && bp.kind !== "frq_bundle") add("bad_kind", "kind 는 mc 또는 frq_bundle");
  if (str(bp.topic) && !ctx.topicUnit.has(bp.topic!)) add("unknown_topic", `공식 토픽이 아니다: ${bp.topic}`);
  if (str(bp.skill) && !ctx.skills.has(bp.skill!)) add("unknown_skill", `공식 스킬이 아니다: ${bp.skill}`);
  if (bp.kind === "mc" && bp.subject && (NOT_ASSESSED_MC[bp.subject] ?? []).includes(bp.skill ?? "")) add("skill_not_assessed_in_mc", `MC 에서 평가되지 않는 스킬: ${bp.skill}`);
  if (!Array.isArray(bp.student_thinking) || bp.student_thinking.length < 2 || bp.student_thinking.some((s) => !str(s, 15))) add("student_thinking_too_thin", "학생이 거쳐야 할 사고 단계가 2개 이상, 각 15자 이상 필요");
  if (!["required", "not_allowed", "allowed", "na"].includes(bp.calculator ?? "")) add("bad_calculator", "calculator 값");
  if (!Array.isArray(bp.key_conditions) || bp.key_conditions.length < 1 || bp.key_conditions.some((k) => !str(k.condition, 8) || !str(k.evidence, 10))) add("key_conditions_missing", "키가 성립하는 조건과 근거(evidence) 필요");
  if (!bp.material || !str(bp.material.type) || !Array.isArray(bp.material.must_include)) add("material_missing", "필요한 자료 유형·필수 포함 항목 필요");
  if (!bp.verification || !str(bp.verification.independent_path, 20) || !str(bp.verification.method)) add("independent_verification_missing", "생성 경로와 독립된 검증 경로 설명(20자 이상)과 방법 필요");
  if (bp.kind === "mc") {
    const ms = bp.misconceptions ?? [];
    if (ms.length < 3 || ms.some((m) => !str(m.id) || !str(m.description, 10))) add("misconceptions_missing", "오답별 오개념 3개 이상(id·설명) 필요");
    else if (new Set(ms.map((m) => m.id)).size !== ms.length || new Set(ms.map((m) => m.description.toLowerCase())).size !== ms.length) add("misconceptions_not_distinct", "오개념이 서로 달라야 한다");
  }
  if (bp.kind === "frq_bundle") {
    const parts = bp.parts ?? []; if (!parts.length) add("no_parts", "FRQ 파트 필요");
    let total = 0; const labels = new Set<string>();
    for (const p of parts) {
      total += p.points ?? 0; if (labels.has(p.label)) add("duplicate_part_label", `파트 라벨 중복 ${p.label}`); labels.add(p.label);
      if (!p.skills?.length || p.skills.some((s) => !ctx.skills.has(s))) add(`part_${p.label}_skill`, `파트 ${p.label}: 공식 스킬 필요`);
      if (!p.topics?.length || p.topics.some((t) => !ctx.topicUnit.has(t))) add(`part_${p.label}_topic`, `파트 ${p.label}: 공식 토픽 필요`);
      if (!(p.points >= 1)) add(`part_${p.label}_points`, `파트 ${p.label}: 점수`);
      if (!p.accepted_answers?.length || p.accepted_answers.some((a) => !str(a))) add(`part_${p.label}_accepted_answers`, `파트 ${p.label}: 허용 답 필요`);
      const rs = p.rubric_rows ?? []; if (!rs.length) add(`part_${p.label}_rubric`, `파트 ${p.label}: 루브릭 행 필요`);
      else { if (rs.reduce((a, r) => a + r.points, 0) !== p.points) add(`part_${p.label}_rubric_sum`, `파트 ${p.label}: 루브릭 점수 합 ≠ 파트 점수`); if (new Set(rs.map((r) => r.row_id)).size !== rs.length) add(`part_${p.label}_row_ids`, "행 id 중복"); if (rs.some((r) => !r.elements?.length)) add(`part_${p.label}_row_elements`, "행마다 필수 요소 필요"); }
    }
    if (bp.total_points !== undefined && bp.total_points !== total) add("total_points_mismatch", `총점 ${bp.total_points} ≠ 파트 합 ${total}`);
  }
  if (bp.subject === "ap_biology") bioExperimentRules(bp, ctx, add);
  if (bp.subject === "ap_microeconomics") microModelRules(bp, add);
  return out;
}

/** Bio 실험 설계 타당성(결정적). 전문가 검수가 게시 전 게이트가 아니므로 코드로 가능한 만큼 먼저 막고, 남는 불확실성은 게시 후 오류 신고로 처리한다(한계: 생물학적 사실의 정확성은 코드로 증명하지 못한다). */
function bioExperimentRules(bp: Partial<Blueprint>, ctx: BlueprintContext, add: (c: string, m: string) => void) {
  const e = bp.experiment; if (!e) return add("bio_experiment_missing", "Bio 설계도에는 experiment(자료 먼저) 필요");
  if (e.fictional !== true) add("bio_must_be_fictional", "가상 실험을 실제 연구처럼 제시하면 안 된다(fictional=true)");
  if (e.design !== "experimental" && e.design !== "observational") add("bio_design_type", "design 은 experimental/observational");
  if (e.design === "experimental") { if ((e.independent_variables ?? []).length !== 1) add("bio_one_variable", "실험 설계는 독립변수가 정확히 1개여야 한다"); if (!(e.controls ?? []).length && !str(e.control_not_applicable, 20)) add("bio_controls_missing", "대조군/대조 조건 필요(없으면 control_not_applicable 사유 20자 이상)"); if ((e.controls ?? []).length && !str(e.control_rationale, 15)) add("bio_control_rationale_missing", "대조군이 왜 기준 조건인지 설명(control_rationale) 필요 — 모호한 대조군 방지"); }
  if (!str(e.dependent_variable)) add("bio_dependent_variable", "종속변수 필요");
  if (!(e.replicates_per_group >= 3)) add("bio_replicates", "집단당 반복 3 이상 필요");
  if (!e.measurement || !str(e.measurement.variable) || !str(e.measurement.unit)) add("bio_measurement", "측정 변수와 단위 정의 필요");
  if (!(e.claims ?? []).length) add("bio_claims_missing", "자료로 지지되는 결론(claims) 필요");
  for (const c of e.claims ?? []) {
    if (e.design === "observational" && c.scope === "causation") add("bio_causal_from_observational", `관찰 자료에서 인과 결론 금지: ${c.text}`);
    if (c.scope === "association" && CAUSAL.test(c.text)) add("bio_causal_wording", `연관 결론에 인과 동사 사용: ${c.text}`);
  }
  const mu = unitNo(ctx.topicUnit.get(bp.topic ?? "") ?? "99");
  for (const t of e.ced_topics_used ?? []) { const u = ctx.topicUnit.get(t); if (!u) add("bio_topic_unknown", `알 수 없는 토픽 ${t}`); else if (unitNo(u) > mu) add("bio_topic_out_of_unit_scope", `이후 단원 개념 사용 금지: ${t}`); }
  if (!(e.ced_topics_used ?? []).length) add("bio_ced_scope_missing", "사용 개념의 CED 토픽 목록 필요");
}
function microModelRules(bp: Partial<Blueprint>, add: (c: string, m: string) => void) {
  const m = bp.model; if (!m) return add("micro_model_missing", "Micro 설계도에는 model(모형→변화→검증) 필요");
  if (!str(m.initial_state, 10)) add("micro_initial_state", "초기 상태 필요");
  if (!(m.changed_conditions ?? []).length) add("micro_changed_conditions", "변화시킨 조건 필요");
  if (!(m.held_constant ?? []).length) add("micro_held_constant", "고정한 조건 필요");
  if (!(m.checks ?? []).length) add("micro_checks", "검증 항목(균형·곡선·계산) 필요");
  if (!m.key_assumptions_id || m.key_assumptions_id !== m.explanation_assumptions_id) add("micro_assumptions_mismatch", "키와 해설이 같은 가정(assumptions_id)을 써야 한다");
}
