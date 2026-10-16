import { execFileSync } from "node:child_process";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loginAs, ACCOUNTS } from "./helpers";

// 외부 검수자 여정 감사(2026-10-08): 공개 가입(/signup/student) → 이메일 확인 화면 → 로그인 상태 →
// 무료 세트 시작 → 답안·표시 → 문제 신고(응시 중·결과) → 모듈 제출 → 결과·해설 토글 → 관리자 신고 화면.
// 로컬 Auth 는 enable_confirmations=false 라 메일이 안 나간다 — 확인 링크는 admin.generateLink(magiclink)로 만든
// token_hash 를 /signup/student/confirm 에 그대로 넣어 같은 화면·같은 서버 액션을 탄다. 실행 ID 데이터는 afterAll 에서 정리.

const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const API_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54421";
const SECRET = process.env.SUPABASE_SECRET_KEY ?? "";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";

const RUN = `rvw${Date.now().toString(36)}`;
const EMAIL = `${RUN}@example.com`;
const NAME = `Reviewer ${RUN}`;
const PASSWORD = "Reviewer-pass-1234";
const SET_NAME = `E2E Reviewer Free ${RUN}`;

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}

let setId = "";
let userId = "";
const problemIds: string[] = [];

test.describe.configure({ mode: "serial" });

test.describe("외부 검수자 여정 (공개 가입 → 응시 → 신고 → 관리자 확인)", () => {
  test.beforeAll(() => {
    setId = psql(
      `insert into mock_exam_sets (name, difficulty_tier, status, format, module_item_counts, created_by)
       values ('${SET_NAME}', 'standard', 'draft', 'mst', '{"rw_m1":2,"rw_m2":2,"math_m1":2,"math_m2":2}', '${ADMIN_ID}') returning id;`,
    );
    const plan = [
      ["rw_m1", "rw", 1, "mc", "rw_craft_structure"], ["rw_m1", "rw", 2, "mc", "rw_craft_structure"],
      ["rw_m2", "rw", 3, "mc", "rw_information_ideas"], ["rw_m2", "rw", 4, "mc", "rw_information_ideas"],
      ["math_m1", "math", 1, "mc", "algebra"], ["math_m1", "math", 2, "mc", "algebra"],
      ["math_m2", "math", 3, "mc", "advanced_math"], ["math_m2", "math", 4, "mc", "advanced_math"],
    ] as const;
    plan.forEach(([key, section, pos, format, domain], i) => {
      const pid = psql(
        `insert into problems (format, passage, subject_id, status, created_by, sat_domain) values ('${format}', '${RUN} passage ${i + 1}', '${SUBJECT_ID}', 'confirmed', '${TEACHER_ID}', '${domain}') returning id;`,
      );
      problemIds.push(pid);
      psql(`select set_config('alton.version_content_edit', 'on', true); update problem_versions set options = '["Alpha","Beta","Gamma","Delta"]'::jsonb, correct_index = 0, question = '${RUN} question ${i + 1}', explanation = '한국어 해설 ${RUN}', explanation_en = 'English explanation ${RUN}', render_check = '{"ok":true,"issues":[]}'::jsonb, difficulty = 'medium', status = 'published', published_at = now() where problem_id = '${pid}' and version_no = 1;`);
      const vid = psql(`select id from problem_versions where problem_id = '${pid}' and version_no = 1;`);
      psql(`insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, difficulty, module_key) values ('${setId}', '${section}', ${pos}, '${pid}', '${vid}', '${domain}', 'medium', '${key}');`);
    });
    expect(psql(`select (mock_exam_validate_mst_set('${setId}')->>'ready');`)).toBe("true");
    psql(`update mock_exam_sets set readiness_status = 'ready', readiness_checked_at = now() where id = '${setId}';`);
    psql(`update mock_exam_sets set status = 'published' where id = '${setId}';`);
    psql(`update mock_exam_sets set access_tier = 'free' where id = '${setId}';`);
  });

  test.afterAll(() => {
    // 실행 ID 정리: 신고 삭제는 트리거가 막으므로 replica 로만 지운다(테스트 데이터 한정).
    const uid = userId || psql(`select coalesce((select id::text from auth.users where email = '${EMAIL}'), '');`);
    const ids = problemIds.map((p) => `'${p}'`).join(",");
    psql(`set session_replication_role = replica;
      delete from problem_error_reports where problem_id in (${ids});
      delete from mock_exam_answers where attempt_id in (select id from mock_exam_attempts where exam_set_id = '${setId}');
      delete from mock_exam_attempt_modules where attempt_id in (select id from mock_exam_attempts where exam_set_id = '${setId}');
      delete from mock_exam_attempts where exam_set_id = '${setId}';
      delete from mock_exam_set_items where exam_set_id = '${setId}';
      delete from mock_exam_sets where id = '${setId}';
      ${uid ? `delete from student_terms_acceptances where student_id = '${uid}'; delete from students where id = '${uid}'; delete from profiles where id = '${uid}'; delete from auth.users where id = '${uid}';` : ""}
      delete from problems where id in (${ids});`);
  });

  test("공개 가입 → 확인 안내 → 확인 링크 → /student (무료 회원)", async ({ page }) => {
    await page.goto("/signup/student");
    await page.getByLabel(/^Name/).fill(NAME);
    await page.getByLabel(/^Email/).fill(EMAIL);
    await page.getByLabel(/^Password/).fill(PASSWORD);
    await page.getByLabel(/^Date of birth/).fill("1990-05-05"); // 성인 검수자도 같은 폼(학년 필수)
    await page.getByLabel(/^Grade/).fill("N/A (reviewer)");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Send confirmation email" }).click();
    await expect(page.getByText("Check your email")).toBeVisible();

    const admin = createClient(API_URL, SECRET, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
    expect(error).toBeNull();
    expect(link?.user).toBeTruthy();
    userId = link!.user!.id;
    // 검수자 표시(운영에서는 mark-reviewers.ts 가 같은 방식으로 app_metadata 를 쓴다).
    await admin.auth.admin.updateUserById(userId, { app_metadata: { external_reviewer: true, reviewer_cohort: "e2e" } });

    await page.context().clearCookies();
    await page.goto(`/signup/student/confirm?token_hash=${link!.properties!.hashed_token}&type=email`);
    await page.getByRole("button", { name: "Confirm email and get started" }).click();
    await page.waitForURL((u) => u.pathname === "/student");
    expect(psql(`select member_type from students where id = '${userId}';`)).toBe("free");
    expect(psql(`select raw_app_meta_data->>'external_reviewer' from auth.users where id = '${userId}';`)).toBe("true");
  });

  test("카탈로그 → 시작 → 답안·표시·신고 → 모듈 제출 → 결과·해설 토글·결과 화면 신고", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/login");
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"));

    await page.goto("/student?tab=mock-exam");
    const row = page.getByText(SET_NAME).locator("xpath=ancestor::*[.//button[normalize-space()='Start']][1]");
    await row.getByRole("button", { name: "Start" }).click();
    await page.waitForURL(/\/student\/mock-exam\//);
    await page.getByTestId("mst-start").click();
    await expect(page.getByTestId("mst-module-label")).toHaveText("Reading and Writing · Module 1");

    await page.getByRole("radio", { name: /Beta/ }).click(); // 일부러 오답
    await page.getByRole("button", { name: "Mark for Review" }).click();

    // 응시 중 신고: 유형 + 자유 메모(선택)
    await page.getByRole("button", { name: "Report a problem" }).first().click();
    await page.getByRole("radio", { name: /Problem itself is flawed/ }).check();
    await page.getByRole("textbox").fill(`${RUN} suggestion: passage wording is ambiguous`);
    await page.getByRole("button", { name: "Submit report" }).click();
    await expect(page.getByText("Your report was received")).toBeVisible();

    const next = ["Reading and Writing · Module 2", "Math · Module 1", "Math · Module 2"];
    for (let m = 0; m < 4; m++) {
      const submit = page.getByTestId("mst-submit-module");
      await expect(submit).toBeEnabled({ timeout: 15000 });
      await submit.click();
      await page.getByTestId("mst-submit-confirm").click();
      if (m === 1) await page.getByTestId("mst-resume").click(); // R&W M2 뒤 휴식
      if (m < 3) await expect(page.getByTestId("mst-module-label")).toHaveText(next[m]);
    }
    await expect(page.getByText("← Back")).toBeVisible();

    // 결과: 영어 해설 기본 → 한국어 토글
    await page.getByRole("tab", { name: "Review Mistakes" }).click();
    await page.getByTestId(/^review-item-/).first().click();
    await expect(page.getByTestId("mock-exam-explanation")).toContainText(`English explanation ${RUN}`);
    await page.getByRole("group", { name: "Explanation language" }).getByRole("button", { name: "한국어" }).click();
    await expect(page.getByTestId("mock-exam-explanation")).toContainText(`한국어 해설 ${RUN}`);

    // 결과 화면에서 다른 문항 신고(정답 오류)
    await page.getByTestId(/^review-item-/).nth(1).click();
    await page.getByRole("button", { name: "Report a problem" }).first().click();
    await page.getByRole("radio", { name: /Wrong answer key/ }).check();
    await page.getByRole("button", { name: "Submit report" }).click();
    await expect(page.getByText("Your report was received")).toBeVisible();
  });

  test("신고 원본: 문항·버전 ID 로 저장, 신고자 연결, 중복 1회 제약", () => {
    const rows = psql(`select report_type, source, (problem_version_id is not null), reporter_role, coalesce(memo,'') from problem_error_reports where reporter_id = '${userId}' order by created_at;`);
    expect(rows).toContain("flawed_problem|mock_exam|t|student|" + `${RUN} suggestion`);
    expect(rows).toContain("wrong_key|mock_exam|t|student|");
    // 같은 문항 재신고(다른 유형·다른 메모)는 새 행이 아니다 → 검수자가 한 문항에 두 번 의견을 남길 수 없다.
    expect(psql(`select count(*) from problem_error_reports where reporter_id = '${userId}';`)).toBe("2");
  });

  test("관리자: 신고 목록·상세에 문항·신고자명·메모·일시, 검수자 표시·이메일·세트명은 없음", async ({ page }) => {
    await loginAs(page, ACCOUNTS.admin);
    await page.goto("/admin?tab=error-reports");
    await expect(page.getByText(`${RUN} question 1`).first()).toBeVisible({ timeout: 15000 });
    await page.getByText(`${RUN} question 1`).first().click();
    const body = page.locator("body");
    await expect(body).toContainText(NAME);
    await expect(body).toContainText(`${RUN} suggestion`);
    const text = await body.innerText();
    expect(text).not.toContain(EMAIL);
    expect(text).not.toMatch(/external_reviewer|검수자/);
    expect(text).not.toContain(SET_NAME);
  });
});
