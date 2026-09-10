import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

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

// 2026-09-09(UAT 지적, 제품 오너 승인) — 보관된 과목 참조 우회 방지
// (20261268000000_r9_subject_archive_bypass_and_race_guard.sql). UI 필터
// (selectableSubjects())는 앱 레벨 편의일 뿐이므로, 그 필터를 거치지 않고
// 직접 INSERT해도(= "일반 관리자 플로우로 위장한 우회") DB가 거부하는지
// 검증한다.
function archiveSubjectWithOneEnrollment(label: string): string {
  const subjectId = createSubject(`통합테스트 우회방지-${label} ${Date.now()}`);
  const childId = psql(`
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'subj-archive-bypass-${label}-${Date.now()}@example.com', 'x', now(), '{}', '{}', now(), now())
    returning id;
  `);
  psql(`insert into profiles (id, role, name, date_of_birth) values ('${childId}', 'student', '우회방지 학생 ${label}', '2005-01-01');`);
  psql(`insert into students (id, grade, status) values ('${childId}', '10학년', 'active');`);
  const householdId = psql(`insert into households (primary_guardian_id) values (null) returning id;`);
  const contractId = psql(`
    insert into contracts (household_id, child_id, status) values ('${householdId}', '${childId}', 'active') returning id;
  `);
  psql(`
    insert into subject_enrollments (child_id, subject_id, contract_id, status)
    values ('${childId}', '${subjectId}', '${contractId}', 'active');
  `);
  const row = psqlAsAdmin(`select archived from attempt_delete_or_archive_subject('${subjectId}');`);
  expect(row).toBe("t");
  return subjectId;
}

describe("보관된 과목 참조 우회 방지(UI 필터를 거치지 않은 직접 INSERT도 거부)", () => {
  it("보관된 과목으로 신규 학생 수강(subject_enrollments)을 만들 수 없다", () => {
    const subjectId = archiveSubjectWithOneEnrollment("enrollment");
    const childId = psql(`
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'subj-archive-bypass-new-${Date.now()}@example.com', 'x', now(), '{}', '{}', now(), now())
      returning id;
    `);
    psql(`insert into profiles (id, role, name, date_of_birth) values ('${childId}', 'student', '신규 학생', '2005-01-01');`);
    psql(`insert into students (id, grade, status) values ('${childId}', '10학년', 'active');`);
    const householdId = psql(`insert into households (primary_guardian_id) values (null) returning id;`);
    const contractId = psql(`
      insert into contracts (household_id, child_id, status) values ('${householdId}', '${childId}', 'active') returning id;
    `);
    expect(() =>
      psql(`
        insert into subject_enrollments (child_id, subject_id, contract_id, status)
        values ('${childId}', '${subjectId}', '${contractId}', 'active');
      `)
    ).toThrow(/보관된 과목에는 새로 연결할 수 없습니다/);
  });

  it("보관된 과목으로 새 선생님 커리큘럼 템플릿을 만들 수 없다", () => {
    const subjectId = archiveSubjectWithOneEnrollment("template");
    const teacherId = psql(`
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'subj-archive-bypass-teacher-${Date.now()}@example.com', 'x', now(), '{}', '{}', now(), now())
      returning id;
    `);
    psql(`insert into profiles (id, role, name) values ('${teacherId}', 'teacher', '보관방지 교사');`);
    psql(`insert into teachers (id, status) values ('${teacherId}', 'pending');`);
    expect(() =>
      psql(`insert into teacher_curriculum_templates (teacher_id, subject_id) values ('${teacherId}', '${subjectId}');`)
    ).toThrow(/보관된 과목에는 새로 연결할 수 없습니다/);
  });

  it("보관된 과목으로 새 교재를 만들 수 없다", () => {
    const subjectId = archiveSubjectWithOneEnrollment("doc");
    expect(() =>
      psql(`
        insert into curriculum_docs (subject_id, owner_type, status, title)
        values ('${subjectId}', 'admin', 'published', '보관방지 테스트 교재');
      `)
    ).toThrow(/보관된 과목에는 새로 연결할 수 없습니다/);
  });

  it("보관된 과목으로 새 문제를 만들 수 없다", () => {
    const subjectId = archiveSubjectWithOneEnrollment("problem");
    expect(() =>
      psql(`insert into problems (format, subject_id, status) values ('mc', '${subjectId}', 'draft');`)
    ).toThrow(/보관된 과목에는 새로 연결할 수 없습니다/);
  });
});

// 2026-09-09(UAT 지적, 제품 오너 승인) — "삭제 요청"과 "새 참조 생성"이 동시에
// 일어나도 하드 삭제나 원시 FK 오류가 나지 않아야 한다. 실제 두 개의 독립
// psql 프로세스를 겹쳐 실행해(진짜 동시성) 검증한다: 트랜잭션 A가 새
// subject_enrollment를 INSERT한 뒤 커밋을 잠깐 미루는 동안(pg_sleep),
// 트랜잭션 B(우리 RPC)가 같은 과목을 삭제 시도한다 — B는 A의 FK 행 잠금 때문에
// 대기했다가, A가 커밋한 뒤 재검증에서 참조를 발견해 원시 에러 없이 보관
// 처리로 전환돼야 한다.
describe("삭제 요청과 새 참조 생성의 동시성 안전성", () => {
  it("과목 삭제 처리 중 다른 트랜잭션이 동시에 참조를 커밋해도, 원시 FK 에러 없이 보관 처리로 전환된다", async () => {
    const subjectId = createSubject(`통합테스트 동시성 ${Date.now()}`);
    const childId = psql(`
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'subj-archive-race-${Date.now()}@example.com', 'x', now(), '{}', '{}', now(), now())
      returning id;
    `);
    psql(`insert into profiles (id, role, name, date_of_birth) values ('${childId}', 'student', '동시성 학생', '2005-01-01');`);
    psql(`insert into students (id, grade, status) values ('${childId}', '10학년', 'active');`);
    const householdId = psql(`insert into households (primary_guardian_id) values (null) returning id;`);
    const contractId = psql(`
      insert into contracts (household_id, child_id, status) values ('${householdId}', '${childId}', 'active') returning id;
    `);

    // 트랜잭션 A: INSERT 후 커밋 전에 0.6초 대기(FK 행 잠금을 그동안 붙들고 있음).
    const txA = execFileAsync("psql", [
      DB_URL,
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
      "-c",
      `
        begin;
        insert into subject_enrollments (child_id, subject_id, contract_id, status)
        values ('${childId}', '${subjectId}', '${contractId}', 'active');
        select pg_sleep(0.6);
        commit;
      `,
    ]);

    // 0.15초 뒤(A가 아직 커밋 전) B를 시작 — B의 DELETE가 A의 FK 잠금 때문에
    // 대기하다가 A 커밋 후 재검증하는 경로를 타도록 유도한다.
    await new Promise((resolve) => setTimeout(resolve, 150));
    const txB = execFileAsync("psql", [
      DB_URL,
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
      "-t",
      "-A",
      "-c",
      `
        set role authenticated;
        select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
        select archived, reason from attempt_delete_or_archive_subject('${subjectId}');
        reset role;
      `,
    ]);

    const [, resultB] = await Promise.all([txA, txB]);
    const lines = resultB.stdout.trim().split("\n");
    const [archived, reason] = lines[lines.length - 1].split("|");

    // 원시 FK 위반 에러 없이 정상적으로 완료돼야 하고(위 execFileAsync가
    // reject 없이 resolve했다는 것 자체가 이미 그 증거), 참조가 생겼으니
    // 삭제가 아니라 보관으로 전환돼야 한다.
    expect(archived).toBe("t");
    expect(reason).toContain("학생 수강 이력");

    const stillLinked = psql(`select count(*) from subject_enrollments where subject_id = '${subjectId}';`);
    expect(stillLinked).toBe("1");
  });
});
