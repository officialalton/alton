import { test, expect, type Page } from "@playwright/test";
import { ACCOUNTS, loginAs } from "./helpers";
import { psql, createFamily, cleanupFamily, startedSessionWith as startedSessionWithFixture, type FixtureFamily } from "./fixtures";

// 문제은행 생성·편집 재구성(2026-09-14 제품 오너 지시) 검증.
//   * 문항 체계 탭(SAT R&W / SAT Math / AP) → 관리 과목·키워드 → 문제 규격 → 지문/자료 → 질문 → 답안 → 해설 → 저장/공개
//   * 체계·유형에 필요한 항목만 보이고(제목·안내), 자료 필요성은 시스템이 판정한다
//   * 단건(1개)·복수(2개) AI 생성 모두 질문이 따로 저장되고 같은 계약·검증·게이트를 거친다
//   * 대표 사례: R&W 5 유형, Math 4 유형(도형·좌표평면·데이터 그래프·SPR), AP 과목 선택 화면
// 실제 모델을 호출한다(ANTHROPIC_API_KEY). 로컬 Supabase 시드 계정 + 로컬 dev 서버.
//
// 2026-09-24 — 원래 공용 시드 학생(지훈)/household를 직접 썼는데, 다른 E2E
// 파일들도 같은 계정을 동시에 건드릴 수 있어 이 스펙 전용 fixture로 옮겼다
// (e2e/fixtures.ts의 공통 헬퍼 사용, cleanup 없던 것도 이번에 추가).

// 2026-09-24 — figure-template-1.spec.ts/rw-structured-blocks.spec.ts와 같은
// 공유 seed 과목(SAT Math)을 썼는데, 세 파일이 기본 병렬(workers>1)로 같이
// 돌면 서로 다른 파일이 동시에 이 과목에 문제를 만들고 지워 문제은행 목록이
// 오염됐다("공개하기" 버튼이 3개 매치되는 등 선택자 모호성·타임아웃 플레이크).
// 이 파일 전용 과목으로 분리해 다른 파일과 절대 겹치지 않게 한다.
const SUBJECT_ID = "eeeeeeee-2222-0000-0000-000000000001";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const OUT = "docs/assets/2026-09-14-render-samples/e2e/bank";

let family: FixtureFamily;
// 2026-09-24 — generate()/seedFallback()이 만드는 problems는 createFamily/
// cleanupFamily 관리 밖이라 실행마다 영원히 쌓였다(공유 SUBJECT_ID에 오늘
// 하루만 89개 누적 확인 — 목록이 비대해지며 다른 결정적 테스트까지 타임아웃
// 플레이크를 유발했다). id를 모아뒀다가 afterAll에서 지운다.
const seededProblemIds: string[] = [];
test.beforeAll(() => {
  psql(`insert into subjects (id, name) values ('${SUBJECT_ID}', 'E2E Problem Bank Subject') on conflict (id) do nothing;`);
  psql(`insert into subject_template_units (id, subject_id, position, unit_title) values ('eeeeeeee-2222-0000-0000-000000000002', '${SUBJECT_ID}', 1, 'E2E 회차') on conflict (id) do nothing;`);
  // is_teacher_of_subject()(20261339000000)가 teacher_curriculum_templates
  // ("담당 과목")로 문제은행 조회 RLS를 좁혀서, 이게 없으면 학생 화면 검증에서
  // 방금 공개한 문제를 curriculum_unit_prep_items에 담을 때 "존재하지 않는
  // 문제입니다" 에러가 난다(트리거가 SECURITY INVOKER라 RLS로 못 봄).
  psql(`insert into teacher_curriculum_templates (teacher_id, subject_id) values ('${TEACHER_ID}', '${SUBJECT_ID}') on conflict (teacher_id, subject_id) do nothing;`);
  family = createFamily("bank", { childNames: ["E2E 문제은행테스트 학생"] });
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

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

function startedSessionWith(problemId: string): string {
  return startedSessionWithFixture({
    problemId,
    subjectId: SUBJECT_ID,
    teacherId: TEACHER_ID,
    studentId: family.children[0].id,
    householdId: family.householdId,
  });
}

type Case = {
  tab: "SAT Reading & Writing" | "SAT Math";
  system: "sat_rw" | "sat_math";
  domain: string;
  skillCode: string;
  label: string;
  /** 판정 기대. */
  need: "required" | "recommended" | "none";
  /** 자료가 있어야 하는 경우 그 type. */
  figureType?: string;
  format?: "mc" | "spr";
  prefix: string;
};

const CASES: Case[] = [
  { tab: "SAT Reading & Writing", system: "sat_rw", domain: "rw_craft_structure", skillCode: "words_in_context", label: "Words in Context", need: "none", prefix: "rw-wic" },
  { tab: "SAT Reading & Writing", system: "sat_rw", domain: "rw_craft_structure", skillCode: "text_structure_purpose", label: "Text Structure and Purpose", need: "none", prefix: "rw-tsp" },
  { tab: "SAT Reading & Writing", system: "sat_rw", domain: "rw_craft_structure", skillCode: "cross_text_connections", label: "Cross-Text Connections", need: "none", prefix: "rw-cross" },
  { tab: "SAT Reading & Writing", system: "sat_rw", domain: "rw_information_ideas", skillCode: "command_of_evidence_quant", label: "Command of Evidence (Quantitative)", need: "required", figureType: "data", prefix: "rw-quant" },
  { tab: "SAT Reading & Writing", system: "sat_rw", domain: "rw_expression_ideas", skillCode: "rhetorical_synthesis", label: "Rhetorical Synthesis", need: "none", prefix: "rw-rs" },
  { tab: "SAT Math", system: "sat_math", domain: "geometry_trig", skillCode: "lines_angles_triangles", label: "도형", need: "required", figureType: "geometry", prefix: "math-geo" },
  { tab: "SAT Math", system: "sat_math", domain: "algebra", skillCode: "linear_functions", label: "좌표평면", need: "recommended", figureType: "plane", prefix: "math-plane" },
  { tab: "SAT Math", system: "sat_math", domain: "problem_solving_data", skillCode: "two_variable_data", label: "데이터 그래프", need: "required", figureType: "data", prefix: "math-data" },
  { tab: "SAT Math", system: "sat_math", domain: "algebra", skillCode: "linear_equations_one_var", label: "SPR", need: "none", format: "spr", prefix: "math-spr" },
];

const GEOMETRY_TYPES = ["parallel_transversal", "triangle", "circle", "polygon", "solid", "composite"];

async function openNewPanel(page: Page, c: Case) {
  await loginAs(page, ACCOUNTS.admin);
  await page.goto("/admin?tab=problem-bank");
  await page.getByRole("button", { name: "생성", exact: true }).click();
  await page.getByRole("tab", { name: c.tab }).click();
  await page.getByLabel("새 문제 과목").selectOption(SUBJECT_ID);
  // 2026-09-17 버킷 분리로 "생성" 화면에는 필터 줄이 없어져(목록 자체가
  // bucket==="create"면 렌더 안 됨) 이제 "SAT 영역"/"세부 기술" select가
  // 생성 폼 자신 하나뿐이다 — 예전엔 필터 줄과 합쳐 2개라 .nth(1)이 필요했다.
  await page.getByLabel("SAT 영역", { exact: true }).selectOption(c.domain);
  await page.getByLabel("세부 기술", { exact: true }).selectOption(c.skillCode);
  if (c.format === "spr") await page.getByLabel("새 문제 형식").selectOption("spr");
  const need = page.getByTestId("new-material-need");
  await expect(need).toHaveAttribute("data-level", c.need);
}

async function generate(page: Page, c: Case, count: number): Promise<string[]> {
  await page.getByLabel("생성 개수").fill(String(count));
  const startedAt = psql(`select now()::text;`);
  await page.getByRole("button", { name: "AI 생성" }).click();
  const ids = () =>
    psql(`select coalesce(string_agg(p.id::text, ',' order by p.created_at), '') from problems p where p.subject_id = '${SUBJECT_ID}' and p.skill_code = '${c.skillCode}' and p.exam_system = '${c.system}' and p.archived_at is null and p.created_at > '${startedAt}'::timestamptz;`);
  // 생성 완료 표시(성공 또는 사유)를 기다린다.
  // 성공 알림 또는 실패 사유(자료 요구를 못 채운 경우 포함) 중 하나가 보일 때까지.
  // 2026-09-17 제품 오너 지시로 성공 문구가 "자동 통과 X/Y..."로 바뀌었다
  // (app/admin/ProblemBankTab.tsx onGenerate) — 예전 "...개를 초안으로
  // 만들었습니다" 문구는 더 이상 어디에도 없다.
  const done = page.getByText(/자동 통과 \d+\/\d+|문제를 생성하지 못했습니다|만들어지지 않았습니다|설정되어 있지 않습니다/).first();
  await expect(done).toBeVisible({ timeout: 300_000 });
  const noticeText = await done.innerText();
  test.info().annotations.push({ type: `generate-${count}`, description: noticeText });
  const generatedIds = ids().split(",").filter(Boolean);
  seededProblemIds.push(...generatedIds);
  return generatedIds;
}

async function openRow(page: Page, problemId: string) {
  const text = psql(`select coalesce(nullif(btrim(v.passage), ''), '') || ' ' || coalesce(v.question, '') from problem_versions v where v.problem_id = '${problemId}' order by v.version_no desc limit 1;`);
  // Rhetorical Synthesis 처럼 첫 줄이 같은 유형이 있어 앞 60자로는 다른 문제를 열 수 있다 — 지문+질문 200자로 맞춘다.
  const head = collapse(text).slice(0, 200);
  await expect.poll(async () => (await page.getByTestId("bank-row-title").allInnerTexts()).some((t) => collapse(t).startsWith(head)), { timeout: 30_000 }).toBe(true);
  const rows = page.getByTestId("bank-row-title");
  const n = await rows.count();
  for (let i = 0; i < n; i++) {
    if (collapse(await rows.nth(i).innerText()).startsWith(head)) { await rows.nth(i).click(); break; }
  }
  await expect(page.getByTestId("draft-editor")).toBeVisible();
}

/** 체계·유형에 맞는 항목만 보이는지. */
async function assertEditorShape(page: Page, c: Case) {
  const editor = page.getByTestId("draft-editor");
  await expect(editor.getByText("지문 / 자료", { exact: true })).toBeVisible();
  await expect(editor.getByText("질문", { exact: true })).toBeVisible();
  await expect(editor.getByText("해설", { exact: true })).toBeVisible();
  await expect(editor.getByText("학생 화면 미리보기", { exact: true })).toBeVisible();
  await expect(page.getByLabel("질문")).not.toHaveValue("");
  // 패널 판정이 '권장'이던 기술은 생성된 본문이 그래프를 가리키면 편집 화면에서 '필수'로 올라간다(자료 포함으로 만들었으므로) — 둘 다 정상.
  if (c.need === "recommended") await expect(page.getByTestId("material-need")).toHaveAttribute("data-level", /recommended|required/);
  else await expect(page.getByTestId("material-need")).toHaveAttribute("data-level", c.need);
  if (c.system === "sat_rw") {
    await expect(page.getByLabel("정답 목록")).toHaveCount(0); // SPR 없음
    await expect(page.getByLabel("진술 목록")).toHaveCount(0); // 로마숫자 진술 없음
    await expect(page.getByRole("button", { name: /좌표평면 데이터|도형 데이터|그래프\/도형 선택지/ })).toHaveCount(0);
    await expect(page.getByText("자료 데이터 편집(고급)")).toHaveCount(0);
    await expect(page.getByText("그림 파일 올리기")).toHaveCount(0);
    await expect(page.getByTestId("rw-structure")).toBeVisible();
    if (c.figureType === "data") await expect(page.getByRole("button", { name: "AI로 표·그래프 데이터 만들기" })).toBeVisible();
    else await expect(page.getByTestId("figure-section")).toHaveCount(0);
  } else {
    await expect(page.getByTestId("rw-structure")).toHaveCount(0);
    if (c.format === "spr") {
      await expect(page.getByLabel("정답 목록")).toBeVisible();
      await expect(page.getByLabel("선택지 1")).toHaveCount(0);
    } else {
      await expect(page.getByLabel("선택지 1")).toBeVisible();
    }
    if (c.figureType === "geometry") {
      await expect(page.getByRole("button", { name: /AI로 도형 데이터 만들기/ }).first()).toBeVisible();
      await expect(page.getByRole("button", { name: "AI로 표·그래프 데이터 만들기" })).toHaveCount(0);
    }
    if (c.figureType === "plane") {
      await expect(page.getByRole("button", { name: /AI로 좌표평면 데이터 만들기|AI로 그래프\/도형 선택지 4개 만들기/ }).first()).toBeVisible();
      await expect(page.getByRole("button", { name: /AI로 도형 데이터 만들기/ })).toHaveCount(0);
    }
    if (c.figureType === "data") {
      await expect(page.getByRole("button", { name: "AI로 표·그래프 데이터 만들기" })).toBeVisible();
      await expect(page.getByRole("button", { name: /AI로 도형 데이터 만들기/ })).toHaveCount(0);
    }
    if (c.need === "none") await expect(page.getByTestId("figure-section")).toHaveCount(0);
  }
}

async function publishAndCheckStudent(page: Page, c: Case, problemId: string, shot: string) {
  const issues = page.getByTestId("content-issues").or(page.getByTestId("figure-issues")).or(page.getByTestId("material-blocker"));
  if ((await issues.count()) > 0) {
    test.info().annotations.push({ type: "blocked-by-validation", description: (await issues.allInnerTexts()).join(" / ") });
    return "blocked";
  }
  await page.getByTestId("draft-editor").screenshot({ path: `${OUT}/${shot}-admin.png` });
  await page.getByRole("button", { name: "초안 저장" }).click();
  await expect(page.getByText(/초안을 저장했습니다/)).toBeVisible({ timeout: 15_000 });
  // "그림 확인함" 체크박스·수동 확인 단계는 현재 UI에서 완전히 제거됐다
  // (app/admin/ProblemDraftEditor.tsx의 "공개하기" 버튼은 이제 canSave·
  // missingAnswer만 보고 그림 확인 여부는 조건에 없음).
  await page.getByTestId("draft-editor").getByRole("button", { name: "공개하기" }).click();
  await expect(page.getByText(/공개했습니다|공개됐습니다|공개되었습니다/)).toBeVisible({ timeout: 20_000 });
  const row = psql(`select v.status || '|' || (v.render_check->>'ok') || '|' || (case when coalesce(nullif(btrim(v.question), ''), '') <> '' then 'q' else 'noq' end) || '|' || coalesce(v.figure->>'type', '-') from problem_versions v where v.problem_id = '${problemId}' order by v.version_no desc limit 1;`);
  expect(row.startsWith("published|true|q|")).toBeTruthy();
  const figType = row.split("|")[3];
  if (c.figureType === "geometry") expect(GEOMETRY_TYPES.includes(figType) || figType === "image").toBeTruthy();
  else if (c.figureType && c.need === "required") expect(figType).toBe(c.figureType);
  // 자동 구성 후보(질문 있는 공개본)인지 — 키워드가 없어도 has_question 자체는 함수로 확인한다.
  expect(psql(`select problem_version_has_question(v.passage, v.question)::text from problem_versions v where v.problem_id = '${problemId}' order by v.version_no desc limit 1;`)).toBe("true");
  const sessionId = startedSessionWith(problemId);
  await page.context().clearCookies();
  await loginAs(page, family.children[0].email); // 공용 지훈 아님 — 이 세션은 fixture 학생 소유
  await page.goto(`/session/${sessionId}?tab=problems`);
  await expect(page.getByTestId("problem-sheet")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("rw-question").or(page.getByTestId("rw-stimulus")).first()).toBeVisible();
  await page.getByTestId("problem-sheet").screenshot({ path: `${OUT}/${shot}-student.png` });
  return "published";
}

/** 생성분이 전부 게이트에 막혔을 때 공개·학생 경로를 확인할 결정적 표본(같은 체계·유형). */
const FALLBACK: Record<string, { passage: string; question: string; options: string[] | null; answers?: string[]; figure?: unknown }> = {
  command_of_evidence_quant: {
    passage: "The table shows the number of bird species recorded in three survey plots in 2010 and 2020. A team of ecologists claims that diversity increased most in the plot where grazing was removed (Plot A).",
    question: "Which choice most effectively uses data from the table to complete the statement?",
    options: ["Plot A rose from 12 to 18 species, the largest increase.", "Plot B rose from 9 to 10 species, the largest increase.", "Plot C fell from 15 to 14 species.", "All three plots recorded the same number of species in 2020."],
    figure: { type: "data", kind: "table", title: "Bird Species Recorded", columns: ["Plot", "2010", "2020"], rows: [["A", 12, 18], ["B", 9, 10], ["C", 15, 14]] },
  },
  lines_angles_triangles: {
    passage: "In right triangle ABC shown, the right angle is at B. AB = 6 and BC = 8.",
    question: "What is the length of side AC?",
    options: ["10", "12", "14", "100"],
    figure: { type: "triangle", vertices: ["A", "B", "C"], kind: "right", rightAngleAt: "B", sideLabels: { AB: "6", BC: "8", AC: "x" }, notToScale: true },
  },
  two_variable_data: {
    passage: "The table shows the number of hours five students studied and their scores on a quiz.",
    question: "Based on the table, which student scored the most points per hour studied?",
    options: ["Student A", "Student B", "Student C", "Student D"],
    figure: { type: "data", kind: "table", title: "Study Time and Quiz Score", columns: ["Student", "Hours studied", "Score (points)"], rows: [["A", 1, 8], ["B", 2, 12], ["C", 3, 15], ["D", 4, 16]] },
  },
  linear_functions: {
    passage: "The function f is defined by f(x) = 3x - 2.",
    question: "What is the value of f(4)?",
    options: ["10", "12", "14", "16"],
  },
  linear_equations_one_var: {
    passage: "If $2x + 3 = 11$.",
    question: "What is the value of $x$?",
    options: null,
    answers: ["4"],
  },
};

function seedFallback(c: Case): string {
  const f = FALLBACK[c.skillCode];
  const q = (v: string) => v.replace(/'/g, "''");
  const tag = ` [E2E BANK SEED ${Date.now()}]`;
  const id = psql(`insert into problems (format, passage, subject_id, status, created_by, skill_code, exam_system) values ('${c.format ?? "mc"}', '${q(f.passage + tag)}', '${SUBJECT_ID}', 'draft', 'aaaaaaaa-0000-0000-0000-000000000001', '${c.skillCode}', '${c.system}') returning id;`);
  psql(`update problem_versions set passage = '${q(f.passage + tag)}', question = '${q(f.question)}', options = ${f.options ? `'${q(JSON.stringify(f.options))}'::jsonb` : "null"}, correct_index = ${f.options ? 0 : "null"}, answers = ${f.answers ? `'${q(JSON.stringify(f.answers))}'::jsonb` : "null"}, explanation = 'seed'${f.figure ? `, figure = '${q(JSON.stringify(f.figure))}'::jsonb` : ""} where problem_id = '${id}' and version_no = 1;`);
  seededProblemIds.push(id);
  return id;
}

test.describe.configure({ mode: "serial" });
test.setTimeout(900_000);

test("AP 탭: 과목을 고르면 '준비 중'만 보이고 SAT 입력을 재사용하지 않는다", async ({ page }) => {
  await loginAs(page, ACCOUNTS.admin);
  await page.goto("/admin?tab=problem-bank");
  await page.getByRole("button", { name: "생성", exact: true }).click();
  await page.getByRole("tab", { name: "AP" }).click();
  await page.getByLabel("새 문제 과목").selectOption(SUBJECT_ID);
  await expect(page.getByLabel("AP 과목")).toBeVisible();
  // 2026-09-17 버킷 분리로 "생성" 화면에는 필터 줄 자체가 없다(목록도 없음) —
  // AP 체계에서는 생성 폼의 "SAT 영역" select도 렌더되지 않으므로(system !== "ap"
  // 조건부) 0개가 맞다. 예전엔 필터 줄이 생성 화면에 같이 있어 1개였다.
  await expect(page.getByLabel("SAT 영역", { exact: true })).toHaveCount(0);
  await page.getByLabel("AP 과목").selectOption("ap_statistics");
  await expect(page.getByTestId("ap-pending-note")).toContainText("준비 중");
  await expect(page.getByRole("button", { name: "AI 생성" })).toHaveCount(0);
  // 버튼명이 "직접 쓰기"→"직접 생성"으로 바뀜(2026-09-17 재구성).
  await expect(page.getByRole("button", { name: "직접 생성" })).toBeDisabled();
  await page.getByTestId("new-problem-panel").screenshot({ path: `${OUT}/ap-select.png` });
});

test("SAT Math 비선형 함수의 그래프 선택지 7문항이 모두 실제 그림 4개로 표시된다", async ({ page }) => {
  const c: Case = { tab: "SAT Math", system: "sat_math", domain: "advanced_math", skillCode: "nonlinear_functions", label: "Nonlinear functions", need: "recommended", figureType: "figure_choice", prefix: "math-figure-choice" };
  await openNewPanel(page, c);
  await page.getByRole("radio", { name: /자료 포함 · 그래프\/도형 선택지 4개/ }).check();
  await expect(page.getByTestId("new-material-need")).toHaveAttribute("data-kind", "figure_choice");
  const ids = await generate(page, c, 7);
  expect(ids).toHaveLength(7);
  for (const id of ids) {
    expect(psql(`select coalesce(v.figure->>'type','-') || '|' || jsonb_array_length(v.figure->'choices')::text from problem_versions v where v.problem_id='${id}' order by v.version_no desc limit 1;`)).toBe("figure_choice|4");
  }
  await page.goto("/admin?tab=problem-bank");
  await page.getByLabel("과목", { exact: true }).selectOption(SUBJECT_ID);
  await page.getByTestId("bank-row-title").first().click();
  await expect(page.getByTestId("published-figure-choice").locator("svg")).toHaveCount(4);
  await page.getByTestId("published-figure-choice").screenshot({ path: "/private/tmp/alton-figure-choice-admin.png" });
});

for (const c of CASES) {
  test(`단건·복수 생성 → 편집 화면 항목 → 질문·자료 판정 → 공개 → 학생: ${c.tab} / ${c.label}`, async ({ page }) => {
    test.skip(!process.env.E2E_REAL_AI, "E2E_REAL_AI=1 로 명시적으로 켜야 실행됨 — 실제 모델 호출 비용 발생");
    await openNewPanel(page, c);
    await page.getByTestId("new-problem-panel").screenshot({ path: `${OUT}/${c.prefix}-panel.png` });

    // 단건
    const single = await generate(page, c, 1);
    expect(single.length).toBeLessThanOrEqual(1);
    // 복수
    const bulk = await generate(page, c, 2);
    expect(bulk.length).toBeLessThanOrEqual(2);
    const all = [...single, ...bulk];
    test.info().annotations.push({ type: "created", description: `single=${single.length} bulk=${bulk.length}` });
    expect(all.length).toBeGreaterThan(0);

    // 저장된 모든 결과에 질문이 따로 있다(계약).
    for (const id of all) {
      expect(psql(`select (coalesce(nullif(btrim(v.question), ''), '') <> '')::text from problem_versions v where v.problem_id = '${id}' order by v.version_no desc limit 1;`)).toBe("true");
    }

    // 결과를 열어 항목·판정 확인 → 공개 → 학생. 검증 게이트에 막힌 결과(AI 자료 품질)는 사유를 기록하고 다음 결과로 — 최대 2개까지 본다.
    let published = false;
    for (const id of all.slice(0, 2)) {
      // 방금 만든 초안은 "검수"(기본 버킷)에 뜬다 — "생성" 버킷은 목록/필터 자체가
      // 없다(2026-09-17 버킷 분리, ProblemBankTab.tsx: bucket==="create"면 목록 null).
      await page.goto("/admin?tab=problem-bank");
      await page.getByLabel("과목", { exact: true }).selectOption(SUBJECT_ID);
      await openRow(page, id);
      await assertEditorShape(page, c);
      const r = await publishAndCheckStudent(page, c, id, `${c.prefix}-${id.slice(0, 4)}`);
      if (r === "published") { published = true; break; }
    }
    if (!published && FALLBACK[c.skillCode]) {
      // 생성분이 전부 게이트에 막혔다(기대 동작). 공개 → 학생 렌더 경로는 같은 체계·유형의 결정적 표본으로 끝까지 확인한다.
      const id = seedFallback(c);
      test.info().annotations.push({ type: "fallback-seed", description: id });
      await page.goto("/admin?tab=problem-bank");
      await page.getByLabel("과목", { exact: true }).selectOption(SUBJECT_ID);
      await openRow(page, id);
      await assertEditorShape(page, c);
      const r = await publishAndCheckStudent(page, c, id, `${c.prefix}-seed`);
      published = r === "published";
    }
    test.info().annotations.push({ type: "published", description: String(published) });
    expect(published).toBeTruthy();
  });
}
