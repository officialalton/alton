import { execFileSync } from "node:child_process";
import { test, expect } from "@playwright/test";
import { ACCOUNTS, loginAs } from "./helpers";

// R5 — 실제 브라우저로 admin → guardian → teacher 3개 포털을 이어서 검증하는
// E2E. r4-purchase-flow.spec.ts의 fixture-seed/cleanup 관례(격리된 fixture,
// 자기 자신의 행만 세팅/정리)를 그대로 따른다.
//
// 대상 학생은 지훈이 아니라 이서아(seoah@example.com)를 쓴다 — 지훈은
// r4-purchase-flow.spec.ts가 자기 contracts 행을 만들고 지우는 대상이라, 같은
// child_id를 여기서도 건드리면 병렬 실행 시 "child당 active 계약 1개" 제약과
// 충돌할 수 있다. 이서아는 기존 스펙들이 항상 "계약 없음(구매 자격 없음)"
// 상태로만 두는 대상이라 이 스펙 전용으로 안전하게 쓸 수 있다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const CHILD_ID = "cccccccc-0000-0000-0000-000000000002"; // 이서아
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001"; // SAT Math
const TEACHER_1_ID = "dddddddd-0000-0000-0000-000000000001"; // 박서연 — SAT Math 커리큘럼 보유(seed)
const TEACHER_2_ID = "dddddddd-0000-0000-0000-000000000002"; // 이도현 — 이 스펙에서만 SAT Math 후보로 추가
const TEACHER_1_NAME = "박서연 선생님";
const TEACHER_2_NAME = "이도현 선생님";
const TEACHER_2_EMAIL = "dohyun@example.com";
const STUDENT_NAME = "이서아";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

let householdId: string;
let contractId: string;
let extraCurriculumTemplateId: string | null = null;

test.describe.configure({ mode: "serial" });

test.describe("R5 — 과목 수강/선생님 배정 admin→guardian→teacher 흐름 (실브라우저)", () => {
  test.beforeAll(() => {
    // 1. 활성 기본계약 + 결제완료 entitlement_grant — 활성화 선행조건 충족.
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

    // 2. admin UI의 "선생님 변경" 후보 목록은 teacher_curriculum_templates로
    // 좁혀진다(app/admin/matching-data.ts) — 이도현은 seed상 AP Calculus
    // 담당이라 SAT Math 후보로 안 뜬다. 이 스펙에서만 임시로 SAT Math
    // 커리큘럼 템플릿 링크를 하나 추가해 "선생님 변경" UI를 실제로 거칠 수
        // 있게 한다(단원 없이 배정 자체만 표시하는 최소 값).
    extraCurriculumTemplateId = psql(
      `insert into teacher_curriculum_templates (teacher_id, subject_id) values ('${TEACHER_2_ID}', '${SUBJECT_ID}') returning id;`
    );
  });

  test.afterAll(() => {
    if (extraCurriculumTemplateId) {
      psql(`delete from teacher_curriculum_templates where id = '${extraCurriculumTemplateId}';`);
    }
    psql(`delete from document_permission_retries where subject_enrollment_id in (select id from subject_enrollments where child_id = '${CHILD_ID}');`);
    psql(`delete from subject_thread_messages where thread_id in (select id from subject_threads where subject_enrollment_id in (select id from subject_enrollments where child_id = '${CHILD_ID}'));`);
    psql(`delete from subject_threads where subject_enrollment_id in (select id from subject_enrollments where child_id = '${CHILD_ID}');`);
    psql(`delete from teacher_assignments where subject_enrollment_id in (select id from subject_enrollments where child_id = '${CHILD_ID}');`);
    psql(`delete from subject_enrollments where child_id = '${CHILD_ID}';`);
    psql(`delete from entitlement_ledger where grant_id in (select id from entitlement_grants where child_id = '${CHILD_ID}');`);
    psql(`delete from entitlement_grants where child_id = '${CHILD_ID}';`);
    psql(`delete from purchases where contract_id = '${contractId}';`);
    psql(`delete from contracts where id = '${contractId}';`);
    psql(`delete from households where id = '${householdId}';`);
  });

  test("admin: 과목 수강 계획 생성 → 활성화 → 최초 선생님 배정 → 선생님 변경", async ({ page }) => {
    test.setTimeout(90000);

    await loginAs(page, ACCOUNTS.admin);
    await page.goto("/admin?tab=matching");

    const panel = page.locator("div").filter({
      has: page.getByRole("heading", { name: "과목 수강 · 선생님 배정 (R5)" }),
    }).first();
    await expect(panel.getByRole("heading", { name: "과목 수강 · 선생님 배정 (R5)" })).toBeVisible();

    // 학생 선택 — 이 패널 안의 학생 칩 버튼(정확 일치)만 골라야 페이지 상단의
    // 다른 "이서아" 텍스트와 헷갈리지 않는다.
    await panel.getByRole("button", { name: STUDENT_NAME, exact: true }).click();

    // 새 과목 수강 계획 생성.
    const subjectSelect = panel.locator("select").first();
    await subjectSelect.selectOption({ label: "SAT Math" });
    await panel.getByRole("button", { name: "수강 계획 생성" }).click();

    const enrollmentRow = panel
      .locator("div.border-\\[1\\.5px\\].border-grey-200.rounded-xl")
      .filter({ hasText: "SAT Math" })
      .first();
    await expect(enrollmentRow).toBeVisible({ timeout: 15000 });
    await expect(enrollmentRow.getByText(/planned/)).toBeVisible();

    // 활성화.
    await enrollmentRow.getByRole("button", { name: "활성화" }).click();
    await expect(enrollmentRow.getByText(/active/)).toBeVisible({ timeout: 15000 });

    // 최초 선생님 배정 — 박서연.
    await expect(enrollmentRow.getByText("현재 선생님: 미배정")).toBeVisible();
    await enrollmentRow.getByRole("button", { name: `${TEACHER_1_NAME} 배정` }).click();
    await expect(enrollmentRow.getByText(`현재 선생님: ${TEACHER_1_NAME}`)).toBeVisible({ timeout: 15000 });

    // 선생님 변경 — 박서연 → 이도현, 사유 입력.
    const changeSelect = enrollmentRow.locator("select");
    await changeSelect.selectOption({ label: TEACHER_2_NAME });
    await enrollmentRow.getByPlaceholder("변경 사유").fill("teacher_long_leave — e2e 검증");
    await enrollmentRow.getByRole("button", { name: "변경 확정" }).click();

    await expect(enrollmentRow.getByText(`현재 선생님: ${TEACHER_2_NAME}`)).toBeVisible({ timeout: 15000 });

    // 이력 확인 — 선생님 변경 액션이 끝나면 handleChangeTeacher가 자동으로
    // expand()를 호출해 이력 패널을 이미 열어둔다("닫기" 버튼으로 바뀜) — 별도
    // 클릭 없이 바로 박서연이 이전 배정 이력에 남아 있는지 확인한다.
    await expect(enrollmentRow.getByRole("button", { name: "닫기" })).toBeVisible();
    await expect(enrollmentRow.getByText(new RegExp(`${TEACHER_1_NAME} · ended`))).toBeVisible();
  });

  test("guardian: EnrollmentTab에 현재 선생님(이도현)이 보인다", async ({ page }) => {
    await loginAs(page, ACCOUNTS.parent);
    await page.goto("/parent?tab=enrollment");

    const childBlock = page.locator("div").filter({ hasText: STUDENT_NAME }).filter({ hasText: "SAT Math" }).last();
    await expect(childBlock.getByText("SAT Math")).toBeVisible({ timeout: 15000 });
    await expect(childBlock.getByText(TEACHER_2_NAME)).toBeVisible();
    // 이전 선생님 변경 이력에 박서연이 남아 있어야 한다.
    await childBlock.getByText(/이전 선생님 변경 이력/).click();
    await expect(childBlock.getByText(new RegExp(TEACHER_1_NAME))).toBeVisible();
  });

  test("teacher: 새로 배정된 선생님(이도현)의 AssignmentsTab에 이서아·SAT Math가 보인다", async ({ page }) => {
    await loginAs(page, TEACHER_2_EMAIL);
    await page.goto("/teacher?tab=assignments");

    // .last()가 아니라 .first()를 써야 한다 — hasText로 필터링된 div들은
    // document order로 반환되고, 가장 안쪽(텍스트 자체를 감싸는) div가 가장
    // 나중에 나온다. .last()를 쓰면 "배정중" 배지가 형제 엘리먼트로 빠진 안쪽
    // div만 잡혀 그 안에서 배지를 못 찾는다 — 카드 전체를 감싸는 바깥 div를
    // 잡으려면 .first()가 맞다.
    const row = page
      .locator("div")
      .filter({ hasText: `${STUDENT_NAME} · SAT Math` })
      .first();
    await expect(row).toBeVisible({ timeout: 15000 });
    await expect(row.getByText("배정중")).toBeVisible();
  });
});
