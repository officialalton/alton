import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// R6 corrective(2026-09-09, 기반 안정화 계획 7절 5단계 후속 — 제품 오너 지적) —
// session_incident_reports INSERT 정책이 reported_by = auth.uid()를 강제하지
// 않아, 세션 관련자가 다른 사용자의 reported_by를 넣어 신고자를 위조할 수
// 있었던 문제(20261264000000_r6_corrective_incident_report_reported_by_identity.sql)의
// 회귀 테스트. 실제 v3 세션 RLS 관계(teacher_id/child_id/guardian)를 검증하기
// 위해 confirm_lesson_booking()으로 진짜 세션을 만든다(payout-batch-lifecycle
// 통합 테스트와 동일한 패턴, 이 파일 전용 fixture 사용).

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const RUN_ID = "r6-incident-report-identity-2026-09-09";
const TEACHER_ID = "77777777-0000-0000-0000-000000000003"; // 이 파일 전용(다른 통합 테스트와 겹치지 않음)
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001"; // 기존 seed subject, 읽기만 함

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

function psqlExpectError(sql: string): string {
  try {
    execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    throw new Error("expected psql to fail, but it succeeded");
  } catch (err) {
    const stderr = (err as { stderr?: Buffer })?.stderr?.toString() ?? String(err);
    return stderr;
  }
}

function asUser(userId: string, sql: string): string {
  return psql(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${userId}', false);
    ${sql}
    reset role;
  `);
}

function asUserExpectError(userId: string, sql: string): string {
  return psqlExpectError(`
    set role authenticated;
    do $$ begin perform set_config('request.jwt.claim.sub', '${userId}', false); end $$;
    ${sql}
    reset role;
  `);
}

function createAuthUser(emailLabel: string, role: string): string {
  return psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${RUN_ID}-${emailLabel}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
}

let guardianId: string;
let childId: string;
let householdId: string;
let subjectEnrollmentId: string;
let sessionId: string;
let strangerId: string; // 세션과 아무 관계 없는 제3자(다른 가족)

beforeAll(() => {
  psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', '${TEACHER_ID}', 'authenticated', 'authenticated', '${RUN_ID}-teacher-${Date.now()}@example.com', 'x', now(), '{}', '{}', now(), now())
     on conflict (id) do nothing;`
  );
  psql(`insert into profiles (id, role, name) values ('${TEACHER_ID}', 'teacher', '${RUN_ID} 선생님') on conflict (id) do nothing;`);

  guardianId = createAuthUser("guardian", "parent");
  psql(`insert into profiles (id, role, name) values ('${guardianId}', 'parent', '${RUN_ID} 보호자');`);

  childId = createAuthUser("child", "student");
  psql(`
    insert into profiles (id, role, name) values ('${childId}', 'student', '${RUN_ID} 학생');
    insert into students (id, grade, status) values ('${childId}', '10학년', 'active');
  `);

  strangerId = createAuthUser("stranger", "parent");
  psql(`insert into profiles (id, role, name) values ('${strangerId}', 'parent', '${RUN_ID} 무관한 사용자');`);

  householdId = psql(`insert into households (primary_guardian_id) values ('${guardianId}') returning id;`);
  psql(
    `insert into household_members (household_id, profile_id, role, is_primary)
     values ('${householdId}', '${guardianId}', 'guardian', true), ('${householdId}', '${childId}', 'child', true);`
  );
  const contractId = psql(
    `insert into contracts (household_id, child_id, status) values ('${householdId}', '${childId}', 'draft') returning id;`
  );
  subjectEnrollmentId = psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status)
     values ('${childId}', '${SUBJECT_ID}', '${contractId}', 'planned') returning id;`
  );
  psql(`select set_teacher_rate('${TEACHER_ID}', 3000000, 'KRW', now() - interval '10 day');`);
  const lessonTypeId = psql(`select id from lesson_types where code = 'regular';`);
  psql(
    `insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from, source)
     values ('${subjectEnrollmentId}', '${TEACHER_ID}', 'active', now() - interval '10 day', 'app');`
  );
  psql(
    `insert into teacher_availability_rules (teacher_id, day_of_week, start_time_local, end_time_local, timezone, created_by)
     select '${TEACHER_ID}', d, '00:00', '23:59', 'America/Los_Angeles', '${TEACHER_ID}' from generate_series(0,6) d;`
  );

  const regularProductId = psql(`select id from entitlement_products where code = 'lesson_pack_10';`);
  const grantId = psql(
    `insert into entitlement_grants (child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at, is_paid)
     values ('${childId}', '${regularProductId}', null, 5, now() + interval '90 days', true) returning id;`
  );
  psql(
    `insert into entitlement_ledger (grant_id, event_type, amount, business_event_id) values ('${grantId}', 'grant', 5, '${RUN_ID}-grant-${grantId}');`
  );

  const future = new Date();
  future.setUTCDate(future.getUTCDate() + 10);
  future.setUTCHours(15, 0, 0, 0); // 로컬 자정 부근을 피한 UTC 15시(America/Los_Angeles 기준 낮 시간)
  const startsAt = future.toISOString();
  const endsAt = new Date(future.getTime() + 120 * 60000).toISOString();
  const row = psql(
    `select session_id from confirm_lesson_booking('${childId}', '${subjectEnrollmentId}', '${TEACHER_ID}', '${lessonTypeId}', '${startsAt}', '${endsAt}', '${RUN_ID}-book-${Date.now()}');`
  );
  sessionId = row;
});

function psqlBestEffort(sql: string): void {
  try {
    psql(sql);
  } catch (err) {
    console.error(`[incident-report-identity cleanup] 정리 문장 실패(계속 진행): ${sql}\n`, err);
  }
}

afterAll(() => {
  psqlBestEffort(`delete from session_incident_reports where session_id = '${sessionId}';`);
  psqlBestEffort(`delete from session_status_events where session_id = '${sessionId}';`);
  psqlBestEffort(`delete from sessions where id = '${sessionId}';`);
  psqlBestEffort(`delete from subject_threads where teacher_assignment_id in (select id from teacher_assignments where teacher_id = '${TEACHER_ID}');`);
  psqlBestEffort(`delete from teacher_assignments where teacher_id = '${TEACHER_ID}';`);
  psqlBestEffort(`delete from teacher_availability_rules where teacher_id = '${TEACHER_ID}';`);
});

describe("session_incident_reports INSERT — reported_by = auth.uid() 구조적 강제 (R6 corrective)", () => {
  it("학생 본인이 자기 id로 신고하면 성공한다", () => {
    asUser(
      childId,
      `insert into session_incident_reports (session_id, report_type, reported_by, minutes_late)
       values ('${sessionId}', 'teacher_late', '${childId}', 10);`
    );
    const count = psql(
      `select count(*) from session_incident_reports where session_id = '${sessionId}' and reported_by = '${childId}';`
    );
    expect(count).toBe("1");
  });

  it("보호자 본인이 자기 id로 신고하면 성공한다", () => {
    asUser(
      guardianId,
      `insert into session_incident_reports (session_id, report_type, reported_by, minutes_late)
       values ('${sessionId}', 'teacher_late', '${guardianId}', 5);`
    );
    const count = psql(
      `select count(*) from session_incident_reports where session_id = '${sessionId}' and reported_by = '${guardianId}';`
    );
    expect(count).toBe("1");
  });

  it("선생님 본인이 자기 id로 신고하면 성공한다", () => {
    asUser(
      TEACHER_ID,
      `insert into session_incident_reports (session_id, report_type, reported_by)
       values ('${sessionId}', 'student_no_show_reported', '${TEACHER_ID}');`
    );
    const count = psql(
      `select count(*) from session_incident_reports where session_id = '${sessionId}' and reported_by = '${TEACHER_ID}';`
    );
    expect(count).toBe("1");
  });

  it("세션 관련자(학생 본인)라도 다른 사용자(교사)의 id를 reported_by로 넣으면 거부된다(신고자 위조 방지)", () => {
    const stderr = asUserExpectError(
      childId,
      `insert into session_incident_reports (session_id, report_type, reported_by, minutes_late)
       values ('${sessionId}', 'teacher_late', '${TEACHER_ID}', 10);`
    );
    expect(stderr).toMatch(/row-level security/i);
  });

  it("세션 관련자(보호자)라도 다른 사용자(무관한 제3자)의 id를 reported_by로 넣으면 거부된다(신고자 위조 방지)", () => {
    const stderr = asUserExpectError(
      guardianId,
      `insert into session_incident_reports (session_id, report_type, reported_by)
       values ('${sessionId}', 'teacher_no_show_reported', '${strangerId}');`
    );
    expect(stderr).toMatch(/row-level security/i);
  });

  it("세션과 무관한 사용자는 본인 id를 reported_by로 넣어도 세션 관련성 요건에서 거부된다", () => {
    const stderr = asUserExpectError(
      strangerId,
      `insert into session_incident_reports (session_id, report_type, reported_by)
       values ('${sessionId}', 'teacher_no_show_reported', '${strangerId}');`
    );
    expect(stderr).toMatch(/row-level security/i);
  });
});
