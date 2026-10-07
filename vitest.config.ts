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
          // 2026-10-01 — 수학 원형 시드 스윕·소스 전수 스캔 같은 무거운 단위 테스트가 통합 프로젝트와 같이 돌 때
          // CPU 포화로 5초 기본 제한에 간헐적으로 걸렸다(매번 다른 테스트). 로직 결함이 아니라 시간 문제다.
          testTimeout: 30_000,
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
          // 2026-10-06 — 공개 버전 불변 트리거(20262100000240)는 세션 설정 alton.version_content_edit='on' 일 때만 내용 수정을 허용한다.
          // 통합 테스트 픽스처는 공개본을 직접 고쳐 상황을 만든다 — psql 연결에 이 설정을 켠다(bank-gate-hardening 테스트만 끈다).
          env: { PGOPTIONS: "-c alton.version_content_edit=on -c alton.skip_set_item_gate=on" },
          // 2026-10-01 — 동기 psql을 여러 번 부르는 테스트가 에이전트 병행 부하·데이터 누적 때
          // 5초 기본 제한에 간헐적으로 걸렸다(매번 다른 테스트). 로직 결함이 아니라 시간 문제다.
          testTimeout: 30_000,
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
