import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // 2026-09-23(발견) — 코드베이스 전반에 "의도적으로 안 쓰는 매개변수/변수는
  // `_` 접두어로 표시"하는 관례가 이미 퍼져 있었는데, no-unused-vars 규칙이
  // 이를 인식하도록 설정돼 있지 않아 같은 관례를 따른 곳들이 전부 lint 에러로
  // 잡히고 있었다 — 개별 파일을 고치는 대신 관례를 규칙에 반영한다.
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
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
