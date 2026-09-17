import { describe, expect, it } from "vitest";
import {
  generateLinearTwoVarModel,
  renderLinearTwoVarProblem,
  validateLinearTwoVarModel,
} from "./linear-two-variables";

// 순수 계산이므로 정확한 값을 그대로 단언한다 — AI 출력이 아니라서 "그럴듯함"이 아니라
// "정확함"을 검사해야 한다.

describe("generateLinearTwoVarModel — 결정적 계산", () => {
  it("교점 관련 문항은 항상 두 직선 식에 실제로 들어맞는 정수 교점을 낸다(100회 반복)", () => {
    for (let i = 0; i < 100; i++) {
      const model = generateLinearTwoVarModel({ difficulty: "medium", questionKind: "intersection_x" });
      expect(model.systemKind).toBe("one_solution");
      expect(model.intersection).not.toBeNull();
      const { x, y } = model.intersection!;
      expect(Number.isInteger(x)).toBe(true);
      expect(Number.isInteger(y)).toBe(true);
      // 그래프-식 일치: 교점이 실제로 두 직선 위에 있어야 한다.
      expect(model.m1 * x + model.b1).toBe(y);
      expect(model.m2 * x + model.b2).toBe(y);
      expect(model.correctAnswer).toBe(String(x));
    }
  });

  it("intersection_y는 y좌표를, intersection_sum은 x+y를 정답으로 낸다", () => {
    for (let i = 0; i < 50; i++) {
      const my = generateLinearTwoVarModel({ difficulty: "medium", questionKind: "intersection_y" });
      expect(my.correctAnswer).toBe(String(my.intersection!.y));
      const sum = generateLinearTwoVarModel({ difficulty: "medium", questionKind: "intersection_sum" });
      expect(sum.correctAnswer).toBe(String(sum.intersection!.x + sum.intersection!.y));
    }
  });

  it("slope/intercept 문항은 첫 번째 식(m1/b1)의 값을 그대로 정답으로 낸다", () => {
    for (let i = 0; i < 50; i++) {
      const slope = generateLinearTwoVarModel({ difficulty: "medium", questionKind: "slope" });
      expect(slope.correctAnswer).toBe(String(slope.m1));
      const intercept = generateLinearTwoVarModel({ difficulty: "medium", questionKind: "intercept" });
      expect(intercept.correctAnswer).toBe(String(intercept.b1));
    }
  });

  it("num_solutions 문항은 세 범주(하나/없음/무한) 중 하나를 실제 계수 관계와 일치하게 낸다(50회 반복)", () => {
    for (let i = 0; i < 50; i++) {
      const model = generateLinearTwoVarModel({ difficulty: "medium", questionKind: "num_solutions" });
      if (model.correctAnswer === "정확히 하나") {
        expect(model.systemKind).toBe("one_solution");
        expect(model.m1).not.toBe(model.m2);
      } else if (model.correctAnswer === "없음") {
        expect(model.systemKind).toBe("no_solution");
        expect(model.m1).toBe(model.m2);
        expect(model.b1).not.toBe(model.b2);
      } else {
        expect(model.correctAnswer).toBe("무한히 많음");
        expect(model.systemKind).toBe("infinite_solutions");
        expect(model.m1).toBe(model.m2);
        expect(model.b1).toBe(model.b2);
      }
    }
  });

  it("정답과 오답 3개는 항상 서로 다른 값이다(중복 없음, 100회 반복 — 모든 문항 유형)", () => {
    const kinds = ["intersection_x", "intersection_y", "intersection_sum", "slope", "intercept", "num_solutions"] as const;
    for (const k of kinds) {
      for (let i = 0; i < 20; i++) {
        const model = generateLinearTwoVarModel({ difficulty: "hard", questionKind: k });
        const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
        expect(new Set(values).size).toBe(4);
        expect(model.distractors).toHaveLength(3);
      }
    }
  });

  it("validateLinearTwoVarModel은 위 모든 생성 결과를 통과시킨다(자체 모순 없음, 200회 반복)", () => {
    const kinds = ["intersection_x", "intersection_y", "intersection_sum", "slope", "intercept", "num_solutions"] as const;
    for (const k of kinds) {
      for (let i = 0; i < 30; i++) {
        const model = generateLinearTwoVarModel({ difficulty: "hard", questionKind: k });
        expect(validateLinearTwoVarModel(model)).toEqual({ ok: true });
      }
    }
  });
});

describe("renderLinearTwoVarProblem — 렌더링은 모델 값만 그대로 옮긴다", () => {
  it("선택지 중 정답 인덱스가 실제 정답 값을 가리킨다", () => {
    for (let i = 0; i < 50; i++) {
      const model = generateLinearTwoVarModel({ difficulty: "medium" });
      const rendered = renderLinearTwoVarProblem(model);
      expect(rendered.options).toHaveLength(4);
      expect(rendered.options[rendered.correctIndex]).toBe(model.correctAnswer);
      // 선택지 4개는 모델의 정답+오답 집합과 정확히 일치한다(순서만 다를 수 있음).
      expect(new Set(rendered.options)).toEqual(new Set([model.correctAnswer, ...model.distractors.map((d) => d.value)]));
    }
  });

  it("해설 문자열은 모델의 실제 계수·좌표 값을 그대로 포함한다(예: intersection_x)", () => {
    const model = generateLinearTwoVarModel({ difficulty: "medium", questionKind: "intersection_x" });
    const rendered = renderLinearTwoVarProblem(model);
    expect(rendered.explanation).toContain(String(model.intersection!.x));
  });

  it("num_solutions 문항은 그래프를 만들지 않고, 그 외 문항은 두 직선을 그린 그래프를 만든다", () => {
    const noSol = generateLinearTwoVarModel({ difficulty: "medium", questionKind: "num_solutions" });
    expect(renderLinearTwoVarProblem(noSol).figure).toBeNull();
    const withSol = generateLinearTwoVarModel({ difficulty: "medium", questionKind: "intersection_x" });
    const rendered = renderLinearTwoVarProblem(withSol);
    expect(rendered.figure?.type).toBe("plane");
  });
});
