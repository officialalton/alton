"use client";

import { useEffect, useMemo, useState } from "react";
import { renderFigureSvg } from "@/lib/problem-figures/render";
import { validateFigureSpec, type ImageFigureSpec } from "@/lib/problem-figures/spec";
import { getProblemImageUrlAction } from "./problem-image-actions";

/**
 * 문제의 도형·그래프(2026-09-14 문제 템플릿 ③). 저장된 것은 데이터고 SVG 는 여기서 만든다 —
 * 우리가 만든 마크업이라 그대로 넣는다. 데이터가 틀리면 학생에게는 조용히 빈 자리 대신 사유를 보인다
 * (교사가 초안에서 고칠 수 있어야 한다).
 */
export default function ProblemFigure({ spec, className }: { spec: unknown; className?: string }) {
  const result = useMemo<{ error: string } | { image: ImageFigureSpec } | { svg: string } | null>(() => {
    if (spec === null || spec === undefined) return null;
    const v = validateFigureSpec(spec);
    if (!v.ok) return { error: v.error };
    if (v.spec.type === "image") return { image: v.spec };
    return { svg: renderFigureSvg(v.spec) };
  }, [spec]);
  if (!result) return null;
  if ("image" in result) return <FigureImage spec={result.image} className={className} />;
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

/** 올린 그림 파일 — 서명 URL 을 받아 그린다(만료 전 재요청). */
function FigureImage({ spec, className }: { spec: ImageFigureSpec; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const load = async () => {
      const r = await getProblemImageUrlAction(spec.bucket, spec.path);
      if (cancelled) return;
      if (r.ok) {
        setUrl(r.url);
        setError(null);
        timer = setTimeout(load, Math.max(30, r.expiresInSeconds - 60) * 1000);
      } else {
        setError(r.error);
      }
    };
    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [spec.bucket, spec.path]);
  if (error) {
    return <p className={"text-[12px] text-red " + (className ?? "")} data-testid="problem-figure-error">그림을 불러올 수 없습니다 — {error}</p>;
  }
  if (!url) return <div className={"text-[12px] text-grey-500 " + (className ?? "")}>그림을 불러오는 중…</div>;
  return (
    <div className={"problem-figure max-w-full " + (className ?? "")} data-testid="problem-figure">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={spec.alt ?? ""} style={{ maxWidth: spec.width ? `${spec.width}px` : "100%" }} className="max-w-full h-auto" />
    </div>
  );
}
