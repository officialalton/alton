import { test, expect, type Page } from "@playwright/test";
import { ACCOUNTS, loginAs } from "./helpers";
import { psql, createFamily, cleanupFamily, startedSessionWith as startedSessionWithFixture, type FixtureFamily } from "./fixtures";

// 표준 렌더링 엔진 템플릿 1(평행선·횡단선·각) — 한 경로 검증(2026-09-14 제품 오너 지시):
//   AI 의미 데이터 생성 → 서버 검증(render_check) → 표준 렌더 미리보기 → 미리보기로 확인함 → 공개 → 학생 수업 화면.
// 로컬 Supabase(시드 계정) + 로컬 dev 서버. 실제 모델을 호출하므로 ANTHROPIC_API_KEY 가 없으면 건너뛴다.
//
// 2026-09-24 — 공용 시드 학생(지훈)/household 대신 이 스펙 전용 fixture로 옮김
// (e2e/fixtures.ts).

// 2026-09-24 — problem-bank-flow.spec.ts/rw-structured-blocks.spec.ts와 같은
// 공유 seed 과목(SAT Math)을 썼는데, 세 파일이 기본 병렬(workers>1)로 같이
// 돌면 서로 다른 파일이 동시에 이 과목에 문제를 만들고 지워 문제은행 목록이
// 오염됐다("공개하기" 버튼이 3개 매치되는 등 선택자 모호성·타임아웃 플레이크).
// 이 파일 전용 과목으로 분리해 다른 파일과 절대 겹치지 않게 한다.
const SUBJECT_ID = "eeeeeeee-1111-0000-0000-000000000001";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const OUT = "docs/assets/2026-09-14-render-samples/e2e";

let family: FixtureFamily;
// 이 파일은 여러 곳에서 직접 psql insert로 problems를 심는데(템플릿마다 개별
// insert문 + AI 생성 경로), createFamily/cleanupFamily 관리 밖이라 실행마다
// 영원히 쌓인다 — 생성한 id를 모아뒀다가 afterAll에서 지운다.
const seededProblemIds: string[] = [];
test.beforeAll(() => {
  psql(`insert into subjects (id, name) values ('${SUBJECT_ID}', 'E2E Figure Template Subject') on conflict (id) do nothing;`);
  psql(`insert into subject_template_units (id, subject_id, position, unit_title) values ('eeeeeeee-1111-0000-0000-000000000002', '${SUBJECT_ID}', 1, 'E2E 회차') on conflict (id) do nothing;`);
  // is_teacher_of_subject()(20261339000000)가 teacher_curriculum_templates
  // ("담당 과목")로 문제은행 조회 RLS를 좁혀서, 이게 없으면 학생 화면 검증에서
  // 방금 공개한 문제를 curriculum_unit_prep_items에 담을 때 "존재하지 않는
  // 문제입니다" 에러가 난다(트리거가 SECURITY INVOKER라 RLS로 못 봄).
  psql(`insert into teacher_curriculum_templates (teacher_id, subject_id) values ('${TEACHER_ID}', '${SUBJECT_ID}') on conflict (teacher_id, subject_id) do nothing;`);
  family = createFamily("figure1", { childNames: ["E2E 도형템플릿테스트 학생"] });
});
test.afterAll(() => {
  cleanupFamily(family);
  if (seededProblemIds.length) {
    const idList = seededProblemIds.map((id) => `'${id}'`).join(",");
    // 학생 화면 검증(startedSessionWith)이 mark_lesson_session_started()로
    // session_prepared_selections를 pinned로 만들어(20261236000000, 우회 불가)
    // cleanupFamily()가 curriculum_unit_prep_items를 못 지운다 — 그 항목이
    // 가리키는 문제는 영구히 지울 수 없다(설계상 정상, e2e-fixture 고유 태그라
    // 남아 있어도 다음 실행과 충돌하지 않는다). 지울 수 있는 것만 지운다.
    psql(`delete from session_content_manifest where problem_version_id in (select id from problem_versions where problem_id in (${idList}));`);
    psql(`delete from problems where id in (${idList})
      and id not in (
        select p.id from problems p join problem_versions v on v.problem_id = p.id
        where exists (select 1 from curriculum_unit_prep_items i where i.content_id = p.id)
           or exists (select 1 from session_prepared_selection_content_items sc where sc.problem_version_id = v.id)
      );`);
  }
});

/** 공개된 문제 하나를 고정한, 시작된 v3 수업(이 스펙 전용 선생님·학생). 통합 테스트 fixture 와 같은 경로. */
function startedSessionWith(problemId: string): string {
  return startedSessionWithFixture({
    problemId,
    subjectId: SUBJECT_ID,
    teacherId: TEACHER_ID,
    studentId: family.children[0].id,
    householdId: family.householdId,
  });
}

async function rowTitles(page: Page): Promise<string[]> {
  return page.getByTestId("bank-row-title").allInnerTexts();
}

test.describe.configure({ mode: "serial" });
test.setTimeout(300_000);

test("템플릿 1: AI 의미 데이터 → 검증 → 표준 렌더 → 공개 → 학생 화면", async ({ page }, testInfo) => {
  test.skip(!process.env.E2E_REAL_AI, "E2E_REAL_AI=1 로 명시적으로 켜야 실행됨 — 실제 모델 호출 비용 발생");
  // 2026-09-24 원인 확인 — 이 테스트는 원래 "생성" 패널(문항 체계 탭 →
  // lines_angles_triangles 선택 → "AI 생성")로 전체 문제를 생성해 figure.type
  // ='parallel_transversal'인 행이 생기길 기다렸다. 그런데 lines_angles_triangles는
  // 지금 MATH_COMPILER_SKILLS(app/admin/ProblemBankTab.tsx)에 들어 있어 "AI
  // 생성"을 눌러도 실제 모델을 부르지 않는 결정론적 컴파일러 경로로 가고,
  // 그 컴파일러(lib/problem-generation/math-compilers/lines-angles-triangles.ts)는
  // figure.type: "triangle"만 만든다 — "parallel_transversal"은 절대 나올 수
  // 없어 180초 뒤 항상(플레이크가 아니라 100% 재현) 타임아웃했다. 다른
  // 템플릿들(2~8)과 같은 경로 — 관리자가 지문을 직접 쓴 초안에
  // "AI로 도형 데이터 만들기(평행선·횡단선)" 버튼(진짜 실제 AI 호출,
  // app/admin/ProblemDraftEditor.tsx makeFigure)을 눌러 그림만 생성 — 로 바꾼다.
  const result = await runDraftFigureFlow(page, testInfo, {
    passage: `In the figure, lines ℓ and m are parallel and line t is a transversal crossing both. The angle formed between ℓ and t on the upper-right side measures 65°. What is the measure of the angle formed between m and t on the lower-left side? [E2E T1 ${Date.now()}]`,
    options: ["65°", "115°", "25°", "155°"], correctIndex: 0, explanation: "동위각(corresponding angles)은 같다 — 65°.", skill: "Geometry and Trigonometry",
    button: "AI로 도형 데이터 만들기(평행선·횡단선)", expectType: "parallel_transversal", shots: ["01-admin-preview.png", "02-student-desktop.png", "03-student-mobile.png"],
  });
  expect(["published", "blocked"]).toContain(result);
});

// ------------------------------------------------------------ 템플릿 2 — 삼각형·직각삼각형
test("템플릿 2: 지문(직각삼각형) → AI 관계 데이터 → 검증 → 표준 렌더 → 공개 → 학생 화면", async ({ page }, testInfo) => {
  test.skip(!process.env.E2E_REAL_AI, "E2E_REAL_AI=1 로 명시적으로 켜야 실행됨 — 실제 모델 호출 비용 발생");
  const passage = `In right triangle ABC shown, the right angle is at B. AB = 6 and BC = 8. What is the length of side AC? [E2E T2 ${Date.now()}]`;
  const problemId = psql(
    `insert into problems (format, passage, subject_id, status, created_by, skill_type) values ('mc', '${passage.replace(/'/g, "''")}', '${SUBJECT_ID}', 'draft', 'aaaaaaaa-0000-0000-0000-000000000001', 'Geometry and Trigonometry') returning id;`
  );
  psql(`update problem_versions set options = '["10","12","14","100"]'::jsonb, correct_index = 0, explanation = 'Pythagorean theorem: 6² + 8² = 100, so AC = 10.' where problem_id = '${problemId}' and version_no = 1;`);
  seededProblemIds.push(problemId);

  await loginAs(page, ACCOUNTS.admin);
  await page.goto("/admin?tab=problem-bank");
  // 방금 psql로 심은 초안은 "검수"(기본 버킷)에 뜬다 — "생성" 버킷은 목록
  // 자체가 없다(2026-09-17 버킷 분리). 과목 select도 필터 줄의 "과목"을 쓴다.
  await page.getByLabel("과목", { exact: true }).selectOption(SUBJECT_ID);
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
    await expect(page.getByText(/초안을 저장했습니다/)).toBeVisible({ timeout: 15_000 });
    // "그림 확인함" 체크박스는 현재 UI에서 제거됐다(ProblemDraftEditor.tsx
    // 공개하기 버튼은 이제 렌더 검증 결과와 무관하게 활성화됨) - 검증 실패
    // 사유가 화면에 남아있는지만 확인하고 끝낸다.
    return;
  }
  await expect(page.getByText(/표준 렌더링 검증 통과/)).toBeVisible({ timeout: 15_000 });
  const figureJson = await page.getByLabel("그림 데이터").inputValue();
  testInfo.annotations.push({ type: "figure", description: figureJson });
  await page.getByRole("button", { name: "초안 저장" }).click();
  await expect(page.getByText(/초안을 저장했습니다/)).toBeVisible({ timeout: 15_000 });
  // "그림 확인함" 체크박스·수동 확인 단계는 현재 UI에서 완전히 제거됐다
  // (공개하기 버튼이 렌더 검증 통과 여부와 무관하게 활성화됨) - 검증
  // 통과 문구만 확인하고 바로 공개로 진행한다.
  await page.getByTestId("draft-editor").getByRole("button", { name: "공개하기" }).click();
  await expect(page.getByText(/공개했습니다|공개됐습니다|공개되었습니다/)).toBeVisible({ timeout: 20_000 });
  expect(psql(`select v.status || '|' || (v.figure->>'type') || '|' || (v.render_check->>'ok') from problem_versions v where v.problem_id = '${problemId}' order by v.version_no desc limit 1;`)).toBe("published|triangle|true");

  const sessionId = startedSessionWith(problemId);
  await page.context().clearCookies();
  await loginAs(page, family.children[0].email); // 공용 지훈 아님 — 이 세션은 fixture 학생 소유
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
  test.skip(!process.env.E2E_REAL_AI, "E2E_REAL_AI=1 로 명시적으로 켜야 실행됨 — 실제 모델 호출 비용 발생");
  const passage = `The graph of line ℓ, y = 2x − 3, is shown in the xy-plane. Point P (2, 1) lies on line ℓ. What is the y-coordinate of the y-intercept of line ℓ? [E2E T3 ${Date.now()}]`;
  const problemId = psql(
    `insert into problems (format, passage, subject_id, status, created_by, skill_type) values ('mc', '${passage.replace(/'/g, "''")}', '${SUBJECT_ID}', 'draft', 'aaaaaaaa-0000-0000-0000-000000000001', 'Algebra') returning id;`
  );
  psql(`update problem_versions set options = '["-3","-1.5","2","3"]'::jsonb, correct_index = 0, explanation = 'At x = 0, y = −3.' where problem_id = '${problemId}' and version_no = 1;`);
  seededProblemIds.push(problemId);

  await loginAs(page, ACCOUNTS.admin);
  await page.goto("/admin?tab=problem-bank");
  // 방금 psql로 심은 초안은 "검수"(기본 버킷)에 뜬다 — "생성" 버킷은 목록
  // 자체가 없다(2026-09-17 버킷 분리). 과목 select도 필터 줄의 "과목"을 쓴다.
  await page.getByLabel("과목", { exact: true }).selectOption(SUBJECT_ID);
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
    await expect(page.getByText(/초안을 저장했습니다/)).toBeVisible({ timeout: 15_000 });
    // "그림 확인함" 체크박스는 현재 UI에서 제거됐다(ProblemDraftEditor.tsx
    // 공개하기 버튼은 이제 렌더 검증 결과와 무관하게 활성화됨) - 검증 실패
    // 사유가 화면에 남아있는지만 확인하고 끝낸다.
    return;
  }
  await expect(page.getByText(/표준 렌더링 검증 통과/)).toBeVisible({ timeout: 15_000 });
  testInfo.annotations.push({ type: "figure", description: await page.getByLabel("그림 데이터").inputValue() });
  await page.getByRole("button", { name: "초안 저장" }).click();
  await expect(page.getByText(/초안을 저장했습니다/)).toBeVisible({ timeout: 15_000 });
  // "그림 확인함" 체크박스·수동 확인 단계는 현재 UI에서 완전히 제거됐다
  // (공개하기 버튼이 렌더 검증 통과 여부와 무관하게 활성화됨) - 검증
  // 통과 문구만 확인하고 바로 공개로 진행한다.
  await page.getByTestId("draft-editor").getByRole("button", { name: "공개하기" }).click();
  await expect(page.getByText(/공개했습니다|공개됐습니다|공개되었습니다/)).toBeVisible({ timeout: 20_000 });
  expect(psql(`select v.status || '|' || (v.figure->>'type') || '|' || (v.render_check->>'ok') from problem_versions v where v.problem_id = '${problemId}' order by v.version_no desc limit 1;`)).toBe("published|plane|true");

  const sessionId = startedSessionWith(problemId);
  await page.context().clearCookies();
  await loginAs(page, family.children[0].email); // 공용 지훈 아님 — 이 세션은 fixture 학생 소유
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
  test.skip(!process.env.E2E_REAL_AI, "E2E_REAL_AI=1 로 명시적으로 켜야 실행됨 — 실제 모델 호출 비용 발생");
  const passage = `The table shows the number of bottles inspected and the number of defective bottles for five production shifts. Shift 4 had 14 defective bottles out of 350 inspected. Based on the shift with the highest defect rate, which of the following is the closest estimate of the number of defective bottles in a day when 42,000 bottles are produced? [E2E T4 ${Date.now()}]`;
  const problemId = psql(
    `insert into problems (format, passage, subject_id, status, created_by, skill_type) values ('mc', '${passage.replace(/'/g, "''")}', '${SUBJECT_ID}', 'draft', 'aaaaaaaa-0000-0000-0000-000000000001', 'Problem-Solving and Data Analysis') returning id;`
  );
  psql(`update problem_versions set options = '["1,050","1,260","1,680","2,100"]'::jsonb, correct_index = 2, explanation = 'Shift 4: 14/350 = 4%. 4% of 42,000 = 1,680.' where problem_id = '${problemId}' and version_no = 1;`);
  seededProblemIds.push(problemId);

  await loginAs(page, ACCOUNTS.admin);
  await page.goto("/admin?tab=problem-bank");
  // 방금 psql로 심은 초안은 "검수"(기본 버킷)에 뜬다 — "생성" 버킷은 목록
  // 자체가 없다(2026-09-17 버킷 분리). 과목 select도 필터 줄의 "과목"을 쓴다.
  await page.getByLabel("과목", { exact: true }).selectOption(SUBJECT_ID);
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
    await expect(page.getByText(/초안을 저장했습니다/)).toBeVisible({ timeout: 15_000 });
    // "그림 확인함" 체크박스는 현재 UI에서 제거됐다(ProblemDraftEditor.tsx
    // 공개하기 버튼은 이제 렌더 검증 결과와 무관하게 활성화됨) - 검증 실패
    // 사유가 화면에 남아있는지만 확인하고 끝낸다.
    return;
  }
  await expect(page.getByText(/표준 렌더링 검증 통과/)).toBeVisible({ timeout: 15_000 });
  testInfo.annotations.push({ type: "figure", description: await page.getByLabel("그림 데이터").inputValue() });
  await page.getByRole("button", { name: "초안 저장" }).click();
  await expect(page.getByText(/초안을 저장했습니다/)).toBeVisible({ timeout: 15_000 });
  // "그림 확인함" 체크박스·수동 확인 단계는 현재 UI에서 완전히 제거됐다
  // (공개하기 버튼이 렌더 검증 통과 여부와 무관하게 활성화됨) - 검증
  // 통과 문구만 확인하고 바로 공개로 진행한다.
  await page.getByTestId("draft-editor").getByRole("button", { name: "공개하기" }).click();
  await expect(page.getByText(/공개했습니다|공개됐습니다|공개되었습니다/)).toBeVisible({ timeout: 20_000 });
  expect(psql(`select v.status || '|' || (v.figure->>'type') || '|' || (v.render_check->>'ok') from problem_versions v where v.problem_id = '${problemId}' order by v.version_no desc limit 1;`)).toBe("published|data|true");

  const sessionId = startedSessionWith(problemId);
  await page.context().clearCookies();
  await loginAs(page, family.children[0].email); // 공용 지훈 아님 — 이 세션은 fixture 학생 소유
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

/** 초안(지문·선택지·해설)이 있는 문제를 열어 AI 도형 버튼 → 검증 → 저장 → 확인 → 공개 → 학생 화면까지 한 경로로 돈다. */
async function runDraftFigureFlow(page: Page, testInfo: import("@playwright/test").TestInfo, opts: { passage: string; options: string[]; correctIndex: number; explanation: string; skill: string; button: string; expectType: string; shots: [string, string, string] }) {
  const problemId = psql(
    `insert into problems (format, passage, subject_id, status, created_by, skill_type) values ('mc', '${opts.passage.replace(/'/g, "''")}', '${SUBJECT_ID}', 'draft', 'aaaaaaaa-0000-0000-0000-000000000001', '${opts.skill}') returning id;`
  );
  psql(`update problem_versions set options = '${JSON.stringify(opts.options).replace(/'/g, "''")}'::jsonb, correct_index = ${opts.correctIndex}, explanation = '${opts.explanation.replace(/'/g, "''")}' where problem_id = '${problemId}' and version_no = 1;`);
  seededProblemIds.push(problemId);
  await loginAs(page, ACCOUNTS.admin);
  await page.goto("/admin?tab=problem-bank");
  // 방금 psql로 심은 초안은 "검수"(기본 버킷)에 뜬다 — "생성" 버킷은 목록
  // 자체가 없다(2026-09-17 버킷 분리). 과목 select도 필터 줄의 "과목"을 쓴다.
  await page.getByLabel("과목", { exact: true }).selectOption(SUBJECT_ID);
  const head = opts.passage.slice(0, 60);
  await expect.poll(async () => (await rowTitles(page)).some((t) => t.startsWith(head)), { timeout: 30_000 }).toBe(true);
  await page.getByTestId("bank-row-title").filter({ hasText: head }).first().click();
  await expect(page.getByLabel("지문 / 자료")).toHaveValue(opts.passage);
  await page.getByRole("button", { name: opts.button }).click();
  await expect(page.getByTestId("figure-preview").or(page.getByText(/그림을 만들지 못했습니다/))).toBeVisible({ timeout: 120_000 });
  if (await page.getByText(/그림을 만들지 못했습니다/).count()) {
    testInfo.annotations.push({ type: "generation-rejected", description: await page.getByText(/그림을 만들지 못했습니다/).innerText() });
    return "generation-rejected";
  }
  await page.getByTestId("figure-section").screenshot({ path: `${OUT}/${opts.shots[0]}` });
  const issues = page.getByTestId("figure-issues");
  if ((await issues.count()) > 0) {
    testInfo.annotations.push({ type: "blocked-by-validation", description: await issues.innerText() });
    await page.getByRole("button", { name: "초안 저장" }).click();
    await expect(page.getByText(/초안을 저장했습니다/)).toBeVisible({ timeout: 15_000 });
    return "blocked";
  }
  await expect(page.getByText(/표준 렌더링 검증 통과/)).toBeVisible({ timeout: 15_000 });
  testInfo.annotations.push({ type: "figure", description: await page.getByLabel("그림 데이터").inputValue() });
  await page.getByRole("button", { name: "초안 저장" }).click();
  await expect(page.getByText(/초안을 저장했습니다/)).toBeVisible({ timeout: 15_000 });
  // "그림 확인함" 체크박스·수동 확인 단계는 현재 UI에서 완전히 제거됐다
  // (공개하기 버튼이 렌더 검증 통과 여부와 무관하게 활성화됨) - 검증
  // 통과 문구만 확인하고 바로 공개로 진행한다.
  await page.getByTestId("draft-editor").getByRole("button", { name: "공개하기" }).click();
  await expect(page.getByText(/공개했습니다|공개됐습니다|공개되었습니다/)).toBeVisible({ timeout: 20_000 });
  expect(psql(`select v.status || '|' || (v.figure->>'type') || '|' || (v.render_check->>'ok') from problem_versions v where v.problem_id = '${problemId}' order by v.version_no desc limit 1;`)).toBe(`published|${opts.expectType}|true`);
  const sessionId = startedSessionWith(problemId);
  await page.context().clearCookies();
  await loginAs(page, family.children[0].email); // 공용 지훈 아님 — 이 세션은 fixture 학생 소유
  await page.goto(`/session/${sessionId}?tab=problems`);
  // 그래프 선택지(figure_choice)는 선택지 칸 안에 그림이 들어가므로 problem-figure 대신 choice-figure-0 을 본다.
  const figureEl = page.getByTestId("problem-figure").or(page.getByTestId("choice-figure-0")).first();
  await expect(figureEl).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("problem-sheet").screenshot({ path: `${OUT}/${opts.shots[1]}` });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  await expect(figureEl).toBeVisible({ timeout: 30_000 });
  const box = await figureEl.boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 375).toBeTruthy();
  await page.screenshot({ path: `${OUT}/${opts.shots[2]}`, fullPage: true });
  return "published";
}

// ------------------------------------------------------------ 템플릿 5 — 원
test("템플릿 5: 지문(원·접선) → AI 관계 데이터 → 검증 → 표준 렌더 → 공개 → 학생 화면", async ({ page }, testInfo) => {
  test.skip(!process.env.E2E_REAL_AI, "E2E_REAL_AI=1 로 명시적으로 켜야 실행됨 — 실제 모델 호출 비용 발생");
  const result = await runDraftFigureFlow(page, testInfo, {
    passage: `In the figure, the circle has center O, and line PT is tangent to the circle at point T. OT = 5 and PT = 12. What is the length of segment OP? [E2E T5 ${Date.now()}]`,
    options: ["7", "13", "17", "√119"], correctIndex: 1, explanation: "OT ⟂ PT, so OP² = 5² + 12² = 169 and OP = 13.", skill: "Geometry and Trigonometry",
    button: "AI로 도형 데이터 만들기(원)", expectType: "circle", shots: ["13-t5-admin-preview.png", "14-t5-student-desktop.png", "15-t5-student-mobile.png"],
  });
  expect(["published", "blocked"]).toContain(result);
});

// ------------------------------------------------------------ 템플릿 3 보완 — 음영 부등식
test("템플릿 3 보완: 지문(연립 부등식) → AI 객체 데이터(음영) → 검증 → 공개 → 학생 화면", async ({ page }, testInfo) => {
  test.skip(!process.env.E2E_REAL_AI, "E2E_REAL_AI=1 로 명시적으로 켜야 실행됨 — 실제 모델 호출 비용 발생");
  const result = await runDraftFigureFlow(page, testInfo, {
    passage: `The system of inequalities y ≤ x + 2 and y > -x - 1 is graphed in the xy-plane. Which of the following points is a solution to the system? [E2E T3b ${Date.now()}]`,
    options: ["(0, 3)", "(1, 1)", "(-3, 1)", "(4, -6)"], correctIndex: 1, explanation: "(1, 1): 1 ≤ 3 and 1 > -2.", skill: "Algebra",
    button: "AI로 좌표평면 데이터 만들기", expectType: "plane", shots: ["16-t3b-admin-preview.png", "17-t3b-student-desktop.png", "18-t3b-student-mobile.png"],
  });
  expect(["published", "blocked"]).toContain(result);
});

// ------------------------------------------------------------ 템플릿 6·7 — 사각형·다각형 / 입체
test("템플릿 6: 지문(사다리꼴 넓이) → AI 관계 데이터 → 검증 → 공개 → 학생 화면", async ({ page }, testInfo) => {
  test.skip(!process.env.E2E_REAL_AI, "E2E_REAL_AI=1 로 명시적으로 켜야 실행됨 — 실제 모델 호출 비용 발생");
  const result = await runDraftFigureFlow(page, testInfo, {
    passage: `Trapezoid ABCD has parallel bases AB = 14 and CD = 8, and the height from C to base AB is 5. What is the area of the trapezoid? [E2E T6 ${Date.now()}]`,
    options: ["40", "55", "70", "110"], correctIndex: 1, explanation: "Area = (14 + 8)/2 × 5 = 55.", skill: "Geometry and Trigonometry",
    button: "AI로 도형 데이터 만들기(사각형·다각형)", expectType: "polygon", shots: ["19-t6-admin-preview.png", "20-t6-student-desktop.png", "21-t6-student-mobile.png"],
  });
  expect(["published", "blocked"]).toContain(result);
});
test("템플릿 7: 지문(원기둥 부피) → AI 치수 데이터 → 검증 → 공개 → 학생 화면", async ({ page }, testInfo) => {
  test.skip(!process.env.E2E_REAL_AI, "E2E_REAL_AI=1 로 명시적으로 켜야 실행됨 — 실제 모델 호출 비용 발생");
  const result = await runDraftFigureFlow(page, testInfo, {
    passage: `A right circular cylinder has a radius of 3 inches and a height of 10 inches. What is the volume of the cylinder, in cubic inches? [E2E T7 ${Date.now()}]`,
    options: ["30π", "60π", "90π", "180π"], correctIndex: 2, explanation: "V = πr²h = π·9·10 = 90π.", skill: "Geometry and Trigonometry",
    button: "AI로 도형 데이터 만들기(입체)", expectType: "solid", shots: ["22-t7-admin-preview.png", "23-t7-student-desktop.png", "24-t7-student-mobile.png"],
  });
  expect(["published", "blocked"]).toContain(result);
});

// ------------------------------------------------------------ 수식·선택지 블록 — 로마숫자 진술(AI 없이 관리자 저장 → 공개 → 학생)
test("진술 블록: 로마숫자 진술 + 조합 선택지 → 내용 검증 → 공개 → 학생 화면(KaTeX)", async ({ page }) => {
  const passage = `If $a$ and $b$ are real numbers such that $a + b > 0$ and $ab < 0$, which of the following must be true? [E2E ST ${Date.now()}]`;
  const problemId = psql(
    `insert into problems (format, passage, subject_id, status, created_by, skill_type) values ('mc', '${passage.replace(/'/g, "''")}', '${SUBJECT_ID}', 'draft', 'aaaaaaaa-0000-0000-0000-000000000001', 'Algebra') returning id;`
  );
  psql(`update problem_versions set options = '["I only","II only","I and II","Neither"]'::jsonb, correct_index = 0, explanation = 'Since $ab < 0$, exactly one is negative; $a + b > 0$ makes the positive one larger in magnitude — so I must be true.', statements = '["$|a| \\\\neq |b|$","$a > b$"]'::jsonb where problem_id = '${problemId}' and version_no = 1;`);
  seededProblemIds.push(problemId);
  await loginAs(page, ACCOUNTS.admin);
  await page.goto("/admin?tab=problem-bank");
  // 방금 psql로 심은 초안은 "검수"(기본 버킷)에 뜬다 — "생성" 버킷은 목록
  // 자체가 없다(2026-09-17 버킷 분리). 과목 select도 필터 줄의 "과목"을 쓴다.
  await page.getByLabel("과목", { exact: true }).selectOption(SUBJECT_ID);
  // 2026-09-24 — head가 50자였는데 이 지문의 고정(태그 없는) 앞부분이 50자보다
  // 길어 반복 실행마다 항상 같은 head로 매칭됐다. 이전 실행이 정리 못 하고 남긴
  // 동일 head의 초안이 있으면 .first()가 그 오래된(엉뚱한) 행을 열어 "공개하기"가
  // 두 번 렌더되는(strict mode violation) 원인이 됐다 — 태그(타임스탬프)까지
  // 포함되도록 head를 늘려 실행마다 유일하게 만든다.
  const head = passage.replace(/\s+/g, " ").slice(0, 120);
  await expect.poll(async () => (await rowTitles(page)).some((t) => t.replace(/\s+/g, " ").startsWith(head)), { timeout: 30_000 }).toBe(true);
  await page.getByTestId("bank-row-title").filter({ hasText: head }).first().click();
  await expect(page.getByLabel("진술 목록")).toHaveValue(/neq/);
  await expect(page.locator('[data-testid="content-issues"]')).toHaveCount(0);
  await page.getByRole("button", { name: "초안 저장" }).click();
  await expect(page.getByText(/초안을 저장했습니다/)).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("draft-editor").getByRole("button", { name: "공개하기" }).click();
  await expect(page.getByText(/공개했습니다|공개됐습니다|공개되었습니다/)).toBeVisible({ timeout: 20_000 });
  expect(psql(`select v.status || '|' || (v.render_check->>'ok') || '|' || jsonb_array_length(v.statements) from problem_versions v where v.problem_id = '${problemId}' order by v.version_no desc limit 1;`)).toBe("published|true|2");
  const sessionId = startedSessionWith(problemId);
  await page.context().clearCookies();
  await loginAs(page, family.children[0].email); // 공용 지훈 아님 — 이 세션은 fixture 학생 소유
  await page.goto(`/session/${sessionId}?tab=problems`);
  await expect(page.getByTestId("statements")).toBeVisible({ timeout: 30_000 });
  expect(await page.getByTestId("statements").locator(".katex").count()).toBe(2);
  await expect(page.getByText("I and II")).toBeVisible();
  await page.getByTestId("problem-sheet").screenshot({ path: `${OUT}/25-st-student-desktop.png` });
});

// ------------------------------------------------------------ 그래프 선택지(figure_choice, AI)
test("그래프 선택지: 지문 → AI 그래프 4개 → 편향 검증 → 공개 → 학생 화면(선택지 안 그림)", async ({ page }, testInfo) => {
  test.skip(!process.env.E2E_REAL_AI, "E2E_REAL_AI=1 로 명시적으로 켜야 실행됨 — 실제 모델 호출 비용 발생");
  const result = await runDraftFigureFlow(page, testInfo, {
    passage: `Which of the following graphs in the xy-plane represents the equation y = -2x + 3? [E2E FC ${Date.now()}]`,
    options: ["A", "B", "C", "D"], correctIndex: 1, explanation: "Slope −2 and y-intercept 3.", skill: "Algebra",
    button: "AI로 그래프/도형 선택지 4개 만들기", expectType: "figure_choice", shots: ["26-fc-admin-preview.png", "27-fc-student-desktop.png", "28-fc-student-mobile.png"],
  });
  expect(["published", "blocked"]).toContain(result);
  if (result === "published") expect(await page.getByTestId("choice-figure-0").count()).toBe(1);
});

// ------------------------------------------------------------ 매트릭스 '부분' 3건 + E2E 없던 표현들
const runAI = (name: string, opts: Parameters<typeof runDraftFigureFlow>[2]) =>
  test(name, async ({ page }, testInfo) => {
    test.skip(!process.env.E2E_REAL_AI, "E2E_REAL_AI=1 로 명시적으로 켜야 실행됨 — 실제 모델 호출 비용 발생");
    const result = await runDraftFigureFlow(page, testInfo, opts);
    expect(["published", "blocked"]).toContain(result);
    testInfo.annotations.push({ type: "result", description: result });
  });

runAI("부분1 비선형 연립 교점: 포물선+직선 → 공개 → 학생", {
  passage: `The graphs of y = x² − 1 and y = x + 1 are shown in the xy-plane. The graphs intersect at the points (-1, 0) and (2, 3). What is the sum of the x-coordinates of the intersection points? [E2E NL ${Date.now()}]`,
  options: ["-1", "1", "2", "3"], correctIndex: 1, explanation: "x² − 1 = x + 1 → x² − x − 2 = 0 → x = −1, 2; sum 1.", skill: "Advanced Math",
  button: "AI로 좌표평면 데이터 만들기", expectType: "plane", shots: ["29-nl-admin.png", "30-nl-student.png", "31-nl-mobile.png"],
});
runAI("부분2 통계적 주장 판단: 연구 설계 자료 → 공개 → 학생", {
  passage: `A researcher randomly assigned 200 plants from one greenhouse to two groups. Group A received a new fertilizer and Group B received the standard fertilizer. After 6 weeks, plants in Group A were taller on average. Which conclusion is best supported by the study design? [E2E SC ${Date.now()}]`,
  options: ["The new fertilizer causes taller growth for plants in this greenhouse.", "The new fertilizer causes taller growth for all plants.", "No conclusion about cause can be drawn.", "Taller plants prefer the new fertilizer."], correctIndex: 0, explanation: "Random assignment supports a causal conclusion, but only for the population sampled (this greenhouse).", skill: "Problem-Solving and Data Analysis",
  button: "AI로 표·그래프 데이터 만들기", expectType: "data", shots: ["32-sc-admin.png", "33-sc-student.png", "34-sc-mobile.png"],
});
runAI("부분3 포물선 그래프 선택지 → 정답 자리 → 공개 → 학생", {
  passage: `Which of the following graphs in the xy-plane represents the equation y = x² − 2x − 3? [E2E PC ${Date.now()}]`,
  options: ["A", "B", "C", "D"], correctIndex: 2, explanation: "Opens upward with vertex (1, −4) and x-intercepts −1 and 3.", skill: "Advanced Math",
  button: "AI로 그래프/도형 선택지 4개 만들기", expectType: "figure_choice", shots: ["35-pc-admin.png", "36-pc-student.png", "37-pc-mobile.png"],
});
runAI("도형 선택지: 직각삼각형 고르기 → 공개 → 학생", {
  passage: `Which of the following triangles is a right triangle? (Side lengths are shown.) [E2E TC ${Date.now()}]`,
  options: ["A", "B", "C", "D"], correctIndex: 0, explanation: "3² + 4² = 5².", skill: "Geometry and Trigonometry",
  button: "AI로 그래프/도형 선택지 4개 만들기", expectType: "figure_choice", shots: ["38-tc-admin.png", "39-tc-student.png", "40-tc-mobile.png"],
});
runAI("복수 자료 Figure A / Table B → 공개 → 학생", {
  passage: `Figure A shows the graph of the line y = 2x − 1 in the xy-plane, and Table B lists four ordered pairs. Which ordered pair in Table B is NOT on the line in Figure A? [E2E FS ${Date.now()}]`,
  options: ["(0, -1)", "(1, 1)", "(2, 4)", "(3, 5)"], correctIndex: 2, explanation: "2·2 − 1 = 3 ≠ 4.", skill: "Algebra",
  button: "AI로 복수 자료(A/B) 만들기", expectType: "figure_set", shots: ["41-fs-admin.png", "42-fs-student.png", "43-fs-mobile.png"],
});
runAI("좌표기하·변환: 삼각형 평행이동 → 공개 → 학생", {
  passage: `Triangle ABC has vertices A(-4, 1), B(-1, 1), and C(-1, 3). Triangle ABC is translated 5 units to the right and 2 units up to form triangle A′B′C′. What are the coordinates of C′? [E2E CG ${Date.now()}]`,
  options: ["(4, 5)", "(4, 1)", "(-6, 5)", "(6, 4)"], correctIndex: 0, explanation: "(-1 + 5, 3 + 2) = (4, 5).", skill: "Geometry and Trigonometry",
  button: "AI로 좌표평면 데이터 만들기", expectType: "plane", shots: ["44-cg-admin.png", "45-cg-student.png", "46-cg-mobile.png"],
});
runAI("데이터 그래프(막대) → 공개 → 학생", {
  passage: `The bar graph shows the monthly sales, in dollars, for Store A and Store B from January to April. In March, Store B had sales of 1,600 dollars. By what percent did Store A's sales increase from March (1,100) to April (1,800)? [E2E BAR ${Date.now()}]`,
  options: ["about 39%", "about 64%", "about 70%", "about 164%"], correctIndex: 1, explanation: "(1800 − 1100)/1100 ≈ 63.6%.", skill: "Problem-Solving and Data Analysis",
  button: "AI로 표·그래프 데이터 만들기", expectType: "data", shots: ["47-bar-admin.png", "48-bar-student.png", "49-bar-mobile.png"],
});
runAI("복합 도형(정사각형 안 원, 음영) → 공개 → 학생", {
  passage: `A circle with radius 5 is inscribed in a square with side length 10, as shown. What is the area of the shaded region between the square and the circle? [E2E CP ${Date.now()}]`,
  options: ["100 − 25π", "100 − 10π", "25π − 100", "50 − 25π"], correctIndex: 0, explanation: "10² − π·5² = 100 − 25π.", skill: "Geometry and Trigonometry",
  button: "AI로 도형 데이터 만들기(복합·음영)", expectType: "composite", shots: ["50-cp-admin.png", "51-cp-student.png", "52-cp-mobile.png"],
});
