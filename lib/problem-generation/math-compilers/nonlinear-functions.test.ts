import { describe, expect, it } from "vitest";
import {
  generateNonlinearFnModel,
  renderNonlinearFnProblem,
  validateNonlinearFnModel,
} from "./nonlinear-functions";

describe("generateNonlinearFnModel — 결정적 계산", () => {
  it("evaluate는 f(x0) = a(x0-h)^2+k를 정확히 계산한다(100회 반복)", () => {
    for (let i = 0; i < 100; i++) {
      const model = generateNonlinearFnModel({ difficulty: "medium", questionKind: "evaluate" });
      const expected = model.a * (model.x0! - model.h) * (model.x0! - model.h) + model.k;
      expect(model.correctAnswer).toBe(String(expected));
      expect(validateNonlinearFnModel(model)).toEqual({ ok: true });
    }
  });

  it("vertex_x/vertex_y는 h/k를 그대로 정답으로 낸다(100회 반복)", () => {
    for (let i = 0; i < 100; i++) {
      const vx = generateNonlinearFnModel({ difficulty: "medium", questionKind: "vertex_x" });
      expect(vx.correctAnswer).toBe(String(vx.h));
      const vy = generateNonlinearFnModel({ difficulty: "medium", questionKind: "vertex_y" });
      expect(vy.correctAnswer).toBe(String(vy.k));
    }
  });

  it("오답은 항상 정확히 3개이고 정답과 겹치지 않는다(전 유형·난이도, 150회 반복)", () => {
    const kinds = ["evaluate", "vertex_x", "vertex_y"] as const;
    const difficulties = ["easy", "medium", "hard"] as const;
    for (let i = 0; i < 150; i++) {
      const model = generateNonlinearFnModel({ difficulty: difficulties[i % 3], questionKind: kinds[i % 3] });
      expect(model.distractors).toHaveLength(3);
      const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
      expect(new Set(values).size).toBe(4);
    }
  });
});

describe("renderNonlinearFnProblem — 렌더링·해설", () => {
  // 2026-09-17(실측, 아침 UAT) — "^2"가 $…$ 밖에 있으면 캐럿 글자 그대로 노출된다.
  it("지문의 함수식은 항상 $…$로 감싸져 있다(100회 반복)", () => {
    for (let i = 0; i < 100; i++) {
      const model = generateNonlinearFnModel({ difficulty: "medium" });
      const rendered = renderNonlinearFnProblem(model);
      expect(rendered.passage).toMatch(/^The function f is defined by \$f\(x\) = .*\$\.$/);
    }
  });

  it("세 유형 모두 선택지 4개·정답 인덱스가 유효하고 해설에 정답이 포함된다", () => {
    const kinds = ["evaluate", "vertex_x", "vertex_y"] as const;
    for (const kind of kinds) {
      for (let i = 0; i < 10; i++) {
        const model = generateNonlinearFnModel({ difficulty: "medium", questionKind: kind });
        const rendered = renderNonlinearFnProblem(model);
        expect(rendered.figure).toBeNull();
        expect(rendered.options).toHaveLength(4);
        expect(rendered.options[rendered.correctIndex]).toBe(model.correctAnswer);
        expect(rendered.explanation).toContain(model.correctAnswer);
      }
    }
  });

  // 2026-09-17 버그 수정 — 관리자가 "자료 포함 · 좌표평면"(require_plane)을 고르면
  // 이전엔 이 값이 컴파일러까지 전달되지 않아 항상 텍스트형(그래프 없음)만 나왔다.
  it("figureMode:'plane'이면 실제 좌표평면 figure를 만들고 지문이 그것을 가리킨다", () => {
    const kinds = ["evaluate", "vertex_x", "vertex_y"] as const;
    for (const kind of kinds) {
      const model = generateNonlinearFnModel({ difficulty: "medium", questionKind: kind });
      const rendered = renderNonlinearFnProblem(model, { figureMode: "plane" });
      expect(rendered.figure).not.toBeNull();
      expect(rendered.figure).toMatchObject({ type: "plane", objects: [{ id: "f", kind: "function", fn: "quadratic" }] });
      expect(rendered.passage).toMatch(/graph.*shown/i);
    }
  });
});
