import { execFileSync } from "node:child_process";
import { test, expect } from "@playwright/test";

// R5 — DB 레벨 검증: subject_enrollments/teacher_assignments 위에 얹은
// 활성화 선행조건, 겹침 방지 exclusion constraint, 선생님 변경 원자성,
// 채팅 스레드 archive/생성, 문서 권한 재처리 큐 등록을 실제 psql로 검증한다.
// (r4-admin-entitlement-ledger.spec.ts와 동일하게 브라우저 없이 DB만 검증 —
// 이 스펙은 UI를 거치지 않고 마이그레이션의 함수/제약을 직접 실행 검증한다.)

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

function psql(sql: string): string {
  const out = execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
  // psql -q suppresses command status lines for statements without RETURNING/SELECT
  // output, but INSERT/UPDATE without a result set still prints nothing extra with -q.
  return out;
}
function psqlExpectError(sql: string): string {
  try {
    execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql], {
      encoding: "utf-8",
      stdio: ["ignore", "ignore", "pipe"],
    });
    throw new Error("expected psql to fail but it succeeded");
  } catch (e) {
    const err = e as { stderr?: Buffer; message: string };
    return err.stderr ? err.stderr.toString() : err.message;
  }
}

const TEACHER_1 = "dddddddd-0000-0000-0000-000000000001"; // active, rate set (seed)
const TEACHER_2 = "dddddddd-0000-0000-0000-000000000002"; // active, rate set (seed)
const TEACHER_PENDING = "77777777-0000-0000-0000-000000000001"; // pending, no active status
const CHILD = "cccccccc-0000-0000-0000-000000000001"; // 지훈 (seed)
const SUBJECT = "eeeeeeee-0000-0000-0000-000000000001"; // SAT Math

let householdId: string;
let contractId: string;
let enrollmentId: string;
let teacherAssignmentId: string | null = null;
let originalTeacher1EndedAt: string;
let midAssignmentId: string;

test.describe.configure({ mode: "serial" });

test.describe("R5 — subject_enrollments/teacher_assignments DB 레벨 검증", () => {
  let teacher2TemplateId: string;

  test.beforeAll(() => {
    householdId = psql(
      `insert into households (primary_guardian_id) values ('bbbbbbbb-0000-0000-0000-000000000001') returning id;`
    );
    contractId = psql(
      `insert into contracts (household_id, child_id, status) values ('${householdId}', '${CHILD}', 'draft') returning id;`
    );
    enrollmentId = psql(
      `insert into subject_enrollments (child_id, subject_id, contract_id, status) values ('${CHILD}', '${SUBJECT}', '${contractId}', 'planned') returning id;`
    );
    // C-2(2026-09-11): change_teacher_assignment()가 이제 새 선생님의 운영
    // 커리큘럼을 요구한다. seed에는 TEACHER_1만 SUBJECT(SAT Math)에 대해 이를
    // 갖고 있다(TEACHER_2는 없음) — 그 비대칭을 그대로 이용해 먼저 가드
    // 거부를 확인한 뒤(아래 새 테스트), TEACHER_2에게 운영 커리큘럼을
    // 부여하고 기존 "선생님 변경" 테스트들을 계속 진행한다.
  });

  test.afterAll(() => {
    psql(`delete from document_permission_retries where subject_enrollment_id = '${enrollmentId}';`);
    psql(`delete from subject_thread_messages where thread_id in (select id from subject_threads where subject_enrollment_id = '${enrollmentId}');`);
    psql(`delete from subject_threads where subject_enrollment_id = '${enrollmentId}';`);
    psql(`delete from teacher_assignments where subject_enrollment_id = '${enrollmentId}';`);
    psql(`delete from subject_enrollments where id = '${enrollmentId}';`);
    psql(`delete from entitlement_ledger where grant_id in (select id from entitlement_grants where child_id = '${CHILD}');`);
    psql(`delete from entitlement_grants where child_id = '${CHILD}';`);
    psql(`delete from purchases where contract_id = '${contractId}';`);
    psql(`delete from contracts where id = '${contractId}';`);
    psql(`delete from households where id = '${householdId}';`);
    psql(`delete from teacher_curriculum_template_units where template_id = '${teacher2TemplateId}';`);
    psql(`delete from teacher_curriculum_templates where id = '${teacher2TemplateId}';`);
  });

  test("activation blocked when contract not active and no paid entitlement", () => {
    const ready = psql(
      `select subject_enrollment_activation_ready('${enrollmentId}');`
    );
    expect(ready).toBe("f");
    const err = psqlExpectError(
      `update subject_enrollments set status = 'active' where id = '${enrollmentId}';`
    );
    // 오류 메시지 정정(2026-09-11) — enforce_subject_enrollment_activation_preconditions()의
    // 실제 문구와 어긋나 있던 사전 존재 오류(C-2와 무관, 이 배치에서 함께 정정).
    expect(err).toMatch(/기본계약이 먼저 active여야/);
  });

  test("activation allowed once contract active + paid entitlement exist", () => {
    psql(`update contracts set status = 'active' where id = '${contractId}';`);
    // 결제완료 entitlement_grants 최소 1건 필요 — 최소 fixture로 purchases + entitlement_grants 생성.
    const productId = psql(`select id from entitlement_products limit 1;`);
    const versionId = psql(
      `select id from entitlement_product_versions where entitlement_product_id = '${productId}' limit 1;`
    );
    const purchaseId = psql(
      `insert into purchases (household_id, child_id, contract_id, entitlement_product_id, product_version_id, quantity, unit_price_minor, package_price_minor, total_minor, validity_months, status)
       values ('${householdId}', '${CHILD}', '${contractId}', '${productId}', '${versionId}', 1, 1000, 1000, 1000, 6, 'succeeded') returning id;`
    );
    psql(
      `insert into entitlement_grants (child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at) values ('${CHILD}', '${productId}', '${purchaseId}', 1, now() + interval '6 months');`
    );

    const ready = psql(`select subject_enrollment_activation_ready('${enrollmentId}');`);
    expect(ready).toBe("t");

    psql(`update subject_enrollments set status = 'active' where id = '${enrollmentId}';`);
    const status = psql(`select status from subject_enrollments where id = '${enrollmentId}';`);
    expect(status).toBe("active");
  });

  test("teacher_assignments enforces valid rate before planned/active assignment", () => {
    const err = psqlExpectError(
      `insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from) values ('${enrollmentId}', '${TEACHER_PENDING}', 'active', now());`
    );
    expect(err).toMatch(/유효한 현재 시급 이력이 없어 배정할 수 없습니다/);
  });

  test("initial teacher assignment succeeds for an active, rated teacher", () => {
    teacherAssignmentId = psql(
      `insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from) values ('${enrollmentId}', '${TEACHER_1}', 'active', now()) returning id;`
    );
    expect(teacherAssignmentId).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("overlapping active assignment for same enrollment is blocked by exclusion constraint", () => {
    const err = psqlExpectError(
      `insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from) values ('${enrollmentId}', '${TEACHER_2}', 'active', now());`
    );
    expect(err).toMatch(/conflicting key value violates exclusion constraint|teacher_assignments_no_overlap/);
  });

  test("trial_teacher_succession_eligibility reports independent qualification/curriculum/rate", () => {
    // TEACHER_1 is seeded qualified+with curriculum for SUBJECT (SAT Math) -> fully eligible.
    const qualifiedRow = psql(
      `select is_active, has_subject_qualification, has_curriculum, has_valid_rate, eligible from trial_teacher_succession_eligibility('${TEACHER_1}', '${SUBJECT}');`
    );
    expect(qualifiedRow).toBe("t|t|t|t|t");

    // TEACHER_1 has no curriculum-template row at all for AP Calculus AB -> unqualified,
    // and specifically missing-curriculum must NOT be conflated with missing-qualification
    // (both happen to be false here, but the function returns them as independent columns).
    const otherSubject = "eeeeeeee-0000-0000-0000-000000000003"; // AP Calculus AB
    const unqualifiedRow = psql(
      `select has_subject_qualification, has_curriculum, eligible from trial_teacher_succession_eligibility('${TEACHER_1}', '${otherSubject}');`
    );
    expect(unqualifiedRow).toBe("f|f|f");
  });

  // C-2(2026-09-11, 제품 오너 승인) — 재배정에도 신규 매칭(C-1)과 동일한
  // "새 선생님이 이 과목 운영 커리큘럼을 가져야 한다" 서버 가드를 적용했다.
  // TEACHER_2는 이 시점까지 SUBJECT(SAT Math)에 대한 teacher_curriculum_templates
  // 행이 seed에 없으므로 자연스러운 거부 대상이다.
  test("change_teacher_assignment rejects a new teacher with no operating curriculum, leaving the existing assignment/threads/queue untouched", () => {
    const beforeAssignment = psql(
      `select id, status, teacher_id from teacher_assignments where subject_enrollment_id = '${enrollmentId}' and status = 'active';`
    );
    const beforeThreadCounts = psql(
      `select count(*) filter (where status = 'archived'), count(*) filter (where status = 'active')
       from subject_threads where subject_enrollment_id = '${enrollmentId}';`
    );
    const beforeRetryCount = psql(
      `select count(*) from document_permission_retries where subject_enrollment_id = '${enrollmentId}';`
    );

    const effectiveFrom = psql(`select (now() + interval '1 day')::text;`);
    const errOut = psqlExpectError(
      `select change_teacher_assignment('${enrollmentId}', '${TEACHER_2}', '${effectiveFrom}', 'teacher_long_leave', '${CHILD}');`
    );
    expect(errOut).toMatch(/운영 커리큘럼이 없어 배정할 수 없습니다/);

    const afterAssignment = psql(
      `select id, status, teacher_id from teacher_assignments where subject_enrollment_id = '${enrollmentId}' and status = 'active';`
    );
    expect(afterAssignment).toBe(beforeAssignment);
    const anyTeacher2Row = psql(
      `select count(*) from teacher_assignments where subject_enrollment_id = '${enrollmentId}' and teacher_id = '${TEACHER_2}';`
    );
    expect(anyTeacher2Row).toBe("0");
    const afterThreadCounts = psql(
      `select count(*) filter (where status = 'archived'), count(*) filter (where status = 'active')
       from subject_threads where subject_enrollment_id = '${enrollmentId}';`
    );
    expect(afterThreadCounts).toBe(beforeThreadCounts);
    const afterRetryCount = psql(
      `select count(*) from document_permission_retries where subject_enrollment_id = '${enrollmentId}';`
    );
    expect(afterRetryCount).toBe(beforeRetryCount);
  });

  test("grant TEACHER_2 an operating curriculum for SUBJECT so the remaining reassignment tests can pass the new guard", () => {
    teacher2TemplateId = psql(
      `insert into teacher_curriculum_templates (teacher_id, subject_id) values ('${TEACHER_2}', '${SUBJECT}') returning id;`
    );
    psql(
      `insert into teacher_curriculum_template_units (template_id, position, unit_title) values ('${teacher2TemplateId}', 1, 'TEACHER_2용 확인 단원');`
    );
    expect(teacher2TemplateId).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("change_teacher_assignment is atomic: ends old, creates new, archives+creates thread, queues doc-permission work-items", () => {
    const effectiveFrom = psql(`select (now() + interval '1 day')::text;`);
    const newAssignmentId = psql(
      `select change_teacher_assignment('${enrollmentId}', '${TEACHER_2}', '${effectiveFrom}', 'teacher_long_leave', '${CHILD}');`
    );
    expect(newAssignmentId).toMatch(/^[0-9a-f-]{36}$/);

    const oldStatus = psql(`select status from teacher_assignments where id = '${teacherAssignmentId}';`);
    expect(oldStatus).toBe("ended");
    const oldUntil = psql(`select effective_until::text from teacher_assignments where id = '${teacherAssignmentId}';`);
    expect(oldUntil.length).toBeGreaterThan(0);
    originalTeacher1EndedAt = oldUntil;

    const newStatus = psql(`select status, teacher_id, curriculum_handoff_status from teacher_assignments where id = '${newAssignmentId}';`);
    expect(newStatus).toBe(`active|${TEACHER_2}|pending`);

    const threadCounts = psql(
      `select count(*) filter (where status = 'archived'), count(*) filter (where status = 'active') from subject_threads where subject_enrollment_id = '${enrollmentId}';`
    );
    expect(threadCounts).toBe("1|1");

    const retryActions = psql(
      `select string_agg(action || ':' || teacher_id::text, ',' order by action) from document_permission_retries where subject_enrollment_id = '${enrollmentId}';`
    );
    expect(retryActions).toBe(`grant:${TEACHER_2},revoke:${TEACHER_1}`);
  });

  test("only one active teacher_assignments row exists at a time for the enrollment (unique-active invariant)", () => {
    const activeCount = psql(
      `select count(*) from teacher_assignments where subject_enrollment_id = '${enrollmentId}' and status = 'active';`
    );
    expect(activeCount).toBe("1");
  });

  test("change_teacher_assignment called twice in immediate succession leaves exactly one active row with the last teacher", () => {
    // 현재 active 배정은 TEACHER_2(위 테스트에서 변경됨). 곧바로 두 번 더
    // 연속 호출해도(다른 target teacher로) 최종 상태는 "정확히 하나의 active
    // 행, teacher는 마지막 호출 대상"이어야 한다 — 이전 배정이 active로 남거나
    // 중복 active 행이 생기면 안 된다.
    const effectiveFrom1 = psql(`select (now() + interval '2 days')::text;`);
    midAssignmentId = psql(
      `select change_teacher_assignment('${enrollmentId}', '${TEACHER_1}', '${effectiveFrom1}', 'teacher_long_leave', '${CHILD}');`
    );
    const effectiveFrom2 = psql(`select (now() + interval '3 days')::text;`);
    const finalAssignmentId = psql(
      `select change_teacher_assignment('${enrollmentId}', '${TEACHER_2}', '${effectiveFrom2}', 'teacher_long_leave', '${CHILD}');`
    );

    const activeRows = psql(
      `select count(*) from teacher_assignments where subject_enrollment_id = '${enrollmentId}' and status = 'active';`
    );
    expect(activeRows).toBe("1");

    const activeRow = psql(
      `select id, teacher_id from teacher_assignments where subject_enrollment_id = '${enrollmentId}' and status = 'active';`
    );
    expect(activeRow).toBe(`${finalAssignmentId}|${TEACHER_2}`);

    const midStatus = psql(`select status from teacher_assignments where id = '${midAssignmentId}';`);
    expect(midStatus).toBe("ended");
  });

  // C-2(2026-09-11, 제품 오너 지시) — "종료했던 기존 선생님에게 다시 배정"
  // 시나리오: 위 테스트의 midAssignmentId가 이미 TEACHER_1(최초 배정
  // teacherAssignmentId가 종료된 뒤)으로의 재배정이었다 — 여기서는 그것이
  // "기존 종료 이력을 덮어쓴 게 아니라 새 배정을 만든 것"임을 명시적으로
  // 검증한다: 최초 배정 행(teacherAssignmentId)은 별개 id로 그대로 남아있고
  // (재활성화되지 않음), 그 종료 시각도 그때 그대로다. 같은 선생님이라는
  // 이유로 재배정 자체가 막히지도 않는다(TEACHER_1은 SUBJECT 운영 커리큘럼을
  // seed부터 갖고 있어 가드도 통과).
  test("reassigning back to a previously-ended teacher creates a new row and never revives/overwrites the old ended row", () => {
    expect(midAssignmentId).not.toBe(teacherAssignmentId);

    const originalRow = psql(
      `select id, status, teacher_id, effective_until::text from teacher_assignments where id = '${teacherAssignmentId}';`
    );
    expect(originalRow).toBe(`${teacherAssignmentId}|ended|${TEACHER_1}|${originalTeacher1EndedAt}`);

    // TEACHER_1 앞으로 존재하는 teacher_assignments 행이 이제 최소 2개(원래
    // 배정 + 재배정)여야 한다 — "재활성화"라면 여전히 1개였을 것.
    const teacher1RowCount = psql(
      `select count(*) from teacher_assignments where subject_enrollment_id = '${enrollmentId}' and teacher_id = '${TEACHER_1}';`
    );
    expect(Number(teacher1RowCount)).toBeGreaterThanOrEqual(2);
  });
});
