import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// 2026-09-09(UAT 지적, 제품 오너 승인) — attempt_delete_or_archive_subject()
// (20261266000000_r9_subject_archive_policy.sql)를 로컬 Postgres에 직접
// psql로 검증한다. 세 가지를 확인한다:
//  1) 참조가 전혀 없는 과목은 실제로 하드 삭제된다.
//  2) 실사용 참조(학생 수강 이력 등)가 있는 과목은 삭제되지 않고
//     archived_at/archived_reason만 세팅되며, 사유가 구체적이다.
//  3) 보관 처리 후에도 기존 참조 행(예: subject_enrollments)의 subject_id는
//     그대로 유지되어 이름·이력 조회가 깨지지 않는다.
//  4) 관리자가 아니면 호출할 수 없다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

function psqlAsAdmin(sql: string): string {
  // psql -t -A는 각 statement의 결과 행을 전부 이어서 출력한다(set_config()
  // 자체도 값 1행을 반환) — 우리가 원하는 마지막 select의 결과만 취한다.
  const out = psql(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
    ${sql}
    reset role;
  `);
  const lines = out.split("\n");
  return lines[lines.length - 1];
}

function createSubject(name: string): string {
  return psql(`insert into subjects (name) values ('${name}') returning id;`);
}

describe("attempt_delete_or_archive_subject()", () => {
  it("참조가 전혀 없는 과목은 실제로 하드 삭제된다", () => {
    const subjectId = createSubject(`통합테스트 삭제전용 ${Date.now()}`);
    const row = psqlAsAdmin(
      `select archived, reason from attempt_delete_or_archive_subject('${subjectId}');`
    );
    const [archived, reason] = row.split("|");
    expect(archived).toBe("f");
    expect(reason).toBe("");

    const stillExists = psql(`select count(*) from subjects where id = '${subjectId}';`);
    expect(stillExists).toBe("0");
  });

  it("학생 수강 이력(subject_enrollments)이 있는 과목은 삭제 대신 보관 처리되고, 사유가 구체적이다", () => {
    const subjectId = createSubject(`통합테스트 보관대상 ${Date.now()}`);
    // 최소한의 subject_enrollments 참조 행 하나를 만든다(FK만 필요 — 다른
    // 필드는 이 테스트와 무관하므로 아무 기존 프로필/계약 id를 재사용하지
    // 않고, 이 테스트 전용 프로필·household·contract를 최소 구성한다).
    const childId = psql(`
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'subj-archive-test-${Date.now()}@example.com', 'x', now(), '{}', '{}', now(), now())
      returning id;
    `);
    psql(
      `insert into profiles (id, role, name, date_of_birth) values ('${childId}', 'student', '보관테스트 학생', '2005-01-01');`
    );
    psql(`insert into students (id, grade, status) values ('${childId}', '10학년', 'active');`);
    const householdId = psql(`insert into households (primary_guardian_id) values (null) returning id;`);
    const contractId = psql(`
      insert into contracts (household_id, child_id, status)
      values ('${householdId}', '${childId}', 'active')
      returning id;
    `);
    psql(`
      insert into subject_enrollments (child_id, subject_id, contract_id, status)
      values ('${childId}', '${subjectId}', '${contractId}', 'active');
    `);

    const row = psqlAsAdmin(
      `select archived, reason from attempt_delete_or_archive_subject('${subjectId}');`
    );
    const [archived, reason] = row.split("|");
    expect(archived).toBe("t");
    expect(reason).toContain("학생 수강 이력 1건");

    const dbRow = psql(
      `select archived_at is not null, archived_reason from subjects where id = '${subjectId}';`
    );
    expect(dbRow.startsWith("t|")).toBe(true);

    // 참조 행은 그대로 남아 이름·이력 조회가 깨지지 않는다.
    const enrollmentStillLinked = psql(
      `select count(*) from subject_enrollments where subject_id = '${subjectId}';`
    );
    expect(enrollmentStillLinked).toBe("1");
    const subjectNameStillReadable = psql(`select name from subjects where id = '${subjectId}';`);
    expect(subjectNameStillReadable).toContain("통합테스트 보관대상");
  });

  it("관리자가 아니면 호출할 수 없다", () => {
    const subjectId = createSubject(`통합테스트 권한체크 ${Date.now()}`);
    const studentId = psql(`
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'subj-archive-perm-${Date.now()}@example.com', 'x', now(), '{}', '{}', now(), now())
      returning id;
    `);
    psql(`insert into profiles (id, role, name) values ('${studentId}', 'student', '권한체크 학생');`);

    expect(() =>
      psql(`
        set role authenticated;
        select set_config('request.jwt.claim.sub', '${studentId}', false);
        select archived, reason from attempt_delete_or_archive_subject('${subjectId}');
        reset role;
      `)
    ).toThrow(/관리자만 과목을 삭제·보관 처리할 수 있습니다/);
  });
});
