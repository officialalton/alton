import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";

// 2026-09-17(제품 오너 지시 — 예약·수업 준비·진도 단일 흐름) — confirm_lesson_booking()이
// 예약 확정 시점에 다음 미완료 커리큘럼 회차를 자동으로 세션에 연결·구성 복사하고
// (_auto_assign_next_curriculum_unit/_stage_unit_for_session), finalize_lesson_session()의
// completed 판정이 그 회차를 진도상 completed로 넘기는지(_그래서 다음 예약이 다음 회차를
// 자동으로 가져가는지) 실제 로컬 Postgres로 끝까지 검증한다.
// lib/booking/session-final-judgment.integration.test.ts와 동일한 psql shell-out
// 패턴·전용 선생님(이 파일만 쓰는 새 UUID)을 재사용해 다른 통합 테스트와의 레이스를 피한다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001"; // SAT Math
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
let TEACHER_ID: string;
const FIXED_BOOKING_HOUR_UTC = 15;

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

let childId: string;
let subjectEnrollmentId: string;
let regularLessonTypeId: string;
let overlayId: string;
let unit1Id: string;
let unit2Id: string;
let problemId: string;

function grantRegularEntitlement(): void {
  const productId = psql(`select id from entitlement_products where code = 'lesson_pack_10';`);
  const grantId = psql(
    `insert into entitlement_grants (child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at, is_paid)
     values ('${childId}', '${productId}', null, 10, now() + interval '90 days', true) returning id;`
  );
  psql(
    `insert into entitlement_ledger (grant_id, event_type, amount, business_event_id) values ('${grantId}', 'grant', 10, 'cup-grant-${Date.now()}-${grantId}');`
  );
}

function bookSession(daysFromNow: number): { reservationId: string; sessionId: string } {
  const startsAtDate = new Date();
  startsAtDate.setUTCDate(startsAtDate.getUTCDate() + daysFromNow);
  startsAtDate.setUTCHours(FIXED_BOOKING_HOUR_UTC, 0, 0, 0);
  const startsAt = startsAtDate.toISOString();
  const endsAt = new Date(startsAtDate.getTime() + 60 * 60000).toISOString();
  const row = psql(
    `select reservation_id, session_id from confirm_lesson_booking('${childId}', '${subjectEnrollmentId}', '${TEACHER_ID}', '${regularLessonTypeId}', '${startsAt}', '${endsAt}', 'cup-book-${Date.now()}-${Math.random()}');`
  );
  const [reservationId, sessionId] = row.split("|");
  return { reservationId, sessionId };
}

function completeSession(sessionId: string): void {
  psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
  psql(`update sessions set actual_start_at = now() - interval '70 minutes' where id = '${sessionId}';`);
  psql(
    `select finalize_lesson_session('${sessionId}', 'completed', '${TEACHER_ID}', '통합테스트 정상 완료', null, 'student_reason');`
  );
}

beforeAll(() => {
  regularLessonTypeId = psql(`select id from lesson_types where code = 'regular';`);

  const now = Date.now();
  TEACHER_ID = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'cup-teacher-${now}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`insert into profiles (id, role, name) values ('${TEACHER_ID}', 'teacher', '진도자동전진 통합테스트 선생님');`);
  psql(`select set_teacher_rate('${TEACHER_ID}', 3000000, 'KRW', now() - interval '1 day');`);
  psql(`insert into teachers (id, status) values ('${TEACHER_ID}', 'active');`);

  const authEmail = `curriculum-unit-progress-${now}@example.com`;
  childId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${authEmail}', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`
    insert into profiles (id, role, name) values ('${childId}', 'student', '진도자동전진 통합테스트 학생');
    insert into students (id, grade, status) values ('${childId}', '10학년', 'active');
  `);

  const householdId = psql(`insert into households (primary_guardian_id) values (null) returning id;`);
  psql(`insert into household_members (household_id, profile_id, role, is_primary) values ('${householdId}', '${childId}', 'child', true);`);
  const contractId = psql(`insert into contracts (household_id, child_id, status) values ('${householdId}', '${childId}', 'draft') returning id;`);
  subjectEnrollmentId = psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status) values ('${childId}', '${SUBJECT_ID}', '${contractId}', 'planned') returning id;`
  );

  psql(
    `insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from, source)
     values ('${subjectEnrollmentId}', '${TEACHER_ID}', 'active', now() - interval '1 day', 'app');`
  );
  psql(
    `insert into teacher_availability_rules (teacher_id, day_of_week, start_time_local, end_time_local, timezone, created_by)
     select '${TEACHER_ID}', d, '00:00', '23:59', 'America/Los_Angeles', '${ADMIN_ID}' from generate_series(0,6) d;`
  );

  grantRegularEntitlement();

  // 커리큘럼 오버레이 + 순서 있는 회차 2개. 상속(inherit) 경로는 다른 통합테스트
  // (prep-version-through-lesson)가 이미 검증하므로, 여기서는 회차별 준비
  // (curriculum_unit_preps)를 직접 심어 "연결·복사·진도전진" 자체만 격리해서 본다.
  overlayId = psql(`insert into student_curriculum_overlays (subject_enrollment_id) values ('${subjectEnrollmentId}') returning id;`);
  unit1Id = psql(
    `insert into curriculum_overlay_units (overlay_id, position, unit_title) values ('${overlayId}', 1, '1회차') returning id;`
  );
  unit2Id = psql(
    `insert into curriculum_overlay_units (overlay_id, position, unit_title) values ('${overlayId}', 2, '2회차') returning id;`
  );

  const keywordId = psql(
    `insert into subject_keywords (subject_id, label, normalized_label) values ('${SUBJECT_ID}', 'cup-test-keyword-${now}', 'cup-test-keyword-${now}') returning id;`
  );
  problemId = psql(
    `select id from problems where status = 'confirmed' and archived_at is null
       and exists (select 1 from problem_versions v where v.problem_id = problems.id and v.status = 'published')
     limit 1;`
  );
  const prepId = psql(`insert into curriculum_unit_preps (overlay_unit_id) values ('${unit1Id}') returning id;`);
  psql(`insert into curriculum_unit_prep_items (prep_id, content_type, content_id, position) values ('${prepId}', 'problem', '${problemId}', 1);`);
  if (keywordId) {
    psql(`insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id) values ('${unit1Id}', '${keywordId}');`);
    // 자동 배정이 복사하는 문제도 이 회차의 키워드 범위 안에 있어야
    // check_prepared_content_item_selectable() 트리거를 통과한다(실제 커리큘럼
    // 구성과 동일한 전제 — 회차 키워드에 안 걸린 문제는 애초에 담기지 않는다).
    psql(`insert into problem_keywords (problem_id, keyword_id) values ('${problemId}', '${keywordId}') on conflict do nothing;`);
  }
});

// 한 번에 끝까지 흐름을 검증한다(예약→연결·복사→완료→진도전진→다음예약). 테스트를
// 나누면 앞 예약이 'scheduled'로 남아 다음 회차 판정(다른 scheduled/live 세션이 이미
// 차지한 회차는 건너뜀)에 서로 영향을 줘, 격리하려면 매번 취소까지 해야 한다.
describe("예약 확정 시 다음 미완료 회차 자동 연결·구성 고정, 완료 시 진도 전진", () => {
  it("예약→1회차 연결·구성 복사→완료→진도전진→다음 예약은 2회차", () => {
    const first = bookSession(10);

    const linkedUnitId = psql(
      `select overlay_unit_id from session_curriculum_units where session_id = '${first.sessionId}' and role = 'primary';`
    );
    expect(linkedUnitId).toBe(unit1Id);

    const copiedContentId = psql(
      `select cit.content_id from session_prepared_selection_content_items cit
       join session_prepared_selections sel on sel.id = cit.prepared_selection_id
       where sel.session_id = '${first.sessionId}';`
    );
    expect(copiedContentId).toBe(problemId);

    let unit1Status = psql(`select status from curriculum_overlay_units where id = '${unit1Id}';`);
    expect(unit1Status).toBe("in_progress");

    completeSession(first.sessionId);

    unit1Status = psql(`select status from curriculum_overlay_units where id = '${unit1Id}';`);
    expect(unit1Status).toBe("completed");

    const second = bookSession(11);
    const secondLinkedUnitId = psql(
      `select overlay_unit_id from session_curriculum_units where session_id = '${second.sessionId}' and role = 'primary';`
    );
    expect(secondLinkedUnitId).toBe(unit2Id);

    // 이 예약을 scheduled로 남겨두면 다음 테스트가 2회차를 "이미 차지된 회차"로
    // 보고 건너뛴다 — 취소해서 2회차를 다시 미배정 상태로 되돌린다.
    psql(`select cancel_lesson_booking('${second.reservationId}', 'student', '${childId}', '통합테스트 정리');`);
  });

  it("취소된 예약의 회차는 완료로 넘어가지 않고 다음 예약이 같은 회차를 다시 받는다", () => {
    const attempt = bookSession(20);
    const linkedUnitId = psql(
      `select overlay_unit_id from session_curriculum_units where session_id = '${attempt.sessionId}' and role = 'primary';`
    );
    // 이 시점에는 1회차가 이미 완료(위 테스트)됐으므로 2회차가 대상이다.
    expect(linkedUnitId).toBe(unit2Id);

    psql(`select cancel_lesson_booking('${attempt.reservationId}', 'student', '${childId}', '통합테스트 취소');`);
    const statusAfterCancel = psql(`select status from curriculum_overlay_units where id = '${unit2Id}';`);
    expect(statusAfterCancel).toBe("in_progress");

    const retry = bookSession(21);
    const retryLinkedUnitId = psql(
      `select overlay_unit_id from session_curriculum_units where session_id = '${retry.sessionId}' and role = 'primary';`
    );
    expect(retryLinkedUnitId).toBe(unit2Id);
  });
});
