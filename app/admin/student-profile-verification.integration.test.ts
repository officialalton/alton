import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";

// M4 UAT #2 후속(2026-09-05) — 신규 로직 3건을 로컬 Postgres에 직접 psql로
// 검증한다(다른 통합 테스트와 동일한 psql shell-out 패턴,
// lib/booking/trial-entitlement-and-cancellation.integration.test.ts 참고):
//  1) 관리자 확인 게이트 — 생년월일 미확인 학생에게는 grant_trial_entitlement_
//     for_consultation()이 체험수업권 지급 자체를 거부하고, verify_student_
//     date_of_birth() 이후에는 지급이 성공한다.
//  2) verify_student_date_of_birth()는 관리자 전용이고, 생년월일이 아직 없으면
//     확인 처리할 수 없다.
//  3) complete_student_profile()의 SAT null 통과(0으로 강제 변환하지 않음) +
//     gpa_scale 저장.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const GUARDIAN_ID = "bbbbbbbb-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

function psqlAsAdmin(sql: string): string {
  return psql(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
    ${sql}
    reset role;
  `);
}

function psqlAsStudent(studentId: string, sql: string): string {
  return psql(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${studentId}', false);
    ${sql}
    reset role;
  `);
}

function createStudent(label: string): string {
  const now = Date.now();
  const authEmail = `m4-profile-uat2-${label}-${now}@example.com`;
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${authEmail}', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`
    insert into profiles (id, role, name) values ('${id}', 'student', 'M4 UAT#2 통합테스트 학생 ${label}');
    insert into students (id, grade, status) values ('${id}', '10학년', 'active');
  `);
  return id;
}

describe("생년월일 관리자 확인 게이트", () => {
  let studentId: string;
  let consultationId: string;

  beforeAll(() => {
    studentId = createStudent("gate");
    psql(`update profiles set date_of_birth = '2011-03-01' where id = '${studentId}';`);
    // grant_trial_entitlement_for_consultation()이 먼저 검사하는 Smart Notes
    // 동의 게이트를 통과시켜야 생년월일 확인 게이트를 단독으로 검증할 수 있다.
    psql(
      `insert into parents (id, status) values ('${GUARDIAN_ID}', 'active') on conflict (id) do nothing;`
    );
    psql(
      `insert into trial_smart_notes_consents (child_id, guardian_id, policy_version)
       values ('${studentId}', '${GUARDIAN_ID}', 'integration-test-v1')
       on conflict (child_id) do nothing;`
    );
    consultationId = psql(
      `insert into consultations (child_id, contact_name, contact_email)
       values ('${studentId}', 'M4 UAT#2 통합테스트', 'm4-uat2-gate-${Date.now()}@example.com')
       returning id;`
    );
  });

  // entitlement_ledger/entitlement_grants는 INSERT-only(불변) 트리거로 보호되고
  // consultations를 FK로 참조하므로, 마지막 성공 케이스가 grant를 만든 뒤에는
  // 이 consultations 행을 정리할 수 없다 — 다른 M2/M4 통합 테스트와 동일하게
  // 다음 `supabase db reset --local`로 정리되는 것을 전제로 하고 별도 cleanup은
  // 하지 않는다.

  it("생년월일 미확인 학생에게는 체험수업권 지급을 거부한다", () => {
    expect(() =>
      psql(`select grant_trial_entitlement_for_consultation('${consultationId}');`)
    ).toThrow(/관리자의 생년월일 확인이 완료되지 않아/);
  });

  it("관리자가 아니면 확인 처리를 할 수 없다", () => {
    expect(() => psqlAsStudent(studentId, `select verify_student_date_of_birth('${studentId}');`)).toThrow(
      /관리자만 생년월일 확인 처리를 할 수 있습니다/
    );
  });

  it("생년월일이 없으면 확인 처리를 할 수 없다", () => {
    const noDobStudent = createStudent("no-dob");
    expect(() => psqlAsAdmin(`select verify_student_date_of_birth('${noDobStudent}');`)).toThrow(
      /생년월일이 아직 입력되지 않아/
    );
  });

  it("관리자가 확인 완료 처리하면 확인시각·확인자가 기록되고, 이후 체험수업권 지급이 성공한다", () => {
    psqlAsAdmin(`select verify_student_date_of_birth('${studentId}');`);

    const verifiedRow = psql(
      `select date_of_birth_verified_at is not null, date_of_birth_verified_by from profiles where id = '${studentId}';`
    );
    const [verified, verifiedBy] = verifiedRow.split("|");
    expect(verified).toBe("t");
    expect(verifiedBy).toBe(ADMIN_ID);

    const grantId = psql(`select grant_trial_entitlement_for_consultation('${consultationId}');`);
    expect(grantId).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("complete_student_profile — SAT null 통과 + gpa_scale 저장", () => {
  let studentId: string;

  beforeAll(() => {
    studentId = createStudent("sat-null");
  });

  it("SAT를 넘기지 않으면(null) 0이 아니라 null로 저장된다", () => {
    psqlAsStudent(
      studentId,
      `select complete_student_profile('2011-01-01', 'OO고등학교', '10학년', null, 3.9, '{}', '{}', '4.3');`
    );
    const row = psql(`select sat_score, gpa, gpa_scale from students where id = '${studentId}';`);
    const [satScore, gpa, gpaScale] = row.split("|");
    expect(satScore).toBe("");
    expect(gpa).toBe("3.90");
    expect(gpaScale).toBe("4.3");
  });

  it("명시적으로 0을 넘기면 0으로 저장된다(null과 구분)", () => {
    const zeroStudent = createStudent("sat-zero");
    psqlAsStudent(
      zeroStudent,
      `select complete_student_profile('2011-01-01', 'OO고등학교', '10학년', 0, null, '{}', '{}', null);`
    );
    const satScore = psql(`select sat_score from students where id = '${zeroStudent}';`);
    expect(satScore).toBe("0");
  });
});
