import { execFileSync } from "node:child_process";
import { test, expect } from "@playwright/test";
import { loginAs, ACCOUNTS } from "./helpers";

// MST(4모듈) Phase 1 — 학생이 실브라우저로 R&W M1 → R&W M2 → 휴식 → Math M1 → Math M2를 끝까지
// 완주하고, 시간 만료 자동 제출·재접속 복구·이전 모듈 재진입 차단이 화면에서 실제로 동작하는지 검증.
// 세트·배정은 psql로 직접 만든다(관리자 조립 UI는 문제은행 규모에 의존하므로 통합 테스트에서 별도 검증).
// 계획: docs/2026-09-28-sat-adaptive-mock-exam-redesign-plan.md §7 1·3항.

const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001"; // jihoon@example.com
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}

let attemptId: string;

test.describe.configure({ mode: "serial" });

test.describe("MST 모의고사 — 4모듈 완주 (실브라우저)", () => {
  test.beforeAll(() => {
    // 출시 조건(2026-09-28): 세트는 draft로 만들고 문항을 채운 뒤 readiness=ready로 공개한다(청사진은 모듈당 2문항으로 축소).
    const setId = psql(
      `insert into mock_exam_sets (name, difficulty_tier, status, format, module_item_counts, created_by)
       values ('E2E MST ${Date.now()}', 'standard', 'draft', 'mst', '{"rw_m1":2,"rw_m2":2,"math_m1":2,"math_m2":2}', '${ADMIN_ID}') returning id;`,
    );
    const plan = [
      ["rw_m1", "rw", 1, "mc", "rw_craft_structure"], ["rw_m1", "rw", 2, "mc", "rw_craft_structure"],
      ["rw_m2", "rw", 3, "mc", "rw_information_ideas"], ["rw_m2", "rw", 4, "mc", "rw_information_ideas"],
      ["math_m1", "math", 1, "mc", "algebra"], ["math_m1", "math", 2, "spr", "algebra"],
      ["math_m2", "math", 3, "mc", "advanced_math"], ["math_m2", "math", 4, "spr", "advanced_math"],
    ] as const;
    plan.forEach(([key, section, pos, format, domain], i) => {
      const pid = psql(
        `insert into problems (format, passage, subject_id, status, created_by, sat_domain) values ('${format}', 'E2E MST 문항 ${i + 1}', '${SUBJECT_ID}', 'confirmed', '${TEACHER_ID}', '${domain}') returning id;`,
      );
      const content = format === "mc" ? `options = '["Alpha","Beta","Gamma","Delta"]'::jsonb, correct_index = 0` : `answers = '["3.25","13/4"]'::jsonb`;
      psql(`update problem_versions set ${content}, question = 'E2E 질문 ${i + 1}', explanation = '해설', difficulty = 'medium', status = 'published', published_at = now() where problem_id = '${pid}' and version_no = 1;`);
      const vid = psql(`select id from problem_versions where problem_id = '${pid}' and version_no = 1;`);
      psql(`insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, difficulty, module_key) values ('${setId}', '${section}', ${pos}, '${pid}', '${vid}', '${domain}', 'medium', '${key}');`);
    });
    // 정원 검증 → ready → 공개 → 배정. (ready가 아니면 아래 배정 insert가 트리거에서 거부된다.)
    expect(psql(`select (mock_exam_validate_mst_set('${setId}')->>'ready');`)).toBe("true");
    psql(`update mock_exam_sets set readiness_status = 'ready', readiness_checked_at = now() where id = '${setId}';`);
    psql(`update mock_exam_sets set status = 'published' where id = '${setId}';`);
    attemptId = psql(`insert into mock_exam_attempts (student_id, exam_set_id, status) values ('${STUDENT_ID}', '${setId}', 'assigned') returning id;`);
  });

  test("문항이 부족한 4모듈 세트는 공개도 배정도 거부된다(학생이 Module 2에서 막히는 상황 원천 차단)", () => {
    const badSet = psql(
      `insert into mock_exam_sets (name, difficulty_tier, status, format, module_item_counts, created_by)
       values ('E2E MST incomplete ${Date.now()}', 'standard', 'draft', 'mst', '{"rw_m1":2,"rw_m2":2,"math_m1":2,"math_m2":2}', '${ADMIN_ID}') returning id;`,
    );
    expect(psql(`select (mock_exam_validate_mst_set('${badSet}')->>'ready');`)).toBe("false");
    const fails = (sql: string) => {
      try {
        psql(sql);
        return "";
      } catch (e) {
        return String((e as { stderr?: string }).stderr ?? e);
      }
    };
    expect(fails(`update mock_exam_sets set status = 'published' where id = '${badSet}';`)).toContain("공개할 수 없습니다");
    expect(fails(`insert into mock_exam_attempts (student_id, exam_set_id, status) values ('${STUDENT_ID}', '${badSet}', 'assigned');`)).toContain("배정할 수 없습니다");
  });

  test("시작 → R&W M1 답변 → 제출 → M2 → (만료 자동 제출) → 휴식 → Math M1 (계산기) → M2 → 결과", async ({ page }) => {
    await loginAs(page, ACCOUNTS.student);
    await page.goto(`/student/mock-exam/${attemptId}`);
    await page.getByTestId("mst-start").click();
    await expect(page.getByTestId("mst-module-label")).toHaveText("Reading and Writing · Module 1");
    await expect(page.getByTestId("mst-timer")).toContainText("31:");
    await expect(page.getByText("계산기")).toHaveCount(0);

    await page.getByRole("radio", { name: /Alpha/ }).click();
    await expect(page.getByLabel("1번 답변함")).toBeVisible();
    await page.getByText("다음").click();
    await page.getByText("검토 표시", { exact: true }).click();
    await expect(page.getByLabel(/^2번.*검토 표시/)).toBeVisible();

    // 재접속 복구: 새로고침 후 같은 모듈·답변·표시 유지
    await page.reload();
    await expect(page.getByTestId("mst-module-label")).toHaveText("Reading and Writing · Module 1");
    await expect(page.getByLabel("1번 답변함")).toBeVisible();

    await page.getByTestId("mst-submit-module").click();
    await expect(page.getByRole("dialog")).toContainText("1/2문항에 답했습니다");
    await page.getByTestId("mst-submit-confirm").click();
    await expect(page.getByTestId("mst-module-label")).toHaveText("Reading and Writing · Module 2");
    expect(psql(`select locked from mock_exam_attempt_modules where attempt_id = '${attemptId}' and module_key = 'rw_m1';`)).toBe("t");

    // 시간 만료: 서버 마감을 과거로 → 다음 화면 갱신에서 자동 제출·잠금 → 휴식 화면
    psql(`update mock_exam_attempt_modules set ends_at = now() - interval '1 second' where attempt_id = '${attemptId}' and module_key = 'rw_m2';`);
    await page.reload();
    await expect(page.getByTestId("mst-resume")).toBeVisible();
    await expect(page.getByTestId("mst-timer")).toContainText("9:");
    expect(psql(`select auto_submitted from mock_exam_attempt_modules where attempt_id = '${attemptId}' and module_key = 'rw_m2';`)).toBe("t");

    await page.getByTestId("mst-resume").click();
    await expect(page.getByTestId("mst-module-label")).toHaveText("Math · Module 1");
    await expect(page.getByText("계산기")).toBeVisible();
    await page.getByText("다음").click();
    await page.getByTestId("mst-spr-input").fill("26/8");
    await expect
      .poll(() => psql(`select coalesce(correct::text, '') from mock_exam_answers a join mock_exam_set_items i on i.id = a.set_item_id where a.attempt_id = '${attemptId}' and i.module_key = 'math_m1' and i.position = 2;`))
      .toBe("true");
    await page.getByTestId("mst-submit-module").click();
    await page.getByTestId("mst-submit-confirm").click();
    await expect(page.getByTestId("mst-module-label")).toHaveText("Math · Module 2");
    await page.getByTestId("mst-submit-module").click();
    await page.getByTestId("mst-submit-confirm").click();

    // 마지막 모듈 제출 → 채점 완료 → 결과 화면(정답 열람 가능), 내부 경로명 미노출
    await expect(page.getByText("← 뒤로")).toBeVisible();
    expect(psql(`select status from mock_exam_attempts where id = '${attemptId}';`)).toBe("graded");
    expect(psql(`select count(*) from mock_exam_attempt_modules where attempt_id = '${attemptId}' and locked;`)).toBe("5");
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/higher|lower|고난도/i);
  });

  test("완료된 응시 재방문은 결과 화면이며 답안 변경 RPC는 거부된다", async ({ page }) => {
    await loginAs(page, ACCOUNTS.student);
    await page.goto(`/student/mock-exam/${attemptId}`);
    await expect(page.getByText("← 뒤로")).toBeVisible();
    await expect(page.getByTestId("mst-submit-module")).toHaveCount(0);
    const itemId = psql(`select i.id from mock_exam_set_items i join mock_exam_attempts a on a.exam_set_id = i.exam_set_id where a.id = '${attemptId}' and i.module_key = 'rw_m1' order by i.position limit 1;`);
    let err = "";
    try {
      psql(`set role authenticated; do $$ begin perform set_config('request.jwt.claim.sub', '${STUDENT_ID}', false); end $$; select mock_exam_save_answer('${attemptId}', '${itemId}', '1', null); reset role;`);
    } catch (e) {
      err = String((e as { stderr?: string }).stderr ?? e);
    }
    expect(err).toContain("이미 제출한 시험");
  });
});
