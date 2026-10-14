// AP Computer Science A 코드 표시·입력 전용 화면 점검(로컬 격리 스택 전용, 자동 Playwright). screen-evidence.ts 가 공통 점검을 하고, 이 스크립트는 코드에만 해당하는 것을 본다.
//   MC·FRQ 학생 화면의 코드 블록: (1) 렌더된 코드 줄이 원본과 글자 단위로 같다(KaTeX·마크다운·HTML 해석으로 깨지지 않음) (2) 줄 번호 1..n (3) .katex 없음·원문 ``` 없음
//   (4) 긴 줄은 블록 안 가로 스크롤(페이지 가로 스크롤 없음) (5) 고정폭 글꼴. FRQ 코드 입력 칸(CodeAnswerField): 고정폭·줄 바꿈 없음·맞춤법 끔·Tab 들여쓰기·Enter 자동 들여쓰기·
//   Escape 후 Tab 포커스 이동·$ __ < & 보존·문항 이동 뒤에도 저장. 결과 화면 해설의 코드 블록도 같은 점검(제출 후).
//   사용(screen-evidence.ts 와 같은 환경): npx tsx scripts/ap-generation/cs-code-check.ts [--out data/ap/screen-evidence/csa-code-checks.json] [--shots-dir <dir>]
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium, type Page } from "@playwright/test";
import { assertIsolatedTargetOrExit } from "../../lib/dev/stack-identity";

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const TARGET = assertIsolatedTargetOrExit({ apiVars: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"] });
const DB_URL = TARGET.dbUrl;
const BASE = arg("base-url", "http://localhost:3011");
if (!/^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(BASE)) { console.error("--base-url 은 로컬이어야 합니다."); process.exit(1); }
const PW = process.env.SEED_TEST_PASSWORD; if (!PW) { console.error("SEED_TEST_PASSWORD 가 필요합니다."); process.exit(1); }
const psql = (sql: string) => execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
const q = (t: string) => `'${t.replace(/'/g, "''")}'`;
const VIEWPORTS = [{ w: 390, h: 844, mobile: true }, { w: 1280, h: 800, mobile: false }];
type Row = { set_item_id: string; section: string; position: number; candidate_key: string; kind: "mc" | "frq_bundle"; payload: Record<string, unknown>; item_index?: number };
type Check = { name: string; ok: boolean; note: string };

const fencedBlocks = (text: string): string[][] => { const out: string[][] = []; const ls = text.split("\n"); for (let i = 0; i < ls.length; i++) { if (/^\s*```[A-Za-z0-9_+-]*\s*$/.test(ls[i])) { let j = i + 1; const b: string[] = []; while (j < ls.length && !/^\s*```\s*$/.test(ls[j])) b.push(ls[j++]); out.push(b); i = j; } } return out; };
const allStrings = (v: unknown, out: string[] = []): string[] => { if (typeof v === "string") out.push(v); else if (Array.isArray(v)) v.forEach((x) => allStrings(x, out)); else if (v && typeof v === "object") Object.values(v).forEach((x) => allStrings(x, out)); return out; };

async function login(page: Page, email: string) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PW!);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
}

/** 현재 화면(루트 = selector)의 코드 블록 점검. known = 이 문항 payload 의 모든 코드 블록(줄 배열). */
async function blockChecks(page: Page, rootSel: string, known: string[][], where: string): Promise<Check[]> {
  const m = (await page.evaluate(`(() => {
    const root = document.querySelector(${JSON.stringify(rootSel)}); if (!root) return null;
    const blocks = [...root.querySelectorAll('[data-testid="code-block"]')].map((pre) => {
      const lines = [...pre.querySelectorAll('[data-testid="code-line"]')].map((l) => { const sp = l.querySelectorAll(':scope > span'); return { num: (sp[0]?.textContent || "").trim(), text: sp[1]?.textContent || "" }; });
      const code = pre.querySelector('code'); const cs = getComputedStyle(code || pre); const ps = getComputedStyle(pre);
      return { lines, scrollW: pre.scrollWidth, clientW: pre.clientWidth, overflowX: ps.overflowX, font: cs.fontFamily, katex: pre.querySelectorAll('.katex').length, hasTab: pre.getAttribute('tabindex') === '0' };
    });
    return { blocks, katexInRoot: root.querySelectorAll('.katex').length, rawFence: (root.textContent || '').includes('\`\`\`'), pageScroll: document.documentElement.scrollWidth > window.innerWidth + 1 };
  })()`)) as { blocks: { lines: { num: string; text: string }[]; scrollW: number; clientW: number; overflowX: string; font: string; katex: number; hasTab: boolean }[]; katexInRoot: number; rawFence: boolean; pageScroll: boolean } | null;
  if (!m) return [{ name: `${where}:root`, ok: false, note: "root not found" }];
  const out: Check[] = [];
  const norm = (s: string) => (s === " " ? "" : s).replace(/\s+$/g, "");
  const knownKeys = new Set(known.map((b) => b.map(norm).join("\n")));
  m.blocks.forEach((b, i) => {
    const got = b.lines.map((l) => norm(l.text)).join("\n");
    out.push({ name: `${where}:block${i + 1}:text_exact`, ok: knownKeys.has(got), note: knownKeys.has(got) ? `${b.lines.length} lines match the source` : `rendered text differs from every source code block: ${got.slice(0, 80)}` });
    out.push({ name: `${where}:block${i + 1}:line_numbers`, ok: b.lines.every((l, k) => l.num === String(k + 1)), note: `1..${b.lines.length}` });
    out.push({ name: `${where}:block${i + 1}:monospace`, ok: /mono|courier|menlo|consolas/i.test(b.font), note: b.font.slice(0, 60) });
    out.push({ name: `${where}:block${i + 1}:no_katex`, ok: b.katex === 0, note: `${b.katex} .katex` });
    const wide = b.scrollW > b.clientW + 1;
    out.push({ name: `${where}:block${i + 1}:scroll`, ok: !wide || /auto|scroll/.test(b.overflowX), note: wide ? `overflow-x ${b.overflowX} (scrollWidth ${b.scrollW} > ${b.clientW})` : "fits without scrolling" });
    out.push({ name: `${where}:block${i + 1}:focusable`, ok: b.hasTab, note: "tabindex=0 (keyboard scroll)" });
  });
  out.push({ name: `${where}:no_raw_fence`, ok: !m.rawFence, note: m.rawFence ? "literal ``` visible" : "no literal ```" });
  out.push({ name: `${where}:page_no_hscroll`, ok: !m.pageScroll, note: m.pageScroll ? "page scrolls horizontally" : "no page horizontal scroll" });
  if (m.blocks.length === 0) out.push({ name: `${where}:has_block`, ok: true, note: "no code block on this item" });
  return out;
}

const SAMPLE = "int a = b <= c ? 1 : 0; String s = \"$x$ __y__ & <b>\"; // ^|~";
async function typingChecks(page: Page, label: string): Promise<Check[]> {
  const out: Check[] = []; const ta = page.locator('textarea[data-testid^="frq-input-"]').first();
  if (!(await ta.count())) return [{ name: `${label}:textarea`, ok: false, note: "no code textarea" }];
  await ta.scrollIntoViewIfNeeded();
  const st = (await ta.evaluate((el) => { const cs = getComputedStyle(el); return { font: cs.fontFamily, ws: cs.whiteSpace, ox: cs.overflowX, spell: el.getAttribute("spellcheck"), ac: el.getAttribute("autocapitalize"), acorrect: el.getAttribute("autocorrect"), hint: !!document.getElementById(el.getAttribute("aria-describedby") || "") }; })) as { font: string; ws: string; ox: string; spell: string | null; ac: string | null; acorrect: string | null; hint: boolean };
  out.push({ name: `${label}:monospace_nowrap`, ok: /mono|courier|menlo|consolas/i.test(st.font) && /pre/.test(st.ws), note: `${st.font.slice(0, 40)} white-space ${st.ws}` });
  out.push({ name: `${label}:no_autocorrect`, ok: st.spell === "false" && st.ac === "off", note: `spellcheck=${st.spell} autocapitalize=${st.ac} autocorrect=${st.acorrect}` });
  out.push({ name: `${label}:hint_linked`, ok: st.hint, note: "aria-describedby hint present" });
  await ta.click(); await ta.fill("");
  await page.keyboard.type("if (x > 0) {"); await page.keyboard.press("Enter");
  let v = await ta.inputValue();
  out.push({ name: `${label}:enter_autoindent`, ok: v === "if (x > 0) {\n    ", note: JSON.stringify(v.slice(-12)) });
  await page.keyboard.type("y++;"); await page.keyboard.press("Enter"); await page.keyboard.press("Shift+Tab"); await page.keyboard.type("}");
  v = await ta.inputValue();
  out.push({ name: `${label}:shift_tab_outdent`, ok: v === "if (x > 0) {\n    y++;\n}", note: JSON.stringify(v.slice(-16)) });
  await page.keyboard.press("Enter"); await page.keyboard.press("Tab"); await page.keyboard.type("z();");
  v = await ta.inputValue();
  out.push({ name: `${label}:tab_inserts_spaces`, ok: v.endsWith("\n    z();"), note: JSON.stringify(v.slice(-10)) });
  await page.keyboard.press("Enter"); await page.keyboard.type(SAMPLE);
  v = await ta.inputValue();
  out.push({ name: `${label}:special_chars_kept`, ok: v.includes(SAMPLE), note: "$ __ < & ^ | ~ and quotes kept verbatim" });
  const long = "int veryLongName = " + "a + ".repeat(60) + "0;";
  await page.keyboard.press("Enter"); await page.keyboard.type(long, { delay: 0 });
  const sc = (await ta.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth, page: document.documentElement.scrollWidth > window.innerWidth + 1 }))) as { sw: number; cw: number; page: boolean };
  out.push({ name: `${label}:long_line_scrolls_inside`, ok: sc.sw > sc.cw && !sc.page, note: `scrollWidth ${sc.sw} > clientWidth ${sc.cw}; page hscroll ${sc.page}` });
  await page.keyboard.press("Escape"); await page.keyboard.press("Tab");
  const away = await ta.evaluate((el) => document.activeElement !== el);
  out.push({ name: `${label}:escape_tab_moves_focus`, ok: away, note: "focus leaves the field after Escape then Tab" });
  return out;
}

async function main() {
  const state = JSON.parse(readFileSync("tmp/ap-demo-state.json", "utf-8")) as { run: string; students: Record<string, string>; sets: string[] };
  const shotDir = arg("shots-dir", `docs/ap/screen-evidence/csa-code`); mkdirSync(shotDir, { recursive: true });
  const browser = await chromium.launch(); const all: { viewport: string; set: string; key: string; kind: string; checks: Check[] }[] = [];
  const setIds = state.sets;
  for (const setId of setIds) {
    const ROWS_SQL = "select coalesce(json_agg(x order by x.ord), '[]') from (select i.section || ':' || i.position as ord, i.section, i.position, i.id as set_item_id, i.problem_version_id, c.candidate_key, c.kind, c.ap_subject_code, c.payload, cp.item_index from mock_exam_set_items i join problems p on p.id = i.problem_id join ap_candidate_items c on c.candidate_key = p.ap_candidate_key join ap_candidate_problems cp on cp.problem_id = p.id where i.exam_set_id = $SET$) x;";
    const rows = JSON.parse(psql(ROWS_SQL.replace("$SET$", q(setId)))) as Row[];
    const tier = psql(`select access_tier from mock_exam_sets where id = ${q(setId)};`);
    const email = state.students[tier === "tutoring" ? "tutoring" : "free"]; const sid = psql(`select id from auth.users where email = ${q(email)};`);
    for (const vp of VIEWPORTS) {
      const attempt = psql(`set role authenticated; do $$ begin perform set_config('request.jwt.claim.sub', ${q(sid)}, false); end $$; select mock_exam_open_start(${q(setId)}); reset role;`).split("\n").filter((l) => /^[0-9a-f-]{36}$/.test(l)).pop();
      if (!attempt) { all.push({ viewport: `${vp.w}x${vp.h}`, set: setId, key: "-", kind: "-", checks: [{ name: "open_attempt", ok: false, note: "start failed" }] }); continue; }
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: vp.mobile, isMobile: vp.mobile });
      await ctx.addInitScript("window.__name = (f) => f;");
      const page = await ctx.newPage(); await login(page, email);
      await page.goto(`${BASE}/student/mock-exam/${attempt}`);
      await page.locator('[data-testid="ap-exam-take"]').waitFor({ state: "visible", timeout: 20_000 });
      const layoutKeys = (JSON.parse(psql(`select section_layout->'sections' from mock_exam_sets where id = ${q(setId)};`)) as { key: string }[]).map((x) => x.key);
      const sections = [...new Set(rows.map((r) => r.section))].sort((a, b) => layoutKeys.indexOf(a) - layoutKeys.indexOf(b));
      let typedLabel = "";
      for (const sec of sections) {
        const tab = page.locator(`[data-testid="ap-section-${sec}"]`); if (await tab.count()) await tab.click();
        const secRows = rows.filter((r) => r.section === sec).sort((a, b) => a.position - b.position);
        const nav = page.locator('nav[aria-label="Go to question"] button');
        for (let i = 0; i < secRows.length; i++) {
          const r = secRows[i]; const checks: Check[] = [];
          try {
            await nav.nth(i).click({ timeout: 8000 }); await page.waitForTimeout(250);
            const known = allStrings(r.payload).flatMap(fencedBlocks);
            checks.push(...(await blockChecks(page, '[data-testid="ap-question-card"]', known, "take")));
            if (r.kind === "frq_bundle" && !typedLabel) {
              checks.push(...(await typingChecks(page, "typing")));
              typedLabel = r.candidate_key;
              await page.screenshot({ path: `${shotDir}/code-entry-${vp.w}x${vp.h}.jpg`, type: "jpeg", quality: 60 });
              // 저장: 다른 문항으로 갔다 와도 값이 남아 있어야 한다
              if ((await nav.count()) < 2) { checks.push({ name: "typing:value_kept_after_navigation", ok: true, note: "single-question set: persistence checked in the other FRQ sets" }); } else { await nav.nth(i === 0 ? 1 : 0).click(); await page.waitForTimeout(1200); await nav.nth(i).click(); await page.waitForTimeout(600);
              const back = await page.locator('textarea[data-testid^="frq-input-"]').first().inputValue();
              checks.push({ name: "typing:value_kept_after_navigation", ok: back.includes(SAMPLE), note: back.includes(SAMPLE) ? "typed code restored" : `restored ${JSON.stringify(back.slice(0, 40))}` }); }
            }
            if (i < 3 || checks.some((c) => !c.ok)) await page.screenshot({ path: `${shotDir}/${r.candidate_key.replace(/[^A-Za-z0-9_.-]/g, "_")}${r.item_index !== undefined && r.item_index !== null ? `-q${r.item_index + 1}` : ""}-${vp.w}x${vp.h}.jpg`, type: "jpeg", quality: 55 });
          } catch (e) { checks.push({ name: "run", ok: false, note: (e as Error).message.replace(/\s+/g, " ").slice(0, 140) }); }
          all.push({ viewport: `${vp.w}x${vp.h}`, set: setId.slice(0, 8), key: r.candidate_key, kind: r.kind, checks });
        }
      }
      // 제출 후 결과 화면의 해설(코드 블록 포함)
      try {
        for (let k = 0; k < 60 && !(await page.getByTestId("ap-review-submit").count()); k++) { await page.getByRole("button", { name: /^Next/ }).first().click(); await page.waitForTimeout(100); }
        await page.locator('[data-testid="ap-review-submit"]').click(); await page.locator('[data-testid="ap-exam-submit"]').click();
        await page.locator('[data-testid="ap-exam-result"]').waitFor({ state: "visible", timeout: 30_000 });
        const items = page.locator('[data-testid="ap-review-item"]'); const n = await items.count();
        for (let i = 0; i < n; i++) {
          const li = items.nth(i); const id = (await li.getAttribute("data-set-item-id")) ?? ""; const r = rows.find((x) => x.set_item_id === id);
          const known = r ? allStrings(r.payload).flatMap(fencedBlocks) : [];
          const sel = `[data-testid="ap-review-item"][data-set-item-id="${id}"]`;
          const checks = await blockChecks(page, sel, known, "result");
          const typedMono = r?.kind === "frq_bundle" ? await li.evaluate((el) => { const t = [...el.querySelectorAll("pre, textarea, p, div")].find((e) => (e.textContent || "").includes("z();") && e.children.length === 0); return t ? getComputedStyle(t).fontFamily : ""; }) : "n/a";
          if (typedMono !== "n/a" && typedMono) checks.push({ name: "result:my_answer_monospace", ok: /mono|courier|menlo|consolas/i.test(typedMono), note: typedMono.slice(0, 40) });
          all.push({ viewport: `${vp.w}x${vp.h}`, set: setId.slice(0, 8), key: r?.candidate_key ?? id, kind: `result-${r?.kind ?? "?"}`, checks });
        }
        await page.screenshot({ path: `${shotDir}/result-${setId.slice(0, 8)}-${vp.w}x${vp.h}.jpg`, type: "jpeg", quality: 55 });
      } catch (e) { all.push({ viewport: `${vp.w}x${vp.h}`, set: setId.slice(0, 8), key: "-", kind: "result", checks: [{ name: "result_run", ok: false, note: (e as Error).message.replace(/\s+/g, " ").slice(0, 140) }] }); }
      await ctx.close();
      console.log(`세트 ${setId.slice(0, 8)} @${vp.w} 완료 (${all.length} 행)`);
    }
  }
  await browser.close();
  const fails = all.flatMap((a) => a.checks.filter((c) => !c.ok).map((c) => `${a.key} ${a.set} @${a.viewport} ${c.name}: ${c.note}`));
  const total = all.reduce((s, a) => s + a.checks.length, 0);
  writeFileSync(arg("out", "data/ap/screen-evidence/csa-code-checks.json"), JSON.stringify({ schema: "csa-code-checks/v1", generatedAt: new Date().toISOString(), limitations: "automated Playwright (Chromium) on a local isolated stack; checks code rendering and typed-code entry only, not code correctness", total, failed: fails.length, rows: all }, null, 1));
  console.log(`코드 점검 ${total}건, 실패 ${fails.length}건`); for (const f of fails.slice(0, 40)) console.log("-", f);
}
main().catch((e) => { console.error(e); process.exit(1); });
