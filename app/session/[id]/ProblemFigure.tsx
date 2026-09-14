"use client";

import { useMemo } from "react";
import { renderFigureSvg } from "@/lib/problem-figures/render";
import { validateFigureSpec } from "@/lib/problem-figures/spec";

/**
 * 문제의 도형·그래프(2026-09-14 문제 템플릿 ③). 저장된 것은 데이터고 SVG 는 여기서 만든다 —
 * 우리가 만든 마크업이라 그대로 넣는다. 데이터가 틀리면 학생에게는 조용히 빈 자리 대신 사유를 보인다
 * (교사가 초안에서 고칠 수 있어야 한다).
 */
export default function ProblemFigure({ spec, className }: { spec: unknown; className?: string }) {
  const result = useMemo(() => {
    if (spec === null || spec === undefined) return null;
    const v = validateFigureSpec(spec);
    return v.ok ? { svg: renderFigureSvg(v.spec) } : { error: v.error };
  }, [spec]);
  if (!result) return null;
  if ("error" in result) {
    return (
      <p className={"text-[12px] text-red " + (className ?? "")} data-testid="problem-figure-error">
        그림 데이터를 읽을 수 없습니다 — {result.error}
      </p>
    );
  }
  return (
    <div
      className={"problem-figure max-w-full overflow-x-auto " + (className ?? "")}
      data-testid="problem-figure"
      dangerouslySetInnerHTML={{ __html: result.svg }}
    />
  );
}
