import { execFileSync } from "node:child_process";
import { test, expect } from "@playwright/test";
import { ACCOUNTS, loginAs } from "./helpers";

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001"; // 시드 학생(jihoon@example.com)

// M4 UAT #2(2026-09-05) — 학생 프로필 완성 강제 게이트 실 브라우저 검증.
//
// 시드 학생은 seed.sql에서 이미 프로필을 완성된 상태로 채워둔다(기존 e2e
// 회귀 방지) — 그래서 이 스펙에서는 그 학생 한 명을 psql로 미완료 상태로
// 되돌려 "미완료 학생이 로그인하면 강제로 /complete-profile로 가고, 완료
// 전에는 학생 포털의 다른 기능에 접근할 수 없으며, 완료 후에는 정상적으로
// 포털에 들어가고 다시 이 화면으로 돌아오지 않는다"는 요구사항 전체를
// 검증한다. 테스트 종료 시 원래(완료된) 상태로 복원해 다른 스펙에 영향을
// 주지 않는다.
function resetStudentProfile() {
  const sql = `
    update students set
      school_name = null,
      grade = null,
      sat_score = null,
      gpa = null,
      gpa_scale = null,
      target_colleges = '{}',
      intended_majors = '{}',
      profile_completed_at = null
    where id = '${STUDENT_ID}';
  `;
  execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-c", sql]);
}

function restoreStudentProfile() {
  const sql = `
    update students set
      school_name = '서울국제학교',
      grade = '10학년',
      sat_score = 1350,
      gpa = 3.7,
      gpa_scale = '4.0',
      target_colleges = array['Stanford University'],
      intended_majors = array['Computer Science'],
      profile_completed_at = now()
    where id = '${STUDENT_ID}';
  `;
  execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-c", sql]);
}

test.describe("학생 프로필 완성 강제 게이트", () => {
  test.afterEach(() => {
    restoreStudentProfile();
  });

  test("미완료 학생은 로그인하면 /complete-profile로 강제 이동하고, 완료해야 학생 포털에 들어간다", async ({
    page,
  }) => {
    resetStudentProfile();

    await loginAs(page, ACCOUNTS.student);
    await expect(page).toHaveURL(/\/complete-profile/);

    // 학생 포털로 직접 이동을 시도해도 다시 여기로 돌아온다(건너뛰기 불가).
    await page.goto("/student");
    await expect(page).toHaveURL(/\/complete-profile/);

    // 시드 학생은 profiles.date_of_birth가 이미 채워져 있어(R2 §4.13 seed 정책)
    // 이 화면에서는 생년월일 입력칸 대신 읽기전용 안내 문구가 보인다 —
    // 학교명/학년만 입력하면 된다.
    await expect(page.getByText(/이미 등록되어 있습니다/)).toBeVisible();
    await page.getByLabel(/학교명/).fill("E2E 국제학교");
    await page.getByLabel(/학년/).fill("11학년");
    await page.getByRole("button", { name: "프로필 완성하고 시작하기" }).click();

    await expect(page).toHaveURL(/\/student/);

    // 완료 후 다시 로그인해도 이 화면으로 돌아오지 않는다.
    await page.goto("/complete-profile");
    await expect(page).toHaveURL(/\/student/);
  });
});
