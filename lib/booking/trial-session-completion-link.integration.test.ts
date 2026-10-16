import { execFileSync } from "node:child_process";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

// M5-d(2026-09-06) — trial_sessions(관리자의 체험 계획/추적 행) ↔ 실제 v3 sessions
// 연결 및 자동 완료 반영을 로컬 Postgres에 직접 psql로 검증한다. 전용 선생님/학생을
// 매번 새로 만들어 다른 통합 테스트 파일과의 teacher_availability_rules 레이스를
// 원천 차단한다(다른 파일들과 동일한 패턴).

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001"; // SAT Math
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

let teacherId: string;
let trialLessonTypeId: string;
let trialProductId: string;

function grantTrialEntitlement(childId: string): void {
  const grantId = psql(
    `insert into entitlement_grants (child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at, is_paid)
     values ('${childId}', '${trialProductId}', null, 1, now() + interval '90 days', false) returning id;`
  );
  psql(
    `insert into entitlement_ledger (grant_id, event_type, amount, business_event_id) values ('${grantId}', 'grant', 1, 'm5d-trial-grant-${Date.now()}-${grantId}');`
  );
}

// trial_sessions_one_active_per_child 제약(자녀당 scheduled/completed 체험은 1개) 때문에
// 각 테스트는 독립된 학생으로 실행한다.
function createTestChild(label: string): { childId: string; subjectEnrollmentId: string } {
  const now = Date.now();
  const authEmail = `m5d-${label}-${now}@example.com`;
  const childId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${authEmail}', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`
    insert into profiles (id, role, name, date_of_birth) values ('${childId}', 'student', 'M5d 통합테스트 학생(${label})', (now() - interval '16 years')::date);
    insert into students (id, grade, status) values ('${childId}', '10학년', 'active');
  `);
  const householdId = psql(`insert into households (primary_guardian_id) values (null) returning id;`);
  psql(
    `insert into household_members (household_id, profile_id, role, is_primary)
     values ('${householdId}', '${childId}', 'child', true);`
  );
  const contractId = psql(
    `insert into contracts (household_id, child_id, status) values ('${householdId}', '${childId}', 'draft') returning id;`
  );
  const subjectEnrollmentId = psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status)
     values ('${childId}', '${SUBJECT_ID}', '${contractId}', 'planned') returning id;`
  );
  psql(
    `insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from, source)
     values ('${subjectEnrollmentId}', '${teacherId}', 'active', now() - interval '1 day', 'app');`
  );
  return { childId, subjectEnrollmentId };
}

beforeAll(() => {
  trialLessonTypeId = psql(`select id from lesson_types where code = 'trial';`);
  trialProductId = psql(`select id from entitlement_products where code = 'trial_lesson_grant';`);

  const now = Date.now();
  teacherId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'm5d-teacher-${now}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`insert into profiles (id, role, name) values ('${teacherId}', 'teacher', 'M5d 통합테스트 선생님');`);
  psql(`select set_teacher_rate('${teacherId}', 3000000, 'KRW', now() - interval '1 day');`);
  psql(`insert into teachers (id, status) values ('${teacherId}', 'active');`);
  psql(
    `insert into teacher_availability_rules (teacher_id, day_of_week, start_time_local, end_time_local, timezone, created_by)
     select '${teacherId}', d, '00:00', '23:59', 'America/Los_Angeles', '${ADMIN_ID}' from generate_series(0,6) d;`
  );

});

afterAll(() => {
  psql(`delete from teacher_availability_rules where teacher_id = '${teacherId}' and created_by = '${ADMIN_ID}';`);
});

describe("trial_sessions ↔ 실제 v3 세션 연결·자동 완료 반영", () => {
  it("체험 예약이 생성되면 관리자의 체험 계획 행(trial_sessions)에 자동으로 연결된다", () => {
    const { childId, subjectEnrollmentId } = createTestChild("link");
    const consultationId = psql(
      `insert into consultations (contact_name, contact_email, child_id) values ('테스트', 'm5d-trial-link@example.com', '${childId}') returning id;`
    );
    const trialSessionId = psql(
      `insert into trial_sessions (consultation_id, child_id, subject_id, teacher_id, scheduled_at)
       values ('${consultationId}', '${childId}', '${SUBJECT_ID}', '${teacherId}', now() + interval '10 days') returning id;`
    );

    grantTrialEntitlement(childId);
    const startsAt = new Date();
    startsAt.setUTCDate(startsAt.getUTCDate() + 10);
    startsAt.setUTCHours(17, 0, 0, 0);
    const endsAt = new Date(startsAt.getTime() + 60 * 60000);
    const row = psql(
      `select reservation_id, session_id from confirm_lesson_booking('${childId}', '${subjectEnrollmentId}', '${teacherId}', '${trialLessonTypeId}', '${startsAt.toISOString()}', '${endsAt.toISOString()}', 'm5d-book-${Date.now()}');`
    );
    const [, sessionId] = row.split("|");

    const linkedSessionId = psql(`select session_id from trial_sessions where id = '${trialSessionId}';`);
    expect(linkedSessionId).toBe(sessionId);
  });

  it("trial_sessions.status는 직접 UPDATE로 completed로 바꿀 수 없다(실제 세션 완료를 통해서만 반영)", () => {
    const { childId } = createTestChild("direct-block");
    const consultationId = psql(
      `insert into consultations (contact_name, contact_email, child_id) values ('테스트', 'm5d-direct-block@example.com', '${childId}') returning id;`
    );
    const trialSessionId = psql(
      `insert into trial_sessions (consultation_id, child_id, subject_id, teacher_id, scheduled_at)
       values ('${consultationId}', '${childId}', '${SUBJECT_ID}', '${teacherId}', now() + interval '11 days') returning id;`
    );
    expect(() => psql(`update trial_sessions set status = 'completed' where id = '${trialSessionId}';`)).toThrow(
      /연결된 세션이 완료 상태가 아닙니다/
    );
  });

  it("실제 v3 세션이 completed로 확정되면 연결된 trial_sessions도 자동으로 completed 처리된다", () => {
    const { childId, subjectEnrollmentId } = createTestChild("auto-complete");
    const consultationId = psql(
      `insert into consultations (contact_name, contact_email, child_id) values ('테스트', 'm5d-auto-complete@example.com', '${childId}') returning id;`
    );
    const trialSessionId = psql(
      `insert into trial_sessions (consultation_id, child_id, subject_id, teacher_id, scheduled_at)
       values ('${consultationId}', '${childId}', '${SUBJECT_ID}', '${teacherId}', now() + interval '12 days') returning id;`
    );

    grantTrialEntitlement(childId);
    const startsAt = new Date();
    startsAt.setUTCDate(startsAt.getUTCDate() + 12);
    startsAt.setUTCHours(17, 0, 0, 0);
    const endsAt = new Date(startsAt.getTime() + 60 * 60000);
    const row = psql(
      `select reservation_id, session_id from confirm_lesson_booking('${childId}', '${subjectEnrollmentId}', '${teacherId}', '${trialLessonTypeId}', '${startsAt.toISOString()}', '${endsAt.toISOString()}', 'm5d-book-${Date.now()}');`
    );
    const [, sessionId] = row.split("|");

    // 아직 완료 전 — trial_sessions는 여전히 scheduled.
    let trialStatus = psql(`select status from trial_sessions where id = '${trialSessionId}';`);
    expect(trialStatus).toBe("scheduled");

    psql(`select mark_lesson_session_started('${sessionId}', '${teacherId}');`);
    psql(
      `update reservations set starts_at = starts_at - interval '365 days', ends_at = ends_at - interval '365 days' where id = (select reservation_id from sessions where id = '${sessionId}');`
    );
    psql(`select finalize_lesson_session('${sessionId}', 'completed', '${teacherId}', '정상 완료');`);

    trialStatus = psql(`select status from trial_sessions where id = '${trialSessionId}';`);
    expect(trialStatus).toBe("completed");
    const completedAt = psql(`select (completed_at is not null) from trial_sessions where id = '${trialSessionId}';`);
    expect(completedAt).toBe("t");
  });

  // 배치 1-3 corrective(20261254000000) — app.bypass_trial_session_auto_complete GUC를
  // 결과 조건 재검증(연결 세션 final_status='completed' + completed_at 동시 non-null)으로
  // 교체한 뒤의 회귀 테스트. 3차 개정이 추가한 completed_at 동시성 불변식까지 검증한다.
  describe("reject_direct_trial_session_completion() — 결과 조건 재검증(corrective 회귀, 3차 개정)", () => {
    it("② 링크된 세션이 completed가 아니면 authenticated/관리자/service_role 전부 직접 완료를 거부당한다(역할 무관)", () => {
      const { childId, subjectEnrollmentId } = createTestChild("role-agnostic-block");
      const consultationId = psql(
        `insert into consultations (contact_name, contact_email, child_id) values ('테스트', 'm5d-role-agnostic@example.com', '${childId}') returning id;`
      );
      const trialSessionId = psql(
        `insert into trial_sessions (consultation_id, child_id, subject_id, teacher_id, scheduled_at)
         values ('${consultationId}', '${childId}', '${SUBJECT_ID}', '${teacherId}', now() + interval '21 days') returning id;`
      );
      grantTrialEntitlement(childId);
      const startsAt = new Date();
      startsAt.setUTCDate(startsAt.getUTCDate() + 21);
      startsAt.setUTCHours(17, 0, 0, 0);
      const endsAt = new Date(startsAt.getTime() + 60 * 60000);
      psql(
        `select session_id from confirm_lesson_booking('${childId}', '${subjectEnrollmentId}', '${teacherId}', '${trialLessonTypeId}', '${startsAt.toISOString()}', '${endsAt.toISOString()}', 'm5d-book-${Date.now()}');`
      );
      // 연결된 sessions.final_status는 아직 'scheduled' — completed가 아니다.

      // authenticated 역할(관리자 클레임 포함)로 직접 완료 시도.
      expect(() =>
        psql(`
          set role authenticated;
          select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
          update trial_sessions set status = 'completed', completed_at = now() where id = '${trialSessionId}';
          reset role;
        `)
      ).toThrow(/연결된 세션이 완료 상태가 아닙니다/);

      // service_role/superuser(RLS 우회 경로 근사, psql 기본 연결) 직접 완료 시도 —
      // 관리자 게이트가 없어도 결과 조건 재검증이 그대로 막는다.
      expect(() =>
        psql(`update trial_sessions set status = 'completed', completed_at = now() where id = '${trialSessionId}';`)
      ).toThrow(/연결된 세션이 완료 상태가 아닙니다/);

      const stillNotCompleted = psql(`select status from trial_sessions where id = '${trialSessionId}';`);
      expect(stillNotCompleted).not.toBe("completed");
    });

    it("③(3차 개정 신규) 링크된 세션이 completed라도 completed_at 없이 직접 완료 시도하면 거부된다", () => {
      const { childId, subjectEnrollmentId } = createTestChild("completed-at-missing");
      const consultationId = psql(
        `insert into consultations (contact_name, contact_email, child_id) values ('테스트', 'm5d-cam@example.com', '${childId}') returning id;`
      );
      const linkedTrialId = psql(
        `insert into trial_sessions (consultation_id, child_id, subject_id, teacher_id, scheduled_at)
         values ('${consultationId}', '${childId}', '${SUBJECT_ID}', '${teacherId}', now() + interval '22 days') returning id;`
      );
      grantTrialEntitlement(childId);
      const startsAt = new Date();
      startsAt.setUTCDate(startsAt.getUTCDate() + 22);
      startsAt.setUTCHours(17, 0, 0, 0);
      const endsAt = new Date(startsAt.getTime() + 60 * 60000);
      const row = psql(
        `select reservation_id, session_id from confirm_lesson_booking('${childId}', '${subjectEnrollmentId}', '${teacherId}', '${trialLessonTypeId}', '${startsAt.toISOString()}', '${endsAt.toISOString()}', 'm5d-book-${Date.now()}');`
      );
      const [, sessionId] = row.split("|");
      psql(`select mark_lesson_session_started('${sessionId}', '${teacherId}');`);
      psql(
        `update reservations set starts_at = starts_at - interval '365 days', ends_at = ends_at - interval '365 days' where id = (select reservation_id from sessions where id = '${sessionId}');`
      );
      psql(`select finalize_lesson_session('${sessionId}', 'completed', '${teacherId}', '정상 완료');`);
      // 캐스케이드로 이미 completed + completed_at 채워짐 — 다시 scheduled로 돌려
      // "링크된 세션은 completed인데 completed_at 없이 직접 완료" 케이스를 만든다.
      psql(`update trial_sessions set status = 'scheduled', completed_at = null where id = '${linkedTrialId}';`);

      expect(() =>
        psql(`update trial_sessions set status = 'completed' where id = '${linkedTrialId}';`)
      ).toThrow(/completed_at도 함께 채워야 합니다/);

      const stillNotCompleted = psql(`select status from trial_sessions where id = '${linkedTrialId}';`);
      expect(stillNotCompleted).toBe("scheduled");
    });

    it("④ 링크된 세션이 completed이고 completed_at도 함께 채우면 직접 UPDATE가 통과한다(호출자 미검증은 GUC 방식과 동일 노출 수준)", () => {
      const { childId, subjectEnrollmentId } = createTestChild("completed-at-present");
      const consultationId = psql(
        `insert into consultations (contact_name, contact_email, child_id) values ('테스트', 'm5d-cap@example.com', '${childId}') returning id;`
      );
      const linkedTrialId = psql(
        `insert into trial_sessions (consultation_id, child_id, subject_id, teacher_id, scheduled_at)
         values ('${consultationId}', '${childId}', '${SUBJECT_ID}', '${teacherId}', now() + interval '23 days') returning id;`
      );
      grantTrialEntitlement(childId);
      const startsAt = new Date();
      startsAt.setUTCDate(startsAt.getUTCDate() + 23);
      startsAt.setUTCHours(17, 0, 0, 0);
      const endsAt = new Date(startsAt.getTime() + 60 * 60000);
      const row = psql(
        `select reservation_id, session_id from confirm_lesson_booking('${childId}', '${subjectEnrollmentId}', '${teacherId}', '${trialLessonTypeId}', '${startsAt.toISOString()}', '${endsAt.toISOString()}', 'm5d-book-${Date.now()}');`
      );
      const [, sessionId] = row.split("|");
      psql(`select mark_lesson_session_started('${sessionId}', '${teacherId}');`);
      psql(
        `update reservations set starts_at = starts_at - interval '365 days', ends_at = ends_at - interval '365 days' where id = (select reservation_id from sessions where id = '${sessionId}');`
      );
      psql(`select finalize_lesson_session('${sessionId}', 'completed', '${teacherId}', '정상 완료');`);
      psql(`update trial_sessions set status = 'scheduled', completed_at = null where id = '${linkedTrialId}';`);

      psql(
        `update trial_sessions set status = 'completed', completed_at = now() where id = '${linkedTrialId}';`
      );

      const finalRow = psql(
        `select status, (completed_at is not null) from trial_sessions where id = '${linkedTrialId}';`
      );
      expect(finalRow).toBe("completed|t");
    });
  });
});
