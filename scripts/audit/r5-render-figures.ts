// 라운드 5: 그림 확인 대기 10건을 저장소 렌더러(renderFigureSvg)로 SVG→PNG 로 그린다(읽기 전용 SELECT 만).
//   npx tsx scripts/audit/r5-render-figures.ts <outDir>
import { writeFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { renderFigureSvg } from "../../lib/problem-figures/render";
import { validateFigureSpec } from "../../lib/problem-figures/spec";
import { dbSelect } from "./apply-audit-fixes";

export const FIGURE_PATCHES = ["S-06", "S-07", "S-08", "F-f87e641a", "F-c27d0f37", "F-8329a1bd", "C-aaeb9945", "C-445bab61", "R2-M17", "R2-F-c5eb51a6"];
const out = process.argv[2] ?? "data/audit/r5-figures";
mkdirSync(out, { recursive: true });
const rows = dbSelect<{ patch: string; vid: string; figure_checked: boolean; passage: string | null; question: string | null; options: string[] | null; correct_index: number | null; figure: unknown }>(
  `select pv.quality->'auditFix'->>'patch' as patch, pv.id as vid, pv.figure_checked, pv.passage, pv.question, pv.options, pv.correct_index, pv.figure from problems p join problem_versions pv on pv.id = p.published_version_id where pv.quality->'auditFix'->>'patch' = any (array[${FIGURE_PATCHES.map((x) => `'${x}'`).join(",")}])`);
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 760, height: 600 }, deviceScaleFactor: 2 });
  for (const r of rows) {
    const v = validateFigureSpec(r.figure);
    const fig = v.ok ? v.spec : (r.figure as never);
    const svg = renderFigureSvg(fig, { text: `${r.passage ?? ""} ${r.question ?? ""}` });
    writeFileSync(`${out}/${r.patch}.html`, svg);
    await page.setContent(`<body style="margin:12px;background:#fff;font-family:Georgia,serif;width:720px">${svg}</body>`);
    await page.screenshot({ path: `${out}/${r.patch}.png`, fullPage: true });
    writeFileSync(`${out}/${r.patch}.json`, JSON.stringify({ vid: r.vid, figure_checked: r.figure_checked, passage: r.passage, question: r.question, options: r.options, correct_index: r.correct_index, figure: r.figure, specValid: v.ok }, null, 1));
    console.log(r.patch, r.figure_checked, v.ok);
  }
  await browser.close();
})();
