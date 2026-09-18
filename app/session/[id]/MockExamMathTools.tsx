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

/** Math 화면 오른쪽 고정 패널(넓은 화면) / 플로팅 버튼(좁은 화면) — 사양 6절. */
export default function MockExamMathTools({ calculatorAllowed, referenceSheetAllowed }: { calculatorAllowed: boolean; referenceSheetAllowed: boolean }) {
  const [open, setOpen] = useState<"calculator" | "reference" | null>(null);
  if (!calculatorAllowed && !referenceSheetAllowed) return null;
  return (
    <>
      <div className="fixed bottom-4 right-4 z-40 flex flex-col gap-2 lg:hidden">
        {calculatorAllowed && (
          <button
            type="button"
            onClick={() => setOpen(open === "calculator" ? null : "calculator")}
            className="rounded-full bg-ink px-4 py-2 text-[13px] font-bold text-white shadow-lg"
            data-testid="open-calculator-mobile"
          >
            계산기
          </button>
        )}
        {referenceSheetAllowed && (
          <button
            type="button"
            onClick={() => setOpen(open === "reference" ? null : "reference")}
            className="rounded-full bg-grey-700 px-4 py-2 text-[13px] font-bold text-white shadow-lg"
            data-testid="open-reference-mobile"
          >
            참조표
          </button>
        )}
      </div>
      <div className="hidden lg:flex lg:w-[420px] lg:flex-shrink-0 lg:flex-col lg:gap-3">
        {calculatorAllowed && <GraphingCalculator />}
        {referenceSheetAllowed && <MathReferenceSheet />}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 lg:hidden" onClick={() => setOpen(null)}>
          <div className="mb-4 w-full max-w-sm px-4" onClick={(e) => e.stopPropagation()}>
            {open === "calculator" ? <GraphingCalculator /> : <MathReferenceSheet />}
          </div>
        </div>
      )}
    </>
  );
}
