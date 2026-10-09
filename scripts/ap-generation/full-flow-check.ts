// AP 풀 세트(공식 레이아웃) 흐름 점검(로컬 전용): FRQ 다문항 저장·복원, 파트별 계산기 조건 안내·타이머·섹션 잠금, 섹션별 만료, 제출·결과, 재응시, 노트북 연동을 실제 학생 화면에서 실행한다.
//   SEED_TEST_PASSWORD=… SUPABASE_TEST_DB_URL=postgresql://postgres:postgres@127.0.0.1:<DB포트>/postgres npx tsx scripts/ap-generation/full-flow-check.ts [--base-url http://localhost:3011]
// 전제: local-demo-seed.ts seed --keys-file <선택 목록> 로 만든 풀 세트(tmp/ap-demo-state.json 의 마지막 세트), dev 서버. 로컬이 아니면 중단.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { chromium, type Page } from "@playwright/test";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const DB = process.env.SUPABASE_TEST_DB_URL ?? ""; const BASE = arg("base-url", "http://localhost:3011"); const PW = process.env.SEED_TEST_PASSWORD;
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(DB) || !/^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(BASE) || !PW) { console.error("로컬 DB·로컬 base-url·SEED_TEST_PASSWORD 가 필요합니다."); process.exit(1); }
const psql = (sql: string) => execFileSync("psql", [DB, "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
const results: { step: string; ok: boolean; note: string }[] = [];
const check = (step: string, ok: boolean, note = "") => { results.push({ step, ok, note }); console.log(`${ok ? "PASS" : "FAIL"}  ${step}${note ? ` — ${note}` : ""}`); };
const clock = async (p: Page) => ((await p.getByTestId("ap-exam-timer").textContent()) ?? "").trim();
const secs = (c: string) => { const [m, s] = c.split(":").map(Number); return m * 60 + s; };

async function main() {
  const st = JSON.parse(readFileSync("tmp/ap-demo-state.json", "utf-8")) as { sets: string[]; students: Record<string, string> };
  const setId = st.sets[st.sets.length - 1]; const email = st.students.free; const sid = psql(`select id from auth.users where email = '${email}'`);
  const asStudent = (sql: string) => psql(`set role authenticated; do $$ begin perform set_config('request.jwt.claim.sub', '${sid}', false); end $$; ${sql} reset role;`);
  const startAttempt = () => asStudent(`select mock_exam_open_start('${setId}');`).split("\n").filter((l) => /^[0-9a-f-]{36}$/.test(l)).pop()!;
  const att = startAttempt();
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.addInitScript("window.__name = (f) => f;");
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`); await page.getByLabel("Email").fill(email); await page.getByLabel("Password").fill(PW!); await page.getByRole("button", { name: "Log in", exact: true }).click(); await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  await page.goto(`${BASE}/student/mock-exam/${att}`); await page.getByTestId("ap-exam-take").waitFor();

  // 파트별 계산기 조건: 섹션 탭 4개, 규칙 문구·타이머가 섹션마다 다르다
  const want: Record<string, { rule: RegExp; mins: number }> = {
    ap_mc_a: { rule: /29 questions · 62 min · No calculator/, mins: 62 }, ap_mc_b: { rule: /13 questions · 38 min · Graphing calculator required/, mins: 38 },
    ap_frq_a: { rule: /2 questions · 30 min · Calculator allowed/, mins: 30 }, ap_frq_b: { rule: /4 questions · 60 min · No calculator/, mins: 60 },
  };
  for (const [key, w] of Object.entries(want)) {
    await page.getByTestId(`ap-section-${key}`).click(); await page.waitForTimeout(500);
    const rules = (await page.getByTestId("ap-section-rules").textContent()) ?? ""; const c = secs(await clock(page));
    const calcBtn = await page.getByRole("button", { name: "Calculator", exact: true }).count(); // 계산기 도구 버튼(섹션 탭 이름의 "(no calculator)" 와 구분)
    const needCalc = key === "ap_mc_b" || key === "ap_frq_a";
    check(`섹션 ${key}: 규칙 문구·타이머(공식 분 이내)·계산기 도구`, w.rule.test(rules) && c <= w.mins * 60 && c > (w.mins - 2) * 60 && (needCalc ? calcBtn > 0 : calcBtn === 0), `${rules.replace(/\s+/g, " ").slice(0, 80)} | ${await clock(page)} | calc도구 ${calcBtn}`);
  }
  check("서버 시계: 4개 섹션 모두 진입이 서버에 기록됨(ap_section_entered)", Number(psql(`select count(*) from jsonb_object_keys((select ap_section_entered from mock_exam_attempts where id = '${att}'))`)) === 4);

  // FRQ 다문항 저장·복원(Part A 2문항): 1번 입력 → 2번 입력 → 1번으로 돌아와 유지 → 새로고침 뒤 둘 다 유지
  await page.getByTestId("ap-section-ap_frq_a").click(); await page.waitForTimeout(400);
  const nav = page.locator('nav[aria-label="Go to question"] button');
  await page.locator('[data-testid^="frq-input-"]').first().fill("Q1 answer alpha"); await page.waitForTimeout(1600);
  await nav.nth(1).click(); await page.waitForTimeout(400);
  await page.locator('[data-testid^="frq-input-"]').first().fill("Q2 answer beta"); await page.waitForTimeout(1600);
  await nav.nth(0).click(); await page.waitForTimeout(400);
  check("FRQ 다문항: 1번으로 돌아오면 1번 입력 유지", (await page.locator('[data-testid^="frq-input-"]').first().inputValue()) === "Q1 answer alpha");
  check("FRQ 다문항: DB 에 두 문항 응답이 각각 저장", Number(psql(`select count(*) from mock_exam_answers where attempt_id = '${att}' and response is not null`)) >= 2);
  await page.reload(); await page.getByTestId("ap-exam-take").waitFor(); await page.getByTestId("ap-section-ap_frq_a").click(); await page.waitForTimeout(500);
  const v1 = await page.locator('[data-testid^="frq-input-"]').first().inputValue(); await nav.nth(1).click(); await page.waitForTimeout(400);
  const v2 = await page.locator('[data-testid^="frq-input-"]').first().inputValue();
  check("FRQ 다문항: 새로고침 뒤에도 두 문항 입력 복원", v1 === "Q1 answer alpha" && v2 === "Q2 answer beta", `${v1.slice(0, 10)} / ${v2.slice(0, 10)}`);
  // 노트북 저장 토글(FRQ)
  await page.getByTestId("toggle-saved-to-practice").click(); await page.waitForTimeout(700);
  check("FRQ 문항을 My Notebook 에 저장 가능(저장 표시)", (await page.getByTestId("toggle-saved-to-practice").getAttribute("aria-pressed")) === "true" && Number(psql(`select count(*) from mock_exam_answers where attempt_id = '${att}' and saved_to_practice`)) === 1);

  // 섹션별 만료: Part A(MC) 서버 시계를 과거로 → 그 섹션만 저장 거절, 다른 섹션은 계속 가능
  psql(`update mock_exam_attempts set ap_section_entered = ap_section_entered || jsonb_build_object('ap_mc_a', to_char((now() - interval '70 minutes') at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) where id = '${att}'`);
  const mcA = psql(`select id from mock_exam_set_items where exam_set_id = '${setId}' and section = 'ap_mc_a' order by position limit 1`);
  const mcB = psql(`select id from mock_exam_set_items where exam_set_id = '${setId}' and section = 'ap_mc_b' order by position limit 1`);
  let rej = false; try { asStudent(`select mock_exam_save_answer('${att}', '${mcA}', '1', 1);`); } catch (e) { rej = /Time is up/.test(String((e as { stderr?: string }).stderr ?? e)); }
  let okB = true; try { asStudent(`select mock_exam_save_answer('${att}', '${mcB}', '1', 1);`); } catch { okB = false; }
  check("섹션별 만료: 만료된 섹션(MC Part A)은 저장 거절, 다른 섹션(MC Part B)은 계속 저장 가능", rej && okB);
  await page.reload(); await page.getByTestId("ap-exam-take").waitFor(); await page.getByTestId("ap-section-ap_mc_a").click(); await page.waitForTimeout(2500); // 클라이언트 타이머 틱 후 잠금
  check("섹션별 만료: 화면에서도 만료 안내와 '다음 섹션' 이동(중간 섹션은 자동 제출 안 함)", (await page.getByTestId("ap-section-expired").count()) > 0 && (await page.getByRole("button", { name: "Go to next section" }).count()) > 0 && psql(`select status from mock_exam_attempts where id = '${att}'`) === "in_progress");

  // 마지막 섹션(FRQ Part B)까지 가서 제출 → 결과
  await page.getByTestId("ap-section-ap_frq_b").click(); await page.waitForTimeout(500);
  await page.locator('[data-testid^="frq-input-"]').first().fill("Part B response"); await page.waitForTimeout(1600);
  for (let k = 0; k < 8 && !(await page.getByTestId("ap-review-submit").count()); k++) { await page.getByRole("button", { name: /^Next/ }).first().click(); await page.waitForTimeout(200); }
  await page.getByTestId("ap-review-submit").click(); await page.getByTestId("ap-exam-submit").click(); await page.getByTestId("ap-exam-result").waitFor({ timeout: 30000 });
  const res = (await page.textContent('[data-testid="ap-exam-result"]')) ?? "";
  check("제출 → 결과: 공식 풀 구성 배지 'Full Practice Exam'와 FRQ 답안·참고 답안 블록", /Full Practice Exam/.test(res) && /Q1 answer alpha/.test(res) && /Reference answer and scoring guide/.test(res));
  check("결과: Free response 탭이 있고(FRQ 포함 세트) 점수·AP 1–5 추정 없음", (await page.getByRole("tab", { name: "Free response" }).count()) === 1 && /AP scores \(1–5\) are not estimated/.test(res));
  await page.goto(`${BASE}/student?tab=problemlog`); await page.waitForTimeout(2500);
  const nb = await page.evaluate(`[...document.querySelectorAll('li')].filter((l) => l.querySelector('button[aria-expanded]') && /Practice Test/.test(l.textContent || '')).map((l) => (l.textContent || '').slice(0, 90))`) as string[];
  check("노트북 연동: 저장한 FRQ 문항이 My Notebook 에 보임", nb.length >= 1, `${nb.length}개`);

  // 재응시
  const att2 = startAttempt();
  await page.goto(`${BASE}/student/mock-exam/${att2}`); await page.getByTestId("ap-exam-take").waitFor(); await page.getByTestId("ap-section-ap_frq_a").click(); await page.waitForTimeout(500);
  check("재응시: 새 응시(회차 2), FRQ 입력칸 비어 있음, 섹션 시계 새로 시작", att2 !== att && psql(`select attempt_no from mock_exam_attempts where id = '${att2}'`) === "2" && (await page.locator('[data-testid^="frq-input-"]').first().inputValue()) === "" && secs(await clock(page)) > 29 * 60);
  await browser.close();
  const bad = results.filter((r) => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} 통과`); if (bad.length) process.exit(1);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : "실패"); process.exit(1); });
