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

describe("linear_quadratic_intersection — 일차식·이차식 연립 교점(2026-09-17, Step 4 항목 3)", () => {
  it("교점 x좌표는 실제로 두 식(y=ax²+bx+c, y=mx+k)을 동시에 만족하고, 판별식 부호와 교점 개수가 일치한다(150회 반복)", () => {
    for (let i = 0; i < 150; i++) {
      const model = generateNonlinearEqModel({ difficulty: "medium", questionKind: "linear_quadratic_intersection" });
      expect(model.questionKind).toBe("linear_quadratic_intersection");
      expect(validateNonlinearEqModel(model)).toEqual({ ok: true });
      const { quadA: a, quadB: qb, quadC: qc, lineM: m, lineK: k } = model;
      const B = qb! - m!, C = qc! - k!;
      const discriminant = B * B - 4 * a! * C;
      const expectedCount = discriminant > 0 ? 2 : discriminant === 0 ? 1 : 0;
      expect(model.intersectionCount).toBe(expectedCount);
      for (const x of model.intersectionXs ?? []) {
        expect(a! * x * x + qb! * x + qc!).toBeCloseTo(m! * x + k!, 9);
      }
    }
  });

  it("count 서브종류는 교점 개수 범주 문자열이 판별식과 일치한다(60회 반복)", () => {
    for (let i = 0; i < 60; i++) {
      const model = generateNonlinearEqModel({ difficulty: "hard", questionKind: "linear_quadratic_intersection" });
      if (model.intersectionSubKind !== "count") continue;
      const expected = model.intersectionCount === 2 ? "Two intersection points" : model.intersectionCount === 1 ? "One intersection point" : "No intersection points";
      expect(model.correctAnswer).toBe(expected);
    }
  });

  it("x_coord 서브종류는 항상 중근(교점 1개)이고, sum_x는 항상 서로 다른 두 근(교점 2개)이다(60회 반복)", () => {
    for (let i = 0; i < 60; i++) {
      const model = generateNonlinearEqModel({ difficulty: "medium", questionKind: "linear_quadratic_intersection" });
      if (model.intersectionSubKind === "x_coord") {
        expect(model.intersectionCount).toBe(1);
        expect(model.intersectionXs).toHaveLength(1);
        expect(model.correctAnswer).toBe(String(model.intersectionXs![0]));
      } else if (model.intersectionSubKind === "sum_x") {
        expect(model.intersectionCount).toBe(2);
        expect(model.intersectionXs).toHaveLength(2);
        const [r1, r2] = model.intersectionXs!;
        expect(model.correctAnswer).toBe(String(r1 + r2));
      }
    }
  });

  it("오답은 항상 정확히 3개이고 정답과 겹치지 않는다(100회 반복)", () => {
    for (let i = 0; i < 100; i++) {
      const model = generateNonlinearEqModel({ difficulty: "medium", questionKind: "linear_quadratic_intersection" });
      expect(model.distractors).toHaveLength(3);
      const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
      expect(new Set(values).size).toBe(4);
    }
  });

  it("렌더링은 지문에 두 식이 모두 $…$로 감싸져 있고, 선택지 4개·정답 인덱스가 유효하다(30회 반복)", () => {
    for (let i = 0; i < 30; i++) {
      const model = generateNonlinearEqModel({ difficulty: "medium", questionKind: "linear_quadratic_intersection" });
      const rendered = renderNonlinearEqProblem(model);
      const eqBlock = rendered.passage.split("\n\n")[1];
      expect(eqBlock.startsWith("$")).toBe(true);
      expect(eqBlock.endsWith("$")).toBe(true);
      expect(rendered.figure).toBeNull();
      expect(rendered.options).toHaveLength(4);
      expect(rendered.options[rendered.correctIndex]).toBe(model.correctAnswer);
      expect(rendered.explanation).toContain(model.correctAnswer);
    }
  });
});

// 2026-09-17(제품 오너 지시, Step 4 고빈도 공백 7번) — 무리수 근을 포함한 이차방정식.
describe("generateNonlinearEqModel(irrational) — 무리수 근, 항상 유리수 답만 요구", () => {
  const IRRATIONAL_KINDS = ["irrational_sum_of_roots", "irrational_product_of_roots", "irrational_root_radical_form"] as const;

  it("판별식이 항상 양수이고 완전제곱수가 아니다(150회 반복, 전 유형·난이도)", () => {
    const difficulties = ["easy", "medium", "hard"] as const;
    for (let i = 0; i < 150; i++) {
      const model = generateNonlinearEqModel({ difficulty: difficulties[i % 3], questionKind: IRRATIONAL_KINDS[i % 3] });
      expect(validateNonlinearEqModel(model)).toEqual({ ok: true });
      const d = model.irrationalDiscriminant!;
      expect(d).toBeGreaterThan(0);
      expect(Number.isInteger(Math.sqrt(d))).toBe(false);
    }
  });

  it("sum/product 정답은 -b/a, c/a와 정확히 일치한다(100회 반복)", () => {
    for (let i = 0; i < 100; i++) {
      const kind = i % 2 === 0 ? "irrational_sum_of_roots" : "irrational_product_of_roots";
      const model = generateNonlinearEqModel({ difficulty: "hard", questionKind: kind });
      const a = model.a ?? 1;
      if (kind === "irrational_sum_of_roots") expect(model.correctAnswer).toBe(String(-model.b / a));
      else expect(model.correctAnswer).toBe(String(model.c / a));
    }
  });

  it("radical_form 정답은 항상 a=1(monic)이고 'p + q√n' 형태이며, √n 부분이 이미 단순화되어 있다(100회 반복)", () => {
    for (let i = 0; i < 100; i++) {
      const model = generateNonlinearEqModel({ difficulty: "medium", questionKind: "irrational_root_radical_form" });
      expect(model.a ?? 1).toBe(1);
      expect(model.correctAnswer).toMatch(/^-?\d+ \+ \d*√\d+$/);
      const rf = model.radicalForm!;
      // n이 제곱인수가 없는지 확인(단순화된 형태).
      for (let k = 2; k * k <= rf.n; k++) expect(rf.n % (k * k)).not.toBe(0);
    }
  });

  it("오답은 항상 정확히 3개이고 정답과 겹치지 않는다(150회 반복)", () => {
    const difficulties = ["easy", "medium", "hard"] as const;
    for (let i = 0; i < 150; i++) {
      const model = generateNonlinearEqModel({ difficulty: difficulties[i % 3], questionKind: IRRATIONAL_KINDS[i % 3] });
      expect(model.distractors).toHaveLength(3);
      const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
      expect(new Set(values).size).toBe(4);
    }
  });

  it("radical_form 문항의 오답 중 하나는 근호를 단순화하지 않은 형태를 포함한다(30회 표본)", () => {
    for (let i = 0; i < 30; i++) {
      const model = generateNonlinearEqModel({ difficulty: "medium", questionKind: "irrational_root_radical_form" });
      const hasUnsimplified = model.distractors.some((d) => d.kind === "formula_misuse" && /√\d+$/.test(d.value));
      expect(hasUnsimplified).toBe(true);
    }
  });

  it("렌더링: 지문은 $…$ 수식이고, 해설(한/영)에 정답이 포함되며 무리수라는 설명이 들어간다", () => {
    for (const kind of IRRATIONAL_KINDS) {
      const model = generateNonlinearEqModel({ difficulty: "hard", questionKind: kind });
      const rendered = renderNonlinearEqProblem(model);
      const eq = rendered.passage.split("\n\n")[1];
      expect(eq.startsWith("$")).toBe(true);
      expect(eq.endsWith("$")).toBe(true);
      expect(rendered.options).toHaveLength(4);
      expect(rendered.options[rendered.correctIndex]).toBe(model.correctAnswer);
      expect(rendered.explanation).toContain(model.correctAnswer);
      expect(rendered.explanationEn).toContain(model.correctAnswer);
      expect(rendered.explanation).toMatch(/무리수|단순화/);
      expect(rendered.explanationEn).toMatch(/irrational|simplif/);
    }
  });
});

// 2026-09-17(제품 오너 지시, 중간우선순위 공백) — "매개변수와 판별식".
describe("parameter_discriminant — x(kx-b)=-c ⟺ kx²-bx+c=0, k의 최소/최대/유일 정수값", () => {
  it("c는 항상 양수이고 정답 k에서 실제로 판별식 조건을 만족한다(150회 반복)", () => {
    for (let i = 0; i < 150; i++) {
      const model = generateNonlinearEqModel({ difficulty: ["easy", "medium", "hard"][i % 3] as "easy" | "medium" | "hard", questionKind: "parameter_discriminant" });
      expect(validateNonlinearEqModel(model)).toEqual({ ok: true });
      expect(model.paramC!).toBeGreaterThan(0);
      const k = Number(model.correctAnswer);
      expect(Number.isInteger(k)).toBe(true);
      const d = model.paramB! * model.paramB! - 4 * k * model.paramC!;
      if (model.paramDiscriminantSubKind === "no_real_least_k") {
        expect(d).toBeLessThan(0);
        expect(model.paramB! * model.paramB! - 4 * (k - 1) * model.paramC!).toBeGreaterThanOrEqual(0);
      } else if (model.paramDiscriminantSubKind === "at_least_one_greatest_k") {
        expect(d).toBeGreaterThanOrEqual(0);
        expect(model.paramB! * model.paramB! - 4 * (k + 1) * model.paramC!).toBeLessThan(0);
      } else {
        expect(d).toBe(0);
      }
    }
  });

  it("오답은 항상 정확히 3개이고 정답과 겹치지 않는다(150회 반복)", () => {
    for (let i = 0; i < 150; i++) {
      const model = generateNonlinearEqModel({ difficulty: "medium", questionKind: "parameter_discriminant" });
      expect(model.distractors).toHaveLength(3);
      const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
      expect(new Set(values).size).toBe(4);
    }
  });

  it("렌더링: 지문은 x(kx±b)=-c 형태의 $…$ 수식이고, 선택지 4개·정답 인덱스가 유효하며 해설에 정답이 포함된다(60회 반복)", () => {
    for (let i = 0; i < 60; i++) {
      const model = generateNonlinearEqModel({ difficulty: "medium", questionKind: "parameter_discriminant" });
      const rendered = renderNonlinearEqProblem(model);
      const eq = rendered.passage.split("\n\n")[1];
      expect(eq.startsWith("$x(kx")).toBe(true);
      expect(eq.endsWith("$")).toBe(true);
      expect(rendered.options).toHaveLength(4);
      expect(rendered.options[rendered.correctIndex]).toBe(model.correctAnswer);
      expect(rendered.explanation).toContain(model.correctAnswer);
      expect(rendered.explanationEn).toContain(model.correctAnswer);
      expect(rendered.explanation).toMatch(/판별식/);
      expect(rendered.explanationEn).toMatch(/discriminant/);
    }
  });
});
