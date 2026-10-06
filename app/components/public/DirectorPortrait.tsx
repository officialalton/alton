"use client";

import { useEffect, useRef, useState } from "react";
import { DIRECTOR } from "@/lib/landing/director";

/** 4:5 인물 사진. 파일이 없거나 로드에 실패하면(하이드레이션 전 실패 포함) 테마 이니셜 블록으로 대체한다. */
export default function DirectorPortrait() {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);
  if (failed) {
    return (
      <div role="img" aria-label={DIRECTOR.photoAlt} className="p-portrait p-portrait-fallback">
        <span className="p-serif" aria-hidden="true">{DIRECTOR.initials}</span>
      </div>
    );
  }
  return (
    <div className="p-portrait">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref}
        src={DIRECTOR.photoSrc}
        alt={DIRECTOR.photoAlt}
        width={800}
        height={1000}
        onError={() => setFailed(true)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
}
