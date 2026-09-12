import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// P4-1(B) — 가구 아카이브의 DB 레이어 검증.
// 착수 정리: docs/2026-09-11-p4-1b-household-archive-plan.md
// 확인 대상:
//  (1) preview_household_archive_impact()가 "취소 대상(미래 확정 + 세션 미판정)",
//      "진행 중(final_status='live', 시간 조건 없음)", "이미 완료된 수업(보존 대상)"을
//      정확히 구분한다.
//  (2) archived_household_profile_ids()가 아카이브된 가구의 보호자·자녀만 돌려준다.
//  (3) household_archive_events는 INSERT-only다.
//  (4) households.archived_at 해제(복귀)는 예약·매칭을 건드리지 않는다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

function createAuthUser(label: string): string {
  const email = `p4-1b-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  return psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${email}', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
}

type Fixture = { guardianId: string; childId: string; householdId: string; enrollmentId: string };

function createHouseholdWithChild(label: string): Fixture {
  const guardianId = createAuthUser(`guardian-${label}`);
  const childId = createAuthUser(`child-${label}`);
  psql(`insert into profiles (id, role, name) values ('${guardianId}', 'parent', '아카이브보호자${label}');`);
  psql(`insert into parents (id) values ('${guardianId}');`);
  psql(`insert into profiles (id, role, name) values ('${childId}', 'student', '아카이브자녀${label}');`);
  psql(`insert into students (id, grade, status) values ('${childId}', '10학년', 'active');`);
  const householdId = psql(`insert into households (primary_guardian_id) values ('${guardianId}') returning id;`);
  psql(
    `insert into household_members (household_id, profile_id, role, is_primary)
     values ('${householdId}', '${guardianId}', 'guardian', true), ('${householdId}', '${childId}', 'child', false);`
  );
  const contractId = psql(
    `insert into contracts (household_id, child_id, status) values ('${householdId}', '${childId}', 'draft') returning id;`
  );
  const enrollmentId = psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status)
     values ('${childId}', '${SUBJECT_ID}', '${contractId}', 'active') returning id;`
  );
  return { guardianId, childId, householdId, enrollmentId };
}

// 이 스펙이 신경 쓰는 것은 "과거/미래" 방향뿐이고 정확한 날짜가 아니다. 그런데
// 예전에는 그 방향을 `now() + N days`로 표현해서, 예약이 **테스트를 실행한 실제
// 시:분**에 심겼다. lib/booking의 예약 통합 테스트들은 17시(UTC) 고정 슬롯을
// 쓰므로, 스위트를 UTC 16~18시 사이에 돌리면 같은 선생님의 예약이 15분 버퍼
// 안에서 겹쳐 teacher_buffer_violation으로 그쪽 테스트가 깨졌다 — 코드가 아니라
// "몇 시에 돌렸는가"에 좌우되는 실패였다.
//
// 그래서 날짜는 그대로 두고(과거/미래 방향이 이 스펙의 핵심이다) **시각만**
// 03:00 UTC로 고정한다. 예약 테스트들의 17시 창에서 멀리 떨어져 있어 어떤
// 시각에 스위트를 돌려도 겹치지 않는다. 기준점 자체를 몇 년 밖으로 밀면
// -3일 같은 "과거" 케이스가 미래가 되어 스펙이 뒤집히므로 그렇게 하지 않는다.
function archiveSpecSlot(startsInDays: number): string {
  return `date_trunc('day', now()) + interval '${startsInDays} days' + interval '3 hours'`;
}

// 예약 + 세션을 직접 심는다(예약 RPC의 가능시간·수업권 검증은 이 스펙의 대상이 아니다).
function createReservationWithSession(
  enrollmentId: string,
  opts: { startsInDays: number; finalStatus: string; reservationStatus?: string }
): string {
  const lessonTypeId = psql(`select id from lesson_types where code = 'trial';`);
  const reservationId = psql(
    `insert into reservations (kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status)
     values ('lesson', '${enrollmentId}', '${TEACHER_ID}',
             ${archiveSpecSlot(opts.startsInDays)},
             ${archiveSpecSlot(opts.startsInDays)} + interval '60 minutes',
             '${opts.reservationStatus ?? "confirmed"}')
     returning id;`
  );
  psql(
    `insert into sessions (reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes, final_status)
     values ('${reservationId}', '${enrollmentId}', '${TEACHER_ID}', '${lessonTypeId}', 60, '${opts.finalStatus}');`
  );
  return reservationId;
}

function previewRow(householdId: string, childId: string): { assignments: number; cancellable: number; live: number } {
  const row = psql(
    `select active_assignment_count, cancellable_reservation_count, live_reservation_count
     from preview_household_archive_impact('${householdId}') where child_id = '${childId}';`
  );
  const [assignments, cancellable, live] = row.split("|").map(Number);
  return { assignments, cancellable, live };
}

describe("preview_household_archive_impact()", () => {
  it("미래 확정 예약 중 아직 판정되지 않은 것만 취소 대상으로 센다", () => {
    const f = createHouseholdWithChild("cancellable");
    createReservationWithSession(f.enrollmentId, { startsInDays: 3, finalStatus: "scheduled" });
    expect(previewRow(f.householdId, f.childId)).toEqual({ assignments: 0, cancellable: 1, live: 0 });
  });

  it("이미 완료된 수업은 취소 대상에 넣지 않는다(완료 수업·사용 수업권 보존)", () => {
    const f = createHouseholdWithChild("completed");
    createReservationWithSession(f.enrollmentId, { startsInDays: -3, finalStatus: "completed" });
    createReservationWithSession(f.enrollmentId, { startsInDays: 4, finalStatus: "completed" });
    expect(previewRow(f.householdId, f.childId)).toEqual({ assignments: 0, cancellable: 0, live: 0 });
  });

  it("진행 중(live) 수업은 시작 시각이 지났어도 잡아낸다 — 차단 판정의 근거", () => {
    const f = createHouseholdWithChild("live");
    // 이미 시작된 수업이라 starts_at은 과거다(시간 조건으로는 잡히지 않는 케이스).
    createReservationWithSession(f.enrollmentId, { startsInDays: -1, finalStatus: "live" });
    expect(previewRow(f.householdId, f.childId)).toEqual({ assignments: 0, cancellable: 0, live: 1 });
  });

  it("취소된 예약은 어느 쪽으로도 세지 않는다", () => {
    const f = createHouseholdWithChild("cancelled");
    createReservationWithSession(f.enrollmentId, {
      startsInDays: 5,
      finalStatus: "company_cancelled",
      reservationStatus: "cancelled",
    });
    expect(previewRow(f.householdId, f.childId)).toEqual({ assignments: 0, cancellable: 0, live: 0 });
  });

  it("활성 매칭 수를 함께 센다", () => {
    const f = createHouseholdWithChild("assignment");
    psql(
      `insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from, source)
       values ('${f.enrollmentId}', '${TEACHER_ID}', 'active', now() - interval '1 day', 'app');`
    );
    expect(previewRow(f.householdId, f.childId)).toEqual({ assignments: 1, cancellable: 0, live: 0 });
  });
});

describe("archived_household_profile_ids() / 아카이브 플래그", () => {
  it("아카이브된 가구의 보호자·자녀만 반환하고, 복귀하면 다시 빠진다", () => {
    const archived = createHouseholdWithChild("filter-archived");
    const active = createHouseholdWithChild("filter-active");
    psql(`update households set archived_at = now(), archived_by = '${ADMIN_ID}' where id = '${archived.householdId}';`);

    const ids = psql(`select profile_id from archived_household_profile_ids();`).split("\n").filter(Boolean);
    expect(ids).toContain(archived.guardianId);
    expect(ids).toContain(archived.childId);
    expect(ids).not.toContain(active.guardianId);
    expect(ids).not.toContain(active.childId);

    // 복귀 = 플래그 해제만.
    psql(`update households set archived_at = null, archived_by = null where id = '${archived.householdId}';`);
    const afterRestore = psql(`select profile_id from archived_household_profile_ids();`).split("\n").filter(Boolean);
    expect(afterRestore).not.toContain(archived.guardianId);
  });

  it("복귀는 예약·매칭·수강 상태를 건드리지 않는다", () => {
    const f = createHouseholdWithChild("restore-untouched");
    psql(
      `insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from, source)
       values ('${f.enrollmentId}', '${TEACHER_ID}', 'ended', now() - interval '2 days', 'app');`
    );
    const reservationId = createReservationWithSession(f.enrollmentId, {
      startsInDays: 6,
      finalStatus: "company_cancelled",
      reservationStatus: "cancelled",
    });
    psql(`update subject_enrollments set status = 'terminated' where id = '${f.enrollmentId}';`);
    psql(`update households set archived_at = now() where id = '${f.householdId}';`);

    psql(`update households set archived_at = null where id = '${f.householdId}';`);

    expect(psql(`select status from reservations where id = '${reservationId}';`)).toBe("cancelled");
    expect(psql(`select status from subject_enrollments where id = '${f.enrollmentId}';`)).toBe("terminated");
    expect(
      psql(`select status from teacher_assignments where subject_enrollment_id = '${f.enrollmentId}';`)
    ).toBe("ended");
  });
});

describe("household_archive_events", () => {
  it("INSERT-only다 — 수정·삭제가 거부된다", () => {
    const f = createHouseholdWithChild("events");
    const eventId = psql(
      `insert into household_archive_events (household_id, action, actor_id, detail)
       values ('${f.householdId}', 'archived', '${ADMIN_ID}', '{"ended_assignments":1}'::jsonb)
       returning id;`
    );
    expect(() => psql(`update household_archive_events set action = 'restored' where id = '${eventId}';`)).toThrow(
      /INSERT-only/
    );
    expect(() => psql(`delete from household_archive_events where id = '${eventId}';`)).toThrow(/INSERT-only/);
  });
});
