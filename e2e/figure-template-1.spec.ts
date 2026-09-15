import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { ACCOUNTS, loginAs } from "./helpers";

// 표준 렌더링 엔진 템플릿 1(평행선·횡단선·각) — 한 경로 검증(2026-09-14 제품 오너 지시):
//   AI 의미 데이터 생성 → 서버 검증(render_check) → 표준 렌더 미리보기 → 미리보기로 확인함 → 공개 → 학생 수업 화면.
// 로컬 Supabase(시드 계정) + 로컬 dev 서버. 실제 모델을 호출하므로 ANTHROPIC_API_KEY 가 없으면 건너뛴다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001";
const HOUSEHOLD_ID = "aabbccdd-0000-0000-0000-000000000001";
const OUT = "docs/assets/2026-09-14-render-samples/e2e";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
function asUser(userId: string, sql: string): string {
  return psql(`set role authenticated; do $$ begin perform set_config('request.jwt.claim.sub', '${userId}', false); end $$; ${sql} reset role;`);
}

/** 공개된 문제 하나를 고정한, 시작된 v3 수업(선생님 seoyeon · 학생 jihoon). 통합 테스트 fixture 와 같은 경로. */
function startedSessionWith(problemId: string): string {
  const baseUnit = psql(`select id from subject_template_units where subject_id = '${SUBJECT_ID}' order by position limit 1;`);
  const contractId = psql(`insert into contracts (household_id, child_id, status) values ('${HOUSEHOLD_ID}', '${STUDENT_ID}', 'draft') returning id;`);
  const enrollmentId = psql(`insert into subject_enrollments (child_id, subject_id, contract_id, status) values ('${STUDENT_ID}', '${SUBJECT_ID}', '${contractId}', 'planned') returning id;`);
  psql(`insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from) values ('${enrollmentId}', '${TEACHER_ID}', 'active', now() - interval '1 day');`);
  const overlayId = asUser(TEACHER_ID, `insert into student_curriculum_overlays (subject_enrollment_id) values ('${enrollmentId}') returning id;`);
  const overlayUnitId = asUser(TEACHER_ID, `insert into curriculum_overlay_units (overlay_id, source_unit_id, position, unit_title) values ('${overlayId}', '${baseUnit}', 1, 'E2E 도형 회차') returning id;`);
  // 회차 키워드 범위 안이어야 담긴다 — 이 문제에 키워드를 달고 회차에도 붙인다.
  const keywordId = psql(`insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', 'E2E 평행선 ${Date.now()}') returning id;`);
  asUser(TEACHER_ID, `insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id) values ('${overlayUnitId}', '${keywordId}');`);
  psql(`insert into problem_keywords (problem_id, keyword_id) values ('${problemId}', '${keywordId}') on conflict do nothing;`);
  const prepId = asUser(TEACHER_ID, `insert into curriculum_unit_preps (overlay_unit_id, created_by) values ('${overlayUnitId}', '${TEACHER_ID}') on conflict (overlay_unit_id) do update set created_by = excluded.created_by returning id;`);
  asUser(TEACHER_ID, `insert into curriculum_unit_prep_items (prep_id, content_type, content_id, position) values ('${prepId}', 'problem', '${problemId}', 1);`);
  const offset = 9000 + Math.floor(Math.random() * 500);
  const reservationId = psql(`insert into reservations (kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status) values ('lesson', '${enrollmentId}', '${TEACHER_ID}', now() + interval '${offset} days', now() + interval '${offset} days 1 hour', 'confirmed') returning id;`);
  const sessionId = psql(`insert into sessions (reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes) values ('${reservationId}', '${enrollmentId}', '${TEACHER_ID}', (select id from lesson_types where code = 'regular'), 60) returning id;`);
  psql(`select link_unit_prep_to_session('${overlayUnitId}', '${sessionId}', '${TEACHER_ID}');`);
  psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
  return sessionId;
}

async function rowTitles(page: Page): Promise<string[]> {
  return page.getByTestId("bank-row-title").allInnerTexts();
}

test.describe.configure({ mode: "serial" });
test.setTimeout(300_000);

test("템플릿 1: AI 의미 데이터 → 검증 → 표준 렌더 → 공개 → 학생 화면", async ({ page }, testInfo) => {
  test.skip(!process.env.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY 없음 — 실제 모델 호출이 필요한 검증");

  await loginAs(page, ACCOUNTS.admin);
  await page.goto("/admin?tab=problem-bank");
  await page.getByLabel("새 문제 과목").selectOption(SUBJECT_ID);
  await page.getByLabel("새 문제 형식").selectOption("mc");
  await page.getByLabel("문제 유형").fill("Geometry and Trigonometry");
  await expect(page.getByLabel("그림")).toHaveValue("require_geometry");
  await page.getByLabel("생성 개수").fill("1");

  const startedAt = psql(`select now()::text;`);
  await page.getByRole("button", { name: "AI로 만들기" }).click();
  // 모델 호출 — DB 에 새 문제(표준 템플릿 그림)가 생길 때까지.
  const latest = () =>
    psql(`select coalesce((select v.problem_id || '|' || v.passage from problem_versions v where v.figure->>'type' = 'parallel_transversal' and v.created_at > '${startedAt}'::timestamptz order by v.created_at desc limit 1), '');`);
  await expect.poll(latest, { timeout: 180_000 }).not.toBe("");
  const [newProblemId, passage] = latest().split("|");
  testInfo.annotations.push({ type: "generated", description: passage });
  // 목록 행은 지문 첫 부분으로 찾는다(같은 지문이 둘일 리 없다).
  const head = passage.replace(/\s+/g, " ").slice(0, 140);
  await expect.poll(async () => (await rowTitles(page)).some((t) => t.replace(/\s+/g, " ").startsWith(head)), { timeout: 30_000 }).toBe(true);
  await page.getByTestId("bank-row-title").filter({ hasText: head }).first().click();
  await expect(page.getByLabel("지문")).toBeVisible();
  await expect(page.getByLabel("지문")).toHaveValue(passage);

  // 표준 렌더러 미리보기 + 검증 결과. AI 가 지문과 어긋난 데이터를 내면 여기서 사유가 보이고 공개가 막힌다 — 그것도 기록한다.
  await expect(page.getByTestId("figure-preview")).toBeVisible();
  await page.getByTestId("figure-section").screenshot({ path: `${OUT}/01-admin-preview.png` });
  const issues = page.getByTestId("figure-issues");
  const hasIssues = (await issues.count()) > 0;
  if (hasIssues) {
    testInfo.annotations.push({ type: "blocked-by-validation", description: await issues.innerText() });
    // 공개가 막히는지 확인하고 끝낸다(기대 동작).
    await page.getByRole("button", { name: "초안 저장" }).click();
    await expect(page.getByText(/초안을 저장했습니다/)).toBeVisible();
    await expect(page.getByLabel("그림 확인함")).toBeDisabled();
    return;
  }
  await expect(page.getByText(/표준 렌더링 검증 통과/)).toBeVisible();
  await page.getByRole("button", { name: "초안 저장" }).click();
  await expect(page.getByText(/초안을 저장했습니다/)).toBeVisible();
  const check = page.getByLabel("그림 확인함");
  await expect(check).toBeEnabled();
  await check.check();
  await expect(page.getByText(/미리보기로 확인했다고 표시했습니다/)).toBeVisible();
  await page.getByRole("button", { name: "공개하기" }).click();
  await expect(page.getByText(/공개했습니다|공개됐습니다|공개되었습니다/)).toBeVisible({ timeout: 20_000 });

  // DB: 공개본에 표준 템플릿 그림 + render_check ok
  const row = psql(`select v.status || '|' || (v.figure->>'type') || '|' || (v.render_check->>'ok') from problem_versions v where v.problem_id = '${newProblemId}' order by v.version_no desc limit 1;`);
  expect(row).toBe("published|parallel_transversal|true");
  const problemId = newProblemId;

  // 학생 화면 — 같은 렌더러.
  const sessionId = startedSessionWith(problemId);
  await page.context().clearCookies();
  await loginAs(page, ACCOUNTS.student);
  await page.goto(`/session/${sessionId}?tab=problems`);
  await expect(page.getByTestId("problem-figure")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("problem-figure").locator("svg[role=img]")).toHaveCount(1);
  await page.getByTestId("problem-sheet").screenshot({ path: `${OUT}/02-student-desktop.png` });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  await expect(page.getByTestId("problem-figure")).toBeVisible({ timeout: 30_000 });
  const box = await page.getByTestId("problem-figure").locator("svg").boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 375).toBeTruthy(); // 잘림 없음
  await page.screenshot({ path: `${OUT}/03-student-mobile.png`, fullPage: true });
});

// ------------------------------------------------------------ 템플릿 2 — 삼각형·직각삼각형
test("템플릿 2: 지문(직각삼각형) → AI 관계 데이터 → 검증 → 표준 렌더 → 공개 → 학생 화면", async ({ page }, testInfo) => {
  test.skip(!process.env.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY 없음 — 실제 모델 호출이 필요한 검증");
  const passage = `In right triangle ABC shown, the right angle is at B. AB = 6 and BC = 8. What is the length of side AC? [E2E T2 ${Date.now()}]`;
  const problemId = psql(
    `insert into problems (format, passage, subject_id, status, created_by, skill_type) values ('mc', '${passage.replace(/'/g, "''")}', '${SUBJECT_ID}', 'draft', 'aaaaaaaa-0000-0000-0000-000000000001', 'Geometry and Trigonometry') returning id;`
  );
  psql(`update problem_versions set options = '["10","12","14","100"]'::jsonb, correct_index = 0, explanation = 'Pythagorean theorem: 6² + 8² = 100, so AC = 10.' where problem_id = '${problemId}' and version_no = 1;`);

  await loginAs(page, ACCOUNTS.admin);
  await page.goto("/admin?tab=problem-bank");
  await page.getByLabel("새 문제 과목").selectOption(SUBJECT_ID);
  const head = passage.slice(0, 60);
  await expect.poll(async () => (await rowTitles(page)).some((t) => t.startsWith(head)), { timeout: 30_000 }).toBe(true);
  await page.getByTestId("bank-row-title").filter({ hasText: head }).first().click();
  await expect(page.getByLabel("지문")).toHaveValue(passage);

  await page.getByRole("button", { name: "AI로 도형 데이터 만들기(삼각형)" }).click();
  await expect(page.getByTestId("figure-preview")).toBeVisible({ timeout: 120_000 });
  await page.getByTestId("figure-section").screenshot({ path: `${OUT}/04-t2-admin-preview.png` });
  const issues = page.getByTestId("figure-issues");
  if ((await issues.count()) > 0) {
    testInfo.annotations.push({ type: "blocked-by-validation", description: await issues.innerText() });
    await page.getByRole("button", { name: "초안 저장" }).click();
    await expect(page.getByText(/초안을 저장했습니다/)).toBeVisible();
    await expect(page.getByLabel("그림 확인함")).toBeDisabled();
    return;
  }
  await expect(page.getByText(/표준 렌더링 검증 통과/)).toBeVisible();
  const figureJson = await page.getByLabel("그림 데이터").inputValue();
  testInfo.annotations.push({ type: "figure", description: figureJson });
  await page.getByRole("button", { name: "초안 저장" }).click();
  await expect(page.getByText(/초안을 저장했습니다/)).toBeVisible();
  const check = page.getByLabel("그림 확인함");
  await expect(check).toBeEnabled();
  await check.check();
  await expect(page.getByText(/미리보기로 확인했다고 표시했습니다/)).toBeVisible();
  await page.getByRole("button", { name: "공개하기" }).click();
  await expect(page.getByText(/공개했습니다|공개됐습니다|공개되었습니다/)).toBeVisible({ timeout: 20_000 });
  expect(psql(`select v.status || '|' || (v.figure->>'type') || '|' || (v.render_check->>'ok') from problem_versions v where v.problem_id = '${problemId}' order by v.version_no desc limit 1;`)).toBe("published|triangle|true");

  const sessionId = startedSessionWith(problemId);
  await page.context().clearCookies();
  await loginAs(page, ACCOUNTS.student);
  await page.goto(`/session/${sessionId}?tab=problems`);
  await expect(page.getByTestId("problem-figure")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("problem-sheet").screenshot({ path: `${OUT}/05-t2-student-desktop.png` });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  await expect(page.getByTestId("problem-figure")).toBeVisible({ timeout: 30_000 });
  const box = await page.getByTestId("problem-figure").locator("svg").boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 375).toBeTruthy();
  await page.screenshot({ path: `${OUT}/06-t2-student-mobile.png`, fullPage: true });
});

// ------------------------------------------------------------ 템플릿 3 — 좌표평면(객체 id)
test("템플릿 3: 지문(직선과 점) → AI 객체 데이터 → 검증 → 표준 렌더 → 공개 → 학생 화면", async ({ page }, testInfo) => {
  test.skip(!process.env.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY 없음 — 실제 모델 호출이 필요한 검증");
  const passage = `The graph of line ℓ, y = 2x − 3, is shown in the xy-plane. Point P (2, 1) lies on line ℓ. What is the y-coordinate of the y-intercept of line ℓ? [E2E T3 ${Date.now()}]`;
  const problemId = psql(
    `insert into problems (format, passage, subject_id, status, created_by, skill_type) values ('mc', '${passage.replace(/'/g, "''")}', '${SUBJECT_ID}', 'draft', 'aaaaaaaa-0000-0000-0000-000000000001', 'Algebra') returning id;`
  );
  psql(`update problem_versions set options = '["-3","-1.5","2","3"]'::jsonb, correct_index = 0, explanation = 'At x = 0, y = −3.' where problem_id = '${problemId}' and version_no = 1;`);

  await loginAs(page, ACCOUNTS.admin);
  await page.goto("/admin?tab=problem-bank");
  await page.getByLabel("새 문제 과목").selectOption(SUBJECT_ID);
  const head = passage.slice(0, 60);
  await expect.poll(async () => (await rowTitles(page)).some((t) => t.startsWith(head)), { timeout: 30_000 }).toBe(true);
  await page.getByTestId("bank-row-title").filter({ hasText: head }).first().click();
  await expect(page.getByLabel("지문")).toHaveValue(passage);

  await page.getByRole("button", { name: "AI로 좌표평면 데이터 만들기" }).click();
  await expect(page.getByTestId("figure-preview")).toBeVisible({ timeout: 120_000 });
  await page.getByTestId("figure-section").screenshot({ path: `${OUT}/07-t3-admin-preview.png` });
  const issues = page.getByTestId("figure-issues");
  if ((await issues.count()) > 0) {
    testInfo.annotations.push({ type: "blocked-by-validation", description: await issues.innerText() });
    await page.getByRole("button", { name: "초안 저장" }).click();
    await expect(page.getByText(/초안을 저장했습니다/)).toBeVisible();
    await expect(page.getByLabel("그림 확인함")).toBeDisabled();
    return;
  }
  await expect(page.getByText(/표준 렌더링 검증 통과/)).toBeVisible();
  testInfo.annotations.push({ type: "figure", description: await page.getByLabel("그림 데이터").inputValue() });
  await page.getByRole("button", { name: "초안 저장" }).click();
  await expect(page.getByText(/초안을 저장했습니다/)).toBeVisible();
  const check = page.getByLabel("그림 확인함");
  await expect(check).toBeEnabled();
  await check.check();
  await expect(page.getByText(/미리보기로 확인했다고 표시했습니다/)).toBeVisible();
  await page.getByRole("button", { name: "공개하기" }).click();
  await expect(page.getByText(/공개했습니다|공개됐습니다|공개되었습니다/)).toBeVisible({ timeout: 20_000 });
  expect(psql(`select v.status || '|' || (v.figure->>'type') || '|' || (v.render_check->>'ok') from problem_versions v where v.problem_id = '${problemId}' order by v.version_no desc limit 1;`)).toBe("published|plane|true");

  const sessionId = startedSessionWith(problemId);
  await page.context().clearCookies();
  await loginAs(page, ACCOUNTS.student);
  await page.goto(`/session/${sessionId}?tab=problems`);
  await expect(page.getByTestId("problem-figure")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("problem-sheet").screenshot({ path: `${OUT}/08-t3-student-desktop.png` });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  await expect(page.getByTestId("problem-figure")).toBeVisible({ timeout: 30_000 });
  const box = await page.getByTestId("problem-figure").locator("svg").boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 375).toBeTruthy();
  await page.screenshot({ path: `${OUT}/09-t3-student-mobile.png`, fullPage: true });
});

// ------------------------------------------------------------ 템플릿 4 — 표·데이터 그래프
test("템플릿 4: 지문(표 자료) → AI 값 데이터 → 검증 → 표준 렌더(표) → 공개 → 학생 화면", async ({ page }, testInfo) => {
  test.skip(!process.env.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY 없음 — 실제 모델 호출이 필요한 검증");
  const passage = `The table shows the number of bottles inspected and the number of defective bottles for five production shifts. Shift 4 had 14 defective bottles out of 350 inspected. Based on the shift with the highest defect rate, which of the following is the closest estimate of the number of defective bottles in a day when 42,000 bottles are produced? [E2E T4 ${Date.now()}]`;
  const problemId = psql(
    `insert into problems (format, passage, subject_id, status, created_by, skill_type) values ('mc', '${passage.replace(/'/g, "''")}', '${SUBJECT_ID}', 'draft', 'aaaaaaaa-0000-0000-0000-000000000001', 'Problem-Solving and Data Analysis') returning id;`
  );
  psql(`update problem_versions set options = '["1,050","1,260","1,680","2,100"]'::jsonb, correct_index = 2, explanation = 'Shift 4: 14/350 = 4%. 4% of 42,000 = 1,680.' where problem_id = '${problemId}' and version_no = 1;`);

  await loginAs(page, ACCOUNTS.admin);
  await page.goto("/admin?tab=problem-bank");
  await page.getByLabel("새 문제 과목").selectOption(SUBJECT_ID);
  const head = passage.slice(0, 60);
  await expect.poll(async () => (await rowTitles(page)).some((t) => t.startsWith(head)), { timeout: 30_000 }).toBe(true);
  await page.getByTestId("bank-row-title").filter({ hasText: head }).first().click();
  await expect(page.getByLabel("지문")).toHaveValue(passage);

  await page.getByRole("button", { name: "AI로 표·그래프 데이터 만들기" }).click();
  await expect(page.getByTestId("figure-preview")).toBeVisible({ timeout: 120_000 });
  await page.getByTestId("figure-section").screenshot({ path: `${OUT}/10-t4-admin-preview.png` });
  const issues = page.getByTestId("figure-issues");
  if ((await issues.count()) > 0) {
    testInfo.annotations.push({ type: "blocked-by-validation", description: await issues.innerText() });
    await page.getByRole("button", { name: "초안 저장" }).click();
    await expect(page.getByText(/초안을 저장했습니다/)).toBeVisible();
    await expect(page.getByLabel("그림 확인함")).toBeDisabled();
    return;
  }
  await expect(page.getByText(/표준 렌더링 검증 통과/)).toBeVisible();
  testInfo.annotations.push({ type: "figure", description: await page.getByLabel("그림 데이터").inputValue() });
  await page.getByRole("button", { name: "초안 저장" }).click();
  await expect(page.getByText(/초안을 저장했습니다/)).toBeVisible();
  const check = page.getByLabel("그림 확인함");
  await expect(check).toBeEnabled();
  await check.check();
  await expect(page.getByText(/미리보기로 확인했다고 표시했습니다/)).toBeVisible();
  await page.getByRole("button", { name: "공개하기" }).click();
  await expect(page.getByText(/공개했습니다|공개됐습니다|공개되었습니다/)).toBeVisible({ timeout: 20_000 });
  expect(psql(`select v.status || '|' || (v.figure->>'type') || '|' || (v.render_check->>'ok') from problem_versions v where v.problem_id = '${problemId}' order by v.version_no desc limit 1;`)).toBe("published|data|true");

  const sessionId = startedSessionWith(problemId);
  await page.context().clearCookies();
  await loginAs(page, ACCOUNTS.student);
  await page.goto(`/session/${sessionId}?tab=problems`);
  await expect(page.getByTestId("problem-figure")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("problem-figure").locator("table, svg")).toHaveCount(1);
  await page.getByTestId("problem-sheet").screenshot({ path: `${OUT}/11-t4-student-desktop.png` });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  await expect(page.getByTestId("problem-figure")).toBeVisible({ timeout: 30_000 });
  const box = await page.getByTestId("problem-figure").boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 375).toBeTruthy();
  await page.screenshot({ path: `${OUT}/12-t4-student-mobile.png`, fullPage: true });
});
