import { describe, expect, it } from "vitest";
import { figureNumbersOf, staticChecks, rewritePrompt, costOf } from "./answer-leak-rewrite";
import { buildDraftArgs } from "./answer-leak-apply";
import { buildIdf } from "./answer-leak-detector";

const question = "Which choice most effectively uses data from the table to support the claim that Painter C has the fewest surviving attributed paintings among the four painters studied?";
const original = ["Painter A has 65 surviving attributed paintings, the most of the four painters studied", "Painter B has 48 surviving attributed paintings, more than both Painter D and Painter C", "Painter D has 34 surviving attributed paintings, fewer than both Painter A and Painter B", "Painter C has only 12 surviving attributed paintings, fewer than any of the other three painters"];
const good = ["Painter C has 12 surviving attributed paintings, more than the 9 recorded for Painter D", "Painter A has 65 surviving attributed paintings, nearly double the 34 attributed to Painter D", "Painter B has 48 paintings, ranking second among the four, which is 14 more than Painter D's 34", original[3]];
const figure = { kind: "table", rows: [["Painter A", 65], ["Painter B", 48], ["Painter C", 12], ["Painter D", 34]], columns: ["Painter", "Number"] };
const idf = buildIdf([question, ...original]);
const base = { skill: "command_of_evidence_quant", question, original, correctIndex: 3, explanationEn: "Painter C's 12 is the minimum.", idf, figureNumbers: figureNumbersOf(figure) };

describe("answer-leak-rewrite", () => {
  it("figureNumbersOf: 숫자 셀과 숫자 문자열만", () => {
    expect([...figureNumbersOf(figure)].sort()).toEqual(["12", "34", "48", "65"].sort());
    expect(figureNumbersOf({ a: "1,200", b: "x" }).has("1200")).toBe(true);
  });
  it("정상 재작성은 정적 검사를 통과한다(정답 문구 불변·한글 없음·감지기·게이트)", () => {
    const r = staticChecks({ ...base, options: good });
    // 9 는 자료에 없는 수치지만 같은 선택지의 다른 수치(12)가 자료 값이라 통과(오답당 하나 이상)
    expect(r.failures).toEqual([]);
  });
  it("정답 문구가 바뀌거나 한글이 섞이거나 자료에 없는 수치만 있으면 실패", () => {
    expect(staticChecks({ ...base, options: [...good.slice(0, 3), "Painter C has 13 surviving paintings"] }).failures.join()).toContain("정답 선택지 문구");
    expect(staticChecks({ ...base, options: good, explanationEn: "정답은 D" }).failures.join()).toContain("한글");
    expect(staticChecks({ ...base, options: ["Painter C has 21 surviving attributed paintings, fewer than either Painter B or Painter A", ...good.slice(1)] }).failures.join()).toContain("오답 A 의 수치가 자료");
  });
  it("원래 누설 선택지(정답만 대상 반복)는 감지기 강한 신호로 실패", () => {
    expect(staticChecks({ ...base, options: original }).failures.join()).toContain("감지기");
  });
  it("프롬프트는 정답 길이 한도와 문구 불변 지시를 담는다", () => {
    const p = rewritePrompt({ skill: base.skill, passage: "x", figureAlt: "table", question, options: original, correctIndex: 3, feedback: ["fix me"] });
    expect(p).toContain("fix me");
    expect(p).toContain(JSON.stringify(original[3]));
    expect(p).toMatch(/LENGTH LIMITS/);
  });
  it("costOf: 모델별 단가", () => {
    expect(costOf("claude-haiku-4-5", 1_000_000, 0)).toBe(1);
    expect(costOf("claude-sonnet-5-5", 0, 1_000_000)).toBe(15);
  });
  it("buildDraftArgs: 정답·난이도·지문·질문·자료 그대로, 선택지·해설만 교체. 정답 문구 변경은 거부", () => {
    const old = { problem_id: "p1", passage: "ps", question, options: original, correct_index: 3, difficulty: "easy", figure, figure_checked: true, statements: null, answers: null };
    const a = buildDraftArgs(old, { options: good, explanation: "k", explanation_en: "e", correctIndex: 3 }, "actor");
    expect(a).toMatchObject({ p_problem_id: "p1", p_passage: "ps", p_question: question, p_correct_index: 3, p_difficulty: "easy", p_options: good, p_explanation_en: "e", p_figure_checked: true });
    expect(() => buildDraftArgs(old, { options: [...good.slice(0, 3), "changed"], explanation: "k", explanation_en: "e", correctIndex: 3 }, "actor")).toThrow();
    expect(() => buildDraftArgs(old, { options: good, explanation: "k", explanation_en: "e", correctIndex: 2 }, "actor")).toThrow();
  });
});
