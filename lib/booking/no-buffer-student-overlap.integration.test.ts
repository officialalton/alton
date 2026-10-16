import { execFileSync } from "node:child_process";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createPerRunTeacher, cleanupPerRunTeacher } from "@/test/per-run-teacher";

// 2026-09-29 오너 결정 — (1) 선생님 15분 버퍼 제거: 같은 선생님의 연속 수업(끝==다음 시작)은
// 예약 가능, 겹침·같은 슬롯은 거부. (2) 같은 학생은 같은 시간에 수업 2건 불가(선생님이 달라도) —
// reservations 트리거가 예약·반복예약·재조정·직접 UPDATE 경로를 모두 막는다.
// 실행마다 전용 선생님 2명 + 전용 학생·수강을 만들고 그 행만 다룬다(재실행 안전, 실제 외부 호출 없음).

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}
function psqlErr(sql: string): string {
  try {
    psql(sql);
    return "";
  } catch (e) {
    return `${(e as { stderr?: unknown })?.stderr ?? ""}${String(e)}`;
  }
}

let teacherA: string;
let teacherB: string;
let lessonTypeId: string;
let packProductId: string;
let baseMs: number; // 실행마다 다른 기준 시각(다른 실행·파일과 슬롯이 겹치지 않도록 전용 선생님 + 랜덤 일자)
const RUN = `nbso-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

const iso = (offsetMin: number) => new Date(baseMs + offsetMin * 60_000).toISOString();

function makeStudent(teachers: string[]): { childId: string; enrollments: string[] } {
  const childId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${RUN}-${Math.random().toString(36).slice(2, 8)}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`,
  );
  psql(`insert into profiles (id, role, name, date_of_birth) values ('${childId}', 'student', '겹침 테스트 학생', now() - interval '17 years');
        insert into students (id, grade, status) values ('${childId}', '10학년', 'active');`);
  const householdId = psql(`insert into households (primary_guardian_id) values (null) returning id;`);
  psql(`insert into household_members (household_id, profile_id, role, is_primary) values ('${householdId}', '${childId}', 'child', true);`);
  const contractId = psql(`insert into contracts (household_id, child_id, status) values ('${householdId}', '${childId}', 'active') returning id;`);
  const enrollments = teachers.map((t) => {
    const e = psql(
      `insert into subject_enrollments (child_id, subject_id, contract_id, status) values ('${childId}', '${SUBJECT_ID}', '${contractId}', 'planned') returning id;`,
    );
    psql(`insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from, source)
          values ('${e}', '${t}', 'active', now() - interval '1 day', 'app');`);
    return e;
  });
  const grantId = psql(
    `insert into entitlement_grants (child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at, is_paid)
     values ('${childId}', '${packProductId}', null, 20, now() + interval '400 days', true) returning id;`,
  );
  psql(`insert into entitlement_ledger (grant_id, event_type, amount, business_event_id) values ('${grantId}', 'grant', 20, '${RUN}-${childId}');`);
  return { childId, enrollments };
}

let seq = 0;
function book(childId: string, enrollmentId: string, teacherId: string, startOffsetMin: number, durMin = 60): string {
  return psql(
    `select reservation_id from confirm_lesson_booking('${childId}', '${enrollmentId}', '${teacherId}', '${lessonTypeId}', '${iso(startOffsetMin)}', '${iso(startOffsetMin + durMin)}', '${RUN}-k${++seq}');`,
  );
}

beforeAll(() => {
  teacherA = createPerRunTeacher(psql, { emailPrefix: "nbso-a", availability: true });
  teacherB = createPerRunTeacher(psql, { emailPrefix: "nbso-b", availability: true });
  lessonTypeId = psql(`select id from lesson_types where code = 'regular';`);
  packProductId = psql(`select id from entitlement_products where code = 'lesson_pack_10';`);
  // 예약 창(24시간~8주) 안, 실행마다 다른 정각 시각(LA 자정 경계를 피해 UTC 18시 기준)
  const day = 3 + Math.floor(Math.random() * 20);
  const d = new Date();
  d.setUTCHours(18, 0, 0, 0);
  baseMs = d.getTime() + day * 86_400_000;
});

afterAll(() => {
  cleanupPerRunTeacher(psql, teacherA);
  cleanupPerRunTeacher(psql, teacherB);
});

describe("선생님 버퍼 제거", () => {
  it("booking_buffer_minutes()는 0이다", () => {
    expect(psql(`select booking_buffer_minutes();`)).toBe("0");
  });

  it("같은 선생님의 연속 수업(끝==다음 시작)은 앞뒤 모두 예약된다", () => {
    const s1 = makeStudent([teacherA]);
    const s2 = makeStudent([teacherA]);
    const s3 = makeStudent([teacherA]);
    book(s1.childId, s1.enrollments[0], teacherA, 0); // [0,60)
    expect(() => book(s2.childId, s2.enrollments[0], teacherA, 60)).not.toThrow(); // [60,120) 바로 뒤
    expect(() => book(s3.childId, s3.enrollments[0], teacherA, -60)).not.toThrow(); // [-60,0) 바로 앞
  });

  it("같은 선생님의 부분 겹침·완전 같은 슬롯은 거부된다", () => {
    const s = makeStudent([teacherA]);
    const other = makeStudent([teacherA]);
    const t0 = 24 * 60; // 다음 날, 위 테스트와 다른 시간대
    book(s.childId, s.enrollments[0], teacherA, t0);
    expect(psqlErr(`select reservation_id from confirm_lesson_booking('${other.childId}', '${other.enrollments[0]}', '${teacherA}', '${lessonTypeId}', '${iso(t0 + 30)}', '${iso(t0 + 90)}', '${RUN}-x1');`))
      .toMatch(/teacher_buffer_violation|reservations_no_overlap/);
    expect(psqlErr(`select reservation_id from confirm_lesson_booking('${other.childId}', '${other.enrollments[0]}', '${teacherA}', '${lessonTypeId}', '${iso(t0)}', '${iso(t0 + 60)}', '${RUN}-x2');`))
      .toMatch(/teacher_buffer_violation|reservations_no_overlap/);
  });

  it("reservations_no_overlap 제약은 그대로 남아 직접 INSERT 겹침도 막는다", () => {
    const s = makeStudent([teacherA]);
    const t0 = 2 * 24 * 60;
    const rid = book(s.childId, s.enrollments[0], teacherA, t0);
    expect(rid).toBeTruthy();
    const other = makeStudent([teacherA]);
    expect(psqlErr(`insert into reservations (kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status)
      values ('lesson', '${other.enrollments[0]}', '${teacherA}', '${iso(t0 + 10)}', '${iso(t0 + 20)}', 'confirmed');`))
      .toMatch(/reservations_no_overlap/);
  });
});

describe("같은 학생 동시간 수업 금지", () => {
  it("다른 선생님이어도 같은 시간·부분 겹침은 거부, 인접·떨어진 시간은 허용", () => {
    const s = makeStudent([teacherA, teacherB]);
    const t0 = 3 * 24 * 60;
    book(s.childId, s.enrollments[0], teacherA, t0); // [t0, t0+60)
    const dup = psqlErr(`select reservation_id from confirm_lesson_booking('${s.childId}', '${s.enrollments[1]}', '${teacherB}', '${lessonTypeId}', '${iso(t0)}', '${iso(t0 + 60)}', '${RUN}-d1');`);
    expect(dup).toContain("student_time_overlap: You already have another lesson at the same time.");
    const part = psqlErr(`select reservation_id from confirm_lesson_booking('${s.childId}', '${s.enrollments[1]}', '${teacherB}', '${lessonTypeId}', '${iso(t0 + 30)}', '${iso(t0 + 90)}', '${RUN}-d2');`);
    expect(part).toContain("student_time_overlap");
    expect(() => book(s.childId, s.enrollments[1], teacherB, t0 + 60)).not.toThrow(); // 바로 뒤 인접
    expect(() => book(s.childId, s.enrollments[1], teacherB, t0 + 300)).not.toThrow(); // 떨어진 시간
    // 거부된 시도는 예약·hold를 남기지 않는다(롤백)
    expect(psql(`select count(*) from reservations r join subject_enrollments e on e.id = r.subject_enrollment_id where e.child_id = '${s.childId}';`)).toBe("3");
  });

  it("취소된 예약은 겹침으로 세지 않는다", () => {
    const s = makeStudent([teacherA, teacherB]);
    const t0 = 4 * 24 * 60;
    const rid = book(s.childId, s.enrollments[0], teacherA, t0);
    psql(`update reservations set status = 'cancelled' where id = '${rid}';`);
    expect(() => book(s.childId, s.enrollments[1], teacherB, t0)).not.toThrow();
  });

  it("재조정(관리자 Google 시간 반영 RPC)으로 다른 수업과 겹치게 옮기면 거부되고, 인접 이동은 허용", () => {
    const s = makeStudent([teacherA, teacherB]);
    const t0 = 5 * 24 * 60;
    book(s.childId, s.enrollments[0], teacherA, t0); // [t0, t0+60) 고정
    const moving = book(s.childId, s.enrollments[1], teacherB, t0 + 300); // teacherB [t0+300, +360)
    const move = (off: number) =>
      psqlErr(`select reschedule_reservation_to_google_time('${moving}', '${iso(off)}', '${iso(off + 60)}', '${ADMIN_ID}', '${RUN} reschedule');`);
    expect(move(t0 + 30)).toContain("student_time_overlap");
    expect(move(t0)).toContain("student_time_overlap");
    expect(move(t0 + 60)).toBe(""); // 인접은 허용
    expect(psql(`select starts_at = '${iso(t0 + 60)}'::timestamptz from reservations where id = '${moving}';`)).toBe("t");
  });

  it("직접 UPDATE(시간 변경)도 막고, 시간이 그대로인 UPDATE는 통과한다", () => {
    const s = makeStudent([teacherA, teacherB]);
    const t0 = 6 * 24 * 60;
    book(s.childId, s.enrollments[0], teacherA, t0);
    const moving = book(s.childId, s.enrollments[1], teacherB, t0 + 300);
    expect(psqlErr(`update reservations set starts_at = '${iso(t0 + 10)}', ends_at = '${iso(t0 + 70)}' where id = '${moving}';`))
      .toContain("student_time_overlap");
    expect(psqlErr(`update reservations set google_sync_status = 'failed' where id = '${moving}';`)).toBe("");
  });

  it("반복 예약(series)은 학생이 겹치는 회차에서 멈추고 앞 회차는 남긴다", () => {
    const s = makeStudent([teacherA, teacherB]);
    const t0 = 7 * 24 * 60;
    // teacherB로 2주 뒤 같은 시각에 이미 수업이 있다 → 회차 0 성공, 회차 1(+1주)은 통과, 회차 2(+2주) 겹침
    book(s.childId, s.enrollments[1], teacherB, t0 + 14 * 24 * 60);
    const rows = psql(
      `select occurrence_index || ':' || coalesce(failure_reason, 'ok')
       from create_weekly_lesson_series('${s.childId}', '${s.enrollments[0]}', '${teacherA}', '${lessonTypeId}', '${iso(t0)}', 60, 3::smallint, 'UTC', '${RUN}-series', '${ADMIN_ID}', false)
       order by occurrence_index;`,
    ).split("\n");
    expect(rows[0]).toBe("0:ok");
    expect(rows[1]).toBe("1:ok");
    expect(rows[2]).toContain("student_time_overlap");
  });

  it("violates_student_overlap()는 exclude 예약을 무시하고 인접은 겹침이 아니다", () => {
    const s = makeStudent([teacherA]);
    const t0 = 8 * 24 * 60;
    const rid = book(s.childId, s.enrollments[0], teacherA, t0);
    const q = (a: number, b: number, ex = "null") =>
      psql(`select violates_student_overlap('${s.childId}', '${iso(a)}', '${iso(b)}', ${ex === "null" ? "null" : `'${ex}'`});`);
    expect(q(t0 + 30, t0 + 90)).toBe("t");
    expect(q(t0 + 30, t0 + 90, rid)).toBe("f");
    expect(q(t0 + 60, t0 + 120)).toBe("f");
    expect(q(t0 - 60, t0)).toBe("f");
  });
});
