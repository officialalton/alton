import type { NextConfig } from "next";
import path from "node:path";

// pdf.mjs 본체는 추적기가 이미 따라가므로, req.resolve 로만 찾는 워커 파일만 명시한다(.min.mjs 는 .map 이 없어 5MB 절감).
const PDF_FILES = ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs"];
// lib/curriculum-assets/pdf.ts · lib/universities/crawler.ts 를 번들에 포함하는 페이지(서버 액션은 import 한 페이지의 함수에서 실행된다).
// 주의: Turbopack 빌드는 이 키를 "/admin/page", "/student/page" 처럼 "/page" 가 붙은 엔트리 경로와 부분 일치(contains)로 비교한다. 짧게 "/admin" 으로 쓰면 /api/admin/*, /auth/admin-* 등 13개 라우트에 AP 재고 JSON 이 번진다(2026-10-14 실측). 반드시 "/…/page" 로 끝까지 쓴다. (exclude 의 node_modules 경로는 Turbopack 빌드에서 적용되지 않음을 확인.)
const PDF_ROUTES = ["/admin/universities/page", "/admin/students/*/roadmap/page", "/consultant/page", "/parent/page", "/student/page", "/teacher/page", "/teacher/student/*/roadmap/page"];

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
  // pdf.js(서버에서 PDF 페이지 수 읽기)는 자기 워커 파일(pdf.worker.min.mjs)을 실행 시점에 동적으로
  // 불러온다. 번들에 넣으면 그 파일이 빠져 "Setting up fake worker failed" 로 공개가 막힌다
  // (2026-09-14 Preview 재현). 외부 패키지로 두어 node_modules 에서 그대로 읽게 하고, 추적에
  // 워커 파일까지 포함시킨다.
  serverExternalPackages: ["pdfjs-dist"],
  // 함수 크기 절감(2026-10-14, docs/vercel-function-size.md): 라우트별 추적 포함/제외를 좁게 지정한다.
  // pdf.js 워커(pdf.worker.min.mjs)는 req.resolve 로 실행 시점에 찾으므로 PDF 를 실제로 읽는 라우트에만 넣는다.
  outputFileTracingIncludes: {
    ...Object.fromEntries(PDF_ROUTES.map((r) => [r, PDF_FILES])),
    // 관리자 'AP 재고 관리'(2026-10-12): 서버 액션이 저장소에 커밋된 재고 산출물을 파일로 읽는다(스크린샷 PNG 는 제외 — 화면 증거 JSON 만).
    "/admin/page": [...PDF_FILES, "./data/ap/stock/*.json", "./data/ap/stock/assembled/*.json","./data/ap/render-check/report.json", "./data/ap/screen-evidence/*.json", "./data/ap/curriculum-2027/*.json"],
  },
  // 런타임에 읽지 않는 저장소 자료(스크린샷·생성 로그·문서·스크립트)는 함수에 넣지 않는다. 서버 코드가
  // path.join(process.cwd(), "data/…") 처럼 동적 경로로 읽으면 추적기가 디렉터리 전체를 끌어오기 때문이다.
  // 남기는 것: docs/tickets.md(관리자 개발 로그), data/ap/stock·render-check/report.json·screen-evidence/*.json·curriculum-2027(AP 재고),
  // data/mock-exam-generation/figure-qa/*.json(그림 검수 해시 상태).
  outputFileTracingExcludes: {
    "/**": [
      "docs/**/*.{png,jpg,jpeg,webp,gif,svg,pdf,sql,csv,html}",
      "docs/ap/screen-evidence/**",
      "docs/assets/**",
      "docs/qa/**",
      "scripts/**",
      "supabase/**",
      "tmp/**",
      "data/**/*.{png,jpg,jpeg,webp,gif,svg,html,jsonl}",
      "data/audit/**",
      "data/explanation-en/**",
      "data/rw-generation/**",
      "data/ap/sample-2027/**",
      "data/ap/screen-evidence/*/**",
      "data/ap/render-check/*/**",
      "data/mock-exam-generation/{cb-hard,gapfill-*,inputs,math-archetype-*,mockgen-*,position-fix,rebalance-*,rw-*,unique-sets-*}/**",
      "data/mock-exam-generation/*.json",
    ],
  },
};

export default nextConfig;
