import { describe, expect, it } from "vitest";
import { planSatErrorReportFix, type SatRow } from "./sat-error-report-1018";
import { hasGraphAndExpressionForSameCurves } from "../problem-generation/graph-expression-redundancy";

const base = (o: Partial<SatRow>): SatRow => ({ passage: null, question: null, options: ["1", "2", "3", "4"], correct_index: 1, explanation: null, explanation_en: null, figure: null, ...o });
const apply = (row: SatRow, r: NonNullable<ReturnType<typeof planSatErrorReportFix>>): SatRow => {
  const next = { ...row } as Record<string, unknown>;
  for (const c of r.changes) next[c.field] = c.new;
  return next as SatRow;
};
const plane = (kinds: string[]) => ({ type: "plane", objects: kinds.map((kind) => ({ kind })) });

describe("planSatErrorReportFix — 컴파일러 옛 문안을 새 문안으로 되돌려 쓰는 패치", () => {
  it("13번 sin(angle B) -> sin B (문항·해설)", () => {
    const row = base({ question: "What is sin(angle B) in the right triangle shown?", explanation: "각 B에서 ... sin(B) = 대변/빗변 = 3/5이다.", explanation_en: "At angle B ... sin(B) = opposite/hypotenuse = 3/5." });
    const r = planSatErrorReportFix(row)!;
    expect(r.rule).toBe("R13-trig-notation");
    const after = apply(row, r);
    expect(after.question).toBe("What is sin B in the right triangle shown?");
    expect(after.explanation).toContain("sin B =");
    expect(after.explanation_en).toContain("sin B =");
    expect(planSatErrorReportFix(after)).toBeNull();
  });

  it("14번 same characteristic -> 성질 명시(표 자료 행 이름 포함)", () => {
    const row = base({
      passage: "A random sample of 40 employees was surveyed. Of those surveyed, 12 were employees of a company who work remotely at least once a week. The population consists of 480 total. The sample results are also shown in the table below.",
      question: "Based on the sample, about how many people in the entire population would be expected to have this same characteristic?",
      figure: { type: "data", kind: "table", columns: ["Category", "Count"], rows: [["Sample size", 40], ["Have this characteristic", 12], ["Population", 480]] },
    });
    const r = planSatErrorReportFix(row)!;
    expect(r.rule).toBe("R14-inference-trait");
    const after = apply(row, r);
    expect(after.question).toBe("Based on the sample, about how many of the 480 employees would be expected to work remotely at least once a week?");
    expect(after.passage).toContain("A random sample of 40 employees of a company was surveyed. Of those surveyed, 12 work remotely at least once a week. The population consists of 480 employees in total.");
    expect((after.figure as { rows: unknown[][] }).rows[1][0]).toBe("Sampled employees who work remotely at least once a week");
    expect(planSatErrorReportFix(after)).toBeNull();
  });

  it("7번 highest power of x is 2 삭제", () => {
    const row = base({ passage: "Some values of a polynomial function $f$, whose highest power of $x$ is 2, are given in the table. Suppose $f(x)$ is written in the form $ax^2 + bx + c$." });
    const r = planSatErrorReportFix(row)!;
    expect(r.rule).toBe("R7-polynomial-degree");
    expect(apply(row, r).passage).toBe("Some values of a polynomial function $f$ are given in the table. Suppose $f(x)$ is written in the form $ax^2 + bx + c$.");
  });

  it("2번 막대그래프: 눈금 밖 값이 있으면 valueLabels 를 켠다 / 모두 눈금 위면 건드리지 않는다", () => {
    const fig = { type: "data", kind: "bar", categories: ["2010", "2020"], series: [{ values: [20, 37] }], yMin: 0, yMax: 50, yStep: 10 };
    const r = planSatErrorReportFix(base({ passage: "The bar graph shows the population.", question: "q", figure: fig }))!;
    expect(r.rule).toBe("R2-chart-value-labels");
    expect((apply(base({ figure: fig }), r).figure as { valueLabels: boolean }).valueLabels).toBe(true);
    expect(planSatErrorReportFix(base({ passage: "p", figure: { ...fig, series: [{ values: [20, 30] }] } }))).toBeNull();
  });

  it("linear_functions plane: 식 삭제 + 그래프 읽기 해설, 같은 문항이 더는 중복이 아니다", () => {
    const ev = base({ passage: "The function f is defined by f(x) = 2x + 3. The graph of y = f(x) is shown in the xy-plane below.", question: "What is f(4)?", options: ["10", "11", "12", "5"], correct_index: 1, figure: plane(["line"]) });
    const r = planSatErrorReportFix(ev)!;
    expect(r.rule).toBe("G1-linear-function-graph-only");
    const after = apply(ev, r);
    expect(after.passage).toBe("The graph of y = f(x) is shown in the xy-plane below.");
    expect(after.explanation).toContain("f(4) = 11");
    expect(hasGraphAndExpressionForSameCurves(after.figure as never, after.passage ?? "")).toBe(false);
    const fx = base({ passage: "The function f is defined by f(x) = -x + 5. The graph of y = f(x) is shown in the xy-plane below.", question: "For what value of x does f(x) = 2?", options: ["3", "7", "-3", "2"], correct_index: 0, figure: plane(["line"]) });
    expect(apply(fx, planSatErrorReportFix(fx)!).explanation_en).toBe("On the graph, the point with y = 2 has x = 3.");
    const sl = base({ passage: "In the xy-plane, line f passes through the points (1, 2) and (3, 8). The graph of line f is shown below.", question: "What is the slope of line f?", figure: plane(["line"]) });
    expect(apply(sl, planSatErrorReportFix(sl)!).passage).toBe("The graph of line f is shown in the xy-plane below.");
  });

  it("nonlinear plane: 꼭짓점은 그래프만, evaluate 는 식만(그림 삭제)", () => {
    const passage = "The function f is defined by $f(x) = 2(x - 3)^2 + 1$. The graph of y = f(x) is shown in the xy-plane below.";
    const vx = base({ passage, question: "What is the x-coordinate of the vertex of the graph of f in the xy-plane?", figure: plane(["function"]) });
    const r1 = planSatErrorReportFix(vx)!;
    expect(r1.rule).toBe("G3-quadratic-vertex-graph-only");
    expect(apply(vx, r1).passage).toBe("The graph of y = f(x), a parabola, is shown in the xy-plane below.");
    const ev = base({ passage, question: "What is f(5)?", figure: plane(["function"]) });
    const r2 = planSatErrorReportFix(ev)!;
    expect(r2.rule).toBe("G3-quadratic-evaluate-expression-only");
    const after = apply(ev, r2);
    expect(after.figure).toBeNull();
    expect(after.passage).toBe("The function f is defined by $f(x) = 2(x - 3)^2 + 1$.");
  });

  it("교점 plane·연립 text·부등식·원: 한 표현만 남긴다", () => {
    const sys = base({ passage: "Consider the system of equations shown. The graphs of the equations are shown in the xy-plane below.\n\n$y = x^2 - 4x + 1$\n$y = 2x - 8$", question: "How many points of intersection do the graphs of the equations shown have?", explanation: "해설", explanation_en: "expl", figure: plane(["function", "line"]) });
    const r = planSatErrorReportFix(sys)!;
    expect(r.rule).toBe("G4-intersection-graph-only");
    const a = apply(sys, r);
    expect(a.passage).not.toMatch(/\$y =/);
    expect(a.question).toBe("How many points of intersection do the two graphs shown have?");
    expect(a.explanation).toContain("y = x² - 4x + 1");
    const text = base({ passage: "Consider the system of equations shown.\n\ny = 3x - 4\ny = 5x - 4", question: "What is the slope of the line represented by the second equation shown?", figure: plane(["line", "line"]) });
    expect(planSatErrorReportFix(text)!.rule).toBe("G5-system-expression-only");
    expect(apply(text, planSatErrorReportFix(text)!).figure).toBeNull();
    const ineq = base({ passage: "Consider the graph of the inequality shown.\n\n$y < 2x + 1$", question: "Which of the following points is a solution to the inequality shown?", figure: plane(["inequality"]) });
    const ai = apply(ineq, planSatErrorReportFix(ineq)!);
    expect(ai.passage).toMatch(/^Consider the inequality shown\./);
    expect(ai.figure).toBeNull();
    const circ = base({ passage: "A circle in the xy-plane is defined by the equation $(x - 2)^2 + (y + 1)^2 = 9$. The circle is shown in the xy-plane below.", question: "What is the radius of this circle?", figure: plane(["circle"]) });
    expect(apply(circ, planSatErrorReportFix(circ)!).passage).toBe("A circle is shown in the xy-plane below.");
    const shift = base({ passage: "A circle in the xy-plane is defined by the equation $(x - 2)^2 + (y + 1)^2 = 9$. The circle is shifted 3 units to the right and 2 units down. The circle is shown in the xy-plane below.", question: "Which equation represents the new circle after this shift?", figure: plane(["circle"]) });
    expect(apply(shift, planSatErrorReportFix(shift)!).passage).toBe("The circle shown in the xy-plane below is shifted 3 units to the right and 2 units down.");
  });

  it("옛 틀이 아닌 그래프+식 중복은 manual, 결함 없는 문항은 null", () => {
    const odd = base({ passage: "The graph of the function $f$, defined by $f(x) = (x + 1)(x - 3)$, is shown in the xy-plane.", question: "What is the minimum value of $f(x)$?", figure: plane(["function"]) });
    expect(planSatErrorReportFix(odd)!.status).toBe("manual");
    expect(planSatErrorReportFix(base({ passage: "The graph of y = f(x) is shown in the xy-plane below.", question: "What is f(2)?", figure: plane(["line"]) }))).toBeNull();
  });
});
