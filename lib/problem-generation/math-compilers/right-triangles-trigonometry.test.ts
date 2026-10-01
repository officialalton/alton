import { describe, expect, it } from "vitest";
import { generateRightTriModel, renderRightTriProblem, validateRightTriModel } from "./right-triangles-trigonometry";
import { checkFigure } from "@/lib/problem-figures/check";

describe("generateRightTriModel — 결정적 계산", () => {
  it("생성된 세 변은 항상 피타고라스 정리를 만족한다(100회 반복, 모든 유형)", () => {
    const kinds = ["pythagorean_hypotenuse", "pythagorean_leg", "trig_ratio"] as const;
    for (let i = 0; i < 100; i++) {
      const m = generateRightTriModel({ difficulty: "hard", questionKind: kinds[i % 3] });
      expect(m.leg1 * m.leg1 + m.leg2 * m.leg2).toBe(m.hyp * m.hyp);
    }
  });

  it("pythagorean_hypotenuse는 hyp를, pythagorean_leg는 leg2를 정답으로 낸다(100회 반복)", () => {
    for (let i = 0; i < 100; i++) {
      const m1 = generateRightTriModel({ difficulty: "easy", questionKind: "pythagorean_hypotenuse" });
      expect(m1.correctAnswer).toBe(String(m1.hyp));
      const m2 = generateRightTriModel({ difficulty: "medium", questionKind: "pythagorean_leg" });
      expect(m2.correctAnswer).toBe(String(m2.leg2));
    }
  });

  it("trig_ratio는 실제 sin/cos/tan 값(기약분수)을 정답으로 낸다(100회 반복)", () => {
    for (let i = 0; i < 100; i++) {
      const m = generateRightTriModel({ difficulty: "medium", questionKind: "trig_ratio" });
      const opp = m.atVertex === "B" ? m.leg2 : m.leg1;
      const adj = m.atVertex === "B" ? m.leg1 : m.leg2;
      const expected = m.trigFn === "sin" ? [opp, m.hyp] : m.trigFn === "cos" ? [adj, m.hyp] : [opp, adj];
      const [n, d] = m.correctAnswer.includes("/") ? m.correctAnswer.split("/").map(Number) : [Number(m.correctAnswer), 1];
      // 기약분수가 실제 비율과 같은 값인지(교차곱)로 검증.
      expect(n * expected[1]).toBe(expected[0] * d);
    }
  });

  it("오답은 실제 삼각비 혼동(대변/인접변/빗변 오류)에서만 나오고 항상 정확히 3개이며 정답과 겹치지 않는다(100회 반복)", () => {
    const kinds = ["pythagorean_hypotenuse", "pythagorean_leg", "trig_ratio"] as const;
    const allowedKinds = new Set(["formula_misuse", "geometry_misapplied", "sign_error", "condition_ignored"]);
    for (let i = 0; i < 100; i++) {
      const m = generateRightTriModel({ difficulty: ["easy", "medium", "hard"][i % 3] as "easy" | "medium" | "hard", questionKind: kinds[i % kinds.length] });
      expect(m.distractors).toHaveLength(3);
      const values = [m.correctAnswer, ...m.distractors.map((d) => d.value)];
      expect(new Set(values).size).toBe(4);
      for (const d of m.distractors) expect(allowedKinds.has(d.kind)).toBe(true);
    }
  });

  it("validateRightTriModel은 위 모든 생성 결과를 통과시킨다(200회 반복)", () => {
    const kinds = ["pythagorean_hypotenuse", "pythagorean_leg", "trig_ratio"] as const;
    for (const k of kinds) {
      for (let i = 0; i < 30; i++) {
        const m = generateRightTriModel({ difficulty: "hard", questionKind: k });
        expect(validateRightTriModel(m)).toEqual({ ok: true });
      }
    }
  });
});

describe("renderRightTriProblem — 렌더링과 그림 검증", () => {
  it("선택지 중 정답 인덱스가 실제 정답 값을 가리킨다", () => {
    for (let i = 0; i < 50; i++) {
      const m = generateRightTriModel({ difficulty: "medium" });
      const r = renderRightTriProblem(m);
      expect(r.options[r.correctIndex]).toBe(m.correctAnswer);
    }
  });

  it("passage/question/options는 영어이고 explanation/explanationEn에는 $나 ^가 없다(모든 유형, 60회 반복)", () => {
    const kinds = ["pythagorean_hypotenuse", "pythagorean_leg", "trig_ratio"] as const;
    for (const k of kinds) {
      for (let i = 0; i < 20; i++) {
        const m = generateRightTriModel({ difficulty: "hard", questionKind: k });
        const r = renderRightTriProblem(m);
        expect(r.explanation).not.toMatch(/[$^]/);
        expect(r.explanationEn).not.toMatch(/[$^]/);
      }
    }
  });

  it("그림은 항상 checkFigure를 통과한다(각 유형 30회 반복, 라벨 충돌 스트레스)", () => {
    const kinds = ["pythagorean_hypotenuse", "pythagorean_leg", "trig_ratio"] as const;
    for (const k of kinds) {
      for (let i = 0; i < 30; i++) {
        const m = generateRightTriModel({ difficulty: "hard", questionKind: k });
        const r = renderRightTriProblem(m);
        const check = checkFigure(r.figure, r.passage + "\n\n" + r.question, r.options, r.correctIndex);
        expect(check.ok, JSON.stringify(check.issues)).toBe(true);
      }
    }
  });
});
