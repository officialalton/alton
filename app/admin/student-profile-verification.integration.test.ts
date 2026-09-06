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

  it("null이 아닌 값을 넘기면 그대로 저장된다(예: 400, 유효 범위 하한)", () => {
    const boundaryStudent = createStudent("sat-lower-bound");
    psqlAsStudent(
      boundaryStudent,
      `select complete_student_profile('2011-01-01', 'OO고등학교', '10학년', 400, null, '{}', '{}', null);`
    );
    const satScore = psql(`select sat_score from students where id = '${boundaryStudent}';`);
    expect(satScore).toBe("400");
  });
});

describe("complete_student_profile — 2026-09-05 무결성 보강(SAT 범위/GPA↔척도)", () => {
  it("SAT가 400 미만이면 거부한다", () => {
    const s = createStudent("sat-too-low");
    expect(() =>
      psqlAsStudent(
        s,
        `select complete_student_profile('2011-01-01', 'OO고등학교', '10학년', 399, null, '{}', '{}', null);`
      )
    ).toThrow(/SAT 점수는 400~1600 사이여야 합니다/);
  });

  it("SAT가 1600 초과면 거부한다", () => {
    const s = createStudent("sat-too-high");
    expect(() =>
      psqlAsStudent(
        s,
        `select complete_student_profile('2011-01-01', 'OO고등학교', '10학년', 1601, null, '{}', '{}', null);`
      )
    ).toThrow(/SAT 점수는 400~1600 사이여야 합니다/);
  });

  it("2026-09-06 후속: 과거 'sat_score=0(미입력 표식)' 데이터는 정규화 절차로 null이 되고, 그 뒤에도 400~1600 제약이 정상 적용된다", () => {
    // 20261106000000 마이그레이션에 추가된 정규화(update ... set sat_score = null
    // where sat_score = 0)를 그 마이그레이션의 정확한 순서(제약 제거 → 레거시 0값
    // 주입 → 정규화 → 제약 재적용)로 재현해, 실제 마이그레이션 실행과 동일한
    // 효과를 검증한다. 완전히 마이그레이션된 DB에서는 제약 때문에 sat_score=0을
    // 직접 넣을 수 없으므로, 이 시나리오 재현을 위해서만 제약을 일시적으로 내린다.
    const s = createStudent("sat-legacy-zero-normalized");
    psql(`
      begin;
      alter table students drop constraint if exists students_sat_score_range;
      update students set sat_score = 0 where id = '${s}';
      update students set sat_score = null where sat_score = 0;
      alter table students add constraint students_sat_score_range
        check (sat_score is null or (sat_score >= 400 and sat_score <= 1600));
      commit;
    `);
    const satScore = psql(`select coalesce(sat_score::text, 'null') from students where id = '${s}';`);
    expect(satScore).toBe("null");

    // 정규화 이후에는 제약이 정상 동작해 0 재입력은 다시 거부된다.
    expect(() => psql(`update students set sat_score = 0 where id = '${s}';`)).toThrow(
      /students_sat_score_range/
    );
  });

  it("2026-09-06: GPA가 음수이면 서버 함수에서 거부한다", () => {
    const s = createStudent("gpa-negative-fn");
    expect(() =>
      psqlAsStudent(
        s,
        `select complete_student_profile('2011-01-01', 'OO고등학교', '10학년', null, -0.1, '{}', '{}', '4.0');`
      )
    ).toThrow(/GPA는 0 이상이어야 합니다/);
  });

  it("2026-09-06: GPA 음수는 DB CHECK 제약(students_gpa_non_negative)으로도 차단된다", () => {
    const s = createStudent("gpa-negative-check");
    expect(() =>
      psqlAsAdmin(`update students set gpa = -1, gpa_scale = '4.0' where id = '${s}';`)
    ).toThrow(/students_gpa_non_negative/);
  });

  it("GPA만 있고 gpa_scale이 없으면 거부한다", () => {
    const s = createStudent("gpa-no-scale");
    expect(() =>
      psqlAsStudent(
        s,
        `select complete_student_profile('2011-01-01', 'OO고등학교', '10학년', null, 3.5, '{}', '{}', null);`
      )
    ).toThrow(/GPA를 입력하려면 GPA 척도를 함께 선택해야 합니다/);
  });

  it("gpa_scale만 있고 GPA가 없으면 거부한다", () => {
    const s = createStudent("scale-no-gpa");
    expect(() =>
      psqlAsStudent(
        s,
        `select complete_student_profile('2011-01-01', 'OO고등학교', '10학년', null, null, '{}', '{}', '4.0');`
      )
    ).toThrow(/GPA 척도만 선택하고 GPA 값이 없는 상태는 허용되지 않습니다/);
  });

  it("GPA가 선택한 척도를 초과하면 거부한다(예: 4.0 척도에 4.3)", () => {
    const s = createStudent("gpa-over-scale");
    expect(() =>
      psqlAsStudent(
        s,
        `select complete_student_profile('2011-01-01', 'OO고등학교', '10학년', null, 4.3, '{}', '{}', '4.0');`
      )
    ).toThrow(/GPA 값\(.*\)이 선택한 척도\(.*\)를 초과할 수 없습니다/);
  });

  it.each([
    ["4.0", 4.0],
    ["4.3", 4.3],
    ["4.5", 4.5],
    ["5.0", 5.0],
  ])("척도 %s에서 정확히 만점(%s)은 허용된다(상한 경계값)", (scale, maxGpa) => {
    const s = createStudent(`gpa-scale-${scale}`);
    psqlAsStudent(
      s,
      `select complete_student_profile('2011-01-01', 'OO고등학교', '10학년', null, ${maxGpa}, '{}', '{}', '${scale}');`
    );
    const row = psql(`select gpa, gpa_scale from students where id = '${s}';`);
    const [gpa, gpaScale] = row.split("|");
    expect(Number(gpa)).toBeCloseTo(maxGpa);
    expect(gpaScale).toBe(scale);
  });

  it("GPA·gpa_scale 둘 다 null인 조합은 허용된다", () => {
    const s = createStudent("gpa-both-null");
    psqlAsStudent(
      s,
      `select complete_student_profile('2011-01-01', 'OO고등학교', '10학년', null, null, '{}', '{}', null);`
    );
    const row = psql(`select gpa, gpa_scale from students where id = '${s}';`);
    const [gpa, gpaScale] = row.split("|");
    expect(gpa).toBe("");
    expect(gpaScale).toBe("");
  });
});
