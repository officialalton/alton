import { test, expect, type Page } from "@playwright/test";
import { ACCOUNTS, loginAs } from "./helpers";
import { psql, createFamily, cleanupFamily, startedSessionWith as startedSessionWithFixture, type FixtureFamily } from "./fixtures";

// Reading & Writing 구조화 자료 블록(2026-09-14 제품 오너 지시) — 기존 11개 유형에 대한 표준 렌더·검증·게이트 확인.
//   관리자(초안 저장 → render_check 에 RW 구조 검사 → 공개 게이트) → 학생 수업 화면(Text 1/2 구역·메모 목록·빈칸·밑줄·질문·데이터 표).
// 앞부분은 모델 호출 없이 결정적으로(관리자 저장 → 공개 → 학생), 뒷부분은 실제 AI 생성(ANTHROPIC_API_KEY 필요).
// 로컬 Supabase(시드 계정) + 로컬 dev 서버. figure-template-1.spec 과 같은 fixture 경로.
//
// 2026-09-24 — 공용 시드 학생(지훈)/household 대신 이 스펙 전용 fixture로 옮김
// (e2e/fixtures.ts).

// 2026-09-24 — figure-template-1.spec.ts/problem-bank-flow.spec.ts와 같은
// 공유 seed 과목(SAT Math)을 썼는데, 세 파일이 기본 병렬(workers>1)로 같이
// 돌면 서로 다른 파일이 동시에 이 과목에 문제를 만들고 지워 문제은행 목록이
// 오염됐다("공개하기" 버튼이 3개 매치되는 등 선택자 모호성·타임아웃 플레이크).
// 이 파일 전용 과목으로 분리해 다른 파일과 절대 겹치지 않게 한다(이름도
// 실제로 "SAT Math"였던 잘못된 부분을 함께 바로잡음 — 이 파일은 RW 문제만
// 다루는데 이름이 틀려 헷갈렸었다).
const SUBJECT_ID = "eeeeeeee-3333-0000-0000-000000000001";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const OUT = "docs/assets/2026-09-14-render-samples/e2e";

const q = (s: string) => s.replace(/'/g, "''");

let family: FixtureFamily;
// seedProblem()이 psql로 직접 심는 problems 행은 createFamily/cleanupFamily
// 관리 밖이라 실행마다 영원히 쌓인다 — id를 모아뒀다가 afterAll에서 지운다.
const seededProblemIds: string[] = [];
test.beforeAll(() => {
  psql(`insert into subjects (id, name) values ('${SUBJECT_ID}', 'E2E RW Blocks Subject') on conflict (id) do nothing;`);
  psql(`insert into subject_template_units (id, subject_id, position, unit_title) values ('eeeeeeee-3333-0000-0000-000000000002', '${SUBJECT_ID}', 1, 'E2E 회차') on conflict (id) do nothing;`);
  // is_teacher_of_subject()(20261339000000)가 teacher_curriculum_templates
  // ("담당 과목")로 문제은행 조회 RLS를 좁혀서, 이게 없으면 학생 화면 검증에서
  // 방금 공개한 문제를 curriculum_unit_prep_items에 담을 때 "존재하지 않는
  // 문제입니다" 에러가 난다(트리거가 SECURITY INVOKER라 RLS로 못 봄).
  psql(`insert into teacher_curriculum_templates (teacher_id, subject_id) values ('${TEACHER_ID}', '${SUBJECT_ID}') on conflict (teacher_id, subject_id) do nothing;`);
  family = createFamily("rwblocks", { childNames: ["E2E RW블록테스트 학생"] });
});
test.afterAll(() => {
  cleanupFamily(family);
  if (seededProblemIds.length) {
    const idList = seededProblemIds.map((id) => `'${id}'`).join(",");
    // studentView()로 시작된 세션은 mark_lesson_session_started()가
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
const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

type Seed = { skillCode: string; skillType: string; passage: string; options: string[]; correctIndex: number; explanation: string; figure?: unknown };

function seedProblem(s: Seed): string {
  // 2026-09-14 재구성으로 질문이 지문과 별도 컬럼(problem_versions.question)에
  // 저장되게 바뀌었다 — 지문 안에 질문이 섞여 있으면(옛 형식) "초안 저장"
  // 버튼 자체가 비활성화된다("질문 갈라내기"를 눌러야 함). 이 스펙의 모든
  // 호출부가 `${본문}\n\n${질문}?` 형태로 합쳐서 넘기므로, 마지막 빈 줄
  // 기준으로 나눠 두 컬럼에 각각 저장한다.
  const splitAt = s.passage.lastIndexOf("\n\n");
  const passageOnly = splitAt === -1 ? s.passage : s.passage.slice(0, splitAt);
  const questionOnly = splitAt === -1 ? "" : s.passage.slice(splitAt + 2);
  const problemId = psql(
    `insert into problems (format, passage, subject_id, status, created_by, skill_type, skill_code) values ('mc', '${q(passageOnly)}', '${SUBJECT_ID}', 'draft', '${ADMIN_ID}', '${q(s.skillType)}', '${s.skillCode}') returning id;`
  );
  psql(`update problem_versions set question = '${q(questionOnly)}', options = '${q(JSON.stringify(s.options))}'::jsonb, correct_index = ${s.correctIndex}, explanation = '${q(s.explanation)}'${s.figure ? `, figure = '${q(JSON.stringify(s.figure))}'::jsonb` : ""} where problem_id = '${problemId}' and version_no = 1;`);
  seededProblemIds.push(problemId);
  return problemId;
}

/** 관리자: 문제은행에서 행을 열고 구조 요약을 확인한 뒤 저장한다. 통과면 공개까지, 막히면 게이트 메시지를 확인한다. */
async function adminSaveAndPublish(page: Page, passage: string, problemId: string, opts: { expectBlocked?: RegExp; hasFigure?: boolean; shot?: string }) {
  await loginAs(page, ACCOUNTS.admin);
  await page.goto("/admin?tab=problem-bank");
  // 방금 psql로 심은 초안은 "검수"(기본 버킷)에 뜬다 — "생성" 버킷은 목록
  // 자체가 없다(2026-09-17 버킷 분리). 과목 select도 필터 줄의 "과목"을 쓴다.
  await page.getByLabel("과목", { exact: true }).selectOption(SUBJECT_ID);
  const head = collapse(passage).slice(0, 60);
  await expect.poll(async () => (await rowTitles(page)).some((t) => collapse(t).startsWith(head)), { timeout: 30_000 }).toBe(true);
  const rows = page.getByTestId("bank-row-title");
  const n = await rows.count();
  for (let i = 0; i < n; i++) {
    if (collapse(await rows.nth(i).innerText()).startsWith(head)) { await rows.nth(i).click(); break; }
  }
  // seedProblem()이 질문을 별도 컬럼으로 이미 갈라뒀으므로(2026-09-14 재구성),
  // "지문 / 자료" 칸에는 질문을 뺀 앞부분만 들어있다.
  const passageOnlySplit = passage.lastIndexOf("\n\n");
  const passageOnly = passageOnlySplit === -1 ? passage : passage.slice(0, passageOnlySplit);
  await expect(page.getByLabel("지문 / 자료")).toHaveValue(passageOnly);
  await expect(page.getByTestId("rw-structure")).toBeVisible();
  const structure = await page.getByTestId("rw-structure").innerText();
  await expect(page.getByTestId("passage-preview")).toBeVisible();
  if (opts.shot) await page.getByTestId("passage-preview").screenshot({ path: `${OUT}/${opts.shot}` });
  if (opts.expectBlocked) {
    await expect(page.getByTestId("content-issues")).toContainText(opts.expectBlocked);
    await page.getByRole("button", { name: "초안 저장" }).click();
    // 3-worker 병렬 실행 시 CPU 경합으로 토스트 표시가 지연되는 flake가 계속
    // 관찰돼(격리 실행 시엔 항상 13~15s 안에 통과) 45s로 늘림 — 이 세션에서 반복
    // 검증한 결과 fixture 충돌·selector 문제가 아니라 순수 로컬 머신 부하임.
    await expect(page.getByText(/초안을 저장했습니다/)).toBeVisible({ timeout: 45_000 });
    await page.getByTestId("draft-editor").getByRole("button", { name: "공개하기" }).click();
    // 게이트 메시지("표준 렌더링 검증을 통과하지 못해 공개할 수 없습니다: …")는 화면에서 사유만 남긴다(readable) — 사유가 오류 줄에 보인다.
    await expect(page.locator("p.text-red").filter({ hasText: opts.expectBlocked })).toBeVisible({ timeout: 20_000 });
    expect(psql(`select v.status || '|' || (v.render_check->>'ok') from problem_versions v where v.problem_id = '${problemId}' order by v.version_no desc limit 1;`)).toBe("draft|false");
    return structure;
  }
  await expect(page.getByTestId("content-issues")).toHaveCount(0);
  await page.getByRole("button", { name: "초안 저장" }).click();
  await expect(page.getByText(/초안을 저장했습니다/)).toBeVisible({ timeout: 15_000 });
  if (opts.hasFigure) {
    // "그림 확인함" 체크박스·수동 확인 단계는 현재 UI에서 완전히 제거됐다
    // (app/admin/ProblemDraftEditor.tsx "공개하기" 버튼은 이제 canSave·
    // missingAnswer만 보고 figure 확인 여부는 조건에 없음) — 렌더링 검증
    // 통과 문구만 확인하고 바로 공개로 진행한다.
    await expect(page.getByText(/표준 렌더링 검증 통과/)).toBeVisible({ timeout: 15_000 });
  }
  await page.getByTestId("draft-editor").getByRole("button", { name: "공개하기" }).click();
  await expect(page.getByText(/공개했습니다|공개됐습니다|공개되었습니다/)).toBeVisible({ timeout: 20_000 });
  expect(psql(`select v.status || '|' || (v.render_check->>'ok') from problem_versions v where v.problem_id = '${problemId}' order by v.version_no desc limit 1;`)).toBe("published|true");
  return structure;
}

async function studentView(page: Page, problemId: string, shots: [string, string]) {
  const sessionId = startedSessionWith(problemId);
  await page.context().clearCookies();
  // ACCOUNTS.student(공용 지훈)이 아니라 이 스펙 전용 fixture 학생으로 봐야
  // 한다 — startedSessionWith가 만든 세션은 family.children[0]에 귀속돼
  // 있어 지훈으로 보면 RLS가 막아 404가 뜬다.
  await loginAs(page, family.children[0].email);
  await page.goto(`/session/${sessionId}?tab=problems`);
  await expect(page.getByTestId("problem-sheet")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("rw-question")).toBeVisible();
  await page.getByTestId("problem-sheet").screenshot({ path: `${OUT}/${shots[0]}` });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  await expect(page.getByTestId("problem-sheet")).toBeVisible({ timeout: 30_000 });
  const box = await page.getByTestId("problem-sheet").boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 375).toBeTruthy();
  await page.screenshot({ path: `${OUT}/${shots[1]}`, fullPage: true });
}

const TAG = () => ` [E2E RW ${Date.now()}]`;

test.describe.configure({ mode: "serial" });
test.setTimeout(300_000);

// ------------------------------------------------------------ 결정적 경로(모델 없음)
test("WiC 빈칸: 정확히 하나의 ______ → 관리자 저장·공개 → 학생 화면 빈칸·질문 분리", async ({ page }) => {
  const passage = `The committee's report was ______ in its treatment of the evidence: it addressed every objection raised during the hearings without omitting inconvenient details.${TAG()}\n\nWhich choice completes the text with the most logical and precise word or phrase?`;
  const id = seedProblem({ skillCode: "words_in_context", skillType: "Words in Context", passage, options: ["thorough", "cursory", "ambiguous", "reluctant"], correctIndex: 0, explanation: "모든 반론을 다뤘다 → thorough." });
  const structure = await adminSaveAndPublish(page, passage, id, { shot: "60-wic-admin.png" });
  expect(structure).toContain("빈칸 1");
  await studentView(page, id, ["61-wic-student.png", "62-wic-mobile.png"]);
  await expect(page.getByTestId("rw-blank")).toHaveCount(1);
});

test("Text Structure 밑줄: __문장__ 하나 + 'underlined' 질문 → 학생 화면 밑줄", async ({ page }) => {
  const passage = `Many coral reefs appear healthy at a glance. __Yet beneath the surface, a slow chemical shift is eroding the skeletons that give reefs their shape.__ Researchers now measure this erosion directly with sensors placed inside reef cavities.${TAG()}\n\nWhich choice best describes the function of the underlined sentence in the text as a whole?`;
  const id = seedProblem({ skillCode: "text_structure_purpose", skillType: "Text Structure and Purpose", passage, options: ["To introduce a hidden problem that the rest of the text explains", "To summarize a debate among researchers", "To argue that reefs are healthier than they appear", "To describe a measurement technique"], correctIndex: 0, explanation: "겉보기와 다른 문제를 도입." });
  const structure = await adminSaveAndPublish(page, passage, id, { shot: "63-tsp-admin.png" });
  expect(structure).toContain("밑줄 1");
  await studentView(page, id, ["64-tsp-student.png", "65-tsp-mobile.png"]);
  await expect(page.getByTestId("rw-stimulus").locator("span.underline")).toHaveCount(1);
});

test("Cross-Text: Text 1 / Text 2 제목 구역 → 학생 화면 두 구역", async ({ page }) => {
  const passage = `Text 1\nHistorians have long treated the printing press as the decisive cause of Europe's early modern information revolution, arguing that mechanical reproduction alone made wide circulation of ideas possible.\n\nText 2\nRecent scholarship stresses that manuscript copying networks were already efficient; the press accelerated rather than created circulation, and its effects depended heavily on existing literacy and trade routes.${TAG()}\n\nBased on the texts, how would the author of Text 2 most likely respond to the claim in Text 1?`;
  const id = seedProblem({ skillCode: "cross_text_connections", skillType: "Cross-Text Connections", passage, options: ["By noting that the press built on circulation networks that already existed", "By agreeing that the press was the sole cause", "By arguing that literacy declined after the press", "By claiming manuscripts were never copied"], correctIndex: 0, explanation: "Text 2: 기존 네트워크 위에서 가속." });
  const structure = await adminSaveAndPublish(page, passage, id, { shot: "66-cross-admin.png" });
  expect(structure).toContain("Text 1·Text 2");
  await studentView(page, id, ["67-cross-student.png", "68-cross-mobile.png"]);
  await expect(page.getByTestId("rw-text-1")).toBeVisible();
  await expect(page.getByTestId("rw-text-2")).toBeVisible();
  await expect(page.getByTestId("rw-text-1").getByRole("heading")).toHaveText("Text 1");
});

test("Rhetorical Synthesis: 메모 목록 + 목표 질문 → 학생 화면 목록", async ({ page }) => {
  const passage = `While researching a topic, a student has taken the following notes:\n- The Voyager 1 probe was launched in 1977.\n- It entered interstellar space in 2012.\n- It still transmits data using a 22-watt radio.\n- Its signal takes over 22 hours to reach Earth.${TAG()}\n\nThe student wants to emphasize how long Voyager 1 has operated. Which choice most effectively uses relevant information from the notes to accomplish this goal?`;
  const id = seedProblem({ skillCode: "rhetorical_synthesis", skillType: "Rhetorical Synthesis", passage, options: ["Launched in 1977, Voyager 1 is still transmitting data decades later.", "Voyager 1's signal takes over 22 hours to reach Earth.", "Voyager 1 uses a 22-watt radio.", "Voyager 1 entered interstellar space."], correctIndex: 0, explanation: "1977 발사 + 지금도 송신 → 운영 기간 강조." });
  const structure = await adminSaveAndPublish(page, passage, id, { shot: "69-rs-admin.png" });
  expect(structure).toContain("메모 4");
  await studentView(page, id, ["70-rs-student.png", "71-rs-mobile.png"]);
  await expect(page.getByTestId("rw-notes").locator("li")).toHaveCount(4);
});

test("정량 근거: figure(type:'data') 표 + 지문(마크다운 표 없음) → 표준 표 렌더 → 학생 화면", async ({ page }) => {
  const passage = `The table shows the number of bird species recorded in three survey plots in 2010 and 2020. A team of ecologists claims that diversity increased most in the plot where grazing was removed (Plot A).${TAG()}\n\nWhich choice most effectively uses data from the table to complete the statement?`;
  const id = seedProblem({
    skillCode: "command_of_evidence_quant", skillType: "Command of Evidence (Quantitative)", passage,
    options: ["Plot A rose from 12 to 18 species, the largest increase.", "Plot B rose from 9 to 10 species, the largest increase.", "Plot C fell from 15 to 14 species.", "All three plots recorded the same number of species in 2020."],
    correctIndex: 0, explanation: "표: A 12→18(+6) 최대.",
    figure: { type: "data", kind: "table", title: "Bird Species Recorded", columns: ["Plot", "2010", "2020"], rows: [["A", 12, 18], ["B", 9, 10], ["C", 15, 14]] },
  });
  await adminSaveAndPublish(page, passage, id, { hasFigure: true, shot: "72-quant-admin.png" });
  await studentView(page, id, ["73-quant-student.png", "74-quant-mobile.png"]);
  await expect(page.getByTestId("problem-figure")).toBeVisible();
  await expect(page.getByTestId("problem-figure").locator("table")).toHaveCount(1);
});

test("문법·전환: Transitions / Boundaries 빈칸 하나 → 공개 → 학생", async ({ page }) => {
  const passage = `Solar panels convert sunlight directly into electricity. ______ their output drops sharply on overcast days, so most installations pair them with battery storage.${TAG()}\n\nWhich choice completes the text with the most logical transition?`;
  const id = seedProblem({ skillCode: "transitions", skillType: "Transitions", passage, options: ["However,", "For example,", "Therefore,", "Similarly,"], correctIndex: 0, explanation: "대조 → However." });
  await adminSaveAndPublish(page, passage, id, {});
  await studentView(page, id, ["75-trans-student.png", "76-trans-mobile.png"]);
  await expect(page.getByTestId("rw-blank")).toHaveCount(1);

  const passage2 = `The museum's new wing, designed by an architect known for her use of natural ______ opened to the public in March.${TAG()}\n\nWhich choice completes the text so that it conforms to the conventions of Standard English?`;
  const id2 = seedProblem({ skillCode: "boundaries", skillType: "Boundaries (Standard English Conventions)", passage: passage2, options: ["light,", "light;", "light", "light:"], correctIndex: 0, explanation: "삽입구 닫는 쉼표." });
  await page.context().clearCookies();
  await page.setViewportSize({ width: 1280, height: 900 });
  await adminSaveAndPublish(page, passage2, id2, {});
  expect(psql(`select status from problem_versions where problem_id = '${id2}' order by version_no desc limit 1;`)).toBe("published");
});

test("게이트: Text 2 가 빠진 Cross-Text 는 검증 사유가 보이고 공개가 막힌다", async ({ page }) => {
  const passage = `Text 1\nHistorians have long treated the printing press as the decisive cause of Europe's early modern information revolution, arguing that mechanical reproduction alone made wide circulation of ideas possible across the continent.${TAG()}\n\nBased on the texts, how would the author of Text 2 most likely respond to the claim in Text 1?`;
  const id = seedProblem({ skillCode: "cross_text_connections", skillType: "Cross-Text Connections", passage, options: ["a", "b", "c", "d"], correctIndex: 0, explanation: "x" });
  await adminSaveAndPublish(page, passage, id, { expectBlocked: /Text 1.*Text 2/, shot: "77-cross-blocked-admin.png" });
});

// ------------------------------------------------------------ AI 생성 경로(대표 유형)
const AI_CASES: { domain: string; skillLabel: string; skillCode: string; figureType?: string; prefix: string }[] = [
  { domain: "rw_craft_structure", skillLabel: "Words in Context", skillCode: "words_in_context", prefix: "80-ai-wic" },
  { domain: "rw_craft_structure", skillLabel: "Cross-Text Connections", skillCode: "cross_text_connections", prefix: "83-ai-cross" },
  { domain: "rw_expression_ideas", skillLabel: "Rhetorical Synthesis", skillCode: "rhetorical_synthesis", prefix: "86-ai-rs" },
  { domain: "rw_information_ideas", skillLabel: "Command of Evidence (Quantitative)", skillCode: "command_of_evidence_quant", figureType: "data", prefix: "89-ai-quant" },
  { domain: "rw_craft_structure", skillLabel: "Text Structure and Purpose", skillCode: "text_structure_purpose", prefix: "92-ai-tsp" },
  { domain: "rw_standard_english", skillLabel: "Boundaries", skillCode: "boundaries", prefix: "95-ai-bnd" },
];

for (const c of AI_CASES) {
  test(`AI 생성 → RW 구조 검증 → 공개 → 학생: ${c.skillLabel}`, async ({ page }, testInfo) => {
    test.skip(!process.env.E2E_REAL_AI, "E2E_REAL_AI=1 로 명시적으로 켜야 실행됨 — 실제 모델 호출 비용 발생");
    await loginAs(page, ACCOUNTS.admin);
    await page.goto("/admin?tab=problem-bank");
    await page.getByRole("button", { name: "생성", exact: true }).click();
    await page.getByLabel("새 문제 과목").selectOption(SUBJECT_ID);
    // 문항 체계 탭 SAT Reading & Writing(기본). 2026-09-17 버킷 분리로 "생성"
    // 화면엔 필터 줄이 없어져 이제 이 select가 유일하다(예전엔 필터 줄과
    // 합쳐 2개라 .nth(1)이 필요했다).
    await page.getByRole("tab", { name: "SAT Reading & Writing" }).click();
    await page.getByLabel("SAT 영역", { exact: true }).selectOption(c.domain);
    await page.getByLabel("세부 기술", { exact: true }).selectOption(c.skillCode);
    await page.getByLabel("생성 개수").fill("1");
    const startedAt = psql(`select now()::text;`);
    await page.getByRole("button", { name: "AI 생성" }).click();
    const latest = () =>
      psql(`select coalesce((select v.problem_id || '|' || v.passage from problem_versions v join problems p on p.id = v.problem_id where p.skill_code = '${c.skillCode}' and v.created_at > '${startedAt}'::timestamptz order by v.created_at desc limit 1), '');`);
    await expect.poll(latest, { timeout: 240_000 }).not.toBe("");
    const raw = latest();
    const problemId = raw.slice(0, raw.indexOf("|"));
    seededProblemIds.push(problemId);
    const passage = psql(`select passage from problem_versions where problem_id = '${problemId}' order by version_no desc limit 1;`);
    testInfo.annotations.push({ type: "generated", description: passage });
    // 생성된 초안은 "생성" 버킷에 남지 않고 "검수"에 뜬다(목록 자체가 생성
    // 버킷엔 없음) — 열어보려면 검수로 넘어가야 한다.
    await page.getByRole("button", { name: "검수", exact: true }).click();
    await page.getByLabel("과목", { exact: true }).selectOption(SUBJECT_ID);
    const head = collapse(passage).slice(0, 60);
    await expect.poll(async () => (await rowTitles(page)).some((t) => collapse(t).startsWith(head)), { timeout: 30_000 }).toBe(true);
    const rows = page.getByTestId("bank-row-title");
    const n = await rows.count();
    for (let i = 0; i < n; i++) {
      if (collapse(await rows.nth(i).innerText()).startsWith(head)) { await rows.nth(i).click(); break; }
    }
    // 기본 expect 타임아웃(5s)은 다른 파일들이 동시에 실제 AI 호출로 부하를
    // 주는 상황(3개 스펙 병렬)에서 에디터 렌더가 늦어지면 부족할 수 있어 늘림.
    await expect(page.getByLabel("지문 / 자료")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel("질문")).not.toHaveValue("");
    const structure = await page.getByTestId("rw-structure").innerText();
    testInfo.annotations.push({ type: "structure", description: structure });
    await page.getByTestId("passage-preview").screenshot({ path: `${OUT}/${c.prefix}-admin.png` });
    const issues = page.getByTestId("content-issues").or(page.getByTestId("figure-issues"));
    if ((await issues.count()) > 0) {
      testInfo.annotations.push({ type: "blocked-by-validation", description: await issues.allInnerTexts().then((t) => t.join(" / ")) });
      await page.getByRole("button", { name: "초안 저장" }).click();
      await expect(page.getByText(/초안을 저장했습니다/)).toBeVisible({ timeout: 15_000 });
      await page.getByTestId("draft-editor").getByRole("button", { name: "공개하기" }).click();
      await expect(page.locator("p.text-red").first()).toBeVisible({ timeout: 20_000 });
      expect(psql(`select status from problem_versions where problem_id = '${problemId}' order by version_no desc limit 1;`)).toBe("draft");
      return;
    }
    await page.getByRole("button", { name: "초안 저장" }).click();
    await expect(page.getByText(/초안을 저장했습니다/)).toBeVisible({ timeout: 15_000 });
    if (c.figureType) {
      // "그림 확인함" 체크박스·수동 확인 단계는 현재 UI에서 완전히 제거됐다.
      await expect(page.getByText(/표준 렌더링 검증 통과/)).toBeVisible({ timeout: 15_000 });
    }
    await page.getByTestId("draft-editor").getByRole("button", { name: "공개하기" }).click();
    await expect(page.getByText(/공개했습니다|공개됐습니다|공개되었습니다/)).toBeVisible({ timeout: 20_000 });
    expect(psql(`select v.status || '|' || (v.render_check->>'ok') || '|' || coalesce(v.figure->>'type', '-') from problem_versions v where v.problem_id = '${problemId}' order by v.version_no desc limit 1;`)).toBe(`published|true|${c.figureType ?? "-"}`);
    await studentView(page, problemId, [`${c.prefix}-student.png`, `${c.prefix}-mobile.png`]);
    if (c.skillCode === "cross_text_connections") await expect(page.getByTestId("rw-text-2")).toBeVisible();
    if (c.skillCode === "rhetorical_synthesis") await expect(page.getByTestId("rw-notes")).toBeVisible();
    if (c.skillCode === "words_in_context" && structure.includes("빈칸 1")) await expect(page.getByTestId("rw-blank")).toHaveCount(1);
    if (c.figureType) await expect(page.getByTestId("problem-figure")).toBeVisible();
  });
}
