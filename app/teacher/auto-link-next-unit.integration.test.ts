import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

// P2 4차 — 예약이 잡히면 다음 회차가 자동으로 연결된다.
//
// 연결일 뿐 고정이 아니다. 내용 고정은 수업 시작에서만 일어나므로, 수업 전에
// 선생님이 다른 회차로 바꾸는 길을 막지 않는다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001";
const HOUSEHOLD_ID = "aabbccdd-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

const uniq = () => `${Date.now()}_${Math.random()}`;
const cleanupContractIds: string[] = [];
let offsetDays = 7000 + Math.floor(Math.random() * 300) * 2;

afterEach(() => {
  for (const id of cleanupContractIds.splice(0)) {
    psql(`
      delete from session_curriculum_units where session_id in (
        select s.id from sessions s
        join subject_enrollments se on se.id = s.subject_enrollment_id
        where se.contract_id = '${id}');
      delete from sessions where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from reservations where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from subject_threads where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from teacher_assignments where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from subject_enrollments where contract_id = '${id}';
      delete from contracts where id = '${id}';
    `);
  }
});

/** 회차 N개를 가진 활성 오버레이 하나. */
function makeEnrollmentWithUnits(unitCount: number): { enrollmentId: string; unitIds: string[] } {
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
     values ('${enrollmentId}', '${TEACHER_ID}', 'active', now() - interval '1 day');`
  );
  if (unitCount === 0) return { enrollmentId, unitIds: [] };

  const overlayId = psql(
    `insert into student_curriculum_overlays (subject_enrollment_id) values ('${enrollmentId}') returning id;`
  );
  const unitIds: string[] = [];
  for (let i = 1; i <= unitCount; i += 1) {
    unitIds.push(
      psql(
        `insert into curriculum_overlay_units (overlay_id, position, unit_title)
         values ('${overlayId}', ${i}, '${i}회차 ${uniq()}') returning id;`
      )
    );
  }
  return { enrollmentId, unitIds };
}

function addSession(enrollmentId: string): string {
  offsetDays += 2;
  const reservationId = psql(
    `insert into reservations (kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status)
     values ('lesson', '${enrollmentId}', '${TEACHER_ID}', now() + interval '${offsetDays} days', now() + interval '${offsetDays} days 1 hour', 'confirmed') returning id;`
  );
  return psql(
    `insert into sessions (reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes)
     values ('${reservationId}', '${enrollmentId}', '${TEACHER_ID}', (select id from lesson_types where code = 'regular'), 60)
     returning id;`
  );
}

const linkedUnit = (sessionId: string) =>
  psql(`select overlay_unit_id from session_curriculum_units where session_id = '${sessionId}';`);

describe("예약이 잡히면 다음 회차가 자동으로 연결된다", () => {
  it("첫 수업에는 1회차가 붙는다", () => {
    const { enrollmentId, unitIds } = makeEnrollmentWithUnits(3);
    const sessionId = addSession(enrollmentId);
    expect(linkedUnit(sessionId)).toBe(unitIds[0]);
  });

  it("다음 수업에는 아직 쓰지 않은 다음 회차가 붙는다", () => {
    const { enrollmentId, unitIds } = makeEnrollmentWithUnits(3);
    const first = addSession(enrollmentId);
    const second = addSession(enrollmentId);
    const third = addSession(enrollmentId);
    expect(linkedUnit(first)).toBe(unitIds[0]);
    expect(linkedUnit(second)).toBe(unitIds[1]);
    expect(linkedUnit(third)).toBe(unitIds[2]);
  });

  it("한 회차가 두 수업에 겹치지 않는다", () => {
    const { enrollmentId } = makeEnrollmentWithUnits(2);
    const first = addSession(enrollmentId);
    const second = addSession(enrollmentId);
    expect(linkedUnit(first)).not.toBe(linkedUnit(second));
  });

  it("남은 회차가 없으면 아무것도 붙이지 않는다 — 빈 채로 열린다", () => {
    const { enrollmentId } = makeEnrollmentWithUnits(1);
    addSession(enrollmentId);
    const extra = addSession(enrollmentId);
    expect(linkedUnit(extra)).toBe("");
  });

  it("운영 커리큘럼이 없으면 만들지 않는다", () => {
    const { enrollmentId } = makeEnrollmentWithUnits(0);
    const sessionId = addSession(enrollmentId);
    expect(linkedUnit(sessionId)).toBe("");
    expect(
      psql(`select count(*) from student_curriculum_overlays where subject_enrollment_id = '${enrollmentId}';`)
    ).toBe("0");
  });

  it("이미 연결된 수업은 다시 불러도 바뀌지 않는다", () => {
    const { enrollmentId, unitIds } = makeEnrollmentWithUnits(3);
    const sessionId = addSession(enrollmentId);
    expect(linkedUnit(sessionId)).toBe(unitIds[0]);

    // 다시 불러도 덮어쓰지 않는다.
    expect(psql(`select auto_link_next_unit_to_session('${sessionId}');`)).toBe("");
    expect(linkedUnit(sessionId)).toBe(unitIds[0]);
  });

  it("자동 연결은 고정이 아니다 — 수업 전에 다른 회차로 바꿀 수 있다", () => {
    const { enrollmentId, unitIds } = makeEnrollmentWithUnits(3);
    const sessionId = addSession(enrollmentId);
    psql(
      `update session_curriculum_units set overlay_unit_id = '${unitIds[2]}' where session_id = '${sessionId}';`
    );
    expect(linkedUnit(sessionId)).toBe(unitIds[2]);
  });
});
