"use client";

import Script from "next/script";

// Calendly의 공식 embed 커스터마이징 파라미터(dashboard 밖에서도 임베드 쪽에서 강제 적용됨).
// 진하게(다크) 테마로 통일 — ALTON 브랜드 컬러(--ink/--red)에 맞춤.
const THEME_PARAMS = "background_color=1a1a1a&text_color=ffffff&primary_color=c8102e";

export default function CalendlyWidget({ url }: { url: string }) {
  const themedUrl = `${url}${url.includes("?") ? "&" : "?"}${THEME_PARAMS}`;

  return (
    <div>
      <div
        className="calendly-inline-widget"
        data-url={themedUrl}
        style={{ minWidth: "280px", height: "700px" }}
      />
      <Script src="https://assets.calendly.com/assets/external/widget.js" strategy="lazyOnload" />
    </div>
  );
}
