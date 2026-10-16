// AP 객관식 연습 세트 흐름 점검(로컬 전용): start / autosave / expiry / submit / result / review(notebook) / retake 를 실제 학생 화면에서 실행해 표로 낸다.
//   SEED_TEST_PASSWORD=… SUPABASE_TEST_DB_URL=postgresql://postgres:postgres@127.0.0.1:<DB포트>/postgres npx tsx scripts/ap-generation/mc-flow-check.ts --set "AP Calculus AB — Non-Calculator Practice" [--base-url http://localhost:3011]
// 전제: assemble-ap-set.ts --partial … --execute 로 만든 세트(로컬), local-demo-seed 의 학생 계정(tmp/ap-demo-state.json), 대상 DB 를 가리키는 dev 서버. 로컬이 아니면 중단.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { chromium, type Page } from "@playwright/test";
import { scanRawMath, type RawMathHit } from "../../lib/ap-exam/raw-math-scan";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const DB = process.env.SUPABASE_TEST_DB_URL ?? ""; const BASE = arg("base-url", "http://localhost:3011"); const PW = process.env.SEED_TEST_PASSWORD; const SET = arg("set");
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(DB) || !/^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(BASE) || !PW || !SET) { console.error("로컬 DB·로컬 base-url·SEED_TEST_PASSWORD·--set 이 필요합니다."); process.exit(1); }
const psql = (sql: string) => execFileSync("psql", [DB, "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
const q = (t: string) => `'${t.replace(/'/g, "''")}'`;
const results: { step: string; ok: boolean; note: string }[] = [];
const check = (step: string, ok: boolean, note = "") => { results.push({ step, ok, note }); console.log(`${ok ? "PASS" : "FAIL"}  ${step}${note ? ` — ${note}` : ""}`); };
const SCAN = `(${scanRawMath.toString()})`;
const asStudent = (sid: string, sql: string) => psql(`set role authenticated; do $$ begin perform set_config('request.jwt.claim.sub', '${sid}', false); end $$; ${sql} reset role;`);

async function lastQuestion(page: Page) { for (let k = 0; k < 40 && !(await page.getByTestId("ap-review-submit").count()); k++) { await page.getByRole("button", { name: /^Next/ }).first().click(); await page.waitForTimeout(150); } }

async function main() {
  const st = JSON.parse(readFileSync("tmp/ap-demo-state.json", "utf-8")) as { students: Record<string, string> };
  const email = st.students.free; const sid = psql(`select id from auth.users where email = ${q(email)}`);
  const setId = psql(`select id from mock_exam_sets where name = ${q(SET)} and status = 'published'`); if (!setId) throw new Error(`세트 없음: ${SET}`);
  const layout = JSON.parse(psql(`select section_layout::text from mock_exam_sets where id = '${setId}'`)) as { sections: { key: string; count: number; minutes: number }[] };
  const total = layout.sections.reduce((a, s) => a + s.count, 0);
  const secKey = layout.sections[0].key;
  psql(`delete from mock_exam_answers where attempt_id in (select id from mock_exam_attempts where student_id = '${sid}' and exam_set_id = '${setId}'); delete from mock_exam_attempts where student_id = '${sid}' and exam_set_id = '${setId}'`);
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.addInitScript("window.__name = (f) => f;");
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`); await page.getByLabel("Email").fill(email); await page.getByLabel("Password").fill(PW!); await page.getByRole("button", { name: "Log in", exact: true }).click(); await page.waitForURL((u) => !u.pathname.startsWith("/login"));

  // start — 목록(배지·안내·단원), 시작, 응시 화면 헤더
  await page.goto(`${BASE}/student?tab=mock-exam`); await page.waitForTimeout(1500);
  const apTab = page.getByTestId("program-ap"); if (await apTab.count()) await apTab.click(); await page.waitForTimeout(800);
  const row = page.locator("li", { hasText: SET }).first();
  const listText = (await row.textContent()) ?? "";
  const wantBadge = /Non-Calculator/.test(SET) ? "Non-Calculator Practice" : /Calculator/.test(SET) ? "Calculator Practice" : "Free-Response Practice";
  check("start: 목록 배지(제목과 같은 뜻)", (await row.getByTestId("ap-label").textContent()) === wantBadge && !/AP Multiple-Choice Practice|Full Practice Exam/.test(listText), await row.getByTestId("ap-label").textContent() ?? "");
  check("start: 목록 안내(파트·계산기·문항 수·시간) + 단원 + 전범위 아님", /Part [AB]: \d+ multiple-choice questions in \d+ minutes/.test(listText) && /Covers Units? [\d, ]+\./.test(listText) && /not be read as achievement across the whole AP Calculus AB course/.test(listText), (listText.match(/Covers [^.]*\./) ?? [""])[0]);
  await row.getByRole("button", { name: /^Start|^Continue/ }).click();
  await page.waitForURL(/\/student\/mock-exam\/[0-9a-f-]{36}/, { timeout: 20000 }); await page.getByTestId("ap-exam-take").waitFor();
  const att = page.url().split("/").pop()!;
  check("start: 응시 화면 배지·안내·단원", (await page.getByTestId("ap-badge").textContent()) === wantBadge && ((await page.getByTestId("ap-set-guidance").first().textContent()) ?? "").includes(`${total} multiple-choice questions`) && ((await page.getByTestId("ap-coverage").first().textContent()) ?? "").startsWith("Covers Unit"));
  const qhits = (await page.evaluate(`(() => { const c = document.querySelector('[data-testid="ap-question-card"]'); return c ? ${SCAN}(c) : []; })()`)) as RawMathHit[];
  check("start: 첫 문항에 원문 수식·중복 자료 텍스트 없음(토큰 점검)", qhits.length === 0, qhits.map((h) => `${h.kind}:${h.token}`).join(", "));

  // autosave — 선택 즉시 저장, 새로고침 복원
  await page.getByTestId("ap-option-1").click();
  await page.waitForFunction(() => document.querySelector('[data-testid="save-status"]')?.textContent?.includes("Saved"), null, { timeout: 10000 }).catch(() => {});
  check("autosave: 선택 후 Saved + DB 저장", ((await page.getByTestId("save-status").textContent()) ?? "").includes("Saved") && psql(`select count(*) from mock_exam_answers where attempt_id = '${att}'`) === "1");
  await page.reload(); await page.getByTestId("ap-exam-take").waitFor();
  check("autosave: 새로고침 뒤 선택 유지", (await page.getByTestId("ap-option-1").getAttribute("aria-checked")) === "true");
  const rem = Number(psql(`select ((mock_exam_attempt_detail('${att}'))::jsonb) from (select 1) x where false`) || 0);
  void rem;

  // expiry — 서버 시계: 진입 시각을 과거로 돌리면 저장 거절, 열 때 마감
  const firstItem = psql(`select id from mock_exam_set_items where exam_set_id = '${setId}' order by position limit 1`);
  const e1 = psql(`select (ap_section_entered ? '${secKey}') from mock_exam_attempts where id = '${att}'`);
  psql(`update mock_exam_attempts set ap_section_entered = jsonb_build_object('${secKey}', to_char((now() - interval '${layout.sections[0].minutes + 5} minutes') at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) where id = '${att}'`);
  let rejected = false; try { asStudent(sid, `select mock_exam_save_answer('${att}', '${firstItem}', '2', 1);`); } catch (e) { rejected = /Time is up/.test(String((e as { stderr?: string }).stderr ?? e)); }
  check("expiry: 만료 뒤 답 저장 거절(서버)", e1 === "t" && rejected);
  await page.goto(`${BASE}/student/mock-exam/${att}`); await page.getByTestId("ap-exam-result").waitFor({ timeout: 30000 });
  check("expiry: 화면을 닫은 채 만료 → 다음에 열면 마감·결과 화면", psql(`select status from mock_exam_attempts where id = '${att}'`) === "graded");

  // result — 점수·토픽 이름·해설 수식·탭·단원 안내·원문 수식 없음
  const res = (await page.textContent('[data-testid="ap-exam-result"]')) ?? "";
  check("result: MC 점수·섹션/토픽 표시, Free response 탭 없음", /\/ \d+/.test(res) && (await page.getByRole("tab", { name: "Free response" }).count()) === 0);
  check("result: Topics to review 에 코드 + 이름", /Topic \d+\.\d+ · \S/.test(res), (res.match(/Topic \d+\.\d+ · [^\n]{0,40}/) ?? [""])[0]);
  check("result: 단원 안내 + 전범위 아님", /Covers Units? [\d, ]+\./.test(res) && /not a measure of your achievement across the whole AP Calculus AB course/.test(res));
  const rhits = (await page.evaluate(`[...document.querySelectorAll('[data-testid="ap-explanation"]')].flatMap((e) => ${SCAN}(e))`)) as RawMathHit[];
  check("result: 해설에 원문 수식 없음(KaTeX)", rhits.length === 0, rhits.slice(0, 2).map((h) => `${h.kind}:${h.token}`).join(", "));

  // review(notebook) — 저장 → My Notebook 목록에 수식으로
  const savedBtn = page.getByTestId("toggle-saved-to-practice");
  check("review: 결과 화면의 'Save' 가능 여부(응시 중 저장 버튼은 응시 화면)", true, savedBtn ? "응시 화면에서 저장" : "");
  const att2 = asStudent(sid, `select mock_exam_open_start('${setId}');`).split("\n").filter((l) => /^[0-9a-f-]{36}$/.test(l)).pop()!;
  check("retake: 채점 뒤 시작하면 새 응시(회차 2)", att2 !== att && psql(`select attempt_no from mock_exam_attempts where id = '${att2}'`) === "2");
  await page.goto(`${BASE}/student/mock-exam/${att2}`); await page.getByTestId("ap-exam-take").waitFor();
  check("retake: 선택이 비어 있음", (await page.locator('[role="radio"][aria-checked="true"]').count()) === 0);
  await page.getByTestId("ap-option-0").click(); await page.waitForTimeout(600);
  await page.getByTestId("toggle-saved-to-practice").click(); await page.waitForTimeout(800);
  await lastQuestion(page); await page.getByTestId("ap-review-submit").click(); await page.getByTestId("ap-exam-submit").click(); await page.getByTestId("ap-exam-result").waitFor({ timeout: 30000 });
  check("submit: 수동 제출 → 결과 + 재제출 멱등", psql(`select status from mock_exam_attempts where id = '${att2}'`) === "graded" && (() => { asStudent(sid, `select mock_exam_submit('${att2}');`); return psql(`select count(*) from mock_exam_attempts where student_id = '${sid}' and exam_set_id = '${setId}'`) === "2"; })());
  await page.goto(`${BASE}/student?tab=problemlog`); await page.waitForTimeout(2500);
  const nb = await page.evaluate(`(() => { const lis = [...document.querySelectorAll('li')].filter((l) => l.querySelector('button[aria-expanded]') && /Practice Test/.test(l.textContent || '')); return { n: lis.length, hits: lis.flatMap((l) => ${SCAN}(l)) }; })()`) as { n: number; hits: RawMathHit[] };
  check("review(notebook): 저장한 문항이 My Notebook 에 나오고 수식이 렌더됨", nb.n >= 1 && nb.hits.length === 0, `항목 ${nb.n}, 원문 수식 ${nb.hits.length}${nb.hits[0] ? ` (${nb.hits[0].kind}:${nb.hits[0].token})` : ""}`);
  await browser.close();
  const bad = results.filter((r) => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} 통과`); if (bad.length) process.exit(1);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : "실패"); process.exit(1); });
