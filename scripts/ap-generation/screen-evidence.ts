// AP 학생 화면 검증 증거 생성기(로컬 전용). 로컬 시드 세트(local-demo-seed.ts)를 실제 학생 응시 화면(/student/mock-exam/<attempt>)에서 Playwright 로 열어
// 문항마다 필수 점검(보기·그림/표 렌더·가림 없음·제출 전 정답/해설 비노출·FRQ 입력)을 실제로 실행하고 그 결과를 증거 JSON 으로 쓴다.
//   1) 격리 스택 + 마이그레이션 + 시드:   SEED_TEST_PASSWORD=<로컬값> npx tsx scripts/ap-generation/local-demo-seed.ts seed
//   2) 대상 DB 를 가리키는 dev 서버:       NEXT_PUBLIC_SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=… SUPABASE_SECRET_KEY=… npm run dev -- -p 3011
//   3) 생성:                              SEED_TEST_PASSWORD=<로컬값> NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:<API포트> SUPABASE_TEST_DB_URL=postgresql://postgres:postgres@127.0.0.1:<DB포트>/postgres npx tsx scripts/ap-generation/screen-evidence.ts [--base-url http://localhost:3011] [--out tmp/ap-screen-evidence.json]
// 증거의 content_hash 는 화면에 띄운 문제 버전의 후보 payload 해시(render 보고서와 같은 sha256)이며, 같은 payload 를 가진 재고 후보 키(stockKey)마다 항목을 만든다.
// 비밀번호·키는 출력하지 않는다. DB URL 이 로컬이 아니면 중단.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";
import { assertIsolatedTargetOrExit } from "../../lib/dev/stack-identity";
import { gateCandidate } from "../../lib/ap-figures/gate";
import { STOCK_FILES } from "./keys-file";
import { scanRawMath, type RawMathHit } from "../../lib/ap-exam/raw-math-scan";
// 토큰 단위 점검(lib/ap-exam/raw-math-scan.ts): KaTeX 수식·코드·이스케이프 달러는 제외하고 텍스트 노드의 원문 수식만 센다.
const SCAN = `(${scanRawMath.toString()})`;
import { AUTOMATED_LIMITATION, itemContentHash, RESULT_CHECK, SCREEN_CHECKS, STIMULUS_CHECK, type ScreenCheck, type ScreenCheckName, type ScreenEntry } from "../../lib/ap-generation/verify-guard";

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
// 모든 env 파일과 process env 를 다 읽은 뒤 대상 결정 + docker 로 DB·API 동일 격리 스택 확인(불일치·공유면 쓰기 전에 종료).
const TARGET = assertIsolatedTargetOrExit({ apiVars: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"] });
const DB_URL = TARGET.dbUrl;
const BASE = arg("base-url", "http://localhost:3011");
if (!/^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(BASE)) { console.error("--base-url 은 로컬이어야 합니다."); process.exit(1); }
const PW = process.env.SEED_TEST_PASSWORD; if (!PW) { console.error("SEED_TEST_PASSWORD 가 필요합니다."); process.exit(1); }
const psql = (sql: string) => execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
const q = (t: string) => `'${t.replace(/'/g, "''")}'`;
const VIEWPORTS = [{ w: 390, h: 844, mobile: true }, { w: 1280, h: 800, mobile: false }];

type Row = { set_item_id: string; section: string; position: number; problem_version_id: string; candidate_key: string; kind: "mc" | "frq_bundle"; ap_subject_code: string; payload: Record<string, unknown> };

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
    // leaked: 문제 문장에 쓰인 단어 "explanation"(예: Which explanation best…)은 노출이 아니다 — 해설 블록·정답 라벨·해설 앞부분만 본다.
    return { optCount: opts.length, optVisible: opts.filter(vis).length, optTextEmpty: opts.filter((o) => !(o.textContent ?? "").trim()).length, inputCount: inputs.length, inputVisible: inputs.filter(vis).length, figCount: figs.length, figVisible: figs.filter(vis).length, hScroll: document.documentElement.scrollWidth > vw + 1, clip, leaked: /\bcorrect answer\b/.test(text) || !!document.querySelector('[data-testid="ap-explanation"], [data-testid="ap-review-item"]'), expectFig, text };
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
  // 문제 영역(자료 텍스트·본문·선지)의 렌더되지 않은 원문 수식 점검(제출 전).
  const qhits = (await page.evaluate(`(() => { const c = document.querySelector('[data-testid="ap-question-card"]'); return c ? ${SCAN}(c) : null; })()`)) as RawMathHit[] | null;
  (out as Record<string, ScreenCheck>)[STIMULUS_CHECK] = qhits === null ? { result: "fail", note: "question card not found" } : qhits.length ? { result: "fail", note: `raw math visible before submit: ${qhits.slice(0, 2).map((h) => `${h.kind} "${h.token}" …${h.context}`).join(" | ")}` } : { result: "pass", note: "no unrendered math tokens in stimulus, stem or options (KaTeX/code/escaped-dollar excluded)" };
  await root.screenshot({ path: shot, type: "jpeg", quality: 55 });
  return out;
}

/** 응시를 제출하고 결과 화면에서 문항별 해설·참고 답안의 원문 TeX 노출 여부를 점검한다. */
async function resultPass(page: Page, rows: Row[], lastSection?: string): Promise<Map<string, ScreenCheck>> {
  if (lastSection) { const tab = page.locator(`[data-testid="ap-section-${lastSection}"]`); if (await tab.count()) await tab.click(); }
  for (let k = 0; k < 40 && !(await page.getByTestId("ap-review-submit").count()); k++) { await page.getByRole("button", { name: /^Next/ }).first().click(); await page.waitForTimeout(120); } // 마지막 섹션의 마지막 문항까지
  await page.locator('[data-testid="ap-review-submit"]').click();
  await page.locator('[data-testid="ap-exam-submit"]').click();
  await page.locator('[data-testid="ap-exam-result"]').waitFor({ state: "visible", timeout: 30_000 });
  // 서버 렌더 스모크: 채점 완료 응시 URL 을 새로 열어도(서버 컴포넌트가 결과 화면을 렌더) 결과가 보여야 한다. 서버→클라이언트 함수 prop 같은 경계 오류는 여기서 500 으로 드러난다.
  await page.goto(page.url().includes("/student/mock-exam/") ? page.url() : page.url());
  await page.locator('[data-testid="ap-exam-result"]').waitFor({ state: "visible", timeout: 30_000 });
  const found = (await page.evaluate(`[...document.querySelectorAll('[data-testid="ap-review-item"]')].map((li) => { const ex = li.querySelector('[data-testid="ap-explanation"]'); return { id: li.getAttribute("data-set-item-id") || "", hasExplanation: !!ex, hits: ex ? ${SCAN}(ex) : [] }; })`)) as { id: string; hasExplanation: boolean; hits: RawMathHit[] }[];
  const byId = new Map(found.map((f) => [f.id, f]));
  const out = new Map<string, ScreenCheck>();
  for (const r of rows) {
    const f = byId.get(r.set_item_id);
    if (!f) { out.set(r.set_item_id, { result: "fail", note: "result item not found" }); continue; }
    const hit = f.hits[0];
    out.set(r.set_item_id, hit ? { result: "fail", note: `raw math visible in explanation: ${hit.kind} "${hit.token}" …${hit.context}` } : { result: "pass", note: f.hasExplanation ? "explanation math rendered (no raw TeX tokens)" : "no explanation text on result screen" });
  }
  return out;
}

async function main() {
  const wd = Number(arg("watchdog-sec", "0")); if (wd) setTimeout(() => { console.error(`watchdog ${wd}s 초과 — 중단`); process.exit(2); }, wd * 1000).unref(); // 개발 서버가 멈추면 세트 단위로 끊고 다시 돌린다
  const state = JSON.parse(readFileSync("tmp/ap-demo-state.json", "utf-8")) as { run: string; students: Record<string, string>; sets: string[] };
  if (arg("set-ids", "")) state.sets = arg("set-ids", "").split(","); // 데모 세트 대신 지정한 세트(예: 실제 조립된 연습 세트)를 점검
  const stock = STOCK_FILES.flatMap((f) => { try { return JSON.parse(readFileSync(`data/ap/stock/${f}.json`, "utf-8")); } catch { return []; } }) as { stockKey: string; payload: Record<string, unknown> }[];
  const keysByHash = new Map<string, string[]>();
  for (const s of stock) { const h = itemContentHash(s.payload); (keysByHash.get(h) ?? keysByHash.set(h, []).get(h)!).push(s.stockKey); }
  const shotDir = arg("shots-dir", `tmp/ap-screen-evidence/${state.run}`); mkdirSync(shotDir, { recursive: true });
  const browser = await chromium.launch();
  const entries: ScreenEntry[] = []; const failures: string[] = [];
  const ver = browser.version();
  const only = arg("only-sets", ""); // 디버그: 앞에서 N개 세트만
  const idx = arg("set-index", "");
  for (const setId of idx ? [state.sets[Number(idx)]] : only ? state.sets.slice(0, Number(only)) : state.sets) {
    const rows = JSON.parse(psql(`select coalesce(json_agg(x order by x.ord), '[]') from (select i.section || ':' || i.position as ord, i.section, i.position, i.id as set_item_id, i.problem_version_id, c.candidate_key, c.kind, c.ap_subject_code, c.payload from mock_exam_set_items i join problems p on p.id = i.problem_id join ap_candidate_items c on c.candidate_key = p.ap_candidate_key where i.exam_set_id = ${q(setId)}) x;`)) as Row[];
    const tier = psql(`select access_tier from mock_exam_sets where id = ${q(setId)};`);
    const email = state.students[tier === "tutoring" ? "tutoring" : "free"];
    const sid = psql(`select id from auth.users where email = ${q(email)};`);
    for (const vp of VIEWPORTS) {
    const attempt = psql(`set role authenticated; do $$ begin perform set_config('request.jwt.claim.sub', ${q(sid)}, false); end $$; select mock_exam_open_start(${q(setId)}); reset role;`).split("\n").filter((l) => /^[0-9a-f-]{36}$/.test(l)).pop();
    if (!attempt) { failures.push(`${setId}: 응시 시작 실패`); continue; }
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: vp.mobile, isMobile: vp.mobile });
      await ctx.addInitScript("window.__name = (f) => f;"); // tsx(esbuild) 가 넣는 헬퍼가 page.evaluate 안에서 없어 실패하는 것 방지
      const page = await ctx.newPage();
      await login(page, email);
      await page.goto(`${BASE}/student/mock-exam/${attempt}`);
      const pending: { setItemId: string; entry: ScreenEntry }[] = [];
      const layoutKeys = (JSON.parse(psql(`select section_layout->'sections' from mock_exam_sets where id = ${q(setId)};`)) as { key: string }[]).map((x) => x.key); // 공식 레이아웃 순서(마지막 섹션에서 제출)
      const sections = [...new Set(rows.map((r) => r.section))].sort((a, b) => layoutKeys.indexOf(a) - layoutKeys.indexOf(b));
      for (const sec of sections) {
        const tab = page.locator(`[data-testid="ap-section-${sec}"]`);
        if (await tab.count()) await tab.click();
        const secRows = rows.filter((r) => r.section === sec).sort((a, b) => a.position - b.position);
        const nav = page.locator('nav[aria-label="Go to question"] button');
        for (let i = 0; i < secRows.length; i++) {
          const r = secRows[i]; if (process.env.AP_DEBUG) console.log("  item", vp.w, sec, i, r.candidate_key);
          let navErr = "";
          try { await nav.nth(i).click({ timeout: 8000 }); await page.waitForTimeout(300); } catch (e) { navErr = (e as Error).message.replace(/\s+/g, " ").slice(0, 100); } // 학생이 문항 번호를 누를 수 없으면 그 자체가 실패
          const hash = itemContentHash(r.payload);
          const key0 = keysByHash.get(hash)?.[0] ?? r.candidate_key;
          const shot = `${shotDir}/${key0.replace(/[^A-Za-z0-9_.-]/g, "_")}-${vp.w}x${vp.h}.jpg`;
          let checks: Record<ScreenCheckName, ScreenCheck>;
          try { if (navErr) throw new Error(`cannot open question ${i + 1}: ${navErr}`); checks = await checkItem(page, r, shot); } catch (e) { checks = Object.fromEntries([...SCREEN_CHECKS, STIMULUS_CHECK].map((c) => [c, { result: "fail", note: `screen run error: ${(e as Error).message.replace(/\s+/g, " ").slice(0, 120)}` }])) as Record<ScreenCheckName, ScreenCheck>; }
          const bad = ([...SCREEN_CHECKS, STIMULUS_CHECK] as const).filter((c) => (checks as Record<string, ScreenCheck>)[c]?.result === "fail");
          if (bad.length) failures.push(`${key0} @${vp.w}: ${bad.map((c) => `${c}(${(checks as Record<string, ScreenCheck>)[c].note})`).join("; ")}`);
          for (const k of keysByHash.get(hash) ?? []) pending.push({ setItemId: r.set_item_id, entry: { candidate_key: k, checker_kind: "automated", content_hash: hash, problem_version_id: r.problem_version_id, kind: r.kind, viewport: `${vp.w}x${vp.h}`, screenshot: shot, timestamp: new Date().toISOString(), checker: `automated-playwright/${ver} local student exam screen`, checks } });
        }
      }
      // 제출 후 결과 화면 점검: 해설·참고 답안에 원문 TeX 가 보이면 실패(KaTeX 로 그려진 수식은 통과).
      const resultChecks = await resultPass(page, rows, sections[sections.length - 1]).catch((e) => new Map<string, ScreenCheck>(rows.map((r) => [r.set_item_id, { result: "fail", note: `result screen error: ${(e as Error).message.replace(/\s+/g, " ").slice(0, 100)}` }])));
      for (const p of pending) {
        const rc = resultChecks.get(p.setItemId) ?? { result: "fail" as const, note: "result item not found" };
        p.entry.checks[RESULT_CHECK] = rc;
        if (rc.result === "fail") failures.push(`${p.entry.candidate_key} @${vp.w}: ${RESULT_CHECK}(${rc.note})`);
        entries.push(p.entry);
      }
      await ctx.close();
      console.log(`세트 ${setId.slice(0, 8)} @${vp.w} 완료 (항목 ${rows.length}, ${new Date().toISOString().slice(11, 19)})`);
    }
  }
  await browser.close();
  const out = arg("out", "tmp/ap-screen-evidence.json");
  writeFileSync(out, JSON.stringify({ schema: "ap-screen-evidence/v3", generator: "playwright", limitations: AUTOMATED_LIMITATION, generatedAt: new Date().toISOString(), entries }, null, 1));
  console.log(`증거 항목 ${entries.length}건(후보 ${new Set(entries.map((e) => e.candidate_key)).size}개) → ${out}`);
  if (failures.length) { console.log(`점검 실패 ${failures.length}건(해당 후보는 mark-verified 가 거부):`); for (const f of failures) console.log(`- ${f}`); }
}
main().catch((e) => { console.error(e instanceof Error ? e.message : "실패"); process.exit(1); });
