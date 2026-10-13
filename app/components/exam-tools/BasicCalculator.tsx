"use client";

import { useState } from "react";
import { compileExpr } from "@/lib/problem-figures/templates/ap-expr";

// 사칙(four-function) 계산기: AP Microeconomics 는 사칙 계산기를 허용한다(docs/ap/microeconomics-facts.md). 숫자와 + − * / ( ) · 만 받는다(함수·거듭제곱은 거부). eval 없이 안전 파서를 쓴다.
export function evalBasic(src: string): { ok: true; value: string } | { ok: false; error: string } {
  if (!src.trim()) return { ok: false, error: "Enter an expression." };
  if (!/^[0-9+\-*/().,\s%]+$/.test(src) || /\*\*|\^/.test(src)) return { ok: false, error: "Use numbers and + - * / ( ) only." };
  const c = compileExpr(src.replace(/,/g, "").replace(/%/g, "/100"), []);
  if (!c) return { ok: false, error: "Cannot read this expression." };
  try {
    const v = c.fn({});
    if (!Number.isFinite(v)) return { ok: false, error: "Result is not a finite number." };
    const a = Math.abs(v);
    return { ok: true, value: a !== 0 && (a >= 1e9 || a < 1e-6) ? v.toExponential(6) : String(Number(v.toPrecision(10))) };
  } catch { return { ok: false, error: "Cannot compute this expression." }; }
}

export default function BasicCalculator() {
  const [src, setSrc] = useState("");
  const r = src.trim() ? evalBasic(src) : null;
  return (
    <div className="space-y-3 p-4" data-testid="basic-calculator">
      <label htmlFor="basic-calc-input" className="block text-[12px] font-bold text-grey-600">Four-function calculator</label>
      <input id="basic-calc-input" value={src} onChange={(e) => setSrc(e.target.value)} autoComplete="off" spellCheck={false} placeholder="e.g. (60 - 40) / 2" className="w-full rounded-md border border-grey-300 px-3 py-2 font-mono text-[14px]" />
      <div role="status" aria-live="polite" className="min-h-[2.5rem] rounded-md bg-grey-50 px-3 py-2 font-mono text-[15px]" data-testid="basic-calc-result">{r ? (r.ok ? `= ${r.value}` : <span className="text-red">{r.error}</span>) : " "}</div>
      <p className="text-[11.5px] text-grey-600">Use + − * / ( ) and decimals. Percent signs divide by 100 (write 5% as 5% or 0.05).</p>
    </div>
  );
}
