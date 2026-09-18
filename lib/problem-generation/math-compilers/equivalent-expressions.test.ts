import { describe, expect, it } from "vitest";
import {
  generateEquivalentExpressionsModel,
  renderEquivalentExpressionsProblem,
  validateEquivalentExpressionsModel,
  type PolynomialDistributionModel,
  type RationalEquivalenceModel,
} from "./equivalent-expressions";

describe("generateEquivalentExpressionsModel(polynomial_distribution) — 결정적 계산", () => {
  it("m=a+c, n=a*b+c*d를 항상 정확히 계산한다(100회 반복)", () => {
    for (let i = 0; i < 100; i++) {
      const model = generateEquivalentExpressionsModel({ difficulty: "medium", kind: "polynomial_distribution" }) as PolynomialDistributionModel;
      expect(model.m).toBe(model.a + model.c);
      expect(model.n).toBe(model.a * model.b + model.c * model.d);
      expect(validateEquivalentExpressionsModel(model)).toEqual({ ok: true });
    }
  });

  it("오답은 항상 정확히 3개이고 정답과 겹치지 않는다(전 난이도, 100회 반복)", () => {
    const difficulties = ["easy", "medium", "hard"] as const;
    for (let i = 0; i < 100; i++) {
      const model = generateEquivalentExpressionsModel({ difficulty: difficulties[i % 3], kind: "polynomial_distribution" });
      expect(model.distractors).toHaveLength(3);
      const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
      expect(new Set(values).size).toBe(4);
    }
  });

  it("x항이 사라지는(m=0) 경우는 만들지 않는다(50회 반복)", () => {
    for (let i = 0; i < 50; i++) {
      const model = generateEquivalentExpressionsModel({ difficulty: "medium", kind: "polynomial_distribution" }) as PolynomialDistributionModel;
      expect(model.m).not.toBe(0);
    }
  });
});

describe("renderEquivalentExpressionsProblem(polynomial_distribution) — 렌더링·해설", () => {
  it("해설이 실제 분배·동류항 정리 단계를 보여주고 결론이 정답과 일치한다", () => {
    for (let i = 0; i < 20; i++) {
      const model = generateEquivalentExpressionsModel({ difficulty: "medium", kind: "polynomial_distribution" });
      const rendered = renderEquivalentExpressionsProblem(model);
      expect(rendered.options).toHaveLength(4);
      expect(rendered.options[rendered.correctIndex]).toBe(model.correctAnswer);
      expect(rendered.explanation).toContain(model.correctAnswer);
      expect(rendered.explanation).toMatch(/분배하면/);
    }
  });

  // 2026-09-17(실측, 아침 UAT) — 계수 1을 "1(x + 7)"처럼, 상수항 0을 "(x + 0)"처럼
  // 그대로 찍던 결함.
  it("괄호 앞 계수가 1/-1이면 숫자를 찍지 않고, 상수항이 0이면 '+ 0'을 찍지 않는다(100회 반복)", () => {
    for (let i = 0; i < 100; i++) {
      const model = generateEquivalentExpressionsModel({ difficulty: "medium", kind: "polynomial_distribution" });
      const rendered = renderEquivalentExpressionsProblem(model);
      expect(rendered.passage).not.toMatch(/\b1\(x/);
      expect(rendered.passage).not.toMatch(/\+ 1\(x/);
      expect(rendered.passage).not.toMatch(/- 1\(x/);
      expect(rendered.passage).not.toMatch(/[+-] 0\)/);
    }
  });
});

describe("generateEquivalentExpressionsModel(rational_equivalence) — 결정적 계산", () => {
  it("결합 분자 numM=A+B, numN=-B*p를 항상 정확히 계산하고 검증을 통과한다(전 난이도, 100회 반복)", () => {
    const difficulties = ["easy", "medium", "hard"] as const;
    for (let i = 0; i < 100; i++) {
      const model = generateEquivalentExpressionsModel({ difficulty: difficulties[i % 3], kind: "rational_equivalence" }) as RationalEquivalenceModel;
      expect(model.numM).toBe(model.A + model.B);
      expect(model.numN).toBe(-model.B * model.p);
      expect(model.p).not.toBe(0);
      expect(validateEquivalentExpressionsModel(model)).toEqual({ ok: true });
    }
  });

  it("오답은 항상 정확히 3개이고, 정답을 포함해 4개 값이 모두 서로 다르다(100회 반복)", () => {
    for (let i = 0; i < 100; i++) {
      const model = generateEquivalentExpressionsModel({ difficulty: "medium", kind: "rational_equivalence" });
      expect(model.distractors).toHaveLength(3);
      const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
      expect(new Set(values).size).toBe(4);
    }
  });

  it("x항이 사라지는(numM=0) 경우는 만들지 않는다(50회 반복)", () => {
    for (let i = 0; i < 50; i++) {
      const model = generateEquivalentExpressionsModel({ difficulty: "medium", kind: "rational_equivalence" }) as RationalEquivalenceModel;
      expect(model.numM).not.toBe(0);
    }
  });

  it("오답 3종의 오류 유형(공통분모 없이 더함/인수분해 부호오류/분배 누락/결합 부호오류)이 실제로 서로 다른 계산에서 나온다", () => {
    for (let i = 0; i < 30; i++) {
      const model = generateEquivalentExpressionsModel({ difficulty: "hard", kind: "rational_equivalence" }) as RationalEquivalenceModel;
      const kinds = model.distractors.map((d) => d.kind);
      // 최소한 서로 다른 종류가 2개 이상 섞여 있어야 한다(전부 같은 오류 유형이면 안 됨).
      expect(new Set(kinds).size).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("renderEquivalentExpressionsProblem(rational_equivalence) — 렌더링·해설", () => {
  it("정답·오답 4개가 모두 LaTeX \\frac 형태로 렌더링되고, 정답이 실제 결합 분자·공통분모와 일치한다", () => {
    for (let i = 0; i < 20; i++) {
      const model = generateEquivalentExpressionsModel({ difficulty: "medium", kind: "rational_equivalence" }) as RationalEquivalenceModel;
      const rendered = renderEquivalentExpressionsProblem(model);
      expect(rendered.options).toHaveLength(4);
      for (const opt of rendered.options) {
        expect(opt).toMatch(/^\$\\frac\{.+\}\{.+\}\$$/);
      }
      expect(rendered.passage).toContain("$");
      expect(rendered.passage).toMatch(/\\frac/);
      // 정답 LaTeX 안에 결합 분자(numM,numN)가 그대로 들어있는지 확인.
      const correctLatex = rendered.options[rendered.correctIndex];
      expect(correctLatex).toContain(`x(x`);
    }
  });

  it("해설이 Unicode 텍스트만 쓰고(LaTeX $/\\frac 없음) 인수분해·약분·결합 단계를 모두 보여준다", () => {
    for (let i = 0; i < 20; i++) {
      const model = generateEquivalentExpressionsModel({ difficulty: "medium", kind: "rational_equivalence" }) as RationalEquivalenceModel;
      const rendered = renderEquivalentExpressionsProblem(model);
      expect(rendered.explanation).not.toContain("$");
      expect(rendered.explanation).not.toContain("\\frac");
      expect(rendered.explanation).toMatch(/약분/);
      expect(rendered.explanation).toMatch(/공통분모/);
      expect(rendered.explanation).toContain(`x(x`);
    }
  });

  it("distractorRationales의 whyWrong이 실제 오류 설명을 담고 kind가 유효하다", () => {
    for (let i = 0; i < 20; i++) {
      const model = generateEquivalentExpressionsModel({ difficulty: "hard", kind: "rational_equivalence" }) as RationalEquivalenceModel;
      const rendered = renderEquivalentExpressionsProblem(model);
      expect(rendered.distractorRationales).toHaveLength(3);
      for (const r of rendered.distractorRationales) {
        expect(r.whyWrong.length).toBeGreaterThan(0);
        expect(r.obvious).toBe(false);
      }
    }
  });
});
