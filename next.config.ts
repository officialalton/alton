import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // 제품 분석 P0(2026-09-25) — VERCEL_ENV(시스템 환경변수)는 프로젝트의
  // "Automatically expose System Environment Variables" 설정에 따라 클라이언트
  // 번들 노출 여부가 달라진다. 그 설정에 기대지 않고 여기서 명시적으로
  // NEXT_PUBLIC_VERCEL_ENV로 복사해, 서버·클라이언트가 항상 같은 값을 보게
  // 한다(lib/analytics/config.ts가 이 값 하나로 production 여부를 판정한다).
  env: {
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? "",
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
