// 시각 검수 스냅샷 렌더러 — figure-qa-snapshot.test.ts 가 쓴 HTML 을 Playwright(Chromium)로 PNG 로 찍는다.
// 실행: node scripts/mock-exam-generation/figure-qa-render.mjs [조합ID접두사]
//   <조합ID>.png      데스크톱(720px, 배율 1.5)
//   <조합ID>.m375.png 모바일(375px, 배율 2)
import { chromium } from "@playwright/test";
import { readdirSync, mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const htmlDir = path.join(root, "data/mock-exam-generation/figure-qa/_html");
const outDir = path.join(root, "data/mock-exam-generation/figure-qa");
const prefix = process.argv[2] ?? "";
mkdirSync(outDir, { recursive: true });
const files = readdirSync(htmlDir).filter((f) => f.endsWith(".html") && f.startsWith(prefix));
if (!files.length) { console.error("HTML 이 없다 — 먼저 FIGURE_QA_SNAPSHOT=1 npx vitest run lib/problem-generation/math-archetypes/figure-qa-snapshot.test.ts --project unit"); process.exit(1); }
const browser = await chromium.launch();
try {
  for (const [name, w, dsf, suffix] of [["desktop", 720, 1.5, ""], ["mobile", 375, 2, ".m375"]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, deviceScaleFactor: dsf, colorScheme: "light" });
    const page = await ctx.newPage();
    for (const f of files) {
      await page.goto(pathToFileURL(path.join(htmlDir, f)).href);
      await page.screenshot({ path: path.join(outDir, f.replace(/\.html$/, `${suffix}.png`)), fullPage: true });
    }
    await ctx.close();
    console.log(`${name}: ${files.length} PNG`);
  }
} finally { await browser.close(); }
