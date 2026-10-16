import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { psql, createFamily, cleanupFamily, grantActiveEntitlement, type FixtureFamily } from "./fixtures";

// M3 — 관리자가 선생님 배정 종료 요청을 처리(수강 종료)하는 최소 흐름을 실브라우저로
// 검증한다. r5-subject-enrollment-flow.spec.ts의 fixture-seed/cleanup 관례를 그대로
// 따른다 — 활성화 트리거(subject_enrollment_activation_ready)가 요구하는 "활성 계약 +
// 결제완료 entitlement"까지 psql로 먼저 채운 뒤, subject_enrollments/teacher_assignments를
// 곧바로 'active'로 심어 관리자 UI 재배정 클릭 없이 종료 처리 자체만 검증한다(재배정/
// 활성화 흐름은 r5 스펙이 이미 커버).
//
// 2026-09-24 — 이서아(r5 스펙도 같은 계정을 status='active'로 동시에 씀)를
// 재사용하던 것을 이 스펙 전용 fixture로 옮겼다(e2e/fixtures.ts).
//
// 2026-09-24(2차) — 이 화면은 2026-09-11 개편 이후에도 "매칭" 탭 하위의
// "종료 요청" 서브탭(TeacherAssignmentTerminationPanel)에 그대로 남아있다
// (학생 프로필 안의 "관리자 직접 매칭 종료"는 완전히 별도 경로 — 여기서
// 검증하는 "교사·보호자가 접수한 요청을 관리자가 처리"하는 흐름과 다르다).
// 다만 화면 헤딩·최종 확정 버튼 문구가 바뀌었으므로 그 기준으로 갱신한다.

const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001"; // SAT Math
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001"; // 박서연

let family: FixtureFamily;
let contractId: string;
let subjectEnrollmentId: string;
let teacherAssignmentId: string;

test.describe.configure({ mode: "serial" });

test.describe("M3 — 관리자 선생님 배정 종료 처리 (실브라우저)", () => {
  test.beforeAll(() => {
    family = createFamily("m3-terminate", { childNames: ["E2E M3종료테스트 학생"] });
    const childId = family.children[0].id;

    contractId = psql(
      `insert into contracts (household_id, child_id, status) values ('${family.householdId}', '${childId}', 'active') returning id;`
    );
    grantActiveEntitlement(family.householdId, childId, contractId);

    // 활성화 선행조건(active 계약 + 결제완료 entitlement)이 이미 충족된 상태이므로,
    // UI의 "수강 계획 생성 → 활성화 → 선생님 배정" 3단계(이미 r5 스펙이 검증함)를 다시
    // 거치지 않고 곧바로 active 상태로 심어 이 스펙은 종료 처리 자체에 집중한다.
    subjectEnrollmentId = psql(
      `insert into subject_enrollments (child_id, subject_id, contract_id, status) values ('${childId}', '${SUBJECT_ID}', '${contractId}', 'active') returning id;`
    );
    teacherAssignmentId = psql(
      `insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from, reason, source) values ('${subjectEnrollmentId}', '${TEACHER_ID}', 'active', now() - interval '1 day', 'e2e seed', 'app') returning id;`
    );
  });

  test.afterAll(() => {
    psql(`delete from teacher_assignment_termination_reservation_actions where termination_request_id in (select id from teacher_assignment_termination_requests where subject_enrollment_id = '${subjectEnrollmentId}');`);
    psql(`delete from teacher_assignment_termination_requests where subject_enrollment_id = '${subjectEnrollmentId}';`);
    cleanupFamily(family);
  });

  test("admin: 종료 요청 접수 → 영향 미리보기 → 수강 종료 처리 확정", async ({ page }) => {
    test.setTimeout(90000);

    // 관리자가 보호자를 대신해(외부 연락 경로) 종료 요청을 직접 접수한다 — 이 스펙은
    // 요청 접수 자체는 UI를 거치지 않고 psql로 준비하고(선생님 자기요청 흐름은 별도
    // 단위 테스트가 이미 커버), 관리자의 "처리" 액션 자체를 실브라우저로 검증한다.
    psql(
      `insert into teacher_assignment_termination_requests (subject_enrollment_id, teacher_assignment_id, requested_by_role, requested_by, reason, status) values ('${subjectEnrollmentId}', '${teacherAssignmentId}', 'admin', '${family.parentId}', 'e2e — 수강 종료 처리 검증', 'requested');`
    );

    await loginAs(page, "admin@alton.education");
    await page.goto("/admin?tab=matching");
    await page.getByRole("button", { name: "종료 요청", exact: true }).click();

    const panel = page.locator("div").filter({
      has: page.getByRole("heading", { name: "매칭 종료 요청" }),
    }).first();
    await expect(panel.getByRole("heading", { name: "매칭 종료 요청" })).toBeVisible({ timeout: 15000 });

    const requestRow = panel
      .locator("div.border-\\[1\\.5px\\].border-grey-200.rounded-xl")
      .filter({ hasText: "e2e — 수강 종료 처리 검증" })
      .first();
    await expect(requestRow).toBeVisible();
    await expect(requestRow.getByText("요청됨")).toBeVisible();

    await requestRow.getByRole("button", { name: "처리" }).click();

    // 기본 선택값이 "매칭 종료(재매칭 없음)"이므로 별도 라디오 클릭 없이
    // 바로 확정한다.
    await expect(requestRow.getByRole("button", { name: "매칭 종료 확정" })).toBeVisible({ timeout: 15000 });
    await requestRow.getByRole("button", { name: "매칭 종료 확정" }).click();

    // 처리 성공 시 openId가 닫히고 목록이 새로고침되면서 "요청됨"/"처리" 버튼이 사라진다
    // (completed 상태는 처리/재처리 버튼을 더 이상 보여주지 않음).
    await expect(requestRow.getByText("완료")).toBeVisible({ timeout: 20000 });
    await expect(requestRow.getByRole("button", { name: "처리" })).toHaveCount(0);

    // DB 레벨로도 배정·수강이 실제로 종료됐는지 확인.
    const assignmentStatus = psql(`select status from teacher_assignments where id = '${teacherAssignmentId}';`);
    expect(assignmentStatus).toBe("ended");
    const enrollmentStatus = psql(`select status from subject_enrollments where id = '${subjectEnrollmentId}';`);
    // subject_enrollments는 teacher_assignments와 다른 enum(v3_subject_enrollment_status)을
    // 쓴다 — "ended"가 아니라 "terminated"가 종료 상태값이다.
    expect(enrollmentStatus).toBe("terminated");
  });
});
