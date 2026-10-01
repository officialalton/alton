import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import {
  psql,
  createFamily,
  cleanupFamily,
  grantActiveEntitlement,
  createFixtureTeacher,
  cleanupFixtureTeacher,
  grantOperatingCurriculum,
  type FixtureFamily,
  type FixtureTeacher,
} from "./fixtures";

// R5 — 실제 브라우저로 admin → guardian → teacher 3개 포털을 이어서 검증하는
// E2E. r4-purchase-flow.spec.ts의 fixture-seed/cleanup 관례(격리된 fixture,
// 자기 자신의 행만 세팅/정리)를 그대로 따른다.
//
// 2026-09-24 — 공용 시드 학생(이서아)/공용 household(김민지) 대신 이 스펙
// 전용 부모+자녀+household를 즉석에서 만든다(e2e/fixtures.ts). m3-teacher-
// assignment-termination-flow.spec.ts가 같은 이서아 계정을 status='active'로
// 동시에 건드려 실제로 경합할 수 있었다.
//
// 2026-09-24(2차) — 2026-09-11 정보구조 개편으로 관리자 쪽 화면이 "매칭"
// 탭의 3단계 폼(수강 계획 생성→활성화→배정)에서 "사용자 > 학생 > 학생
// 프로필"의 SubjectEnrollmentPanel(과목 선택→선생님 선택→매칭 확인 한
// 번으로 통합)로 완전히 옮겨갔다 — 이 테스트가 그 개편 이후 한 번도
// 갱신되지 않아 존재하지 않는 화면을 찾고 있었다. 현재 화면 기준으로
// 다시 작성한다. 활성 계약+결제완료 수업권을 미리 만들어두면
// confirm_student_teacher_subject_match()가 매칭 확인 시점에 바로
// planned→active까지 끝내므로(activate_subject_enrollment_if_ready,
// best-effort) 별도 "활성화" 버튼 클릭이 필요 없다.
//
// 2026-09-24(3차) — "선생님 변경" 대상은 공용 선생님(이도현)을 재사용하지
// 않는다. teacher_curriculum_templates(teacher_id, subject_id)에 unique
// 제약이 있어, r5-subject-enrollment-teacher-assignment.spec.ts가 같은
// (이도현, SAT Math) 조합을 동시에 만들면 병렬 실행 시 중복 키 충돌이 난다
// — 이 스펙 전용 임시 선생님을 만들어 공용 계정을 전혀 건드리지 않는다.

const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001"; // SAT Math
const TEACHER_1_NAME = "박서연 선생님";

let family: FixtureFamily;
let teacher2: FixtureTeacher;
let STUDENT_NAME: string;
let contractId: string;

test.describe.configure({ mode: "serial" });

test.describe("R5 — 과목 수강/선생님 배정 admin→guardian→teacher 흐름 (실브라우저)", () => {
  test.beforeAll(() => {
    family = createFamily("r5-enroll", { childNames: ["E2E R5수강테스트 학생"] });
    STUDENT_NAME = family.children[0].name;
    const childId = family.children[0].id;

    // 1. 활성 기본계약 + 결제완료 entitlement_grant — 활성화 선행조건 충족.
    contractId = psql(
      `insert into contracts (household_id, child_id, status) values ('${family.householdId}', '${childId}', 'active') returning id;`
    );
    grantActiveEntitlement(family.householdId, childId, contractId);

    // 2. "선생님 변경" 대상 — 이 스펙 전용 임시 선생님을 만들고 SAT Math
    // 운영 커리큘럼(단원 1개 이상)을 부여해 후보로 뜨게 한다(C-1 가드).
    teacher2 = createFixtureTeacher("r5-enroll-change-to");
    grantOperatingCurriculum(teacher2.id, SUBJECT_ID);
  });

  test.afterAll(() => {
    // cleanupFamily가 이 가족의 subject_enrollments에 딸린 subject_threads/
    // teacher_assignments를 먼저 지운다 — teacher2 소유의 배정 행도 그 안에
    // 포함되므로, teacher2 정리보다 먼저 해야 subject_threads FK에 걸리지
    // 않는다.
    cleanupFamily(family);
    cleanupFixtureTeacher(teacher2);
  });

  test("admin: 학생 프로필에서 과목 매칭 → 즉시 활성화 → 선생님 변경 → 이력", async ({ page }) => {
    test.setTimeout(90000);

    // AssignTeacherForm의 "매칭 확인" 클릭은 window.confirm()을 띄운다 —
    // Playwright dialog 핸들러로 자동 수락한다.
    page.on("dialog", (d) => d.accept());

    await loginAs(page, "admin@alton.education");
    await page.goto("/admin?tab=users");
    await page.getByRole("button", { name: "학생", exact: true }).click();
    await page
      .getByPlaceholder("이름·이메일·보호자 이름 검색")
      .fill(STUDENT_NAME);
    // 학생 카드 버튼의 접근성 이름에는 이름 외에 상태·이메일·학년도 함께
    // 들어가 exact 매칭이 불가능하다 — 검색으로 이미 한 명만 남았으니
    // hasText로 충분하다.
    await page.getByRole("button").filter({ hasText: STUDENT_NAME }).first().click();

    await expect(page.getByRole("heading", { name: STUDENT_NAME, level: 1 })).toBeVisible({ timeout: 15000 });

    // 학생 프로필 안에는 "상태"/"수업권 조정 유형" 등 다른 select도 있으므로,
    // "수강 과목 · 매칭" 패널 컨테이너 안으로 범위를 좁혀야 한다.
    const panel = page
      .locator("div.border-\\[1\\.5px\\].border-grey-200.rounded-xl")
      .filter({ hasText: "수강 과목 · 매칭" });

    // + 과목 매칭 → 과목 선택 → 선생님 선택(박서연) → 매칭 확인.
    await panel.getByRole("button", { name: "+ 과목 매칭" }).click();
    await panel.getByRole("combobox").first().selectOption({ label: "SAT Math" });
    await panel.getByRole("combobox").nth(1).selectOption({ label: TEACHER_1_NAME });
    await panel.getByRole("button", { name: "매칭 확인" }).click();

    const enrollmentRow = panel
      .locator("div.border-\\[1\\.5px\\].border-grey-200.rounded-xl")
      .filter({ hasText: "SAT Math" })
      .first();
    await expect(enrollmentRow).toBeVisible({ timeout: 15000 });
    // 이미 active 계약 + 결제완료 수업권을 만들어뒀으므로 매칭 확인 시점에
    // 바로 활성화까지 끝난다(수강중) — 별도 "활성화" 버튼이 없다.
    await expect(enrollmentRow.getByText("수강중")).toBeVisible({ timeout: 15000 });
    await expect(enrollmentRow.getByText(`현재 선생님: ${TEACHER_1_NAME}`)).toBeVisible();

    // 선생님 변경 — 박서연 → 이 스펙 전용 임시 선생님, 사유 입력(오늘 날짜 기본값 그대로).
    const changeSelect = enrollmentRow.locator("select").last();
    await changeSelect.selectOption({ label: teacher2.name });
    await enrollmentRow.getByPlaceholder("변경 사유").fill("teacher_long_leave — e2e 검증");
    await enrollmentRow.getByRole("button", { name: "변경 확정" }).click();

    // getByText(teacher2.name)만 쓰면 select 안의 (화면엔 안 보이는) <option>도
    // 매칭될 수 있다 — "현재 선생님: X" 문구로 좁혀서 실제로 보이는 텍스트만 잡는다.
    await expect(enrollmentRow.getByText(`현재 선생님: ${teacher2.name}`)).toBeVisible({ timeout: 15000 });

    // 이력 확인 — 선생님 변경 액션이 끝나면 handleChangeTeacher가 자동으로
    // expand()를 호출해 이력·예약영향 패널을 이미 열어둔다("닫기" 버튼으로
    // 바뀜) — 별도 클릭 없이 바로 박서연이 매칭 이력에 남아 있는지 확인한다.
    await expect(enrollmentRow.getByRole("button", { name: "닫기" })).toBeVisible();
    await expect(enrollmentRow.getByText(new RegExp(`${TEACHER_1_NAME} · ended`))).toBeVisible();
  });

  test("guardian: EnrollmentTab에 현재 선생님(변경된 선생님)이 보인다", async ({ page }) => {
    await loginAs(page, family.parentEmail);
    await page.goto("/parent?tab=enrollment");

    // 이 fixture 부모는 자녀가 한 명뿐이라 EnrollmentTab이 childName을
    // 따로 붙이지 않는다(childrenEnrollments.length > 1일 때만) — 카드는
    // 과목명(SAT Math)만으로 충분히 식별된다.
    // .first()가 맞다 — hasText로 필터링된 div는 document order로 반환되고,
    // 가장 바깥(카드 전체를 감싸는) div가 먼저 나온다. .last()를 쓰면 과목명만
    // 담은 가장 안쪽 div가 잡혀 형제인 담당 선생님 텍스트를 못 찾는다.
    const childBlock = page.locator("div").filter({ hasText: "SAT Math" }).first();
    await expect(childBlock.getByText("SAT Math")).toBeVisible({ timeout: 15000 });
    await expect(childBlock.getByText(teacher2.name)).toBeVisible();
    // 이전 선생님 변경 이력에 박서연이 남아 있어야 한다.
    await childBlock.getByText(/이전 선생님 변경 이력/).click();
    await expect(childBlock.getByText(new RegExp(TEACHER_1_NAME))).toBeVisible();
  });

  test("teacher: 새로 배정된 선생님의 AssignmentsTab에 학생·SAT Math가 보인다", async ({ page }) => {
    await loginAs(page, teacher2.email);
    await page.goto("/teacher?tab=assignments");

    // 2026-09-22 UI 변경 — 과목명·학생명이 이제 한 줄(" · ")이 아니라 별도
    // <div>로 분리됐다. hasText를 두 번 체이닝해 카드 컨테이너를 좁힌다.
    const row = page
      .locator("div")
      .filter({ hasText: STUDENT_NAME })
      .filter({ hasText: "SAT Math" })
      .first();
    await expect(row).toBeVisible({ timeout: 15000 });
    await expect(row.getByText("배정중")).toBeVisible();
  });
});
