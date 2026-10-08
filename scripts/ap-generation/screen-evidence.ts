// AP 학생 화면 검증 증거 생성기(로컬 전용). 로컬 시드 세트(local-demo-seed.ts)를 실제 학생 응시 화면(/student/mock-exam/<attempt>)에서 Playwright 로 열어
// 문항마다 필수 점검(보기·그림/표 렌더·가림 없음·제출 전 정답/해설 비노출·FRQ 입력)을 실제로 실행하고 그 결과를 증거 JSON 으로 쓴다.
//   1) 격리 스택 + 마이그레이션 + 시드:   SEED_TEST_PASSWORD=<로컬값> npx tsx scripts/ap-generation/local-demo-seed.ts seed
//   2) 대상 DB 를 가리키는 dev 서버:       NEXT_PUBLIC_SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=… SUPABASE_SECRET_KEY=… npm run dev -- -p 3011
//   3) 생성:                              SEED_TEST_PASSWORD=<로컬값> SUPABASE_TEST_DB_URL=postgresql://postgres:postgres@127.0.0.1:<DB포트>/postgres npx tsx scripts/ap-generation/screen-evidence.ts [--base-url http://localhost:3011] [--out tmp/ap-screen-evidence.json]
// 증거의 content_hash 는 화면에 띄운 문제 버전의 후보 payload 해시(render 보고서와 같은 sha256)이며, 같은 payload 를 가진 재고 후보 키(stockKey)마다 항목을 만든다.
// 비밀번호·키는 출력하지 않는다. DB URL 이 로컬이 아니면 중단.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";
import { gateCandidate } from "../../lib/ap-figures/gate";
import { itemContentHash, SCREEN_CHECKS, type ScreenCheck, type ScreenCheckName, type ScreenEntry } from "../../lib/ap-generation/verify-guard";

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "";
if (!/^postgres(ql)?:\/\/[^@]*@(127\.0\.0\.1|localhost)[:/]/.test(DB_URL)) { console.error("SUPABASE_TEST_DB_URL 이 로컬 DB 가 아닙니다. 중단."); process.exit(1); }
const BASE = arg("base-url", "http://localhost:3011");
if (!/^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(BASE)) { console.error("--base-url 은 로컬이어야 합니다."); process.exit(1); }
const PW = process.env.SEED_TEST_PASSWORD; if (!PW) { console.error("SEED_TEST_PASSWORD 가 필요합니다."); process.exit(1); }
const psql = (sql: string) => execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
const q = (t: string) => `'${t.replace(/'/g, "''")}'`;
const VIEWPORTS = [{ w: 390, h: 844, mobile: true }, { w: 1280, h: 800, mobile: false }];

type Row = { section: string; position: number; problem_version_id: string; candidate_key: string; kind: "mc" | "frq_bundle"; ap_subject_code: string; payload: Record<string, unknown> };

async function login(page: Page, email: string) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PW!);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
}

async function checkItem(page: Page, r: Row, shot: string): Promise<Record<ScreenCheckName, ScreenCheck>> {
  const root = page.locator('[data-testid="ap-exam-take"]');
  await root.waitFor({ state: "visible", timeout: 20_000 });
  const g = gateCandidate({ candidateKey: r.candidate_key, apSubjectCode: r.ap_subject_code, kind: r.kind, payload: r.payload as never });
  const p = r.payload as { options?: unknown[]; parts?: unknown[]; explanation_en?: string };
  const out = {} as Record<ScreenCheckName, ScreenCheck>;
  const m = await page.evaluate(({ expectFig }) => {
    const root = document.querySelector('[data-testid="ap-exam-take"]')!;
    const vw = window.innerWidth;
    const scrollable = (el: Element) => { for (let e: Element | null = el.parentElement; e && e !== document.body; e = e.parentElement) { const o = getComputedStyle(e).overflowX; if (o === "auto" || o === "scroll") return true; } return false; };
    const inside = (el: Element) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.left >= -1 && b.right <= vw + 1; };
    const vis = (el: Element) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
    const opts = [...root.querySelectorAll('[data-testid^="ap-option-"]')];
    const inputs = [...root.querySelectorAll('[data-testid^="frq-input-"]')];
    const figs = [...root.querySelectorAll("svg, table, img")].filter((e) => !e.closest("nav") && !e.closest("button") && (e.tagName === "TABLE" ? e.getBoundingClientRect().width >= 60 && e.getBoundingClientRect().height >= 40 : e.getBoundingClientRect().width >= 120 && e.getBoundingClientRect().height >= 60));
    const clip = [...opts, ...inputs, ...figs].filter((e) => !inside(e) && !scrollable(e)).length;
    const text = (document.body.innerText || "").toLowerCase();
    return { optCount: opts.length, optVisible: opts.filter(vis).length, optTextEmpty: opts.filter((o) => !(o.textContent ?? "").trim()).length, inputCount: inputs.length, inputVisible: inputs.filter(vis).length, figCount: figs.length, figVisible: figs.filter(vis).length, hScroll: document.documentElement.scrollWidth > vw + 1, clip, leaked: /\b(correct answer|explanation|rationale)\b/.test(text), expectFig, text };
  }, { expectFig: !!g.spec });
  const mc = r.kind === "mc";
  const wantOpts = mc ? (p.options?.length ?? 0) : (p.parts?.length ?? 0);
  const gotOpts = mc ? m.optCount : m.inputCount, gotVis = mc ? m.optVisible : m.inputVisible;
  out.options_visible = gotOpts === wantOpts && wantOpts > 0 && gotVis === gotOpts && (!mc || m.optTextEmpty === 0) ? { result: "pass", note: `${gotVis}/${wantOpts} ${mc ? "options" : "FRQ parts"} visible` } : { result: "fail", note: `expected ${wantOpts}, rendered ${gotOpts}, visible ${gotVis}, empty ${m.optTextEmpty}` };
  out.figure_rendered = !m.expectFig ? { result: "na", note: "no figure/table required by this item (gate: no render spec)" } : m.figCount > 0 && m.figVisible === m.figCount ? { result: "pass", note: `${m.figVisible} figure/table element(s) visible` } : { result: "fail", note: `figure expected, found ${m.figCount} (visible ${m.figVisible})` };
  out.no_clipping = !m.hScroll && m.clip === 0 ? { result: "pass", note: "no horizontal page scroll; options/inputs/figures inside viewport or in a scroll wrapper" } : { result: "fail", note: `hScroll=${m.hScroll} clipped=${m.clip}` };
  const expl = (p.explanation_en ?? "").trim().slice(0, 40).toLowerCase();
  out.no_answer_before_submit = !m.leaked && !(expl.length >= 20 && m.text.includes(expl)) ? { result: "pass", note: "no explanation/correct-answer text on screen before submit" } : { result: "fail", note: "explanation or answer text visible before submit" };
  if (mc) out.frq_input_works = { result: "na", note: "multiple-choice item" };
  else {
    const areas = root.locator('[data-testid^="frq-input-"]'); let ok = m.inputCount > 0;
    for (let i = 0; i < await areas.count(); i++) { const a = areas.nth(i); await a.fill("screen check"); if ((await a.inputValue()) !== "screen check") ok = false; await a.fill(""); }
    out.frq_input_works = ok ? { result: "pass", note: `typed into ${m.inputCount} part input(s), value retained` } : { result: "fail", note: "input did not retain text" };
  }
  await root.screenshot({ path: shot, type: "jpeg", quality: 55 });
  return out;
}

async function main() {
  const state = JSON.parse(readFileSync("tmp/ap-demo-state.json", "utf-8")) as { run: string; students: Record<string, string>; sets: string[] };
  const stock = JSON.parse(readFileSync("data/ap/stock/items.json", "utf-8")) as { stockKey: string; payload: Record<string, unknown> }[];
  const keysByHash = new Map<string, string[]>();
  for (const s of stock) { const h = itemContentHash(s.payload); (keysByHash.get(h) ?? keysByHash.set(h, []).get(h)!).push(s.stockKey); }
  const shotDir = arg("shots-dir", `tmp/ap-screen-evidence/${state.run}`); mkdirSync(shotDir, { recursive: true });
  const browser = await chromium.launch();
  const entries: ScreenEntry[] = []; const failures: string[] = [];
  const ver = browser.version();
  for (const setId of state.sets) {
    const rows = JSON.parse(psql(`select coalesce(json_agg(x order by x.ord), '[]') from (select i.section || ':' || i.position as ord, i.section, i.position, i.problem_version_id, c.candidate_key, c.kind, c.ap_subject_code, c.payload from mock_exam_set_items i join problems p on p.id = i.problem_id join ap_candidate_items c on c.candidate_key = p.ap_candidate_key where i.exam_set_id = ${q(setId)}) x;`)) as Row[];
    const tier = psql(`select access_tier from mock_exam_sets where id = ${q(setId)};`);
    const email = state.students[tier === "tutoring" ? "tutoring" : "free"];
    const sid = psql(`select id from auth.users where email = ${q(email)};`);
    const attempt = psql(`set role authenticated; do $$ begin perform set_config('request.jwt.claim.sub', ${q(sid)}, false); end $$; select mock_exam_open_start(${q(setId)}); reset role;`).split("\n").filter((l) => /^[0-9a-f-]{36}$/.test(l)).pop();
    if (!attempt) { failures.push(`${setId}: 응시 시작 실패`); continue; }
    for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: vp.mobile, isMobile: vp.mobile });
      await ctx.addInitScript("window.__name = (f) => f;"); // tsx(esbuild) 가 넣는 헬퍼가 page.evaluate 안에서 없어 실패하는 것 방지
      const page = await ctx.newPage();
      await login(page, email);
      await page.goto(`${BASE}/student/mock-exam/${attempt}`);
      const sections = [...new Set(rows.map((r) => r.section))];
      for (const sec of sections) {
        const tab = page.locator(`[data-testid="ap-section-${sec}"]`);
        if (await tab.count()) await tab.click();
        const secRows = rows.filter((r) => r.section === sec).sort((a, b) => a.position - b.position);
        const nav = page.locator('nav[aria-label="Go to question"] button');
        for (let i = 0; i < secRows.length; i++) {
          const r = secRows[i];
          let navErr = "";
          try { await nav.nth(i).click({ timeout: 8000 }); await page.waitForTimeout(300); } catch (e) { navErr = (e as Error).message.replace(/\s+/g, " ").slice(0, 100); } // 학생이 문항 번호를 누를 수 없으면 그 자체가 실패
          const hash = itemContentHash(r.payload);
          const key0 = keysByHash.get(hash)?.[0] ?? r.candidate_key;
          const shot = `${shotDir}/${key0.replace(/[^A-Za-z0-9_.-]/g, "_")}-${vp.w}x${vp.h}.jpg`;
          let checks: Record<ScreenCheckName, ScreenCheck>;
          try { if (navErr) throw new Error(`cannot open question ${i + 1}: ${navErr}`); checks = await checkItem(page, r, shot); } catch (e) { checks = Object.fromEntries(SCREEN_CHECKS.map((c) => [c, { result: "fail", note: `screen run error: ${(e as Error).message.replace(/\s+/g, " ").slice(0, 120)}` }])) as Record<ScreenCheckName, ScreenCheck>; }
          const bad = SCREEN_CHECKS.filter((c) => checks[c].result === "fail");
          if (bad.length) failures.push(`${key0} @${vp.w}: ${bad.map((c) => `${c}(${checks[c].note})`).join("; ")}`);
          for (const k of keysByHash.get(hash) ?? []) entries.push({ candidate_key: k, content_hash: hash, problem_version_id: r.problem_version_id, kind: r.kind, viewport: `${vp.w}x${vp.h}`, screenshot: shot, timestamp: new Date().toISOString(), checker: `playwright/${ver} local student exam screen`, checks });
        }
      }
      await ctx.close();
    }
  }
  await browser.close();
  const out = arg("out", "tmp/ap-screen-evidence.json");
  writeFileSync(out, JSON.stringify({ schema: "ap-screen-evidence/v1", generator: "playwright", generatedAt: new Date().toISOString(), entries }, null, 1));
  console.log(`증거 항목 ${entries.length}건(후보 ${new Set(entries.map((e) => e.candidate_key)).size}개) → ${out}`);
  if (failures.length) { console.log(`점검 실패 ${failures.length}건(해당 후보는 mark-verified 가 거부):`); for (const f of failures) console.log(`- ${f}`); }
}
main().catch((e) => { console.error(e instanceof Error ? e.message : "실패"); process.exit(1); });
