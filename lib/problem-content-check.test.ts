import { describe, expect, it } from "vitest";
import { checkContent, parseRomanOption } from "./problem-content-check";

const base = { format: "mc", passage: "If $2x + 3 = 11$, what is $x$?", options: ["2", "4", "5", "7"], correctIndex: 1, explanation: "$2x = 8$, so $x = 4$." };

describe("수식·선택지 블록 검증", () => {
  it("정상 객관식·연립방정식(cases)·분수·근호는 통과한다", () => {
    expect(checkContent(base)).toEqual([]);
    expect(checkContent({ ...base, passage: "$$\\begin{cases} 2x + y = 7 \\\\ x - y = 2 \\end{cases}$$ What is $x$? Also $\\frac{3}{4}$, $\\sqrt{2}$, $x^2$, $1 < x \\le 5$." })).toEqual([]);
  });
  it("수식 파싱 실패·수식 밖 LaTeX 제어문·닫히지 않은 $ 는 거부", () => {
    expect(checkContent({ ...base, passage: "Solve $\\frac{1}{$." }).some((i) => i.code === "math_parse" || i.code === "math_unclosed")).toBe(true);
    expect(checkContent({ ...base, explanation: "Use \\frac{1}{2} here" }).some((i) => i.code === "latex_leak")).toBe(true);
  });
  it("선택지 수·중복·정답 범위·'x =' 표기를 거부", () => {
    const m = checkContent({ ...base, options: ["2", "2", "x = 5"], correctIndex: 5 }).map((i) => i.code);
    expect(m).toEqual(expect.arrayContaining(["option_duplicate", "correct_index", "option_style"]));
    expect(checkContent({ ...base, options: ["1"] }).some((i) => i.code === "option_count")).toBe(true);
  });
  it("식+조건 두 개를 만족하는 선택지가 실제로는 둘인데 하나만 정답으로 표시되면 거부(2026-09-15 실제 사례)", () => {
    const passage =
      "A rental company charges customers based on the number of hours, h, a kayak is rented. The graph shows line p, which represents the equation C = 6h + 10, where C is the total cost in dollars. The company also offers a promotional rule: a customer qualifies for a discount only if the total cost without the discount would be greater than 40 dollars and the number of hours rented is at most 8. Based on the graph and the promotional rule, which of the following numbers of hours h satisfies both the condition for qualifying for the discount and the constraint h <= 8?";
    // 실제 사례: 6과 5.5 둘 다 만족하는데 6(인덱스 1)만 정답으로 표시됨.
    const issues = checkContent({ ...base, passage, options: ["4", "6", "9", "5.5"], correctIndex: 1 });
    expect(issues.some((i) => i.code === "condition_ambiguous")).toBe(true);
  });
  it("조건을 만족하는 선택지가 정확히 하나면 통과한다", () => {
    const passage =
      "A rental company charges customers based on the number of hours, h, a kayak is rented. The equation C = 6h + 10 gives the total cost in dollars. A customer qualifies for a discount only if the total cost would be greater than 40 dollars and the number of hours rented is at most 8. Which number of hours h satisfies both conditions?";
    // 오직 6만 만족: 4는 34<40 실패, 9는 h<=8 실패, 5는 40에 걸쳐 40 초과가 아니라 실패(6*5+10=40).
    const issues = checkContent({ ...base, passage, options: ["4", "5", "6", "9"], correctIndex: 2 });
    expect(issues.some((i) => i.code === "condition_ambiguous" || i.code === "condition_no_match")).toBe(false);
  });
  it("선택지가 실제 그래프 없이 'Graph A' 같은 이름표뿐이면 거부(2026-09-15 — 그래프 선택형 미구현)", () => {
    expect(checkContent({ ...base, options: ["Graph A", "Graph B", "Graph C", "Graph D"] }).some((i) => i.code === "figure_choice_placeholder")).toBe(true);
    expect(checkContent({ ...base, options: ["2", "4", "5", "7"] }).some((i) => i.code === "figure_choice_placeholder")).toBe(false);
  });

  it("로마숫자 진술: 조합 선택지와 진술 수가 맞아야 하고, 진술 없이 조합 선택지만 있으면 거부", () => {
    const ok = checkContent({ ...base, passage: "Which of the following must be true?", statements: ["$a > 0$", "$b < 0$", "$ab < 0$"], options: ["I only", "I and II only", "I, II, and III", "Neither"] });
    expect(ok).toEqual([]);
    expect(parseRomanOption("I and II only")).toEqual([1, 2]);
    expect(parseRomanOption("Neither")).toBe("none");
    expect(parseRomanOption("4")).toBeNull();
    const bad = checkContent({ ...base, statements: ["$a > 0$"], options: ["I only", "II only", "3", "None"] }).map((i) => i.message).join("\n");
    expect(bad).toContain("조합이어야");
    expect(checkContent({ ...base, statements: ["$a > 0$", "$b < 0$"], options: ["I only", "Neither", "I only", "None"] }).some((i) => i.message.includes("진술 II"))).toBe(true);
    expect(checkContent({ ...base, options: ["I only", "II only", "I and II", "Neither"] }).some((i) => i.code === "statements")).toBe(true);
  });
  it("SPR 정답 형식·자릿수", () => {
    expect(checkContent({ format: "spr", passage: "x?", options: null, correctIndex: null, explanation: "", answers: ["7/2", "3.5"] })).toEqual([]);
    expect(checkContent({ format: "spr", passage: "x?", options: null, correctIndex: null, explanation: "", answers: ["abc", "1234567"] }).length).toBeGreaterThanOrEqual(2);
  });
});
