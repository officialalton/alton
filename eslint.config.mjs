import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 2026-09-23(발견) — 다른 세션들의 git worktree 전체 복사본(각각 완전한
    // 소스 트리 + 자체 .next 빌드 산출물 포함)이 lint 대상에 그대로 잡혀
    // "766개 문제"의 대부분이 이 중복 사본에서 나온 노이즈였다 — 실제
    // 작업 트리 기준 실제 문제 수와 무관.
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
