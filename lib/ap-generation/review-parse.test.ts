import { describe, expect, it } from "vitest";
import { normalizeReview, parseCriterion } from "./review-parse";
describe("검토 출력 정규화", () => {
  it("정상 객체는 그대로", () => { expect(parseCriterion({ pass: false, notes: "x" })).toEqual({ pass: false, notes: "x" }); });
  it("깨진 문자열 true/false 를 읽는다", () => { expect(parseCriterion('<parameter name="pass">true')?.pass).toBe(true); expect(parseCriterion('\n<parameter name="pass">false')?.pass).toBe(false); });
  it("읽을 수 없으면 malformed 로 표시(암묵 불통과 아님)", () => { const r = normalizeReview({ scope_skill: "???", key_scoring: { pass: true, notes: "" }, stimulus_expression: { pass: true, notes: "" }, distractor_explanation: { pass: true, notes: "" }, exam_suitability: { pass: true, notes: "" } }); expect(r.malformed).toEqual(["scope_skill"]); });
});
