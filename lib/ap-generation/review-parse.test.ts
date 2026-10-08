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
