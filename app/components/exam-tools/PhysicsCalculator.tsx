"use client";

import { useState } from "react";
import { compileExpr } from "@/lib/problem-figures/templates/ap-expr";

// 공학용 계산기(4칙·거듭제곱·sin/cos/tan·ln/log/sqrt·pi·e). 삼각함수는 라디안이며 각도는 `30*deg` 로 입력한다. eval 없이 안전 파서를 쓴다.
export function evalScientific(src: string): { ok: true; value: string } | { ok: false; error: string } {
  if (!src.trim()) return { ok: false, error: "Enter an expression." };
  const c = compileExpr(src, ["deg"]);
  if (!c) return { ok: false, error: "Cannot read this expression." };
  try {
    const v = c.fn({ deg: Math.PI / 180 });
    if (!Number.isFinite(v)) return { ok: false, error: "Result is not a finite number." };
    const a = Math.abs(v);
    return { ok: true, value: a !== 0 && (a >= 1e6 || a < 1e-3) ? v.toExponential(6) : String(Number(v.toPrecision(10))) };
  } catch { return { ok: false, error: "Cannot compute this expression." }; }
}

export default function PhysicsCalculator() {
  const [src, setSrc] = useState("");
  const r = src.trim() ? evalScientific(src) : null;
  return (
    <div className="space-y-3 p-4" data-testid="physics-calculator">
      <label htmlFor="phys-calc-input" className="block text-[12px] font-bold text-grey-600">Scientific calculator</label>
      <input id="phys-calc-input" value={src} onChange={(e) => setSrc(e.target.value)} autoComplete="off" spellCheck={false} placeholder="e.g. sqrt(2*9.8*5) or sin(30*deg)" className="w-full rounded-md border border-grey-300 px-3 py-2 font-mono text-[14px]" />
      <div role="status" aria-live="polite" className="min-h-[2.5rem] rounded-md bg-grey-50 px-3 py-2 font-mono text-[15px]" data-testid="physics-calc-result">{r ? (r.ok ? `= ${r.value}` : <span className="text-red">{r.error}</span>) : " "}</div>
      <p className="text-[11.5px] text-grey-600">Use + − * / ^ ( ), sqrt, sin, cos, tan, ln, log, pi, e. Trigonometric functions use radians: write angles in degrees as <span className="font-mono">30*deg</span>.</p>
    </div>
  );
}
