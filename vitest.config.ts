import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    // 2026-09-11 수정 — 예전 패턴("node_modules")은 루트 node_modules만
    // 매칭하고 .claude/worktrees/*/node_modules처럼 중첩된 경로는 걸러내지
    // 못해서, 스테일 워크트리가 남아있으면 그 안의 패키지(tsconfig-paths 등)
    // 번들 테스트까지 전체 스위트로 잘못 흡수돼 수백 개의 가짜 실패를
    // 만들었다(2026-09-11 실측). 재귀 glob으로 바꿔 항상 제외되게 한다.
    // lib/universities의 *.integration.test.ts만 별도 vitest.integration.config.ts
    // (파일 병렬성 꺼짐, `npm run test:integration:universities`)로 옮긴다 — 이 디렉터리의
    // 통합 테스트들만 university_refresh_jobs.status='running' 전역 카운트를 공유해서
    // 병렬 실행 시 경합이 났기 때문(2026-09-23 마무리 세션). 다른 디렉터리의 통합 테스트는
    // 그런 전역 공유 상태가 없으므로 기존대로 이 기본 설정(병렬)에 그대로 둔다.
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "**/e2e/**",
      "**/.claude/worktrees/**",
      "lib/universities/**/*.integration.test.ts",
    ],
  },
  resolve: {
    alias: {
      "next/font/google": path.resolve(__dirname, "./test/next-font-google-mock.ts"),
      "@": path.resolve(__dirname, "."),
    },
  },
});
