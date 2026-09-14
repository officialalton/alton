import { defineConfig, devices } from "@playwright/test";

// .env.local은 Next dev 서버(webServer) 프로세스에는 자동 로드되지만, Playwright
// 테스트 러너 자체 프로세스(process.env)에는 로드되지 않는다. DOCUSIGN_WEBHOOK_TOKEN
// 같은 값을 테스트 스킵 가드에서 참조하는 스펙(e2e/r3-*.spec.ts)이 있어, 로컬 실행 시
// 조용히 스킵되는 걸 막기 위해 여기서 명시적으로 로드한다. 없으면 무시(CI 등).
try {
  process.loadEnvFile(require("path").resolve(process.cwd(), ".env.local"));
} catch {
  // .env.local이 없는 환경(CI 등)에서는 조용히 무시한다.
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3010",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- -p 3010",
    url: "http://localhost:3010",
    reuseExistingServer: !process.env.CI,
  },
});
