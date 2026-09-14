import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// 2026-09-09(UAT 지적, 제품 오너 승인) — curriculum_docs/curriculum_doc_sections
// 열람 RLS를 v3(subject_enrollments + teacher_assignments)까지 확장한
// 20261267000000_r9_curriculum_docs_v3_access.sql을 로컬 Postgres에 직접
// psql로 검증한다. 레거시 enrollments 행이 전혀 없는, 순수 v3 전용 교사/학생
// 계정이 공개된 교재를 볼 수 있어야 한다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

function psqlAs(userId: string, sql: string): string {
  const out = psql(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${userId}', false);
    ${sql}
    reset role;
  `);
  const lines = out.split("\n");
  return lines[lines.length - 1];
}

function createAuthUser(role: "teacher" | "student", label: string): string {
  const id = psql(`
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'v3-materials-${label}-${Date.now()}@example.com', 'x', now(), '{}', '{}', now(), now())
    returning id;
  `);
  psql(`insert into profiles (id, role, name, date_of_birth) values ('${id}', '${role}', 'v3 자료 테스트 ${label}', '2000-01-01');`);
  if (role === "teacher") {
    // RLS는 teacher_assignments.teacher_id만 확인하므로 teachers.status는
    // 이 테스트와 무관하다 — active 전환 체크리스트(시급 이력 등)를 굳이
    // 충족시키지 않도록 pending으로 둔다.
    psql(`insert into teachers (id, status) values ('${id}', 'pending');`);
  } else {
    psql(`insert into students (id, grade, status) values ('${id}', '10학년', 'active');`);
  }
  return id;
}

describe("v3(subject_enrollments/teacher_assignments) 전용 계정의 curriculum_docs 열람", () => {
  it("레거시 enrollments 행이 전혀 없어도, v3 배정된 교사/학생은 공개된 교재를 볼 수 있다", () => {
    const subjectId = psql(`insert into subjects (name) values ('v3자료테스트 ${Date.now()}') returning id;`);
    const teacherId = createAuthUser("teacher", "teacher");
    const studentId = createAuthUser("student", "student");

    const householdId = psql(`insert into households (primary_guardian_id) values (null) returning id;`);
    const contractId = psql(`
      insert into contracts (household_id, child_id, status)
      values ('${householdId}', '${studentId}', 'active')
      returning id;
    `);
    const subjectEnrollmentId = psql(`
      insert into subject_enrollments (child_id, subject_id, contract_id, status)
      values ('${studentId}', '${subjectId}', '${contractId}', 'active')
      returning id;
    `);
    psql(`select set_teacher_rate('${teacherId}', 50000, 'KRW');`);
    psql(`
      insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from)
      values ('${subjectEnrollmentId}', '${teacherId}', 'active', now());
    `);

    const docId = psql(`
      insert into curriculum_docs (subject_id, owner_type, status, title)
      values ('${subjectId}', 'admin', 'published', '테스트 교재')
      returning id;
    `);
    const sectionId = psql(`
      insert into curriculum_doc_sections (curriculum_doc_id, position, title, body)
      values ('${docId}', 1, '개념 정리', '본문')
      returning id;
    `);

    // 레거시 enrollments 행은 의도적으로 만들지 않는다 — 순수 v3 경로만 검증.
    const legacyCount = psql(`select count(*) from enrollments where subject_id = '${subjectId}';`);
    expect(legacyCount).toBe("0");

    const teacherSeesDoc = psqlAs(teacherId, `select count(*) from curriculum_docs where id = '${docId}';`);
    expect(teacherSeesDoc).toBe("1");
    const teacherSeesSection = psqlAs(teacherId, `select count(*) from curriculum_doc_sections where id = '${sectionId}';`);
    expect(teacherSeesSection).toBe("1");

    const studentSeesDoc = psqlAs(studentId, `select count(*) from curriculum_docs where id = '${docId}';`);
    expect(studentSeesDoc).toBe("1");
    const studentSeesSection = psqlAs(studentId, `select count(*) from curriculum_doc_sections where id = '${sectionId}';`);
    expect(studentSeesSection).toBe("1");
  });

  it("v3 배정이 없는 제3자 교사는 여전히 볼 수 없다", () => {
    const subjectId = psql(`insert into subjects (name) values ('v3자료테스트-무관 ${Date.now()}') returning id;`);
    const otherTeacherId = createAuthUser("teacher", "unrelated");
    const docId = psql(`
      insert into curriculum_docs (subject_id, owner_type, status, title)
      values ('${subjectId}', 'admin', 'published', '테스트 교재')
      returning id;
    `);

    const sees = psqlAs(otherTeacherId, `select count(*) from curriculum_docs where id = '${docId}';`);
    expect(sees).toBe("0");
  });
});
