// 실제 작품 지문의 화면 배치 검증(2026-10-15, 로컬 목업·DB 없음). 실제 학생 화면(ApExamTakeClient)의 지문 칸 폭을 그대로 흉내 낸다:
//   모바일(390px) = section.px-4(내용 358px) / 데스크톱(1280px) = 절반 칸 640px · px-8(내용 576px). PassageBlock 은 실제 컴포넌트를 서버 렌더링한다.
// 사용: LABEL=before|after npx tsx scripts/ap-generation/englit-real-layout.tsx  → docs/ap/englit-layout/<id>-<w>-<label>.png + layout-<label>.json
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { chromium } from "@playwright/test";
import { PassageBlock } from "../../app/session/[id]/LearningText";
import { flatWithBreaks } from "../../lib/ap-exam/passage-lines";
import { realStanzas } from "../../lib/ap-generation/englit-real";
import type { Registry } from "../../lib/ap-generation/englit-sources";

const LABEL = process.env.LABEL ?? "before"; const SRC = path.resolve("data/ap/englit-sources"); const OUT = path.resolve("docs/ap/englit-layout"); mkdirSync(OUT, { recursive: true });
const TMP = path.resolve("tmp/layout"); rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true });
const reg = JSON.parse(readFileSync(path.join(SRC, "registry.json"), "utf-8")) as Registry; const IDS = (process.env.IDS ?? "").split(",").filter(Boolean);
const entries = reg.entries.filter((e) => !IDS.length || IDS.includes(e.id));
const WIDTHS = [{ w: 390, pane: "w-[390px]", pad: "px-4 py-4" }, { w: 1280, pane: "w-[640px]", pad: "px-8 py-6" }];
async function main() {
  const html = (e: (typeof entries)[number], v: (typeof WIDTHS)[number]) => { const lines = flatWithBreaks(realStanzas(e, readFileSync(path.join(SRC, e.text_file), "utf-8"))); const body = renderToStaticMarkup(<div className={v.pane}><section className={`min-w-0 ${v.pad}`}><div className="mb-1 font-sans text-[11px] text-grey-500">{e.title} - {e.author} ({v.w}px viewport; passage pane {v.w === 390 ? 358 : 576}px)</div><PassageBlock lines={lines} /></section></div>); return `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="app.css"></head><body style="margin:0;background:#fff">${body}</body></html>`; };
  for (const e of entries) for (const v of WIDTHS) writeFileSync(path.join(TMP, `${e.id}-${v.w}.html`), html(e, v));
  const base = readFileSync(path.resolve("app/globals.css"), "utf-8").replace(/@import "katex[^;]*;\n?/, "");
  const css = await postcss([tailwind()]).process(`${base}\n@source "${TMP}";\n`, { from: path.resolve("app/globals.css") }); writeFileSync(path.join(TMP, "app.css"), css.css);
  const browser = await chromium.launch(); const results: unknown[] = [];
  for (const e of entries) for (const v of WIDTHS) {
    const page = await browser.newPage({ viewport: { width: v.w, height: 900 } }); await page.goto(`file://${path.join(TMP, `${e.id}-${v.w}.html`)}`);
    const m = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('[data-testid="passage-line"]')]; const LH = 14 * 1.7;
      return rows.map((r, i) => { const [num, txt] = [r.children[0] as HTMLElement, r.children[1] as HTMLElement]; const tr = txt.getBoundingClientRect(); const nr = num.getBoundingClientRect(); const text = txt.textContent ?? "";
        const node = txt.firstChild as Text; let first = -1; let contLeft: number | null = null; let firstLeft: number | null = null; let rowsN = 1; let lastTop = -1;
        for (let k = 0; k < text.length; k++) { const rg = document.createRange(); rg.setStart(node, k); rg.setEnd(node, k + 1); const rc = rg.getClientRects()[0]; if (!rc || text[k] === " " && first < 0) continue; if (first < 0) { first = k; firstLeft = rc.left; lastTop = Math.round(rc.top); continue; } if (Math.round(rc.top) !== lastTop && text[k] !== " ") { rowsN++; lastTop = Math.round(rc.top); if (contLeft === null) contLeft = rc.left; } }
        const probe = document.createElement("span"); probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${getComputedStyle(txt).font}`; probe.textContent = text; document.body.append(probe); const natural = probe.getBoundingClientRect().width; probe.remove();
        return { i, natural: Math.round(natural), label: num.textContent, chars: text.length, rows: rowsN, heightRows: Math.round(tr.height / LH), numTopDelta: Math.round(nr.top - tr.top), textLeft: Math.round(tr.left), firstCharLeft: firstLeft === null ? null : Math.round(firstLeft), contLeft: contLeft === null ? null : Math.round(contLeft), scrollOverflow: Math.round(txt.scrollWidth - txt.clientWidth) };
      });
    });
    const labels = m.filter((x) => x.label).map((x) => `${x.label}@${x.i + 1}`);
    const wrapped = m.filter((x) => x.rows > 1);
    results.push({ id: e.id, width: v.w, counted_lines: m.length, labelled: labels, wrapped_lines: wrapped.length, max_rows_per_line: Math.max(...m.map((x) => x.rows)), max_chars: Math.max(...m.map((x) => x.chars)), natural_max_px: Math.max(...m.map((x) => x.natural)), text_column_px: v.w === 390 ? 326 : 544, numbers_aligned_with_first_row: m.every((x) => x.numTopDelta === 0), hanging_indent_px: wrapped.map((x) => (x.contLeft ?? 0) - (x.firstCharLeft ?? 0)), horizontal_overflow: m.some((x) => x.scrollOverflow > 0), per_line: wrapped.map((x) => ({ line: x.i + 1, chars: x.chars, rows: x.rows })) });
    await page.screenshot({ path: path.join(OUT, `${e.id}-${v.w}-${LABEL}.png`), fullPage: true }); await page.close();
  }
  await browser.close(); writeFileSync(path.join(OUT, `layout-${LABEL}.json`), JSON.stringify(results, null, 1) + "\n");
  for (const r of results as { id: string; width: number; counted_lines: number; wrapped_lines: number; max_rows_per_line: number; numbers_aligned_with_first_row: boolean; hanging_indent_px: number[] }[]) console.log(r.id, r.width, "lines", r.counted_lines, "wrapped", r.wrapped_lines, "maxRows", r.max_rows_per_line, "numAligned", r.numbers_aligned_with_first_row, "hang", [...new Set(r.hanging_indent_px)].join(","));
}
main().catch((err) => { console.error(err); process.exit(1); });
