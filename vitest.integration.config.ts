import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// *.integration.test.ts 전용 설정. 이 테스트들은 실제 로컬 supabase(127.0.0.1:54421)에
// 대고 university_refresh_jobs.status='running' 전역 카운트로 동시 실행 한도(3)를 체크한다
// (대학별이 아니라 전역 세마포어 — lib/universities/refresh-actions.ts MAX_CONCURRENT_JOBS
// 참고). vitest 기본값(파일별 병렬 실행)으로 여러 integration 테스트 파일이 동시에 돌면
// 그 전역 카운터를 서로 갈아타며 간헐적으로 "queued"에 머무는 채로 끝나 단정문이 실패할 수
// 있다(2026-09-23 마무리 세션 실측). 마이그레이션/시딩까지 건드리는 통합 테스트라 파일 간
// 격리 보장도 약하므로, 파일 병렬성을 꺼서 한 번에 하나씩만 돈다.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    // lib/universities로만 한정한다 — 이 디렉터리 밖의 통합 테스트(예: app/session)는
    // 전역 상태를 공유하지 않으므로 기존 vitest.config.ts(병렬)로 그대로 돌린다.
    include: ["lib/universities/**/*.integration.test.ts"],
    exclude: ["**/node_modules/**", "**/.next/**", "**/e2e/**", "**/.claude/worktrees/**"],
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
