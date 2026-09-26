import { execFileSync } from "node:child_process";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// DB 왕복이 많은 통합테스트라 기본 5초 제한을 넉넉히 늘린다.
vi.setConfig({ testTimeout: 20000 });

// 2026-09-18(제품 오너 지시) — "다음 수업에 추가 학습 회차 넣기".
// insert_additional_study_unit()/preview_additional_study_unit_insert()
// (supabase/migrations/20261405000000_p6_additional_study_unit_insert.sql)를
// 실제 로컬 Postgres에 대고 검증한다:
//   1. 진행 중/완료 회차 바로 다음에 같은 구성(키워드·교재·문제)의 회차가 끼워진다.
//   2. 아직 시작하지 않은(scheduled) 미래 세션만 예약 시각 순으로 재연결된다.
//   3. live/completed/취소·노쇼 세션과 그 학생 기록은 전혀 변하지 않는다.
//   4. actor_id는 호출자가 주장하는 값을 그대로 믿지 않고, 담당 교사·관리자
//      여부를 DB 함수 안에서 다시 검사한다(무관한 교사는 거부된다).

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const OTHER_TEACHER_ID = "dddddddd-0000-0000-0000-000000000002";
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001";
const HOUSEHOLD_ID = "aabbccdd-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";

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
    do $$ begin perform set_config('request.jwt.claim.sub', '${userId}', false); end $$;
    ${sql}
    reset role;
  `);
}

// 다른 통합테스트 파일과 예약 시각 구간이 겹치지 않도록(reservations_no_overlap)
// 파일마다 고유한 오프셋 대역을 쓴다.
let reservationOffsetDays = 5 + Math.floor(Math.random() * 10);
const cleanupContractIds: string[] = [];

afterEach(() => {
  for (const id of cleanupContractIds.splice(0)) {
    psql(`
      delete from session_status_events where session_id in (
        select id from sessions where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}')
      );
      delete from payout_items where session_id in (
        select id from sessions where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}')
      );
      delete from sessions where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from reservations where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from subject_threads where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from teacher_assignments where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from subject_enrollments where contract_id = '${id}';
      delete from contracts where id = '${id}';
    `);
  }
});

/** 고정(pin)된 준비된 선택이 생기는 테스트(예: live로 시작한 세션)는 pin-lock 때문에
 * 세션을 지울 수 없다 — 그 계약은 정리 대상에서 뺀다(다른 통합테스트 파일들과 같은
 * 관례: 파일 간 정리는 `supabase db reset --local`이 담당). */
function excludeFromCleanup(contractId: string): void {
  const idx = cleanupContractIds.indexOf(contractId);
  if (idx !== -1) cleanupContractIds.splice(idx, 1);
}

let baseUnitId: string;
let regularLessonTypeId: string;
let teacherId: string;

function grantEntitlement(childId: string, productCode: string, quantity: number): void {
  const productId = psql(`select id from entitlement_products where code = '${productCode}';`);
  const grantId = psql(
    `insert into entitlement_grants (child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at, is_paid)
     values ('${childId}', '${productId}', null, ${quantity}, now() + interval '90 days', true) returning id;`
  );
  psql(`insert into entitlement_ledger (grant_id, event_type, amount, business_event_id) values ('${grantId}', 'grant', ${quantity}, 'additional-study-grant-${Date.now()}-${grantId}');`);
}

beforeAll(() => {
  baseUnitId = psql(
    `select id from subject_template_units where subject_id = '${SUBJECT_ID}' order by position limit 1;`
  );
  regularLessonTypeId = psql(`select id from lesson_types where code = 'regular';`);

  // 공유 TEACHER_ID의 가용시간은 다른 파일의 예약 오프셋에 맞춰져 있어 이 파일의
  // 시각과 겹칠 보장이 없다 — confirm_lesson_booking()으로 실제 예약을 확정해야
  // 하므로(teacher_slot_not_open 검사를 진짜로 통과해야 함), 하루 24시간 전부
  // 열어 둔 전용 선생님을 새로 만든다.
  teacherId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'additional-study-teacher-'||extract(epoch from now())||'@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`insert into profiles (id, role, name) values ('${teacherId}', 'teacher', '추가학습검증 선생님');`);
  psql(`select set_teacher_rate('${teacherId}', 3000000, 'KRW', now() - interval '1 day');`);
  psql(`insert into teachers (id, status) values ('${teacherId}', 'active');`);
  psql(
    `insert into teacher_availability_rules (teacher_id, day_of_week, start_time_local, end_time_local, timezone, created_by)
     select '${teacherId}', d, '00:00', '23:59', 'America/Los_Angeles', '${ADMIN_ID}' from generate_series(0,6) d;`
  );
  grantEntitlement(STUDENT_ID, "lesson_pack_10", 10);
});

/** 3회차(1·2·3)짜리 오버레이 + 1회차에 실제 키워드·교재·문제 구성을 가진 학생 하나. */
function makeThreeUnitCurriculum(): { contractId: string; enrollmentId: string; unitIds: string[]; keywordId: string; docId: string; problemId: string } {
  const contractId = psql(
    `insert into contracts (household_id, child_id, status) values ('${HOUSEHOLD_ID}', '${STUDENT_ID}', 'draft') returning id;`
  );
  cleanupContractIds.push(contractId);
  const enrollmentId = psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status)
     values ('${STUDENT_ID}', '${SUBJECT_ID}', '${contractId}', 'planned') returning id;`
  );
  psql(
    `insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from)
     values ('${enrollmentId}', '${teacherId}', 'active', now() - interval '1 day');`
  );
  const overlayId = asUser(
    teacherId,
    `insert into student_curriculum_overlays (subject_enrollment_id) values ('${enrollmentId}') returning id;`
  );
  const unitIds: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const unitId = asUser(
      teacherId,
      `insert into curriculum_overlay_units (overlay_id, source_unit_id, position, unit_title)
       values ('${overlayId}', '${baseUnitId}', ${i}, '추가학습검증 ${i}회차') returning id;`
    );
    asUser(teacherId, `insert into curriculum_unit_preps (overlay_unit_id) values ('${unitId}') on conflict do nothing;`);
    unitIds.push(unitId);
  }

  const keywordId = psql(
    `insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', '추가학습검증 ${Date.now()}_${Math.random()}') returning id;`
  );
  asUser(teacherId, `insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id) values ('${unitIds[0]}', '${keywordId}');`);

  const docId = psql(
    `insert into curriculum_docs (title, subject_id, owner_type, status)
     values ('추가학습검증 교재 ${Date.now()}_${Math.random()}', '${SUBJECT_ID}', 'admin', 'published') returning id;`
  );
  asUser(teacherId, `insert into curriculum_overlay_unit_materials (overlay_unit_id, curriculum_doc_id, position) values ('${unitIds[0]}', '${docId}', 1);`);

  const problemId = psql(
    `select id from problems where subject_id = '${SUBJECT_ID}' and status = 'confirmed' and archived_at is null
       and exists (select 1 from problem_versions v where v.problem_id = problems.id and v.status = 'published')
     limit 1;`
  );
  psql(`insert into problem_keywords (problem_id, keyword_id) values ('${problemId}', '${keywordId}') on conflict do nothing;`);
  const prepId = psql(`select id from curriculum_unit_preps where overlay_unit_id = '${unitIds[0]}';`);
  asUser(teacherId, `insert into curriculum_unit_prep_items (prep_id, content_type, content_id, position) values ('${prepId}', 'problem', '${problemId}', 1);`);

  return { contractId, enrollmentId, unitIds, keywordId, docId, problemId };
}

// 시각을 하루 중 정오(UTC)로 고정한다 — "지금부터 N일 뒤"처럼 실행 시각의
// 시/분을 그대로 물려받으면, 실제 실행 시각이 선생님 가용시간(America/Los_Angeles
// 00:00~23:59)의 자정 근처와 겹칠 때만 간헐적으로 teacher_slot_not_open이
// 난다(하루 전체가 열려 있어도 1시간 수업이 23:xx~00:xx로 날짜를 넘기면 같은
// 날짜 조건에 걸린다). 정오 UTC는 어떤 타임존으로 봐도 자정 근처가 아니라 항상
// 안전하다.
function bookSession(enrollmentId: string): { reservationId: string; sessionId: string } {
  reservationOffsetDays += 2;
  const startsAtDate = new Date();
  startsAtDate.setUTCDate(startsAtDate.getUTCDate() + reservationOffsetDays);
  startsAtDate.setUTCHours(12, 0, 0, 0);
  const startsAt = startsAtDate.toISOString();
  const endsAt = new Date(startsAtDate.getTime() + 60 * 60000).toISOString();
  const row = psql(
    `select reservation_id, session_id from confirm_lesson_booking(
       '${STUDENT_ID}', '${enrollmentId}', '${teacherId}', '${regularLessonTypeId}',
       '${startsAt}', '${endsAt}', 'additional-study-book-${Date.now()}-${Math.random()}');`
  );
  const [reservationId, sessionId] = row.split("|");
  return { reservationId, sessionId };
}

function completeSession(sessionId: string): void {
  psql(`select mark_lesson_session_started('${sessionId}', '${teacherId}');`);
  psql(`update sessions set actual_start_at = now() - interval '70 minutes' where id = '${sessionId}';`);
  psql(`select finalize_lesson_session('${sessionId}', 'completed', '${teacherId}', '통합테스트 정상 완료', null, 'student_reason');`);
}

describe("insert_additional_study_unit — 진행 중/완료 회차 다음에 끼워 넣고 미래 예약만 재배치", () => {
  it("1회차 완료 뒤 2·3회차가 예약돼 있으면, 1회차 뒤에 넣었을 때 2회차 예약이 새 회차를, 3회차 예약이 원래 2회차를 받는다", () => {
    const { contractId, enrollmentId, unitIds, keywordId, docId, problemId } = makeThreeUnitCurriculum();
    // 1회차 세션을 실제로 시작·완료시키므로(mark_lesson_session_started) 그 준비된
    // 선택이 pin되어 afterEach의 세션 삭제가 pin-lock에 막힌다 — 정리 대상에서 뺀다.
    excludeFromCleanup(contractId);

    const first = bookSession(enrollmentId);
    completeSession(first.sessionId);
    const second = bookSession(enrollmentId);
    const third = bookSession(enrollmentId);

    expect(
      psql(`select overlay_unit_id from session_curriculum_units where session_id = '${second.sessionId}' and role='primary';`)
    ).toBe(unitIds[1]);
    expect(
      psql(`select overlay_unit_id from session_curriculum_units where session_id = '${third.sessionId}' and role='primary';`)
    ).toBe(unitIds[2]);

    const preview = JSON.parse(psql(`select preview_additional_study_unit_insert('${unitIds[0]}', '${teacherId}');`));
    expect(preview.affectedFutureSessions).toHaveLength(2);
    expect(preview.newUnitTitle).toBe("추가 학습 · 추가학습검증 1회차");

    const result = JSON.parse(psql(`select insert_additional_study_unit('${unitIds[0]}', '${teacherId}');`));
    const newUnitId = result.newUnitId as string;

    expect(
      psql(`select overlay_unit_id from session_curriculum_units where session_id = '${second.sessionId}' and role='primary';`)
    ).toBe(newUnitId);
    expect(
      psql(`select overlay_unit_id from session_curriculum_units where session_id = '${third.sessionId}' and role='primary';`)
    ).toBe(unitIds[1]);
    // 3회차는 예약이 부족해 아무 세션도 연결되지 않은 채 남는다("다음 예약 대기").
    expect(psql(`select count(*) from session_curriculum_units where overlay_unit_id = '${unitIds[2]}';`)).toBe("0");

    // 새 회차가 1회차의 키워드·교재·문제를 그대로 복사했는지.
    expect(
      psql(`select count(*) from curriculum_overlay_unit_keywords where overlay_unit_id = '${newUnitId}' and keyword_id = '${keywordId}';`)
    ).toBe("1");
    expect(
      psql(`select count(*) from curriculum_overlay_unit_materials where overlay_unit_id = '${newUnitId}' and curriculum_doc_id = '${docId}';`)
    ).toBe("1");
    expect(
      psql(`select count(*) from curriculum_unit_prep_items i join curriculum_unit_preps p on p.id = i.prep_id
             where p.overlay_unit_id = '${newUnitId}' and i.content_id = '${problemId}';`)
    ).toBe("1");

    // 1회차 자체(완료된 세션이 이미 연결된 회차)와 그 세션 기록은 전혀 바뀌지 않는다.
    expect(psql(`select status from curriculum_overlay_units where id = '${unitIds[0]}';`)).toBe("completed");
    expect(
      psql(`select overlay_unit_id from session_curriculum_units where session_id = '${first.sessionId}' and role='primary';`)
    ).toBe(unitIds[0]);
    expect(psql(`select final_status from sessions where id = '${first.sessionId}';`)).toBe("completed");
  });

  it("live·취소된 세션은 재배치 대상에서 아예 빠진다", () => {
    const { contractId, enrollmentId, unitIds } = makeThreeUnitCurriculum();
    excludeFromCleanup(contractId);
    psql(`update curriculum_overlay_units set status = 'in_progress' where id = '${unitIds[0]}';`);

    const live = bookSession(enrollmentId);
    psql(`select mark_lesson_session_started('${live.sessionId}', '${teacherId}');`);

    const cancelled = bookSession(enrollmentId);
    psql(`select cancel_lesson_booking('${cancelled.reservationId}', 'student', '${STUDENT_ID}', '통합테스트 취소');`);

    const scheduled = bookSession(enrollmentId);
    expect(
      psql(`select overlay_unit_id from session_curriculum_units where session_id = '${scheduled.sessionId}' and role='primary';`)
    ).toBe(unitIds[1]);

    const beforeLiveUnit = psql(
      `select overlay_unit_id from session_curriculum_units where session_id = '${live.sessionId}' and role='primary';`
    );
    const result = JSON.parse(psql(`select insert_additional_study_unit('${unitIds[0]}', '${teacherId}');`));
    const newUnitId = result.newUnitId as string;

    // live 세션은 손대지 않는다.
    expect(
      psql(`select overlay_unit_id from session_curriculum_units where session_id = '${live.sessionId}' and role='primary';`)
    ).toBe(beforeLiveUnit);
    expect(psql(`select final_status from sessions where id = '${live.sessionId}';`)).toBe("live");
    // scheduled였던 세션만 새 회차로 재배치된다.
    expect(
      psql(`select overlay_unit_id from session_curriculum_units where session_id = '${scheduled.sessionId}' and role='primary';`)
    ).toBe(newUnitId);
    // 취소된 세션의 연결은 그대로(재배치 대상이 아니었음).
    expect(psql(`select final_status from sessions where id = '${cancelled.sessionId}';`)).toBe("student_cancelled");
  });

  it("담당이 아닌 교사가 실행하면 관리자·담당 교사 검사에서 거부된다(actor_id를 곧이곧대로 믿지 않는다)", () => {
    const { unitIds } = makeThreeUnitCurriculum();
    psql(`update curriculum_overlay_units set status = 'completed' where id = '${unitIds[0]}';`);

    expect(psqlExpectError(`select preview_additional_study_unit_insert('${unitIds[0]}', '${OTHER_TEACHER_ID}');`)).toMatch(
      /담당 학생·과목/
    );
    expect(psqlExpectError(`select insert_additional_study_unit('${unitIds[0]}', '${OTHER_TEACHER_ID}');`)).toMatch(
      /담당 학생·과목/
    );
    // 관리자는 담당 배정이 없어도 실행할 수 있다.
    expect(() => psql(`select insert_additional_study_unit('${unitIds[0]}', '${ADMIN_ID}');`)).not.toThrow();
  });

  it("not_started 회차에서는 실행할 수 없다(진행 중/완료 회차에서만 넣을 수 있다)", () => {
    const { unitIds } = makeThreeUnitCurriculum();
    expect(psqlExpectError(`select insert_additional_study_unit('${unitIds[1]}', '${teacherId}');`)).toMatch(
      /진행 중이거나 완료된 회차에서만/
    );
  });
});
