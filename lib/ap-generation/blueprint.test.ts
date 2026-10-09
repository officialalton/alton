import { describe, expect, it } from "vitest";
import { validateBlueprint, type Blueprint, type BlueprintContext } from "./blueprint";
const ctx: BlueprintContext = { skills: new Set(["1.E", "2.B", "3.C", "4.B", "6.B", "5.A", "4.A"]), topicUnit: new Map([["3.1", "3"], ["7.7", "7"], ["8.1", "8"], ["3.2", "3"], ["2.3", "2"], ["4.2", "4"]]) };
const mc: Blueprint = { id: "t-1", subject: "ap_calculus_ab", kind: "mc", concept: "chain rule at a point", topic: "3.1", skill: "1.E", student_thinking: ["Recognize the composite structure of the function", "Differentiate with the chain rule and evaluate at the point with a calculator"], structure: "standalone", response_mode: "select", calculator: "required",
  key_conditions: [{ condition: "f is differentiable at a", evidence: "composition of elementary differentiable functions" }], material: { type: "none", must_include: [] }, misconceptions: [{ id: "no_chain", description: "drops the inner derivative factor" }, { id: "eval_f", description: "evaluates f instead of f prime" }, { id: "sign", description: "sign error in the inner derivative" }],
  verification: { independent_path: "symbolic derivative cross-checked by a high-precision central difference", method: "sympy+numeric" } };
const bio = (over: Record<string, unknown> = {}): Blueprint => ({ ...mc, subject: "ap_biology", kind: "frq_bundle", topic: "8.1", skill: "3.C", calculator: "allowed", structure: "frq_multipart", response_mode: "explain", misconceptions: [], total_points: 2,
  parts: [{ label: "A", skills: ["3.C"], topics: ["8.1"], points: 1, accepted_answers: ["independent variable is humidity"], rubric_rows: [{ row_id: "A1", points: 1, criterion: "identifies variable", elements: ["humidity"] }] }, { label: "B", skills: ["4.B"], topics: ["8.1"], points: 1, accepted_answers: ["control is 60%"], rubric_rows: [{ row_id: "B1", points: 1, criterion: "names control", elements: ["60%"] }] }],
  experiment: { fictional: true, design: "experimental", independent_variables: ["humidity"], dependent_variable: "pill bugs in test half", controls: ["60% humidity group"], replicates_per_group: 10, measurement: { variable: "count", unit: "pill bugs" }, claims: [{ text: "high humidity is associated with more bugs in the test half", scope: "association" }], ced_topics_used: ["8.1"] }, ...over } as Blueprint);
describe("blueprint 검증(생성 전 결정적 게이트)", () => {
  it("완전한 MC 설계도는 통과", () => { expect(validateBlueprint(mc, ctx)).toEqual([]); });
  it("키 조건·독립 검증·오개념이 없으면 걸린다(문항을 먼저 쓰고 끼워 맞추기 방지)", () => {
    const codes = validateBlueprint({ ...mc, key_conditions: [], verification: { independent_path: "same", method: "x" }, misconceptions: [{ id: "a", description: "one misconception only here" }] }, ctx).map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(["key_conditions_missing", "independent_verification_missing", "misconceptions_missing"]));
  });
  it("공식 스킬·토픽이 아니면 걸리고 MC 에서 평가 안 되는 스킬도 걸린다", () => {
    expect(validateBlueprint({ ...mc, skill: "9.Z", topic: "99.9" }, ctx).map((i) => i.code)).toEqual(expect.arrayContaining(["unknown_skill", "unknown_topic"]));
    expect(validateBlueprint({ ...mc, skill: "4.A" }, { ...ctx, skills: new Set([...ctx.skills, "4.A"]) }).map((i) => i.code)).toContain("skill_not_assessed_in_mc");
  });
  it("FRQ 파트: 루브릭 합계가 파트 점수와 다르면 걸린다", () => {
    const b = bio(); b.parts![0].rubric_rows[0].points = 2;
    expect(validateBlueprint(b, ctx).map((i) => i.code)).toContain("part_A_rubric_sum");
  });
  it("Bio 정상 설계도는 통과", () => { expect(validateBlueprint(bio(), ctx)).toEqual([]); });
  it("Bio 실험 설계 타당성: 대조군·반복·독립변수 1개·측정 정의·가상 표시", () => {
    const b = bio(); const e = b.experiment!; e.controls = []; e.replicates_per_group = 2; e.independent_variables = ["a", "b"]; e.fictional = false; e.measurement = { variable: "", unit: "" };
    expect(validateBlueprint(b, ctx).map((i) => i.code)).toEqual(expect.arrayContaining(["bio_controls_missing", "bio_replicates", "bio_one_variable", "bio_must_be_fictional", "bio_measurement"]));
  });
  it("Bio: 관찰 자료에서 인과 결론, 연관 결론의 인과 동사, 이후 단원 개념 금지", () => {
    const b = bio(); b.experiment!.design = "observational"; b.experiment!.claims = [{ text: "humidity causes movement", scope: "causation" }, { text: "humidity leads to more bugs", scope: "association" }]; b.experiment!.ced_topics_used = ["8.1", "9.9"];
    const codes = validateBlueprint(b, { ...ctx, topicUnit: new Map([...ctx.topicUnit, ["9.9", "9"]]) }).map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(["bio_causal_from_observational", "bio_causal_wording", "bio_topic_out_of_unit_scope"]));
  });
  it("Micro: 변화·고정 조건, 키·해설 가정 일치가 필요", () => {
    const m = { ...mc, subject: "ap_microeconomics", model: { initial_state: "monopolist with linear demand and constant MC", changed_conditions: ["MC rises"], held_constant: ["demand"], checks: ["MR=MC", "profit"], key_assumptions_id: "A1", explanation_assumptions_id: "A2" } } as Blueprint;
    expect(validateBlueprint(m, ctx).map((i) => i.code)).toContain("micro_assumptions_mismatch");
    expect(validateBlueprint({ ...m, model: { ...m.model!, explanation_assumptions_id: "A1" } }, ctx)).toEqual([]);
  });
});
