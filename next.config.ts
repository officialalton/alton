import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // pdf.js(서버에서 PDF 페이지 수 읽기)는 자기 워커 파일(pdf.worker.mjs)을 실행 시점에 동적으로
  // 불러온다. 번들에 넣으면 그 파일이 빠져 "Setting up fake worker failed" 로 공개가 막힌다
  // (2026-09-14 Preview 재현). 외부 패키지로 두어 node_modules 에서 그대로 읽게 하고, 추적에
  // 워커 파일까지 포함시킨다.
  serverExternalPackages: ["pdfjs-dist"],
  outputFileTracingIncludes: {
    "/**": ["./node_modules/pdfjs-dist/legacy/build/**"],
  },
};

export default nextConfig;
