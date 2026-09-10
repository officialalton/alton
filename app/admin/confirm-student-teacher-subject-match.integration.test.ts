import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

// 2026-09-10(매칭 공통화 + 커리큘럼 출처 보존) — 실제 로컬 Postgres에 대고
// confirm_student_teacher_subject_match()/seed_curriculum_overlay_for_match()
// (migration 20261270000000)를 직접 호출해 검증한다. 다음 UAT 항목을 다룬다:
//   1) 공통 매칭의 원자성 — 유효 시급 없는 교사 배정 시도가 실패하면
//      subject_enrollments insert까지 함께 롤백된다(부분 성공 없음).
//   2) 중복 호출 멱등성 — 같은 조합을 두 번 호출해도 행이 중복 생성되지 않는다.
//   3) 교사 운영본 우선 / 공통 원본(subject_template_units) 폴백.
//   4) 서로 다른 시점에 매칭된 두 학생의 커리큘럼 스냅샷이 다르게 남는다.
//   5) 교사 운영본 단원 삭제 후에도 학생 사본과 출처(source_kind)는 보존된다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const ADMIN_PASSWORD = "test-password-12345";

const admin = createClient("http://127.0.0.1:54421", SERVICE_ROLE_KEY);

type MatchRpcRow = {
  out_subject_enrollment_id: string;
  out_teacher_assignment_id: string;
  out_overlay_id: string | null;
  out_activation_warning: string | null;
  out_curriculum_warning: string | null;
};

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

async function createAdminUser(label: string): Promise<{ id: string; email: string }> {
  const email = `p0-match-admin-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: ADMIN_PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(error?.message ?? "admin 생성 실패");
  psql(`insert into profiles (id, role, name) values ('${data.user.id}', 'admin', '${label}');`);
  return { id: data.user.id, email };
}

async function signInAsAdmin(email: string) {
  const client = createClient("http://127.0.0.1:54421", ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password: ADMIN_PASSWORD });
  if (error) throw new Error(error.message);
  return client;
}

function createChild(label: string): string {
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'p0-match-child-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  // date_of_birth를 만 13세 이상으로 지정해 보호자 동의 게이트를 비켜간다 —
  // 이 테스트가 검증하려는 건 매칭 원자성·멱등성·커리큘럼 시딩이지 미성년자
  // 동의 정책이 아니다.
  psql(`insert into profiles (id, role, name, date_of_birth) values ('${id}', 'student', '${label}', '2008-01-01');`);
  psql(`insert into students (id, grade, status) values ('${id}', '10학년', 'pending');`);
  return id;
}

function createTeacher(label: string, withValidRate: boolean): string {
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'p0-match-teacher-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`insert into profiles (id, role, name) values ('${id}', 'teacher', '${label}');`);
  psql(`insert into teachers (id, status) values ('${id}', 'pending');`);
  if (withValidRate) {
    psql(`select set_teacher_rate('${id}', 30000, 'KRW');`);
  }
  return id;
}

function createSubject(label: string): string {
  // name은 unique 제약이 있다 — DB reset 없이 이 파일을 반복 실행해도 충돌하지
  // 않도록 매번 고유한 이름을 만든다.
  const uniqueName = `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return psql(`insert into subjects (name) values ('${uniqueName}') returning id;`);
}

function createHousehold(childId: string): string {
  const guardianId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'p0-match-guardian-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`insert into profiles (id, role, name) values ('${guardianId}', 'parent', '보호자');`);
  psql(`insert into parents (id) values ('${guardianId}');`);
  const householdId = psql(`insert into households (primary_guardian_id) values ('${guardianId}') returning id;`);
  psql(
    `insert into household_members (household_id, profile_id, role, is_primary) values
       ('${householdId}', '${guardianId}', 'guardian', true),
       ('${householdId}', '${childId}', 'child', true);`
  );
  return householdId;
}

describe("confirm_student_teacher_subject_match (2026-09-10, 매칭 공통화, 실제 DB)", () => {
  it("원자성: 유효 시급 없는 교사 배정은 전체가 실패하고 subject_enrollments도 만들어지지 않는다", async () => {
    const adminUser = await createAdminUser("관리자1");
    const childId = createChild("원자성학생1");
    createHousehold(childId);
    const subjectId = createSubject("원자성과목1");
    const teacherId = createTeacher("원자성교사1", false); // 유효 시급 없음

    const adminClient = await signInAsAdmin(adminUser.email);
    const { error } = await adminClient.rpc("confirm_student_teacher_subject_match", {
      p_child_id: childId,
      p_teacher_id: teacherId,
      p_subject_id: subjectId,
    });

    expect(error).not.toBeNull();
    expect(error?.message).toContain("유효한 현재 시급 이력이 없어 배정할 수 없습니다");

    const enrollmentCount = psql(
      `select count(*) from subject_enrollments where child_id = '${childId}' and subject_id = '${subjectId}';`
    );
    expect(enrollmentCount).toBe("0"); // 부분 성공 없음 — 앞 단계까지 롤백됨
  });

  it("정상 배정 + 멱등성: 같은 조합을 두 번 호출해도 새 행을 만들지 않고 같은 id를 반환한다", async () => {
    const adminUser = await createAdminUser("관리자2");
    const childId = createChild("멱등학생1");
    createHousehold(childId);
    const subjectId = createSubject("멱등과목1");
    const teacherId = createTeacher("멱등교사1", true);

    const adminClient = await signInAsAdmin(adminUser.email);
    const first = await adminClient.rpc("confirm_student_teacher_subject_match", {
      p_child_id: childId,
      p_teacher_id: teacherId,
      p_subject_id: subjectId,
    }).single();
    expect(first.error).toBeNull();
    const firstData = first.data as MatchRpcRow;
    expect(firstData.out_subject_enrollment_id).toBeTruthy();
    expect(firstData.out_teacher_assignment_id).toBeTruthy();

    const second = await adminClient.rpc("confirm_student_teacher_subject_match", {
      p_child_id: childId,
      p_teacher_id: teacherId,
      p_subject_id: subjectId,
    }).single();
    expect(second.error).toBeNull();
    const secondData = second.data as MatchRpcRow;
    expect(secondData.out_subject_enrollment_id).toBe(firstData.out_subject_enrollment_id);
    expect(secondData.out_teacher_assignment_id).toBe(firstData.out_teacher_assignment_id);

    const enrollmentCount = psql(
      `select count(*) from subject_enrollments where child_id = '${childId}' and subject_id = '${subjectId}';`
    );
    expect(enrollmentCount).toBe("1");
    const assignmentCount = psql(
      `select count(*) from teacher_assignments where subject_enrollment_id = '${firstData.out_subject_enrollment_id}' and status = 'active';`
    );
    expect(assignmentCount).toBe("1");

    // 학생 상태도 pending -> active로 자동 전환됐어야 한다.
    const studentStatus = psql(`select status from students where id = '${childId}';`);
    expect(studentStatus).toBe("active");
  });

  it("교사 운영본이 있으면 그것을 우선 시딩하고, source_kind='teacher_template'로 표시한다(공통 원본과 가산하지 않음)", async () => {
    const adminUser = await createAdminUser("관리자3");
    const childId = createChild("교사우선학생1");
    createHousehold(childId);
    const subjectId = createSubject("교사우선과목1");
    const teacherId = createTeacher("교사우선교사1", true);

    // 교사 운영본 생성.
    const templateId = psql(
      `insert into teacher_curriculum_templates (teacher_id, subject_id) values ('${teacherId}', '${subjectId}') returning id;`
    );
    psql(
      `insert into teacher_curriculum_template_units (template_id, position, unit_title, note) values
        ('${templateId}', 1, '교사 단원 1', '교사 노트 1'),
        ('${templateId}', 2, '교사 단원 2', null);`
    );
    // 공통 원본(subject_template_units)도 함께 만들어, 가산되지 않고 교사
    // 운영본만 쓰이는지 확인한다.
    psql(`insert into subject_template_units (subject_id, position, unit_title) values ('${subjectId}', 1, '공통 원본 단원');`);

    const adminClient = await signInAsAdmin(adminUser.email);
    const { data, error } = await adminClient
      .rpc("confirm_student_teacher_subject_match", {
        p_child_id: childId,
        p_teacher_id: teacherId,
        p_subject_id: subjectId,
      })
      .single();
    expect(error).toBeNull();
    const matchData = data as MatchRpcRow;
    expect(matchData.out_overlay_id).toBeTruthy();

    const units = psql(
      `select unit_title || '|' || source_kind from curriculum_overlay_units where overlay_id = '${matchData.out_overlay_id}' order by position;`
    ).split("\n");
    expect(units).toEqual(["교사 단원 1|teacher_template", "교사 단원 2|teacher_template"]);
    // 공통 원본 단원("공통 원본 단원")은 섞여 있지 않아야 한다 — 가산 금지.
    expect(units.some((u) => u.includes("공통 원본 단원"))).toBe(false);
  });

  it("교사 운영본이 없으면 기존 공통 원본(subject_template_units)으로 폴백한다", async () => {
    const adminUser = await createAdminUser("관리자4");
    const childId = createChild("폴백학생1");
    createHousehold(childId);
    const subjectId = createSubject("폴백과목1");
    const teacherId = createTeacher("폴백교사1", true); // 운영본 없음

    psql(`insert into subject_template_units (subject_id, position, unit_title) values ('${subjectId}', 1, '공통 원본 단원 A');`);

    const adminClient = await signInAsAdmin(adminUser.email);
    const { data, error } = await adminClient
      .rpc("confirm_student_teacher_subject_match", {
        p_child_id: childId,
        p_teacher_id: teacherId,
        p_subject_id: subjectId,
      })
      .single();
    expect(error).toBeNull();
    const matchData = data as MatchRpcRow;

    const units = psql(
      `select unit_title || '|' || source_kind from curriculum_overlay_units where overlay_id = '${matchData.out_overlay_id}' order by position;`
    ).split("\n");
    expect(units).toEqual(["공통 원본 단원 A|subject_template"]);
  });

  it("서로 다른 시점에 매칭된 두 학생은 그 사이 교사 운영본이 바뀌면 서로 다른 스냅샷을 갖는다", async () => {
    const adminUser = await createAdminUser("관리자5");
    const subjectId = createSubject("스냅샷과목1");
    const teacherId = createTeacher("스냅샷교사1", true);
    const templateId = psql(
      `insert into teacher_curriculum_templates (teacher_id, subject_id) values ('${teacherId}', '${subjectId}') returning id;`
    );
    const unitId = psql(
      `insert into teacher_curriculum_template_units (template_id, position, unit_title) values ('${templateId}', 1, '버전1 단원') returning id;`
    );

    const childA = createChild("스냅샷학생A");
    createHousehold(childA);
    const adminClient = await signInAsAdmin(adminUser.email);
    const resultA = await adminClient
      .rpc("confirm_student_teacher_subject_match", { p_child_id: childA, p_teacher_id: teacherId, p_subject_id: subjectId })
      .single();
    expect(resultA.error).toBeNull();

    // 교사가 운영본을 수정.
    psql(`update teacher_curriculum_template_units set unit_title = '버전2 단원' where id = '${unitId}';`);

    const childB = createChild("스냅샷학생B");
    createHousehold(childB);
    const resultB = await adminClient
      .rpc("confirm_student_teacher_subject_match", { p_child_id: childB, p_teacher_id: teacherId, p_subject_id: subjectId })
      .single();
    expect(resultB.error).toBeNull();

    const titleA = psql(`select unit_title from curriculum_overlay_units where overlay_id = '${(resultA.data as MatchRpcRow).out_overlay_id}';`);
    const titleB = psql(`select unit_title from curriculum_overlay_units where overlay_id = '${(resultB.data as MatchRpcRow).out_overlay_id}';`);
    expect(titleA).toBe("버전1 단원"); // A는 매칭 시점 스냅샷 유지 — 이후 교사 수정에 영향받지 않음.
    expect(titleB).toBe("버전2 단원"); // B는 자기 매칭 시점(수정 후)의 상태로 시딩됨.
  });

  it("교사 운영본 단원을 삭제해도 이미 배정된 학생의 사본과 출처(source_kind)는 남는다", async () => {
    const adminUser = await createAdminUser("관리자6");
    const childId = createChild("삭제보존학생1");
    createHousehold(childId);
    const subjectId = createSubject("삭제보존과목1");
    const teacherId = createTeacher("삭제보존교사1", true);
    const templateId = psql(
      `insert into teacher_curriculum_templates (teacher_id, subject_id) values ('${teacherId}', '${subjectId}') returning id;`
    );
    const unitId = psql(
      `insert into teacher_curriculum_template_units (template_id, position, unit_title) values ('${templateId}', 1, '삭제될 단원') returning id;`
    );

    const adminClient = await signInAsAdmin(adminUser.email);
    const { data, error } = await adminClient
      .rpc("confirm_student_teacher_subject_match", { p_child_id: childId, p_teacher_id: teacherId, p_subject_id: subjectId })
      .single();
    expect(error).toBeNull();
    const matchData = data as MatchRpcRow;

    psql(`delete from teacher_curriculum_template_units where id = '${unitId}';`);

    const row = psql(
      `select unit_title || '|' || source_kind || '|' || coalesce(source_teacher_template_unit_id::text, 'NULL') from curriculum_overlay_units where overlay_id = '${matchData.out_overlay_id}';`
    );
    expect(row).toBe("삭제될 단원|teacher_template|NULL"); // 제목·출처 사실은 남고, FK만 null(on delete set null).
  });
});
