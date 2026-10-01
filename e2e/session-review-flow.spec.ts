import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import {
  psql,
  createFamily,
  cleanupFamily,
  createFixtureTeacher,
  cleanupFixtureTeacher,
  type FixtureFamily,
  type FixtureTeacher,
} from "./fixtures";

// 수업 리뷰 — 선생님이 지난 수업의 리뷰를 쓰고 "공개 확정"하면 그 학생 포털에
// 그대로 보인다.
//
// 2026-09-29 갱신 — 리뷰 작성은 일정 탭(?tab=lesson-schedule) > "지난 수업" 카드의
// "수업 리뷰 작성" 모달로 옮겨졌고(체험/정규 공용, LessonReviewForm), 초안 저장은
// 비공개이며 "공개 확정" + 확인("네, 공개합니다")을 거쳐야 학생·보호자 화면에 나온다.
// 학생은 Courses(수강 과목) 탭의 "수업 리뷰 보기"에서 확정본을 본다.
// 공용 시드 선생님/학생 대신 이 스펙 전용 선생님·가족·수업을 만들고 끝나면 지운다.

const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001"; // SAT Math (seed)

let family: FixtureFamily;
let teacher: FixtureTeacher;
let enrollmentId: string;
const FINAL_TEXT = `E2E 종합 의견 ${Date.now()}: 이번 수업은 전반적으로 좋았습니다.`;

test.describe.configure({ mode: "serial" });

test.describe("수업 리뷰 작성 → 학생 포털 노출", () => {
  test.beforeAll(() => {
    family = createFamily("review", { childNames: ["E2E 리뷰 학생"] });
    teacher = createFixtureTeacher("review");
    const childId = family.children[0].id;
    const adminId = psql(`select id from profiles where role='admin' limit 1;`);

    const contractId = psql(
      `insert into contracts (household_id, child_id, status) values ('${family.householdId}', '${childId}', 'active') returning id;`
    );
    enrollmentId = psql(
      `insert into subject_enrollments (child_id, subject_id, contract_id, status) values ('${childId}', '${SUBJECT_ID}', '${contractId}', 'active') returning id;`
    );
    psql(
      `insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from, changed_by) values ('${enrollmentId}', '${teacher.id}', 'active', now() - interval '1 day', '${adminId}');`
    );
    // 완료된 정규 수업 1건(수업권 hold 없이 세션만) — 리뷰 작성 대상.
    const reservationId = psql(
      `insert into reservations (kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status)
       values ('lesson', '${enrollmentId}', '${teacher.id}', now() + interval '2 days', now() + interval '2 days 1 hour', 'confirmed') returning id;`
    );
    const sessionId = psql(
      `insert into sessions (reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes)
       values ('${reservationId}', '${enrollmentId}', '${teacher.id}', (select id from lesson_types where code = 'regular'), 60) returning id;`
    );
    psql(`update sessions set final_status = 'completed' where id = '${sessionId}';`);
  });

  test.afterAll(() => {
    psql(`delete from lesson_reviews where subject_enrollment_id = '${enrollmentId}';`);
    cleanupFamily(family);
    cleanupFixtureTeacher(teacher);
  });

  test("선생님이 지난 수업 리뷰를 공개 확정하면, 학생 포털에도 그 리뷰가 그대로 보인다", async ({ page, browser }) => {
    await loginAs(page, teacher.email);
    await page.goto("/teacher?tab=lesson-schedule");
    await page.getByRole("button", { name: "지난 수업" }).click();
    await page.getByRole("button", { name: "수업 리뷰 작성" }).first().click();

    const modal = page.locator("div.fixed").filter({ has: page.getByRole("heading", { name: "수업 리뷰 작성" }) });
    await expect(modal).toBeVisible();
    await modal.getByLabel("고객에게 보여줄 종합 의견").fill(FINAL_TEXT);

    // 초안 저장은 비공개 — 학생에게는 아직 보이면 안 된다.
    await modal.getByRole("button", { name: "초안 저장(비공개)" }).click();
    await expect(modal.getByRole("button", { name: "공개 확정" })).toBeEnabled();
    expect(psql(`select status from lesson_reviews where subject_enrollment_id = '${enrollmentId}';`)).toBe("draft");

    await modal.getByRole("button", { name: "공개 확정" }).click();
    await modal.getByRole("button", { name: "네, 공개합니다" }).click();
    await expect(modal).toHaveCount(0, { timeout: 15000 });
    expect(psql(`select status from lesson_reviews where subject_enrollment_id = '${enrollmentId}';`)).toBe("final");

    // 확정 뒤에는 카드가 "리뷰 수정"으로 바뀐다.
    await page.goto("/teacher?tab=lesson-schedule");
    await page.getByRole("button", { name: "지난 수업" }).click();
    await expect(page.getByRole("button", { name: "리뷰 수정" }).first()).toBeVisible();

    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();
    await loginAs(studentPage, family.children[0].email);
    await studentPage.goto("/student?tab=enrollment");
    await studentPage.getByRole("button", { name: /수업 리뷰 보기/ }).first().click();
    await expect(studentPage.getByText(FINAL_TEXT)).toBeVisible();
    await studentContext.close();
  });
});
