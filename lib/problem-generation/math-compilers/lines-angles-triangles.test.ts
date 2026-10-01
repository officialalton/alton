import { describe, expect, it } from "vitest";
import { generateLinesAnglesModel, renderLinesAnglesProblem, validateLinesAnglesModel } from "./lines-angles-triangles";
import { checkFigure } from "@/lib/problem-figures/check";

describe("generateLinesAnglesModel — 결정적 계산", () => {
  it("triangle_angle_sum은 항상 180-A-B를 정답으로 내고, 세 각의 합은 180이다(100회 반복)", () => {
    for (let i = 0; i < 100; i++) {
      const m = generateLinesAnglesModel({ difficulty: "easy", questionKind: "triangle_angle_sum" });
      const c = 180 - m.angleA! - m.angleB!;
      expect(c).toBeGreaterThan(0);
      expect(m.correctAnswer).toBe(String(c));
    }
  });

  it("exterior_angle은 항상 두 원격 내각의 합을 정답으로 낸다(100회 반복)", () => {
    for (let i = 0; i < 100; i++) {
      const m = generateLinesAnglesModel({ difficulty: "medium", questionKind: "exterior_angle" });
      expect(m.correctAnswer).toBe(String(m.angleA! + m.angleB!));
    }
  });

  it("isosceles_base_angle은 항상 (180-apex)/2를 정답으로 내고 정수다(100회 반복)", () => {
    for (let i = 0; i < 100; i++) {
      const m = generateLinesAnglesModel({ difficulty: "hard", questionKind: "isosceles_base_angle" });
      const base = (180 - m.apexAngle!) / 2;
      expect(Number.isInteger(base)).toBe(true);
      expect(m.correctAnswer).toBe(String(base));
    }
  });

  it("오답은 실제 개념 오류(직각·보각·이등변 혼동)에서만 나오고 항상 정확히 3개이며 정답과 겹치지 않는다(100회 반복)", () => {
    const kinds = ["triangle_angle_sum", "exterior_angle", "isosceles_base_angle"] as const;
    const allowedKinds = new Set(["formula_misuse", "condition_ignored", "sign_error", "geometry_misapplied"]);
    for (let i = 0; i < 100; i++) {
      const m = generateLinesAnglesModel({ difficulty: ["easy", "medium", "hard"][i % 3] as "easy" | "medium" | "hard", questionKind: kinds[i % kinds.length] });
      expect(m.distractors).toHaveLength(3);
      const values = [m.correctAnswer, ...m.distractors.map((d) => d.value)];
      expect(new Set(values).size).toBe(4);
      for (const d of m.distractors) expect(allowedKinds.has(d.kind)).toBe(true);
    }
  });

  it("similar_triangles는 항상 EF = BC × (DE÷AB)를 정답으로 내고 대응변 배율이 일관된다(100회 반복, medium/hard)", () => {
    for (let i = 0; i < 100; i++) {
      const difficulty = i % 2 === 0 ? "medium" : "hard";
      const m = generateLinesAnglesModel({ difficulty, questionKind: "similar_triangles" });
      expect(m.sideDE).toBe((m.sideAB! * m.scaleNum!) / m.scaleDenom!);
      const ef = (m.sideBC! * m.scaleNum!) / m.scaleDenom!;
      expect(Number.isInteger(ef)).toBe(true);
      expect(m.correctAnswer).toBe(String(ef));
      if (difficulty === "hard") expect(m.scaleDenom).not.toBe(1);
    }
  });

  it("similar_triangles 오답은 대응변 오짝짓기·배율 역전·가산 오류·합동 착각에서만 나오고 정답과 겹치지 않는다(100회 반복)", () => {
    const allowedKinds = new Set(["formula_misuse", "condition_ignored", "geometry_misapplied"]);
    for (let i = 0; i < 100; i++) {
      const m = generateLinesAnglesModel({ difficulty: i % 2 === 0 ? "medium" : "hard", questionKind: "similar_triangles" });
      expect(m.distractors).toHaveLength(3);
      const values = [m.correctAnswer, ...m.distractors.map((d) => d.value)];
      expect(new Set(values).size).toBe(4);
      for (const d of m.distractors) expect(allowedKinds.has(d.kind)).toBe(true);
    }
  });

  it("validateLinesAnglesModel은 위 모든 생성 결과를 통과시킨다(200회 반복)", () => {
    const kinds = ["triangle_angle_sum", "exterior_angle", "isosceles_base_angle", "similar_triangles"] as const;
    for (const k of kinds) {
      for (let i = 0; i < 30; i++) {
        const m = generateLinesAnglesModel({ difficulty: "hard", questionKind: k });
        expect(validateLinesAnglesModel(m)).toEqual({ ok: true });
      }
    }
  });
});

describe("renderLinesAnglesProblem — 렌더링과 그림 검증", () => {
  it("선택지 중 정답 인덱스가 실제 정답 값을 가리킨다", () => {
    for (let i = 0; i < 50; i++) {
      const m = generateLinesAnglesModel({ difficulty: "medium" });
      const r = renderLinesAnglesProblem(m);
      expect(r.options[r.correctIndex]).toBe(m.correctAnswer);
    }
  });

  it("passage/question/options는 영어이고 explanation/explanationEn에는 $나 ^가 없다(모든 유형, 60회 반복)", () => {
    const kinds = ["triangle_angle_sum", "exterior_angle", "isosceles_base_angle"] as const;
    for (const k of kinds) {
      for (let i = 0; i < 20; i++) {
        const m = generateLinesAnglesModel({ difficulty: "hard", questionKind: k });
        const r = renderLinesAnglesProblem(m);
        expect(r.explanation).not.toMatch(/[$^]/);
        expect(r.explanationEn).not.toMatch(/[$^]/);
      }
    }
  });

  it("그림이 있는 문항(각 합·이등변)은 checkFigure를 통과하고, exterior_angle은 그림 없이도 통과한다(각 유형 30회 반복)", () => {
    for (let i = 0; i < 30; i++) {
      const m1 = generateLinesAnglesModel({ difficulty: "easy", questionKind: "triangle_angle_sum" });
      const r1 = renderLinesAnglesProblem(m1);
      expect(r1.figure).not.toBeNull();
      const check1 = checkFigure(r1.figure, r1.passage + "\n\n" + r1.question, r1.options, r1.correctIndex);
      expect(check1.ok, JSON.stringify(check1.issues)).toBe(true);

      const m2 = generateLinesAnglesModel({ difficulty: "hard", questionKind: "isosceles_base_angle" });
      const r2 = renderLinesAnglesProblem(m2);
      expect(r2.figure).not.toBeNull();
      const check2 = checkFigure(r2.figure, r2.passage + "\n\n" + r2.question, r2.options, r2.correctIndex);
      expect(check2.ok, JSON.stringify(check2.issues)).toBe(true);

      const m3 = generateLinesAnglesModel({ difficulty: "medium", questionKind: "exterior_angle" });
      const r3 = renderLinesAnglesProblem(m3);
      expect(r3.figure).toBeNull();
      const check3 = checkFigure(r3.figure, r3.passage + "\n\n" + r3.question, r3.options, r3.correctIndex);
      expect(check3.ok, JSON.stringify(check3.issues)).toBe(true);
    }
  });

  it("similar_triangles는 두 삼각형(제2삼각형 포함) 그림을 함께 만들고 checkFigure를 통과한다(라벨 충돌 스트레스, 40회 반복)", () => {
    for (let i = 0; i < 40; i++) {
      const m = generateLinesAnglesModel({ difficulty: i % 2 === 0 ? "medium" : "hard", questionKind: "similar_triangles" });
      const r = renderLinesAnglesProblem(m);
      expect(r.figure).not.toBeNull();
      const f = r.figure as { second?: unknown };
      expect(f.second).toBeDefined();
      const check = checkFigure(r.figure, r.passage + "\n\n" + r.question, r.options, r.correctIndex);
      expect(check.ok, JSON.stringify(check.issues)).toBe(true);
    }
  });
});
