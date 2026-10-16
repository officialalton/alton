import { describe, expect, it } from "vitest";
import { checkFigure } from "@/lib/problem-figures/check";
import { generateLinearTwoVarModel, renderLinearTwoVarProblem } from "./linear-two-variables";

// 손으로 만든 PlaneSpec이 실제 표준 렌더링 검증기(check.ts)를 통과하는지 확인한다 —
// 타입이 맞아도 라벨 겹침·클리핑 같은 실제 렌더링 문제는 이 검사에서만 드러난다.
describe("linear-two-variables 그래프 — 표준 렌더링 검증기 통과 확인", () => {
  it("교점 문항의 그래프는 checkFigure를 통과한다(300회 반복 — 다양한 계수 조합, 전 난이도)", () => {
    const failures: string[] = [];
    const difficulties = ["easy", "medium", "hard"] as const;
    for (let i = 0; i < 300; i++) {
      const model = generateLinearTwoVarModel({ difficulty: difficulties[i % 3], questionKind: "intersection_x" });
      const rendered = renderLinearTwoVarProblem(model);
      const check = checkFigure(rendered.figure, rendered.passage + " " + rendered.question, rendered.options, rendered.correctIndex);
      if (!check.ok) failures.push(JSON.stringify({ model: { m1: model.m1, b1: model.b1, m2: model.m2, b2: model.b2 }, issues: check.issues }));
    }
    expect(failures).toEqual([]);
  });
});
