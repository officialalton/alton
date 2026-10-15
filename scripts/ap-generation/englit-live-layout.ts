// 반응형 줄 번호 검증(2026-10-15, 로컬·DB 없음): 실제 LearningText 를 Chromium 에서 클라이언트 렌더링해 폭마다 (a) 번호가 화면의 세는 행과 일치하는지 (b) 문항 속 'lines a-b' 가 화면 번호로 바뀌는지 잰다.
// 사용: IDS=a,b npx tsx scripts/ap-generation/englit-live-layout.ts → docs/ap/englit-layout/live-<id>-<w>-<mode>.png + live-layout.json
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { build } from "vite";
import { chromium } from "@playwright/test";
import { countedLines, litPassageDisplay, flatWithBreaks } from "../../lib/ap-exam/passage-lines";
import { realStanzas } from "../../lib/ap-generation/englit-real";
import type { Registry } from "../../lib/ap-generation/englit-sources";

const SRC = path.resolve("data/ap/englit-sources"); const OUT = path.resolve("docs/ap/englit-layout"); const TMP = path.resolve("tmp/live"); mkdirSync(OUT, { recursive: true }); rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true });
const IDS = (process.env.IDS ?? "chopin-silk-stockings,chekhov-lady-dog,crane-open-boat,ibsen-dolls-house,whitman-spider").split(",");
const WIDTHS = [{ w: 390, pane: 358 }, { w: 768, pane: 736 }, { w: 1280, pane: 576 }];
async function main() {
  const reg = JSON.parse(readFileSync(path.join(SRC, "registry.json"), "utf-8")) as Registry;
  await build({ configFile: false, logLevel: "error", root: path.resolve("."), resolve: { alias: { "@": path.resolve(".") } }, define: { "process.env.NODE_ENV": '"production"' }, oxc: { jsx: { runtime: "automatic" } },
    build: { outDir: TMP, emptyOutDir: false, minify: false, rollupOptions: { input: path.resolve("scripts/ap-generation/englit-live-harness.tsx"), output: { format: "iife", entryFileNames: "h.js", inlineDynamicImports: true } } } } as never);
  const base = readFileSync(path.resolve("app/globals.css"), "utf-8").replace(/@import "katex[^;]*;\n?/, "");
  writeFileSync(path.join(TMP, "app.css"), (await postcss([tailwind()]).process(`${base}\n@source "${path.resolve("app/session/[id]/LearningText.tsx")}";\n@source "${path.resolve("scripts/ap-generation/englit-live-harness.tsx")}";\n`, { from: path.resolve("app/globals.css") })).css);
  writeFileSync(path.join(TMP, "p.html"), `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="app.css"></head><body style="margin:0;background:#fff"><div id="pane" style="padding:16px"><div id="app"></div></div><script src="h.js"></script></body></html>`);
  const browser = await chromium.launch(); const results: unknown[] = [];
  for (const id of IDS) {
    const e = reg.entries.find((x) => x.id === id)!; const stanzas = realStanzas(e, readFileSync(path.join(SRC, e.text_file), "utf-8")); const cl = countedLines(stanzas);
    const refs = [[Math.min(7, cl.length), Math.min(9, cl.length)], [Math.min(15, cl.length), Math.min(15, cl.length)], [Math.max(1, cl.length - 4), cl.length]];
    const stems = refs.map(([a, b]) => `The passage (${a === b ? "line" : "lines"} ${a}${a === b ? "" : "-" + b}) suggests`);
    const passage = litPassageDisplay({ title: e.title, stanzas }); void flatWithBreaks;
    for (const variant of ["before", "after", "resize"] as const) for (const v of variant === "resize" ? [WIDTHS[0]] : WIDTHS) {
      const legacy = variant === "before";
      const page = await browser.newPage({ viewport: { width: v.w, height: 900 } }); await page.addInitScript("window.__name = (f) => f;"); await page.goto(`file://${path.join(TMP, "p.html")}`);
      await page.evaluate((w) => { (document.getElementById("pane") as HTMLElement).style.width = w + 32 + "px"; }, variant === "resize" ? 576 : v.pane);
      await page.evaluate(([c, l]) => window.__mount(c as never, l as unknown as boolean), [{ passage, stems }, legacy] as unknown as [never, never]);
      await page.waitForTimeout(250);
      if (variant === "resize") { await page.evaluate((w) => { (document.getElementById("pane") as HTMLElement).style.width = w + 32 + "px"; }, v.pane); await page.waitForTimeout(400); }
      const r = await page.evaluate(({ cl, refs }: { cl: string[]; refs: number[][] }) => {
        const host = document.querySelector('[data-testid="lit-passage"]') as HTMLElement; const rg = document.createRange();
        // 화면 행: 숨김(aria-hidden) 밖의 모든 글자 노드를 단어 단위로 훑어 행 상단을 모은다
        const tw = document.createTreeWalker(host, NodeFilter.SHOW_TEXT); const nodes: Text[] = []; for (let n = tw.nextNode(); n; n = tw.nextNode()) { if (!(n.parentElement as HTMLElement).closest('[aria-hidden="true"]')) nodes.push(n as Text); }
        const tops: number[] = []; const words: { node: Text; off: number; len: number; top: number; text: string }[] = [];
        for (const n of nodes) { const re = /\S+/g; let m: RegExpExecArray | null; while ((m = re.exec(n.data))) { rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length); const rc = (window as unknown as { __origRects: () => DOMRectList }).__origRects.call(rg)[0]; const t = Math.round(rc.top + window.scrollY); words.push({ node: n, off: m.index, len: m[0].length, top: t, text: m[0] }); tops.push(t); } }
        const uniq = [...new Set(tops)].sort((a, b) => a - b).reduce<number[]>((acc, t) => (acc.length && t - acc[acc.length - 1] <= 3 ? acc : [...acc, t]), []);
        const rowIdx = (t: number) => uniq.findIndex((u) => Math.abs(u - t) <= 3) + 1;
        const nums = [...host.querySelectorAll('[data-testid="passage-number"], [data-testid="passage-line"] > span[aria-hidden="true"]')].map((s) => ({ el: s as HTMLElement, label: (s.textContent ?? "").trim() })).filter((x) => x.label);
        const numRows = nums.map((x) => { const nr = x.el.getBoundingClientRect(); const lineTop = nr.top + window.scrollY; const near = uniq.reduce((b, u) => (Math.abs(u - lineTop) < Math.abs(b - lineTop) ? u : b), uniq[0]); return { label: Number(x.label), row: rowIdx(near), dy: Math.round(Math.abs(near - lineTop)) }; });
        const stemsOut = [...document.querySelectorAll(".stem")].map((s) => s.textContent ?? "");
        // 인용 줄(옛 줄 a..b)의 첫 단어·끝 단어가 놓인 화면 행
        const all = words.map((w) => w.text); const joined = all.join(" ");
        const rowsOfLines = refs.map(([a, b]) => { const first = cl[a - 1].trim().split(/\s+/); const last = cl[b - 1].trim().split(/\s+/); const find = (seq: string[], from = 0) => { for (let i = from; i + seq.length <= all.length; i++) { let ok = true; for (let j = 0; j < seq.length; j++) if (all[i + j] !== seq[j]) { ok = false; break; } if (ok) return i; } return -1; }; const i0 = find(first); const i1 = find(last, Math.max(0, i0)); return i0 < 0 || i1 < 0 ? null : { from: rowIdx(words[i0].top), to: rowIdx(words[i1 + last.length - 1].top) }; });
        return { rows: uniq.length, numRows, stemsOut, rowsOfLines, chars: joined.length };
      }, { cl, refs });
      const labelsMatchRows = r.numRows.every((n) => n.label === n.row && n.dy <= 4);
      const gaps = r.numRows.slice(1).map((n, i) => n.row - r.numRows[i].row);
      const refOk = r.stemsOut.map((s, i) => { const x = r.rowsOfLines[i]; if (!x) return null; const m = /line(?:s)? (\d+)(?:-(\d+))?/.exec(s); if (!m) return false; const a = Number(m[1]); const b = m[2] ? Number(m[2]) : a; return a === x.from && b === x.to; });
      results.push({ id, width: v.w, pane_px: v.pane, mode: variant === "before" ? "before(56-char rows)" : variant === "after" ? "after(measured)" : "after-resize(pane 576->358)", counted_visual_rows: r.rows, legacy_counted_lines: cl.length, numbers: r.numRows.map((n) => n.label), number_row_gaps: gaps, numbers_match_visual_rows: labelsMatchRows, stems: r.stemsOut, refs_match_displayed_rows: refOk });
      await page.screenshot({ path: path.join(OUT, `live-${id}-${v.w}-${variant}.png`), fullPage: true }); await page.close();
    }
  }
  await browser.close(); writeFileSync(path.join(OUT, "live-layout.json"), JSON.stringify(results, null, 1) + "\n");
  for (const r of results as { id: string; width: number; mode: string; counted_visual_rows: number; legacy_counted_lines: number; number_row_gaps: number[]; numbers_match_visual_rows: boolean; refs_match_displayed_rows: (boolean | null)[]; stems: string[] }[]) console.log(r.id, r.width, r.mode.slice(0, 6), "visualRows", r.counted_visual_rows, "/legacy", r.legacy_counted_lines, "gaps", [...new Set(r.number_row_gaps)].join(","), "numMatch", r.numbers_match_visual_rows, "refs", r.refs_match_displayed_rows.join(","), "|", r.stems.map((s) => s.replace("The passage ", "").replace(" suggests", "")).join(" "));
}
main().catch((err) => { console.error(err); process.exit(1); });
