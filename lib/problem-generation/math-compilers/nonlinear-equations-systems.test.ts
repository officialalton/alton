import { describe, expect, it } from "vitest";
import {
  generateNonlinearEqModel,
  renderNonlinearEqProblem,
  validateNonlinearEqModel,
} from "./nonlinear-equations-systems";

describe("generateNonlinearEqModel — 결정적 계산", () => {
  it("root/sum/product 문항은 실제로 x^2+bx+c=0을 만족하는 정수 근에서 계산된다(100회 반복)", () => {
    const kinds = ["root", "sum_of_roots", "product_of_roots"] as const;
    for (let i = 0; i < 100; i++) {
      const model = generateNonlinearEqModel({ difficulty: "medium", questionKind: kinds[i % 3] });
      expect(validateNonlinearEqModel(model)).toEqual({ ok: true });
      const { r1, r2 } = model;
      expect(r1! * r1! + model.b * r1! + model.c).toBe(0);
      expect(r2! * r2! + model.b * r2! + model.c).toBe(0);
      if (model.questionKind === "root") expect(model.correctAnswer).toBe(String(Math.max(r1!, r2!)));
      if (model.questionKind === "sum_of_roots") expect(model.correctAnswer).toBe(String(r1! + r2!));
      if (model.questionKind === "product_of_roots") expect(model.correctAnswer).toBe(String(r1! * r2!));
    }
  });

  it("num_real_solutions은 판별식 부호와 정답 범주가 항상 일치한다(100회 반복)", () => {
    for (let i = 0; i < 100; i++) {
      const model = generateNonlinearEqModel({ difficulty: "medium", questionKind: "num_real_solutions" });
      expect(validateNonlinearEqModel(model)).toEqual({ ok: true });
      const d = model.discriminant!;
      if (d > 0) expect(model.correctAnswer).toBe("Two distinct real solutions");
      if (d === 0) expect(model.correctAnswer).toBe("One real solution");
      if (d < 0) expect(model.correctAnswer).toBe("No real solutions");
    }
  });

  it("오답은 항상 정확히 3개이고 정답과 겹치지 않는다(전 유형·난이도, 150회 반복)", () => {
    const kinds = ["root", "sum_of_roots", "product_of_roots", "num_real_solutions"] as const;
    const difficulties = ["easy", "medium", "hard"] as const;
    for (let i = 0; i < 150; i++) {
      const model = generateNonlinearEqModel({ difficulty: difficulties[i % 3], questionKind: kinds[i % 4] });
      expect(model.distractors).toHaveLength(3);
      const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
      expect(new Set(values).size).toBe(4);
    }
  });
});

describe("renderNonlinearEqProblem — 렌더링·해설", () => {
  // 2026-09-17(실측, 아침 UAT) — "^2"가 $…$ 밖에 있으면 캐럿 글자 그대로 노출된다.
  it("지문의 방정식은 항상 $…$로 감싸져 있다(100회 반복)", () => {
    for (let i = 0; i < 100; i++) {
      const model = generateNonlinearEqModel({ difficulty: "medium" });
      const rendered = renderNonlinearEqProblem(model);
      const eq = rendered.passage.split("\n\n")[1];
      expect(eq.startsWith("$")).toBe(true);
      expect(eq.endsWith("$")).toBe(true);
    }
  });

  it("네 유형 모두 선택지 4개·정답 인덱스가 유효하고 해설에 정답이 포함된다", () => {
    const kinds = ["root", "sum_of_roots", "product_of_roots", "num_real_solutions"] as const;
    for (const kind of kinds) {
      for (let i = 0; i < 10; i++) {
        const model = generateNonlinearEqModel({ difficulty: "medium", questionKind: kind });
        const rendered = renderNonlinearEqProblem(model);
        expect(rendered.figure).toBeNull();
        expect(rendered.options).toHaveLength(4);
        expect(rendered.options[rendered.correctIndex]).toBe(model.correctAnswer);
        expect(rendered.explanation).toContain(model.correctAnswer);
      }
    }
  });
});
