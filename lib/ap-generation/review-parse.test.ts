import { describe, expect, it } from "vitest";
import { normalizeReview, parseCriterion, recoverFromBlocks } from "./review-parse";
describe("검토 출력 정규화", () => {
  it("정상 객체는 그대로", () => { expect(parseCriterion({ pass: false, notes: "x" })).toEqual({ pass: false, notes: "x" }); });
  it("깨진 문자열 true/false 를 읽는다", () => { expect(parseCriterion('<parameter name="pass">true')?.pass).toBe(true); expect(parseCriterion('\n<parameter name="pass">false')?.pass).toBe(false); });
  it("읽을 수 없으면 malformed 로 표시(암묵 불통과 아님)", () => { const r = normalizeReview({ scope_skill: "???", key_scoring: { pass: true, notes: "" }, stimulus_expression: { pass: true, notes: "" }, distractor_explanation: { pass: true, notes: "" }, exam_suitability: { pass: true, notes: "" } }); expect(r.malformed).toEqual(["scope_skill"]); });
});

describe("분할된 도구 블록 복원", () => {
  const blocks = [{ scope_skill: '\n<parameter name="pass">true', notes: "ok" }, { pass: "true", notes: "k" }, { pass: true, notes: "s" }, { pass: "false", notes: "d" }, { pass: "true", notes: "e" }, { items: "[]" }, { value: "true" }, { value: "false" }, { value: "summary text" }];
  it("9개 블록에서 완전한 검토를 복원한다", () => { const r = recoverFromBlocks(blocks)!; expect(r.scope_skill).toEqual({ pass: true, notes: "ok" }); expect((r.distractor_explanation as { pass: boolean }).pass).toBe(false); expect(r.instant_reject).toEqual([]); expect(r.summary).toBe("summary text"); expect(normalizeReview(r).malformed).toEqual([]); });
  it("모양이 어긋나면 복원하지 않는다", () => { expect(recoverFromBlocks(blocks.slice(0, 5))).toBeNull(); expect(recoverFromBlocks([blocks[1], ...blocks.slice(1)])).toBeNull(); });
});

import { numsIn, reviewFromToolBlocks } from "./review-parse";
describe("유니코드 마이너스·평탄 검토 도구(무료 검증)", () => {
  it("'−72.9%' 는 -72.9, 3,025 는 3025", () => { expect(numsIn("(3.9 − 14.4)/14.4 × 100 ≈ −72.9%, about a 73% decrease")).toEqual(expect.arrayContaining([-72.9])); expect(numsIn("−72.9%")).toEqual([-72.9]); expect(numsIn("–5 and 3,025")).toEqual([-5, 3025]); });
  it("솔버 기대값 -72.9 와 유니코드 마이너스 답이 일치한다", () => { const exp = -72.9; const got = numsIn("−72.9%"); expect(got.some((g) => Math.abs(g - exp) <= Math.max(0.0015, Math.abs(exp) * 0.0015))).toBe(true); });
  it("평탄 검토 도구 출력을 정규 검토로 바꾸고 malformed 가 아니다", () => {
    const flat = { scope_skill_pass: true, scope_skill_notes: "n", key_scoring_pass: true, key_scoring_notes: "", stimulus_expression_pass: false, stimulus_expression_notes: "x", distractor_explanation_pass: true, distractor_explanation_notes: "", exam_suitability_pass: true, exam_suitability_notes: "", instant_reject: [], matches_reference_pattern: true, resembles_known_exam_item: false, summary: "s" };
    const r = reviewFromToolBlocks([flat]); const n = normalizeReview(r); expect(n.malformed).toEqual([]); expect((n.review!.stimulus_expression as { pass: boolean }).pass).toBe(false);
  });
  it("쪼개진 블록은 복원되고 읽을 수 없으면 malformed 로 남는다", () => { expect(normalizeReview(reviewFromToolBlocks([{ scope_skill: "???" }])).malformed.length).toBeGreaterThan(0); });
});
