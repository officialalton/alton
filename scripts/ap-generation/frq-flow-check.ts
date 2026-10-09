// AP Free-Response 흐름 점검(로컬 전용): 입력·자동 저장·새로고침 복원·제출 전 비노출·제출·답안+채점 가이드(참고 피드백) 열람·재응시를 실제 학생 화면에서 실행해 pass/fail 표로 낸다.
//   (--set "<세트 이름>" 으로 조립한 실제 FRQ 세트를 지정, 없으면 데모 FRQ 세트)
//   SEED_TEST_PASSWORD=… SUPABASE_TEST_DB_URL=postgresql://postgres:postgres@127.0.0.1:<DB포트>/postgres npx tsx scripts/ap-generation/frq-flow-check.ts [--base-url http://localhost:3011]
// 전제: local-demo-seed.ts seed 로 FRQ 세트가 있고(상태 파일 tmp/ap-demo-state.json), 대상 DB 를 가리키는 dev 서버가 떠 있다. 로컬 DB·로컬 주소가 아니면 중단.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const DB = process.env.SUPABASE_TEST_DB_URL ?? ""; const BASE = arg("base-url", "http://localhost:3011"); const PW = process.env.SEED_TEST_PASSWORD;
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(DB) || !/^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(BASE) || !PW) { console.error("로컬 DB·로컬 base-url·SEED_TEST_PASSWORD 가 필요합니다."); process.exit(1); }
const psql = (sql: string) => execFileSync("psql", [DB, "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
const results: { step: string; ok: boolean; note: string }[] = [];
const check = (step: string, ok: boolean, note = "") => { results.push({ step, ok, note }); console.log(`${ok ? "PASS" : "FAIL"}  ${step}${note ? ` — ${note}` : ""}`); };

async function main() {
  const st = JSON.parse(readFileSync("tmp/ap-demo-state.json", "utf-8")) as { sets: string[]; students: Record<string, string> };
  const named = arg("set", "");
  const setId = named ? psql(`select id from mock_exam_sets where name = '${named.replace(/'/g, "''")}' and status = 'published'`) : st.sets.find((id) => /FRQ/.test(psql(`select name from mock_exam_sets where id = '${id}'`)));
  if (!setId) throw new Error("FRQ 데모 세트가 없습니다(local-demo-seed seed --all-eligible).");
  const email = st.students.free; const sid = psql(`select id from auth.users where email = '${email}'`);
  const start = () => psql(`set role authenticated; do $$ begin perform set_config('request.jwt.claim.sub', '${sid}', false); end $$; select mock_exam_open_start('${setId}'); reset role;`).split("\n").filter((l) => /^[0-9a-f-]{36}$/.test(l)).pop()!;
  const att = start();
  // 제출 전 비노출(DB 상세): FRQ 항목에 정답·해설·루브릭이 없다.
  const d0 = JSON.parse(psql(`set role authenticated; do $$ begin perform set_config('request.jwt.claim.sub', '${sid}', false); end $$; select mock_exam_attempt_detail('${att}')::text; reset role;`)) as { items: { format: string; explanation: string | null; correctIndex: number | null; answers: unknown }[] };
  check("제출 전 응답에 해설·정답·답안 없음(DB 상세)", d0.items.every((i) => i.explanation === null && i.correctIndex === null && !i.answers));

  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.addInitScript("window.__name = (f) => f;");
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`); await page.getByLabel("Email").fill(email); await page.getByLabel("Password").fill(PW!); await page.getByRole("button", { name: "Log in", exact: true }).click(); await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  await page.goto(`${BASE}/student/mock-exam/${att}`); await page.locator('[data-testid="ap-exam-take"]').waitFor();
  const inputs = page.locator('[data-testid^="frq-input-"]');
  check("FRQ 파트 입력칸 표시", (await inputs.count()) > 0, `${await inputs.count()}개`);
  const body0 = (await page.textContent("body")) ?? "";
  check("제출 전 화면에 참고 답안·채점 가이드 문구 없음", !/Reference answer|scoring guide|Reference feedback/i.test(body0.replace(/a reference answer and scoring guide \(reference feedback, not official scoring\) is shown after you submit/i, "")));
  // 입력 + 자동 저장
  const typed = ["Because the area is bounded by f and g.", "42.5 cubic units", "The rate is increasing at t = 2"];
  const n = await inputs.count();
  for (let i = 0; i < n; i++) await inputs.nth(i).fill(typed[i % typed.length] + ` #${i}`);
  await page.waitForFunction(() => document.querySelector('[data-testid="save-status"]')?.textContent?.includes("Saved"), null, { timeout: 15000 }).catch(() => {});
  check("자동 저장 표시(Saved)", ((await page.getByTestId("save-status").textContent()) ?? "").includes("Saved"));
  await page.waitForTimeout(1800);
  const saved = psql(`select response::text from mock_exam_answers where attempt_id = '${att}' and response is not null limit 1;`);
  check("DB 에 입력이 저장됨(mock_exam_answers)", /#0/.test(saved), saved.slice(0, 60));
  // 새로고침 복원
  await page.reload(); await page.locator('[data-testid="ap-exam-take"]').waitFor();
  const v0 = await page.locator('[data-testid^="frq-input-"]').first().inputValue();
  check("새로고침 뒤 입력 복원", /#0/.test(v0), v0.slice(0, 40));
  // 제출 → 결과
  for (let k = 0; k < 12 && !(await page.getByTestId("ap-review-submit").count()); k++) { await page.getByRole("button", { name: /^Next/ }).first().click(); await page.waitForTimeout(250); } // 마지막 문항까지
  await page.getByTestId("ap-review-submit").click(); await page.getByTestId("ap-exam-submit").click();
  await page.getByTestId("ap-exam-result").waitFor({ timeout: 30000 });
  check("제출 후 결과 화면 표시", true);
  const resText = (await page.textContent('[data-testid="ap-exam-result"]')) ?? "";
  check("내 답안이 결과에 보임", /#0/.test(resText) || (await page.locator('[data-testid^="frq-answer-"]').first().textContent())?.includes("#0") === true);
  check("답안+채점 가이드(참고 피드백) 블록과 '공식 채점 아님' 라벨", /Reference answer and scoring guide \(reference feedback, not official scoring\)/.test(resText) && /not official scoring/i.test(resText));
  check("AP 1–5 점수·FRQ 점수 표시 없음", /AP scores \(1–5\) are not estimated/.test(resText) && !/\bScore:\s*\d/.test(resText));
  // 서버 렌더 새로 열기(채점 완료 URL)
  await page.goto(`${BASE}/student/mock-exam/${att}`); await page.getByTestId("ap-exam-result").waitFor({ timeout: 30000 });
  check("채점 완료 URL 새로 열어도 결과(서버 렌더)", true);
  // 이중 제출·두 탭: 멱등
  const g1 = psql(`select submitted_at::text || '|' || graded_at::text from mock_exam_attempts where id = '${att}'`);
  for (let i = 0; i < 2; i++) psql(`set role authenticated; do $$ begin perform set_config('request.jwt.claim.sub', '${sid}', false); end $$; select mock_exam_submit('${att}'); reset role;`);
  check("이중 제출 멱등(시각·행 불변)", psql(`select submitted_at::text || '|' || graded_at::text from mock_exam_attempts where id = '${att}'`) === g1 && psql(`select count(*) from mock_exam_attempts where student_id = '${sid}' and exam_set_id = '${setId}'`) === "1");
  // 재응시: 목록에서 Retake → 새 회차, 입력 비어 있음
  await page.goto(`${BASE}/student?tab=mock-exam`); await page.waitForTimeout(1500);
  const apTab = page.getByTestId("program-ap"); if (await apTab.count()) await apTab.click();
  await page.getByRole("tab", { name: "Completed" }).or(page.getByRole("button", { name: "Completed" })).first().click().catch(() => {}); await page.waitForTimeout(800);
  const setName = psql(`select name from mock_exam_sets where id = '${setId}'`);
  const row = page.locator("li", { hasText: setName }).first();
  await row.getByRole("button", { name: "Retake" }).click();
  await page.waitForURL(/\/student\/mock-exam\/[0-9a-f-]{36}/, { timeout: 20000 }); await page.locator('[data-testid="ap-exam-take"]').waitFor();
  const att2 = page.url().split("/").pop()!;
  const v2 = await page.locator('[data-testid^="frq-input-"]').first().inputValue();
  check("재응시: 새 응시(회차 2)·입력칸 비어 있음", att2 !== att && v2 === "" && psql(`select attempt_no from mock_exam_attempts where id = '${att2}'`) === "2", `attempt_no=${psql(`select attempt_no from mock_exam_attempts where id = '${att2}'`)}`);
  await browser.close();
  const bad = results.filter((r) => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} 통과`); if (bad.length) process.exit(1);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : "실패"); process.exit(1); });
