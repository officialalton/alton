"use client";

import Script from "next/script";

export default function CalendlyWidget({ url }: { url: string }) {
  return (
    <div>
      <div
        className="calendly-inline-widget"
        data-url={url}
        style={{ minWidth: "280px", height: "700px" }}
      />
      <Script src="https://assets.calendly.com/assets/external/widget.js" strategy="lazyOnload" />
    </div>
  );
}
