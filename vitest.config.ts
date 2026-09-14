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
    exclude: ["**/node_modules/**", "**/.next/**", "**/e2e/**", "**/.claude/worktrees/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
