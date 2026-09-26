import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { evalBasicExpression } from "./MockExamMathTools";

describe("evalBasicExpression — 과거 기본 계산기 로직(회귀 유지)", () => {
  it("사칙연산을 계산한다", () => {
    expect(evalBasicExpression("2+3*4")).toBe("14");
    expect(evalBasicExpression("(2+3)*4")).toBe("20");
    expect(evalBasicExpression("10/4")).toBe("2.5");
  });

  it("빈 입력은 빈 문자열", () => {
    expect(evalBasicExpression("")).toBe("");
  });

  it("악의적인 문자는 걸러내고 숫자·연산자·괄호만 남겨 계산한다", () => {
    // "alert(1)+2" 에서 문자를 제거하면 "(1)+2" 만 남는다(괄호는 계산식으로 허용).
    expect(evalBasicExpression("alert(1)+2")).toBe("3");
  });

  it("0으로 나누거나 잘못된 식은 오류를 표시한다", () => {
    expect(evalBasicExpression("1/0")).toBe("오류");
    expect(evalBasicExpression("1+")).toBe("오류");
  });
});

describe("GraphingCalculator — Desmos 마운트/언마운트", () => {
  // Desmos 자체는 jsdom에서 실행할 수 없으므로 window.Desmos를 목업해 마운트 로직만 검증한다.
  const destroyMock = vi.fn();
  const graphingCalculatorMock = vi.fn(() => ({ destroy: destroyMock }));

  beforeEach(() => {
    destroyMock.mockClear();
    graphingCalculatorMock.mockClear();
    document.head.innerHTML = "";
    delete window.Desmos;
    // 모듈 내부 desmosLoadPromise 캐시는 테스트 간 격리를 위해 매번 새 모듈로 불러온다.
    vi.resetModules();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  function mockScriptAutoLoad() {
    // jsdom은 <script src> 를 실제로 fetch하지 않으므로, appendChild 시점에 곧바로
    // window.Desmos 를 세팅하고 onload 를 실행해 실제 CDN 로드를 흉내낸다.
    const originalAppendChild = document.head.appendChild.bind(document.head);
    vi.spyOn(document.head, "appendChild").mockImplementation((node: Node) => {
      const result = originalAppendChild(node);
      const script = node as HTMLScriptElement;
      if (script.tagName === "SCRIPT") {
        window.Desmos = { GraphingCalculator: graphingCalculatorMock };
        queueMicrotask(() => script.onload?.(new Event("load")));
      }
      return result;
    });
  }

  it("스크립트를 로드하고 컨테이너에 Desmos.GraphingCalculator를 마운트한다", async () => {
    mockScriptAutoLoad();
    const { GraphingCalculator } = await import("./MockExamMathTools");
    render(<GraphingCalculator />);
    await waitFor(() => expect(graphingCalculatorMock).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("desmos-calculator-container")).toBeTruthy();
  });

  it("언마운트 시 destroy를 호출해 인스턴스를 정리한다(반복 토글 시 누적 방지)", async () => {
    mockScriptAutoLoad();
    const { GraphingCalculator } = await import("./MockExamMathTools");
    const { unmount } = render(<GraphingCalculator />);
    await waitFor(() => expect(graphingCalculatorMock).toHaveBeenCalledTimes(1));
    unmount();
    expect(destroyMock).toHaveBeenCalledTimes(1);
  });

  it("스크립트 로드에 실패하면 오류 메시지를 보여준다", async () => {
    vi.spyOn(document.head, "appendChild").mockImplementation((node: Node) => {
      const script = node as HTMLScriptElement;
      queueMicrotask(() => script.onerror?.(new Event("error")));
      return node;
    });
    const { GraphingCalculator } = await import("./MockExamMathTools");
    render(<GraphingCalculator />);
    await waitFor(() => expect(screen.getByTestId("calculator-error")).toBeTruthy());
  });
});
