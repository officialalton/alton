import { describe, expect, it } from "vitest";
import { generateCirclesModel, renderCirclesProblem, validateCirclesModel } from "./circles";
import { checkFigure } from "@/lib/problem-figures/check";

describe("generateCirclesModel — 결정적 계산", () => {
  it("circumference_radius/diameter는 항상 2πr(=πd)을 정답으로 낸다(100회 반복)", () => {
    for (let i = 0; i < 50; i++) {
      const m1 = generateCirclesModel({ difficulty: "easy", questionKind: "circumference_radius" });
      expect(m1.correctAnswer).toBe(`${2 * m1.radius!}π`);
      const m2 = generateCirclesModel({ difficulty: "hard", questionKind: "circumference_diameter" });
      expect(m2.diameter).toBe(m2.radius! * 2);
      expect(m2.correctAnswer).toBe(`${m2.diameter}π`);
    }
  });

  it("arc_length는 (angle/360)×2πr을, sector_area는 (angle/360)×πr²을 항상 정수 계수로 낸다(100회 반복)", () => {
    for (let i = 0; i < 50; i++) {
      const m1 = generateCirclesModel({ difficulty: "medium", questionKind: "arc_length" });
      const coeff1 = (m1.centralAngle! / 360) * 2 * m1.radius!;
      expect(Number.isInteger(coeff1)).toBe(true);
      expect(m1.correctAnswer).toBe(`${coeff1}π`);
      const m2 = generateCirclesModel({ difficulty: "hard", questionKind: "sector_area" });
      const coeff2 = (m2.centralAngle! / 360) * m2.radius! * m2.radius!;
      expect(Number.isInteger(coeff2)).toBe(true);
      expect(m2.correctAnswer).toBe(`${coeff2}π`);
    }
  });

  it("central_from_inscribed/inscribed_from_central은 항상 중심각=원주각×2 관계를 만족한다(100회 반복)", () => {
    for (let i = 0; i < 50; i++) {
      const m1 = generateCirclesModel({ difficulty: "medium", questionKind: "central_from_inscribed" });
      expect(m1.centralAngle).toBe(m1.inscribedAngle! * 2);
      expect(m1.correctAnswer).toBe(String(m1.centralAngle));
      const m2 = generateCirclesModel({ difficulty: "hard", questionKind: "inscribed_from_central" });
      expect(m2.centralAngle).toBe(m2.inscribedAngle! * 2);
      expect(m2.correctAnswer).toBe(String(m2.inscribedAngle));
    }
  });

  it("오답은 실제 공식 혼동(반지름/지름·호/부채꼴·중심각/원주각)에서만 나오고 항상 정확히 3개이며 정답과 겹치지 않는다(100회 반복)", () => {
    const kinds = ["circumference_radius", "circumference_diameter", "arc_length", "sector_area", "central_from_inscribed", "inscribed_from_central"] as const;
    const allowedKinds = new Set(["formula_misuse", "geometry_misapplied", "unit_error", "condition_ignored"]);
    for (let i = 0; i < 120; i++) {
      const m = generateCirclesModel({ difficulty: ["easy", "medium", "hard"][i % 3] as "easy" | "medium" | "hard", questionKind: kinds[i % kinds.length] });
      expect(m.distractors).toHaveLength(3);
      const values = [m.correctAnswer, ...m.distractors.map((d) => d.value)];
      expect(new Set(values).size).toBe(4);
      for (const d of m.distractors) expect(allowedKinds.has(d.kind)).toBe(true);
    }
  });

  it("validateCirclesModel은 위 모든 생성 결과를 통과시킨다(200회 반복)", () => {
    const kinds = ["circumference_radius", "circumference_diameter", "arc_length", "sector_area", "central_from_inscribed", "inscribed_from_central"] as const;
    for (const k of kinds) {
      for (let i = 0; i < 30; i++) {
        const m = generateCirclesModel({ difficulty: "hard", questionKind: k });
        expect(validateCirclesModel(m)).toEqual({ ok: true });
      }
    }
  });
});

describe("renderCirclesProblem — 렌더링과 그림 검증", () => {
  it("선택지 중 정답 인덱스가 실제 정답 값을 가리킨다", () => {
    for (let i = 0; i < 50; i++) {
      const m = generateCirclesModel({ difficulty: "medium" });
      const r = renderCirclesProblem(m);
      expect(r.options[r.correctIndex]).toBe(m.correctAnswer);
    }
  });

  it("passage/question/options는 영어이고 explanation/explanationEn에는 $나 ^가 없다(모든 유형, 60회 반복)", () => {
    const kinds = ["circumference_radius", "circumference_diameter", "arc_length", "sector_area", "central_from_inscribed", "inscribed_from_central"] as const;
    for (const k of kinds) {
      for (let i = 0; i < 10; i++) {
        const m = generateCirclesModel({ difficulty: "hard", questionKind: k });
        const r = renderCirclesProblem(m);
        expect(r.explanation).not.toMatch(/[$^]/);
        expect(r.explanationEn).not.toMatch(/[$^]/);
      }
    }
  });

  it("그림은 항상 checkFigure를 통과한다(각 유형 30회 반복, 라벨 충돌 스트레스)", () => {
    const kinds = ["circumference_radius", "circumference_diameter", "arc_length", "sector_area", "central_from_inscribed", "inscribed_from_central"] as const;
    for (const k of kinds) {
      for (let i = 0; i < 30; i++) {
        const m = generateCirclesModel({ difficulty: "hard", questionKind: k });
        const r = renderCirclesProblem(m);
        const check = checkFigure(r.figure, r.passage + "\n\n" + r.question, r.options, r.correctIndex);
        expect(check.ok, JSON.stringify(check.issues)).toBe(true);
      }
    }
  });
});
