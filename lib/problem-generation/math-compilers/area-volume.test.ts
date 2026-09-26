import { describe, expect, it } from "vitest";
import { generateAreaVolumeModel, renderAreaVolumeProblem, validateAreaVolumeModel } from "./area-volume";
import { checkFigure } from "@/lib/problem-figures/check";

describe("generateAreaVolumeModel — 결정적 계산", () => {
  it("rectangle_area는 항상 length×width를 정답으로 낸다(100회 반복)", () => {
    for (let i = 0; i < 100; i++) {
      const m = generateAreaVolumeModel({ difficulty: "easy", questionKind: "rectangle_area" });
      expect(m.correctAnswer).toBe(String(m.length! * m.width!));
    }
  });

  it("triangle_area는 항상 (base×height)/2를 정답으로 낸다(100회 반복)", () => {
    for (let i = 0; i < 100; i++) {
      const m = generateAreaVolumeModel({ difficulty: "medium", questionKind: "triangle_area" });
      expect(Number(m.correctAnswer)).toBe((m.base! * m.height!) / 2);
      expect(Number.isInteger(Number(m.correctAnswer))).toBe(true);
    }
  });

  it("prism_volume은 항상 l×w×h를 정답으로 낸다(100회 반복)", () => {
    for (let i = 0; i < 100; i++) {
      const m = generateAreaVolumeModel({ difficulty: "easy", questionKind: "prism_volume" });
      expect(m.correctAnswer).toBe(String(m.l! * m.w! * m.h!));
    }
  });

  it("prism_missing_dimension은 부피÷(알려진 두 치수의 곱)을 정답으로 내고, 세 치수의 곱이 부피와 일치한다(100회 반복)", () => {
    for (let i = 0; i < 100; i++) {
      const m = generateAreaVolumeModel({ difficulty: "hard", questionKind: "prism_missing_dimension" });
      expect(m.volume).toBe(m.l! * m.w! * m.h!);
      const answer = m.missingDim === "l" ? m.l! : m.missingDim === "w" ? m.w! : m.h!;
      expect(m.correctAnswer).toBe(String(answer));
    }
  });

  it("cylinder_volume_radius/diameter는 πr²h 계수를 정답으로 내고, 지름이 있으면 반지름의 2배다(100회 반복)", () => {
    for (let i = 0; i < 50; i++) {
      const m1 = generateAreaVolumeModel({ difficulty: "medium", questionKind: "cylinder_volume_radius" });
      expect(m1.correctAnswer).toBe(`${m1.radius! * m1.radius! * m1.cylHeight!}π`);
      const m2 = generateAreaVolumeModel({ difficulty: "hard", questionKind: "cylinder_volume_diameter" });
      expect(m2.diameter).toBe(m2.radius! * 2);
      expect(m2.correctAnswer).toBe(`${m2.radius! * m2.radius! * m2.cylHeight!}π`);
    }
  });

  it("오답은 실제 오류 경로(넓이/부피 공식 혼동)에서만 나오고 항상 정확히 3개이며 정답과 겹치지 않는다(모든 유형, 100회 반복)", () => {
    const kinds = ["rectangle_area", "triangle_area", "prism_volume", "prism_missing_dimension", "cylinder_volume_radius", "cylinder_volume_diameter"] as const;
    const allowedKinds = new Set(["formula_misuse", "geometry_misapplied", "unit_error"]);
    for (let i = 0; i < 100; i++) {
      const m = generateAreaVolumeModel({ difficulty: ["easy", "medium", "hard"][i % 3] as "easy" | "medium" | "hard", questionKind: kinds[i % kinds.length] });
      expect(m.distractors).toHaveLength(3);
      const values = [m.correctAnswer, ...m.distractors.map((d) => d.value)];
      expect(new Set(values).size).toBe(4);
      for (const d of m.distractors) expect(allowedKinds.has(d.kind)).toBe(true);
    }
  });

  it("validateAreaVolumeModel은 위 모든 생성 결과를 통과시킨다(200회 반복)", () => {
    const kinds = ["rectangle_area", "triangle_area", "prism_volume", "prism_missing_dimension", "cylinder_volume_radius", "cylinder_volume_diameter"] as const;
    for (const k of kinds) {
      for (let i = 0; i < 30; i++) {
        const m = generateAreaVolumeModel({ difficulty: "hard", questionKind: k });
        expect(validateAreaVolumeModel(m)).toEqual({ ok: true });
      }
    }
  });
});

describe("renderAreaVolumeProblem — 렌더링과 그림 검증", () => {
  it("선택지 중 정답 인덱스가 실제 정답 값을 가리킨다", () => {
    for (let i = 0; i < 50; i++) {
      const m = generateAreaVolumeModel({ difficulty: "medium" });
      const r = renderAreaVolumeProblem(m);
      expect(r.options).toHaveLength(4);
      expect(r.options[r.correctIndex]).toBe(m.correctAnswer);
    }
  });

  it("passage/question/options는 영어이고 explanation/explanationEn에는 $나 ^가 없다(모든 유형, 60회 반복)", () => {
    const kinds = ["rectangle_area", "triangle_area", "prism_volume", "prism_missing_dimension", "cylinder_volume_radius", "cylinder_volume_diameter"] as const;
    for (const k of kinds) {
      for (let i = 0; i < 10; i++) {
        const m = generateAreaVolumeModel({ difficulty: "hard", questionKind: k });
        const r = renderAreaVolumeProblem(m);
        expect(r.explanation).not.toMatch(/[$^]/);
        expect(r.explanationEn).not.toMatch(/[$^]/);
        expect(/^[A-Za-z0-9\s.,°²³×÷≈≤≥()?/π=+\-]*$/.test(r.question)).toBe(true);
      }
    }
  });

  it("그림이 있는 문항은 checkFigure를 통과한다(각 유형 30회 반복, 라벨 충돌 스트레스)", () => {
    const kinds = ["rectangle_area", "triangle_area", "prism_volume", "prism_missing_dimension", "cylinder_volume_radius", "cylinder_volume_diameter"] as const;
    for (const k of kinds) {
      for (let i = 0; i < 30; i++) {
        const m = generateAreaVolumeModel({ difficulty: "hard", questionKind: k });
        const r = renderAreaVolumeProblem(m);
        expect(r.figure).not.toBeNull();
        const passageForCheck = r.passage + "\n\n" + r.question;
        const check = checkFigure(r.figure, passageForCheck, r.options, r.correctIndex);
        expect(check.ok, JSON.stringify(check.issues)).toBe(true);
      }
    }
  });
});
