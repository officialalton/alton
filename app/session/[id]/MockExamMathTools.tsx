"use client";

import { useState } from "react";

// 고정형 SAT 모의고사 V1 — Math 공통 도구(사양 6절): 계산기 · 참조표.
// 2026-09-18 제품 오너 지시로 V1 범위에 포함됐다. 사양은 "그래프 계산을 지원하는 Desmos 스타일
// 도구를 목표로 한다"고 적었지만, 이번 패스에서는 시간 제약으로 **그래프 기능 없는 기본
// 사칙연산·부호·소수 계산기**만 만들었다 — 그래프 계산기는 후속 작업으로 남긴다(README/보고 참고).
// 참조표 내용은 실제 College Board 문구·이미지를 그대로 옮기지 않고, 필요한 공식만 ALTON 화면용으로
// 다시 구성했다(사양 6절 "실제 문구·도표의 재사용 범위는 구현 전에 확인" — 문구 재사용 없이 공식만
// 표현했으므로 저작권 문제가 없다고 보되, 최종 확인은 제품 오너 몫으로 남긴다).
//
// 사용처는 이번 패스에서는 모의고사 Math 섹션 화면(MockExamTakeClient)뿐이다. 사양 6절은 문제 탭·
// 과제 탭·교사 미리보기에도 "같은 렌더러"를 쓰라고 하므로, 이 컴포넌트는 그 화면들에도 그대로
// import 해 재사용할 수 있게 독립 컴포넌트로 뺐다 — 이번 패스에서 그 화면들까지 배선하지는 않았다
// (범위 밖으로 명시적으로 남김, 최종 보고 참고).

export function evalBasicExpression(expr: string): string {
  const cleaned = expr.replace(/[^0-9+\-*/().% ]/g, "");
  if (!cleaned.trim()) return "";
  try {
    // eslint-disable-next-line no-new-func -- 사칙연산 전용 문자만 허용한 뒤 계산(위에서 필터링).
    const result = Function(`"use strict"; return (${cleaned});`)();
    if (typeof result !== "number" || !Number.isFinite(result)) return "오류";
    return String(Math.round(result * 1e10) / 1e10);
  } catch {
    return "오류";
  }
}

export function BasicCalculator() {
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const press = (token: string) => setExpr((e) => e + token);
  return (
    <div className="rounded-lg border border-grey-200 bg-white p-3 w-full max-w-[260px]" data-testid="mock-exam-calculator">
      <div className="mb-2 rounded border border-grey-200 bg-grey-50 px-2 py-2 text-right font-mono text-[14px] min-h-[36px]">
        {expr || "0"}
      </div>
      {result !== null && (
        <div className="mb-2 text-right font-mono text-[16px] font-bold" data-testid="calculator-result">
          = {result}
        </div>
      )}
      <div className="grid grid-cols-4 gap-1.5">
        {["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "%", "+"].map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            className="rounded bg-grey-100 py-2 text-[13px] font-semibold hover:bg-grey-200"
          >
            {k}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setExpr("");
            setResult(null);
          }}
          className="col-span-2 rounded bg-grey-200 py-2 text-[13px] font-semibold hover:bg-grey-300"
        >
          지우기
        </button>
        <button
          type="button"
          onClick={() => setExpr((e) => e.slice(0, -1))}
          className="rounded bg-grey-200 py-2 text-[13px] font-semibold hover:bg-grey-300"
        >
          ⌫
        </button>
        <button
          type="button"
          onClick={() => setResult(evalBasicExpression(expr))}
          className="rounded bg-ink py-2 text-[13px] font-semibold text-white hover:opacity-90"
        >
          =
        </button>
      </div>
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
      <div className="hidden lg:flex lg:w-[280px] lg:flex-shrink-0 lg:flex-col lg:gap-3">
        {calculatorAllowed && <BasicCalculator />}
        {referenceSheetAllowed && <MathReferenceSheet />}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 lg:hidden" onClick={() => setOpen(null)}>
          <div className="mb-4 w-full max-w-sm px-4" onClick={(e) => e.stopPropagation()}>
            {open === "calculator" ? <BasicCalculator /> : <MathReferenceSheet />}
          </div>
        </div>
      )}
    </>
  );
}
