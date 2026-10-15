"use client";

import { useEffect, useMemo, useState } from "react";
import { renderFigureSvg } from "@/lib/problem-figures/render";
import { validateFigureSpec, STATIC_IMAGE_BUCKET, type ImageFigureSpec } from "@/lib/problem-figures/spec";
import { getProblemImageUrlAction } from "./problem-image-actions";

/**
 * 문제의 도형·그래프(2026-09-14 문제 템플릿 ③). 저장된 것은 데이터고 SVG 는 여기서 만든다 —
 * 우리가 만든 마크업이라 그대로 넣는다. 데이터가 틀리면 학생에게는 조용히 빈 자리 대신 사유를 보인다
 * (교사가 초안에서 고칠 수 있어야 한다).
 * `text` = 문제 텍스트(지문·질문·선택지). 주면 본문에 나오지 않는 직선·곡선 라벨은 그리지 않는다(lib/problem-figures/label-rule.ts).
 */
export default function ProblemFigure({ spec, className, text }: { spec: unknown; className?: string; text?: string }) {
  const result = useMemo<{ error: string } | { image: ImageFigureSpec } | { svg: string } | null>(() => {
    if (spec === null || spec === undefined) return null;
    const v = validateFigureSpec(spec);
    if (!v.ok) return { error: v.error };
    if (v.spec.type === "image") return { image: v.spec };
    return { svg: renderFigureSvg(v.spec, text === undefined ? undefined : { text }) };
  }, [spec, text]);
  if (!result) return null;
  if ("image" in result) return <FigureImage spec={result.image} className={className} />;
  if ("error" in result) {
    return (
      <p className={"text-[12px] text-red " + (className ?? "")} data-testid="problem-figure-error">
        Couldn&apos;t read the figure data — {result.error}
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
  if (spec.bucket === STATIC_IMAGE_BUCKET) return <StaticFigureImage spec={spec} className={className} />;
  return <SignedFigureImage spec={spec} className={className} />;
}

/** 정적 실제 자료 이미지: public/ 에서 그대로 서빙하고 출처 표기를 항상 이미지 아래에 보인다.
 *  이미지를 누르면(탭하면) 원본 크기를 새 탭에서 열어 만평 글자·지도 범례를 확대해 읽을 수 있다(2026-10-15, 390px 화면에서 1024px 이미지는 글자가 작다).
 *  DBQ 처럼 이미지 자료가 여러 장이면 `more` 를 차례로 그리고 각 장에 라벨(Document N)을 붙인다. */
function StaticFigureImage({ spec, className }: { spec: ImageFigureSpec; className?: string }) {
  const items = [{ path: spec.path, alt: spec.alt, credit: spec.credit ?? "", label: spec.label }, ...(spec.more ?? [])];
  return (
    <div className={"flex flex-col gap-4 " + (className ?? "")} data-testid="problem-figure-set">
      {items.map((it, i) => (
        <figure key={it.path + i} className="problem-figure max-w-full m-0" data-testid="problem-figure">
          {it.label ? <p className="mb-1 text-[12.5px] font-bold text-ink" data-testid="figure-label">{it.label}</p> : null}
          <a href={"/" + it.path} target="_blank" rel="noopener noreferrer" aria-label={`${it.label ? it.label + ": " : ""}open the image full size in a new tab`} data-testid="figure-open-full" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={"/" + it.path} alt={it.alt ?? ""} style={{ maxWidth: i === 0 && spec.width ? `${spec.width}px` : "100%" }} className="max-w-full h-auto" />
          </a>
          <figcaption className="mt-1 text-[12px] leading-snug text-grey-500" data-testid="figure-credit">{it.credit}</figcaption>
          <p className="text-[11.5px] text-grey-500" data-testid="figure-enlarge-hint">Tap or click the image to open it full size.</p>
        </figure>
      ))}
    </div>
  );
}

function SignedFigureImage({ spec, className }: { spec: ImageFigureSpec; className?: string }) {
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
    return <p className={"text-[12px] text-red " + (className ?? "")} data-testid="problem-figure-error">Couldn&apos;t load the figure — {error}</p>;
  }
  if (!url) return <div className={"text-[12px] text-grey-500 " + (className ?? "")}>Loading figure…</div>;
  return (
    <div className={"problem-figure max-w-full " + (className ?? "")} data-testid="problem-figure">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={spec.alt ?? ""} style={{ maxWidth: spec.width ? `${spec.width}px` : "100%" }} className="max-w-full h-auto" />
    </div>
  );
}
