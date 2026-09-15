import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { ACCOUNTS, loginAs } from "./helpers";

// Reading & Writing 구조화 자료 블록(2026-09-14 제품 오너 지시) — 기존 11개 유형에 대한 표준 렌더·검증·게이트 확인.
//   관리자(초안 저장 → render_check 에 RW 구조 검사 → 공개 게이트) → 학생 수업 화면(Text 1/2 구역·메모 목록·빈칸·밑줄·질문·데이터 표).
// 앞부분은 모델 호출 없이 결정적으로(관리자 저장 → 공개 → 학생), 뒷부분은 실제 AI 생성(ANTHROPIC_API_KEY 필요).
// 로컬 Supabase(시드 계정) + 로컬 dev 서버. figure-template-1.spec 과 같은 fixture 경로.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001";
const HOUSEHOLD_ID = "aabbccdd-0000-0000-0000-000000000001";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const OUT = "docs/assets/2026-09-14-render-samples/e2e";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
function asUser(userId: string, sql: string): string {
  return psql(`set role authenticated; do $$ begin perform set_config('request.jwt.claim.sub', '${userId}', false); end $$; ${sql} reset role;`);
}
const q = (s: string) => s.replace(/'/g, "''");

function startedSessionWith(problemId: string): string {
  const baseUnit = psql(`select id from subject_template_units where subject_id = '${SUBJECT_ID}' order by position limit 1;`);
  const contractId = psql(`insert into contracts (household_id, child_id, status) values ('${HOUSEHOLD_ID}', '${STUDENT_ID}', 'draft') returning id;`);
  const enrollmentId = psql(`insert into subject_enrollments (child_id, subject_id, contract_id, status) values ('${STUDENT_ID}', '${SUBJECT_ID}', '${contractId}', 'planned') returning id;`);
  psql(`insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from) values ('${enrollmentId}', '${TEACHER_ID}', 'active', now() - interval '1 day');`);
  const overlayId = asUser(TEACHER_ID, `insert into student_curriculum_overlays (subject_enrollment_id) values ('${enrollmentId}') returning id;`);
  const overlayUnitId = asUser(TEACHER_ID, `insert into curriculum_overlay_units (overlay_id, source_unit_id, position, unit_title) values ('${overlayId}', '${baseUnit}', 1, 'E2E RW 회차') returning id;`);
  const keywordId = psql(`insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', 'E2E RW ${Date.now()}${Math.floor(Math.random() * 1000)}') returning id;`);
  asUser(TEACHER_ID, `insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id) values ('${overlayUnitId}', '${keywordId}');`);
  psql(`insert into problem_keywords (problem_id, keyword_id) values ('${problemId}', '${keywordId}') on conflict do nothing;`);
  const prepId = asUser(TEACHER_ID, `insert into curriculum_unit_preps (overlay_unit_id, created_by) values ('${overlayUnitId}', '${TEACHER_ID}') on conflict (overlay_unit_id) do update set created_by = excluded.created_by returning id;`);
  asUser(TEACHER_ID, `insert into curriculum_unit_prep_items (prep_id, content_type, content_id, position) values ('${prepId}', 'problem', '${problemId}', 1);`);
  const offset = 9500 + Math.floor(Math.random() * 400);
  const reservationId = psql(`insert into reservations (kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status) values ('lesson', '${enrollmentId}', '${TEACHER_ID}', now() + interval '${offset} days', now() + interval '${offset} days 1 hour', 'confirmed') returning id;`);
  const sessionId = psql(`insert into sessions (reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes) values ('${reservationId}', '${enrollmentId}', '${TEACHER_ID}', (select id from lesson_types where code = 'regular'), 60) returning id;`);
  psql(`select link_unit_prep_to_session('${overlayUnitId}', '${sessionId}', '${TEACHER_ID}');`);
  psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
  return sessionId;
}

async function rowTitles(page: Page): Promise<string[]> {
  return page.getByTestId("bank-row-title").allInnerTexts();
}
const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

type Seed = { skillCode: string; skillType: string; passage: string; options: string[]; correctIndex: number; explanation: string; figure?: unknown };

function seedProblem(s: Seed): string {
  const problemId = psql(
    `insert into problems (format, passage, subject_id, status, created_by, skill_type, skill_code) values ('mc', '${q(s.passage)}', '${SUBJECT_ID}', 'draft', '${ADMIN_ID}', '${q(s.skillType)}', '${s.skillCode}') returning id;`
  );
  psql(`update problem_versions set options = '${q(JSON.stringify(s.options))}'::jsonb, correct_index = ${s.correctIndex}, explanation = '${q(s.explanation)}'${s.figure ? `, figure = '${q(JSON.stringify(s.figure))}'::jsonb` : ""} where problem_id = '${problemId}' and version_no = 1;`);
  return problemId;
}

/** 관리자: 문제은행에서 행을 열고 구조 요약을 확인한 뒤 저장한다. 통과면 공개까지, 막히면 게이트 메시지를 확인한다. */
async function adminSaveAndPublish(page: Page, passage: string, problemId: string, opts: { expectBlocked?: RegExp; hasFigure?: boolean; shot?: string }) {
  await loginAs(page, ACCOUNTS.admin);
  await page.goto("/admin?tab=problem-bank");
  await page.getByLabel("새 문제 과목").selectOption(SUBJECT_ID);
  const head = collapse(passage).slice(0, 60);
  await expect.poll(async () => (await rowTitles(page)).some((t) => collapse(t).startsWith(head)), { timeout: 30_000 }).toBe(true);
  const rows = page.getByTestId("bank-row-title");
  const n = await rows.count();
  for (let i = 0; i < n; i++) {
    if (collapse(await rows.nth(i).innerText()).startsWith(head)) { await rows.nth(i).click(); break; }
  }
  await expect(page.getByLabel("지문")).toHaveValue(passage);
  await expect(page.getByTestId("rw-structure")).toBeVisible();
  const structure = await page.getByTestId("rw-structure").innerText();
  await expect(page.getByTestId("passage-preview")).toBeVisible();
  if (opts.shot) await page.getByTestId("passage-preview").screenshot({ path: `${OUT}/${opts.shot}` });
  if (opts.expectBlocked) {
    await expect(page.getByTestId("content-issues")).toContainText(opts.expectBlocked);
    await page.getByRole("button", { name: "초안 저장" }).click();
    await expect(page.getByText(/초안을 저장했습니다/)).toBeVisible();
    await page.getByRole("button", { name: "공개하기" }).click();
    // 게이트 메시지("표준 렌더링 검증을 통과하지 못해 공개할 수 없습니다: …")는 화면에서 사유만 남긴다(readable) — 사유가 오류 줄에 보인다.
    await expect(page.locator("p.text-red").filter({ hasText: opts.expectBlocked })).toBeVisible({ timeout: 20_000 });
    expect(psql(`select v.status || '|' || (v.render_check->>'ok') from problem_versions v where v.problem_id = '${problemId}' order by v.version_no desc limit 1;`)).toBe("draft|false");
    return structure;
  }
  await expect(page.getByTestId("content-issues")).toHaveCount(0);
  await page.getByRole("button", { name: "초안 저장" }).click();
  await expect(page.getByText(/초안을 저장했습니다/)).toBeVisible();
  if (opts.hasFigure) {
    await expect(page.getByText(/표준 렌더링 검증 통과/)).toBeVisible();
    const check = page.getByLabel("그림 확인함");
    await expect(check).toBeEnabled();
    await check.check();
    await expect(page.getByText(/미리보기로 확인했다고 표시했습니다/)).toBeVisible();
  }
  await page.getByRole("button", { name: "공개하기" }).click();
  await expect(page.getByText(/공개했습니다|공개됐습니다|공개되었습니다/)).toBeVisible({ timeout: 20_000 });
  expect(psql(`select v.status || '|' || (v.render_check->>'ok') from problem_versions v where v.problem_id = '${problemId}' order by v.version_no desc limit 1;`)).toBe("published|true");
  return structure;
}

async function studentView(page: Page, problemId: string, shots: [string, string]) {
  const sessionId = startedSessionWith(problemId);
  await page.context().clearCookies();
  await loginAs(page, ACCOUNTS.student);
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
    test.skip(!process.env.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY 없음 — 실제 모델 호출이 필요한 검증");
    await loginAs(page, ACCOUNTS.admin);
    await page.goto("/admin?tab=problem-bank");
    await page.getByLabel("새 문제 과목").selectOption(SUBJECT_ID);
    await page.getByLabel("새 문제 형식").selectOption("mc");
    // 필터 줄(첫 번째)과 새 문제 줄(두 번째)에 같은 라벨의 선택이 있다 — 새 문제 줄을 쓴다.
    await page.getByLabel("SAT 영역", { exact: true }).nth(1).selectOption(c.domain);
    await page.getByLabel("세부 기술", { exact: true }).nth(1).selectOption(c.skillCode);
    await page.getByLabel("생성 개수").fill("1");
    const startedAt = psql(`select now()::text;`);
    await page.getByRole("button", { name: "AI로 만들기" }).click();
    const latest = () =>
      psql(`select coalesce((select v.problem_id || '|' || v.passage from problem_versions v join problems p on p.id = v.problem_id where p.skill_code = '${c.skillCode}' and v.created_at > '${startedAt}'::timestamptz order by v.created_at desc limit 1), '');`);
    await expect.poll(latest, { timeout: 240_000 }).not.toBe("");
    const raw = latest();
    const problemId = raw.slice(0, raw.indexOf("|"));
    const passage = psql(`select passage from problem_versions where problem_id = '${problemId}' order by version_no desc limit 1;`);
    testInfo.annotations.push({ type: "generated", description: passage });
    const head = collapse(passage).slice(0, 60);
    await expect.poll(async () => (await rowTitles(page)).some((t) => collapse(t).startsWith(head)), { timeout: 30_000 }).toBe(true);
    const rows = page.getByTestId("bank-row-title");
    const n = await rows.count();
    for (let i = 0; i < n; i++) {
      if (collapse(await rows.nth(i).innerText()).startsWith(head)) { await rows.nth(i).click(); break; }
    }
    await expect(page.getByLabel("지문")).toBeVisible();
    const structure = await page.getByTestId("rw-structure").innerText();
    testInfo.annotations.push({ type: "structure", description: structure });
    await page.getByTestId("passage-preview").screenshot({ path: `${OUT}/${c.prefix}-admin.png` });
    const issues = page.getByTestId("content-issues").or(page.getByTestId("figure-issues"));
    if ((await issues.count()) > 0) {
      testInfo.annotations.push({ type: "blocked-by-validation", description: await issues.allInnerTexts().then((t) => t.join(" / ")) });
      await page.getByRole("button", { name: "초안 저장" }).click();
      await expect(page.getByText(/초안을 저장했습니다/)).toBeVisible();
      await page.getByRole("button", { name: "공개하기" }).click();
      await expect(page.locator("p.text-red").first()).toBeVisible({ timeout: 20_000 });
      expect(psql(`select status from problem_versions where problem_id = '${problemId}' order by version_no desc limit 1;`)).toBe("draft");
      return;
    }
    await page.getByRole("button", { name: "초안 저장" }).click();
    await expect(page.getByText(/초안을 저장했습니다/)).toBeVisible();
    if (c.figureType) {
      await expect(page.getByText(/표준 렌더링 검증 통과/)).toBeVisible();
      const check = page.getByLabel("그림 확인함");
      await expect(check).toBeEnabled();
      await check.check();
      await expect(page.getByText(/미리보기로 확인했다고 표시했습니다/)).toBeVisible();
    }
    await page.getByRole("button", { name: "공개하기" }).click();
    await expect(page.getByText(/공개했습니다|공개됐습니다|공개되었습니다/)).toBeVisible({ timeout: 20_000 });
    expect(psql(`select v.status || '|' || (v.render_check->>'ok') || '|' || coalesce(v.figure->>'type', '-') from problem_versions v where v.problem_id = '${problemId}' order by v.version_no desc limit 1;`)).toBe(`published|true|${c.figureType ?? "-"}`);
    await studentView(page, problemId, [`${c.prefix}-student.png`, `${c.prefix}-mobile.png`]);
    if (c.skillCode === "cross_text_connections") await expect(page.getByTestId("rw-text-2")).toBeVisible();
    if (c.skillCode === "rhetorical_synthesis") await expect(page.getByTestId("rw-notes")).toBeVisible();
    if (c.skillCode === "words_in_context" && structure.includes("빈칸 1")) await expect(page.getByTestId("rw-blank")).toHaveCount(1);
    if (c.figureType) await expect(page.getByTestId("problem-figure")).toBeVisible();
  });
}
