"use client";

import { useEffect, useRef, useState } from "react";

// 고정형 SAT 모의고사 V1 — Math 공통 도구(사양 6절): 그래프 계산기 · 참조표.
// 2026-09-18 제품 오너 지시로 V1 범위에 포함됐다. 최초 패스는 시간 제약으로 그래프 기능 없는
// 기본 사칙연산 계산기만 만들었으나("BasicCalculator" — 이번 패스에서 제거), 실제 디지털 SAT과
// 동일한 Desmos 그래프 계산기 경험을 요구하는 제품 오너 확인에 따라 이번 패스에서 Desmos
// Graphing Calculator API(CDN `<script>` 동적 로드, npm 의존성 추가 없음, 실제 디지털 SAT이 쓰는
// 것과 같은 엔진)로 교체했다. `evalBasicExpression`은 과거 기본 계산기 로직으로 테스트가 남아
// 있어 그대로 유지한다(회귀 없음 확인용, 화면에서는 더 이상 쓰지 않음).
// 참조표 내용은 실제 College Board 문구·이미지를 그대로 옮기지 않고, 필요한 공식만 ALTON 화면용으로
// 다시 구성했다(사양 6절 "실제 문구·도표의 재사용 범위는 구현 전에 확인" — 문구 재사용 없이 공식만
// 표현했으므로 저작권 문제가 없다고 보되, 최종 확인은 제품 오너 몫으로 남긴다).
//
// 사용처는 이번 패스에서는 모의고사 Math 섹션 화면(MockExamTakeClient)뿐이다. 사양 6절은 문제 탭·
// 과제 탭·교사 미리보기에도 "같은 렌더러"를 쓰라고 하므로, 이 컴포넌트는 그 화면들에도 그대로
// import 해 재사용할 수 있게 독립 컴포넌트로 뺐다 — 이번 패스에서 그 화면들까지 배선하지는 않았다
// (범위 밖으로 명시적으로 남김, 최종 보고 참고).

declare global {
  interface Window {
    Desmos?: {
      GraphingCalculator: (
        elt: HTMLElement,
        options?: Record<string, unknown>,
      ) => { destroy: () => void };
    };
  }
}

// Desmos는 2026년부터 apiKey 파라미터 없는 요청을 403으로 거부한다. 아래 키는 Desmos가 공개
// 문서·튜토리얼에서 배포하는 평가용 데모 키(dcb31709b452b1cf9dc26972add0fda6)로, 별도 계정
// 가입이나 결제 없이 GraphingCalculator API를 그대로 쓸 수 있다(Desmos API 문서 "Quick Start" 기준).
const DESMOS_API_KEY = "dcb31709b452b1cf9dc26972add0fda6";
const DESMOS_SCRIPT_SRC = `https://www.desmos.com/api/v1.11/calculator.js?apiKey=${DESMOS_API_KEY}`;
let desmosLoadPromise: Promise<void> | null = null;

/** Desmos 스크립트를 한 번만 로드한다(패널을 여러 번 열고 닫아도 재요청하지 않음). */
export function loadDesmosScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Desmos) return Promise.resolve();
  if (desmosLoadPromise) return desmosLoadPromise;
  desmosLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${DESMOS_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("desmos-script-load-failed")));
      return;
    }
    const script = document.createElement("script");
    script.src = DESMOS_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      desmosLoadPromise = null;
      reject(new Error("desmos-script-load-failed"));
    };
    document.head.appendChild(script);
  });
  return desmosLoadPromise;
}

/** 과거 기본 계산기 로직 — 화면에서는 더 이상 쓰지 않지만 회귀 테스트를 위해 남겨둔다. */
export function evalBasicExpression(expr: string): string {
  const cleaned = expr.replace(/[^0-9+\-*/().% ]/g, "");
  if (!cleaned.trim()) return "";
  try {
    const result = Function(`"use strict"; return (${cleaned});`)();
    if (typeof result !== "number" || !Number.isFinite(result)) return "오류";
    return String(Math.round(result * 1e10) / 1e10);
  } catch {
    return "오류";
  }
}

/** 실제 디지털 SAT과 같은 엔진(Desmos)을 쓰는 그래프 계산기. 마운트마다 인스턴스 하나만 만들고,
 * 언마운트 시 반드시 destroy 해 패널을 반복해서 열고 닫아도 인스턴스가 누적되지 않게 한다. */
export function GraphingCalculator() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const calculatorRef = useRef<{ destroy: () => void } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    loadDesmosScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.Desmos) return;
        calculatorRef.current = window.Desmos.GraphingCalculator(containerRef.current, {
          keypad: true,
          expressionsCollapsed: false,
          settingsMenu: false,
          border: false,
        });
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
      if (calculatorRef.current) {
        calculatorRef.current.destroy();
        calculatorRef.current = null;
      }
    };
  }, []);

  return (
    <div className="rounded-lg border border-grey-200 bg-white p-2 w-full max-w-[420px]" data-testid="mock-exam-calculator">
      {status === "error" ? (
        <div className="p-3 text-center text-[13px] text-red" data-testid="calculator-error">
          그래프 계산기를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.
        </div>
      ) : (
        <div
          ref={containerRef}
          data-testid="desmos-calculator-container"
          className="h-[360px] w-full"
        />
      )}
    </div>
  );
}

export function MathReferenceSheet() {
  return (
    <div className="rounded-lg border border-grey-200 bg-white p-4 text-[12.5px] leading-relaxed" data-testid="mock-exam-reference-sheet">
      <h4 className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-grey-500">참조표</h4>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="font-bold">원</p>
          <p>넓이 = πr², 둘레 = 2πr</p>
        </div>
        <div>
          <p className="font-bold">직사각형</p>
          <p>넓이 = 가로 × 세로</p>
        </div>
        <div>
          <p className="font-bold">삼각형</p>
          <p>넓이 = ½ × 밑변 × 높이</p>
        </div>
        <div>
          <p className="font-bold">직각삼각형(피타고라스)</p>
          <p>a² + b² = c²</p>
        </div>
        <div>
          <p className="font-bold">특수각 직각삼각형</p>
          <p>30-60-90: 변 비율 1 : √3 : 2</p>
          <p>45-45-90: 변 비율 1 : 1 : √2</p>
        </div>
        <div>
          <p className="font-bold">직육면체</p>
          <p>부피 = 가로 × 세로 × 높이</p>
        </div>
        <div>
          <p className="font-bold">원기둥</p>
          <p>부피 = πr²h</p>
        </div>
        <div>
          <p className="font-bold">구</p>
          <p>부피 = (4/3)πr³</p>
        </div>
        <div>
          <p className="font-bold">원뿔</p>
          <p>부피 = (1/3)πr²h</p>
        </div>
        <div>
          <p className="font-bold">각도</p>
          <p>삼각형 내각의 합 = 180°, 원 = 360° = 2π 라디안</p>
        </div>
      </div>
    </div>
  );
}

export type MathToolsOpen = "calculator" | "reference" | null;

/** 계산기·참조표 열기/닫기 버튼만 렌더링한다 — 화면마다 원하는 자리(상단 바, 툴바 등)에 그대로
 * 얹어 쓴다(2026-09-21 UAT: "상단 버튼으로 필요할 때 열고 닫게"). 상태는 부모가 들고 있는다 —
 * 모의고사 응시 화면·과제 화면·세션 문제 화면이 각자 자기 레이아웃에 맞는 자리에 버튼을 놓으면서도
 * 같은 계산기·참조표 패널(MockExamMathTools)을 공유하기 위함이다. */
export function MockExamToolButtons({
  calculatorAllowed,
  referenceSheetAllowed,
  open,
  onToggle,
}: {
  calculatorAllowed: boolean;
  referenceSheetAllowed: boolean;
  open: MathToolsOpen;
  onToggle: (which: "calculator" | "reference") => void;
}) {
  if (!calculatorAllowed && !referenceSheetAllowed) return null;
  return (
    <div className="flex items-center gap-1.5">
      {calculatorAllowed && (
        <button
          type="button"
          onClick={() => onToggle("calculator")}
          aria-pressed={open === "calculator"}
          className={`rounded-full border px-3 py-1.5 text-[12px] font-bold ${
            open === "calculator" ? "border-ink bg-ink text-white" : "border-grey-300 text-grey-600"
          }`}
          data-testid="toggle-calculator"
        >
          계산기
        </button>
      )}
      {referenceSheetAllowed && (
        <button
          type="button"
          onClick={() => onToggle("reference")}
          aria-pressed={open === "reference"}
          className={`rounded-full border px-3 py-1.5 text-[12px] font-bold ${
            open === "reference" ? "border-ink bg-ink text-white" : "border-grey-300 text-grey-600"
          }`}
          data-testid="toggle-reference"
        >
          참조표
        </button>
      )}
    </div>
  );
}

/** 계산기 패널(플로팅, fixed) + 참조표 팝업. 그리드·플렉스 등 부모 레이아웃과 무관하게 항상
 * 화면 위에 뜬다 — 모의고사 응시(flex)·과제(block)·세션 문제 탭(grid)에서 전부 그대로 재사용
 * 하기 위함이다(2026-09-21 UAT "문제·과제에서도 계산기·참조표 진입 가능해야"). 계산기는 한 번
 * 열리면(calcMounted) 이후 CSS로만 숨겨서 Desmos 인스턴스를 유지한다 — 닫았다 다시 열어도
 * 입력한 수식이 그대로 남는다. */
export default function MockExamMathTools({
  calculatorAllowed,
  referenceSheetAllowed,
  open,
  onClose,
}: {
  calculatorAllowed: boolean;
  referenceSheetAllowed: boolean;
  open: MathToolsOpen;
  onClose: () => void;
}) {
  const [calcMounted, setCalcMounted] = useState(false);
  useEffect(() => {
    if (open === "calculator") setCalcMounted(true);
  }, [open]);

  if (!calculatorAllowed && !referenceSheetAllowed) return null;

  return (
    <>
      {calculatorAllowed && calcMounted && (
        <div
          className={`fixed bottom-4 right-4 z-40 w-[calc(100vw-2rem)] max-w-[380px] ${open === "calculator" ? "block" : "hidden"}`}
          data-testid="mock-exam-calculator-panel"
        >
          <div className="relative">
            <button
              type="button"
              onClick={onClose}
              className="absolute -top-2 -right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-[12px] font-bold text-white shadow"
              data-testid="close-calculator"
              aria-label="계산기 닫기"
            >
              ×
            </button>
            <GraphingCalculator />
          </div>
        </div>
      )}
      {referenceSheetAllowed && open === "reference" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-grey-200 bg-white px-4 py-2">
              <span className="text-[12px] font-extrabold text-grey-500">참조표</span>
              <button type="button" onClick={onClose} className="text-[12px] font-bold text-grey-500 underline" data-testid="close-reference">
                닫기
              </button>
            </div>
            <MathReferenceSheet />
          </div>
        </div>
      )}
    </>
  );
}
