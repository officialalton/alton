import { execFileSync } from "node:child_process";
import { test, expect } from "@playwright/test";
import { ACCOUNTS, loginAs } from "./helpers";

// M3 — 관리자가 선생님 배정 종료 요청을 처리(수강 종료)하는 최소 흐름을 실브라우저로
// 검증한다. r5-subject-enrollment-flow.spec.ts의 fixture-seed/cleanup 관례를 그대로
// 따른다 — 활성화 트리거(subject_enrollment_activation_ready)가 요구하는 "활성 계약 +
// 결제완료 entitlement"까지 psql로 먼저 채운 뒤, subject_enrollments/teacher_assignments를
// 곧바로 'active'로 심어 관리자 UI 재배정 클릭 없이 종료 처리 자체만 검증한다(재배정/
// 활성화 흐름은 r5 스펙이 이미 커버).
//
// 대상 학생은 지훈(r4 purchase-flow가 씀)도 이서아(r5가 씀)도 아닌 값을 새로 만들지
// 않고 이서아를 재사용하되, r5와 동일하게 이 스펙 전용 household/contract/enrollment/
// assignment를 새로 만들고 afterAll에서 자신이 만든 행만 정리한다 — 프로젝트 컨벤션상
// Playwright는 항상 `--workers=1` 순차 실행이 전제이므로 r5 스펙과 실행 시점이 겹치지
// 않는다(README/CLAUDE.md에 명시된 기존 관례).

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const CHILD_ID = "cccccccc-0000-0000-0000-000000000002"; // 이서아
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001"; // SAT Math
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001"; // 박서연
const STUDENT_NAME = "이서아";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

let householdId: string;
let contractId: string;
let subjectEnrollmentId: string;
let teacherAssignmentId: string;

test.describe.configure({ mode: "serial" });

test.describe("M3 — 관리자 선생님 배정 종료 처리 (실브라우저)", () => {
  test.beforeAll(() => {
    householdId = psql(
      `insert into households (primary_guardian_id) values ('bbbbbbbb-0000-0000-0000-000000000001') returning id;`
    );
    contractId = psql(
      `insert into contracts (household_id, child_id, status) values ('${householdId}', '${CHILD_ID}', 'active') returning id;`
    );
    const productId = psql(`select id from entitlement_products limit 1;`);
    const versionId = psql(
      `select id from entitlement_product_versions where entitlement_product_id = '${productId}' limit 1;`
    );
    const purchaseId = psql(
      `insert into purchases (household_id, child_id, contract_id, entitlement_product_id, product_version_id, quantity, unit_price_minor, package_price_minor, total_minor, validity_months, status)
       values ('${householdId}', '${CHILD_ID}', '${contractId}', '${productId}', '${versionId}', 1, 1000, 1000, 1000, 6, 'succeeded') returning id;`
    );
    psql(
      `insert into entitlement_grants (child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at) values ('${CHILD_ID}', '${productId}', '${purchaseId}', 1, now() + interval '6 months');`
    );

    // 활성화 선행조건(active 계약 + 결제완료 entitlement)이 이미 충족된 상태이므로,
    // UI의 "수강 계획 생성 → 활성화 → 선생님 배정" 3단계(이미 r5 스펙이 검증함)를 다시
    // 거치지 않고 곧바로 active 상태로 심어 이 스펙은 종료 처리 자체에 집중한다.
    subjectEnrollmentId = psql(
      `insert into subject_enrollments (child_id, subject_id, contract_id, status) values ('${CHILD_ID}', '${SUBJECT_ID}', '${contractId}', 'active') returning id;`
    );
    teacherAssignmentId = psql(
      `insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from, reason, source) values ('${subjectEnrollmentId}', '${TEACHER_ID}', 'active', now() - interval '1 day', 'e2e seed', 'app') returning id;`
    );
  });

  test.afterAll(() => {
    psql(`delete from teacher_assignment_termination_reservation_actions where termination_request_id in (select id from teacher_assignment_termination_requests where subject_enrollment_id = '${subjectEnrollmentId}');`);
    psql(`delete from teacher_assignment_termination_requests where subject_enrollment_id = '${subjectEnrollmentId}';`);
    psql(`delete from document_permission_retries where subject_enrollment_id = '${subjectEnrollmentId}';`);
    psql(`delete from subject_thread_messages where thread_id in (select id from subject_threads where subject_enrollment_id = '${subjectEnrollmentId}');`);
    psql(`delete from subject_threads where subject_enrollment_id = '${subjectEnrollmentId}';`);
    psql(`delete from teacher_assignments where subject_enrollment_id = '${subjectEnrollmentId}';`);
    psql(`delete from subject_enrollments where id = '${subjectEnrollmentId}';`);
    psql(`delete from entitlement_ledger where grant_id in (select id from entitlement_grants where child_id = '${CHILD_ID}');`);
    psql(`delete from entitlement_grants where child_id = '${CHILD_ID}';`);
    psql(`delete from purchases where contract_id = '${contractId}';`);
    psql(`delete from contracts where id = '${contractId}';`);
    psql(`delete from households where id = '${householdId}';`);
  });

  test("admin: 종료 요청 접수 → 영향 미리보기 → 수강 종료 처리 확정", async ({ page }) => {
    test.setTimeout(90000);

    // 관리자가 보호자를 대신해(외부 연락 경로) 종료 요청을 직접 접수한다 — 이 스펙은
    // 요청 접수 자체는 UI를 거치지 않고 psql로 준비하고(선생님 자기요청 흐름은 별도
    // 단위 테스트가 이미 커버), 관리자의 "처리" 액션 자체를 실브라우저로 검증한다.
    psql(
      `insert into teacher_assignment_termination_requests (subject_enrollment_id, teacher_assignment_id, requested_by_role, requested_by, reason, status) values ('${subjectEnrollmentId}', '${teacherAssignmentId}', 'admin', 'bbbbbbbb-0000-0000-0000-000000000001', 'e2e — 수강 종료 처리 검증', 'requested');`
    );

    await loginAs(page, ACCOUNTS.admin);
    await page.goto("/admin?tab=matching");

    const panel = page.locator("div").filter({
      has: page.getByRole("heading", { name: "선생님 배정 종료 요청" }),
    }).first();
    await expect(panel.getByRole("heading", { name: "선생님 배정 종료 요청" })).toBeVisible({ timeout: 15000 });

    const requestRow = panel
      .locator("div.border-\\[1\\.5px\\].border-grey-200.rounded-xl")
      .filter({ hasText: "e2e — 수강 종료 처리 검증" })
      .first();
    await expect(requestRow).toBeVisible();
    await expect(requestRow.getByText("요청됨")).toBeVisible();

    await requestRow.getByRole("button", { name: "처리" }).click();

    // 기본 선택값이 "수강 종료"이므로 별도 라디오 클릭 없이 바로 확정한다.
    await expect(requestRow.getByRole("button", { name: "종료 처리 확정" })).toBeVisible({ timeout: 15000 });
    await requestRow.getByRole("button", { name: "종료 처리 확정" }).click();

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
