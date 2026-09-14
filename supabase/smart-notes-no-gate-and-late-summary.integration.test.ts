import { execFileSync } from "node:child_process";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

// 2026-09-06(제품 오너 검수 지적 반영) — Smart Notes(smart_notes_status/
// smart_notes_config_status/smart_notes_drive_file_id)가 pending/failed
// 상태여도 (1) 수업 종료 판정(finalize_lesson_session), (2) 리뷰 초안 저장/
// 확정(save_lesson_review_draft/finalize_lesson_review), (3) 정규 전환 선행조건
// (subject_enrollment_activation_ready)이 전부 성공하는지 로컬 Postgres에 직접
// psql로 검증한다. 코드 조사 결과 이 4개 함수 어디에도 smart_notes 관련 조건문이
// 없음을 확인했다(grep으로 함수 본문 전체 검사) — 이 테스트는 그 사실을 향후
// 회귀 없이 고정한다. 상담 결과 기록(admin_record_consultation_outcome)의 Smart
// Notes 게이트 제거는 이미 app/admin/consultation-outcome-smart-notes-gate.
// integration.test.ts가 검증하므로 여기서는 건드리지 않는다. 동의 게이트
// (guardian_consents 기반)도 이 테스트에서 건드리지 않는다.
//
// 추가로 "늦게 도착한 AI 요약이 확정된 리뷰를 덮어쓰지 않는다"도 함께 검증한다
// — save_lesson_review_draft()는 status<>'draft'면 예외를 던지므로(초안 되돌리기
// 금지), 리뷰가 final로 확정된 뒤 도착한 AI 요약 갱신 시도는 반드시 실패하고
// final_text는 그대로 남는다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001"; // SAT Math
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
// 2026-09-06: 이 파일 전용 선생님을 직접 생성한다(seed된 선생님을 재사용하면
// 다른 통합 테스트 파일과 teacher_availability_rules를 공유해 병렬 실행 시
// 레이스가 난다 — lib/booking/session-final-judgment.integration.test.ts와
// 동일한 이유, lib/booking/session-teacher-partial-interruption.integration.test.ts의
// 전용 선생님 생성 패턴을 재사용).
let TEACHER_ID: string;

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

function asUser(id: string, sql: string): string {
  const output = psql(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${id}', false);
    ${sql}
    reset role;
  `);
  const lines = output.split("\n");
  if (lines[0] === id) lines.shift();
  return lines.join("\n");
}

function asUserExpectError(id: string, sql: string): string {
  try {
    execFileSync(
      "psql",
      [
        DB_URL,
        "-v",
        "ON_ERROR_STOP=1",
        "-q",
        "-t",
        "-A",
        "-c",
        `set role authenticated; select set_config('request.jwt.claim.sub', '${id}', false); ${sql} reset role;`,
      ],
      { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }
    );
    throw new Error("expected psql to fail but it succeeded");
  } catch (err) {
    const stderr = (err as { stderr?: Buffer })?.stderr?.toString() ?? String(err);
    return stderr;
  }
}

let childId: string;
let subjectEnrollmentId: string;
let contractId: string;
let trialLessonTypeId: string;

function bookSession(daysFromNow: number, durationMinutes: number): string {
  const startsAtDate = new Date();
  startsAtDate.setUTCDate(startsAtDate.getUTCDate() + daysFromNow);
  startsAtDate.setUTCHours(17, 0, 0, 0);
  const startsAt = startsAtDate.toISOString();
  const endsAt = new Date(startsAtDate.getTime() + durationMinutes * 60000).toISOString();
  const row = psql(
    `select session_id from confirm_lesson_booking('${childId}', '${subjectEnrollmentId}', '${TEACHER_ID}', '${trialLessonTypeId}', '${startsAt}', '${endsAt}', 'smart-notes-gate-book-${Date.now()}-${Math.random()}');`
  );
  return row;
}

beforeAll(() => {
  trialLessonTypeId = psql(`select id from lesson_types where code = 'trial';`);
  const trialProductId = psql(`select id from entitlement_products where code = 'trial_lesson_grant';`);

  const now = Date.now();

  TEACHER_ID = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'smart-notes-gate-teacher-${now}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`insert into profiles (id, role, name) values ('${TEACHER_ID}', 'teacher', 'Smart Notes 게이트 통합테스트 선생님');`);
  psql(`select set_teacher_rate('${TEACHER_ID}', 3000000, 'KRW', now() - interval '1 day');`);
  psql(`insert into teachers (id, status) values ('${TEACHER_ID}', 'active');`);

  const authEmail = `smart-notes-gate-${now}@example.com`;
  childId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${authEmail}', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`
    insert into profiles (id, role, name, date_of_birth) values ('${childId}', 'student', 'Smart Notes 게이트 통합테스트 학생', now() - interval '17 years');
    insert into students (id, grade, status) values ('${childId}', '10학년', 'active');
  `);

  const householdId = psql(`insert into households (primary_guardian_id) values (null) returning id;`);
  psql(
    `insert into household_members (household_id, profile_id, role, is_primary)
     values ('${householdId}', '${childId}', 'child', true);`
  );
  contractId = psql(
    `insert into contracts (household_id, child_id, status) values ('${householdId}', '${childId}', 'draft') returning id;`
  );
  subjectEnrollmentId = psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status)
     values ('${childId}', '${SUBJECT_ID}', '${contractId}', 'planned') returning id;`
  );
  psql(`select set_teacher_rate('${TEACHER_ID}', 3000000, 'KRW', now() - interval '1 day');`);
  psql(
    `insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from, source)
     values ('${subjectEnrollmentId}', '${TEACHER_ID}', 'active', now() - interval '1 day', 'app');`
  );
  psql(
    `insert into teacher_availability_rules (teacher_id, day_of_week, start_time_local, end_time_local, timezone, created_by)
     select '${TEACHER_ID}', d, '00:00', '23:59', 'America/Los_Angeles', '${ADMIN_ID}' from generate_series(0,6) d;`
  );

  const grantId = psql(
    `insert into entitlement_grants (child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at, is_paid)
     values ('${childId}', '${trialProductId}', null, 10, now() + interval '90 days', false) returning id;`
  );
  psql(
    `insert into entitlement_ledger (grant_id, event_type, amount, business_event_id) values ('${grantId}', 'grant', 10, 'smart-notes-gate-${now}');`
  );
});

afterAll(() => {
  psql(`delete from teacher_availability_rules where teacher_id = '${TEACHER_ID}' and created_by = '${ADMIN_ID}';`);
});

describe("Smart Notes 상태가 pending/failed여도 세션 종료·리뷰·정규 전환이 막히지 않는다", () => {
  it("smart_notes_status='pending'이어도 mark_lesson_session_started/finalize_lesson_session이 성공한다", () => {
    const sessionId = bookSession(41, 60);
    const statusBefore = psql(`select smart_notes_status from sessions where id = '${sessionId}';`);
    expect(statusBefore).toBe("pending");

    psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
    psql(
      `update reservations set starts_at = starts_at - interval '365 days', ends_at = ends_at - interval '365 days'
       where id = (select reservation_id from sessions where id = '${sessionId}');`
    );
    psql(`select finalize_lesson_session('${sessionId}', 'completed', '${TEACHER_ID}', 'Smart Notes pending 상태에서도 종료 확인');`);

    const finalStatus = psql(`select final_status from sessions where id = '${sessionId}';`);
    expect(finalStatus).toBe("completed");
  });

  it("smart_notes_status='failed'여도 finalize_lesson_session이 성공한다", () => {
    const sessionId = bookSession(42, 60);
    psql(`update sessions set smart_notes_status = 'failed' where id = '${sessionId}';`);
    psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
    psql(
      `update reservations set starts_at = starts_at - interval '365 days', ends_at = ends_at - interval '365 days'
       where id = (select reservation_id from sessions where id = '${sessionId}');`
    );
    psql(`select finalize_lesson_session('${sessionId}', 'completed', '${TEACHER_ID}', 'Smart Notes failed 상태에서도 종료 확인');`);

    const finalStatus = psql(`select final_status from sessions where id = '${sessionId}';`);
    expect(finalStatus).toBe("completed");
  });

  it("smart_notes_status='failed'인 세션도 리뷰 초안 저장·확정이 성공한다", () => {
    const sessionId = bookSession(43, 60);
    psql(`update sessions set smart_notes_status = 'failed' where id = '${sessionId}';`);
    psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
    psql(
      `update reservations set starts_at = starts_at - interval '365 days', ends_at = ends_at - interval '365 days'
       where id = (select reservation_id from sessions where id = '${sessionId}');`
    );
    psql(`select finalize_lesson_session('${sessionId}', 'completed', '${TEACHER_ID}', '완료');`);

    const reviewId = asUser(
      TEACHER_ID,
      `select save_lesson_review_draft('${sessionId}', null, 'Smart Notes 실패 상태에서도 작성된 초안', '[]'::jsonb);`
    );
    expect(reviewId).toMatch(/^[0-9a-f-]{36}$/);

    asUser(TEACHER_ID, `select finalize_lesson_review('${sessionId}', 'Smart Notes 실패 상태에서도 확정된 리뷰');`);
    const [status, finalText] = psql(`select status, final_text from lesson_reviews where id = '${reviewId}';`).split("|");
    expect(status).toBe("final");
    expect(finalText).toBe("Smart Notes 실패 상태에서도 확정된 리뷰");
  });

  it("smart_notes_config_status가 'pending'이어도 subject_enrollment_activation_ready()는 계약 상태만으로 true를 반환한다", () => {
    psql(`update contracts set status = 'active' where id = '${contractId}';`);
    // subject_enrollment_activation_ready()는 계약 상태만 검사한다(smart_notes 조건 없음) —
    // 세션의 smart_notes_status와 무관함을 명시적으로 재확인.
    psql(`update sessions set smart_notes_status = 'pending' where subject_enrollment_id = '${subjectEnrollmentId}';`);
    const ready = psql(`select subject_enrollment_activation_ready('${subjectEnrollmentId}');`);
    expect(ready).toBe("t");
  });
});

describe("늦게 도착한 AI 요약이 확정된 리뷰를 덮어쓰지 않는다", () => {
  it("finalize_lesson_review()로 확정한 뒤 save_lesson_review_draft()로 뒤늦은 AI 요약 갱신을 시도하면 거부되고 final_text는 그대로 남는다", () => {
    const sessionId = bookSession(44, 60);
    psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
    psql(
      `update reservations set starts_at = starts_at - interval '365 days', ends_at = ends_at - interval '365 days'
       where id = (select reservation_id from sessions where id = '${sessionId}');`
    );
    psql(`select finalize_lesson_session('${sessionId}', 'completed', '${TEACHER_ID}', '완료');`);

    const reviewId = asUser(
      TEACHER_ID,
      `select save_lesson_review_draft('${sessionId}', '초기 AI 요약(도착 빠름)', '선생님 초안', '[]'::jsonb);`
    );
    asUser(TEACHER_ID, `select finalize_lesson_review('${sessionId}', '확정된 최종 리뷰 — 절대 바뀌면 안 됨');`);

    const finalTextBefore = psql(`select final_text from lesson_reviews where id = '${reviewId}';`);
    expect(finalTextBefore).toBe("확정된 최종 리뷰 — 절대 바뀌면 안 됨");

    // 뒤늦게 도착한 AI 재요약본이 이 확정된 리뷰를 초안으로 되돌리며 덮어쓰려는
    // 시도 — 반드시 거부돼야 한다.
    const stderr = asUserExpectError(
      TEACHER_ID,
      `select save_lesson_review_draft('${sessionId}', '뒤늦게 도착한 AI 재요약본', null, '[]'::jsonb);`
    );
    expect(stderr).toMatch(/이미 확정된 리뷰는 초안으로 되돌릴 수 없습니다/);

    const [finalTextAfter, aiSummaryAfter, statusAfter] = psql(
      `select final_text, coalesce(ai_summary, 'null'), status from lesson_reviews where id = '${reviewId}';`
    ).split("|");
    expect(finalTextAfter).toBe("확정된 최종 리뷰 — 절대 바뀌면 안 됨");
    expect(aiSummaryAfter).toBe("초기 AI 요약(도착 빠름)"); // 갱신 시도가 거부됐으므로 이전 값 그대로.
    expect(statusAfter).toBe("final");
  });

  it("관리자 정정(admin_edit_lesson_review)도 finalized_at을 보존하며, 그 이후의 초안 되돌리기 시도 역시 거부된다", () => {
    const sessionId = bookSession(45, 60);
    psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
    psql(
      `update reservations set starts_at = starts_at - interval '365 days', ends_at = ends_at - interval '365 days'
       where id = (select reservation_id from sessions where id = '${sessionId}');`
    );
    psql(`select finalize_lesson_session('${sessionId}', 'completed', '${TEACHER_ID}', '완료');`);
    asUser(TEACHER_ID, `select save_lesson_review_draft('${sessionId}', null, '초안', '[]'::jsonb);`);
    asUser(TEACHER_ID, `select finalize_lesson_review('${sessionId}', '최초 확정본');`);

    const finalizedAtBefore = psql(`select finalized_at from lesson_reviews where trial_session_id = '${sessionId}';`);
    asUser(ADMIN_ID, `select admin_edit_lesson_review('${sessionId}', '관리자 공개 정정본', null);`);
    const finalizedAtAfter = psql(`select finalized_at from lesson_reviews where trial_session_id = '${sessionId}';`);
    expect(finalizedAtAfter).toBe(finalizedAtBefore);

    const stderr = asUserExpectError(
      TEACHER_ID,
      `select save_lesson_review_draft('${sessionId}', '또 다른 뒤늦은 AI 요약', null, '[]'::jsonb);`
    );
    expect(stderr).toMatch(/이미 확정된 리뷰는 초안으로 되돌릴 수 없습니다/);
    const finalTextAfter = psql(`select final_text from lesson_reviews where trial_session_id = '${sessionId}';`);
    expect(finalTextAfter).toBe("관리자 공개 정정본");
  });
});
