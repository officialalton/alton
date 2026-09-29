import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// 2026-09-11 — 예전 패턴("node_modules")은 루트 node_modules만 매칭해서 .claude/worktrees/*
// 안의 중첩 node_modules 테스트까지 흡수했다. 재귀 glob으로 항상 제외한다.
const SHARED_EXCLUDE = ["**/node_modules/**", "**/.next/**", "**/e2e/**", "**/.claude/worktrees/**"];

export default defineConfig({
  plugins: [react()],
  test: {
    // 2026-09-28 — DB 통합 테스트(*.integration.test.ts)는 모두 같은 로컬 Supabase와
    // 시드(선생님·과목·전역 게이트)를 공유한다. 파일 병렬로 돌리면 서로의 예약 슬롯·
    // 시드 회차·전역 트리거를 건드려 실행마다 다른 파일이 몇 개씩 실패했다(실측: 초기화
    // 직후 전체 실행 3회 1/6/12건, 매번 다른 파일). 단위 테스트는 기존대로 병렬, 통합
    // 테스트만 파일 순차(fileParallelism: false) 프로젝트로 나눈다 — 순차 실행 시 87파일
    // 884건 전부 통과(약 7분).
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          exclude: [...SHARED_EXCLUDE, "**/*.integration.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["**/*.integration.test.ts"],
          // lib/universities 통합 테스트는 별도 설정(vitest.integration.config.ts,
          // `npm run test:integration:universities`)으로만 돈다.
          exclude: [...SHARED_EXCLUDE, "lib/universities/**/*.integration.test.ts"],
          fileParallelism: false,
        },
      },
    ],
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "next/font/google": path.resolve(__dirname, "./test/next-font-google-mock.ts"),
      "@": path.resolve(__dirname, "."),
    },
  },
});
