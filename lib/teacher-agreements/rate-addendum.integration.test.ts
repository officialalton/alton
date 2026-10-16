import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Rate change addendum (20262100000150): apply_teacher_rate_addendum() creates the new rate effective from the stated
// date (earlier lessons keep the old rate), links the addendum, is idempotent, and the session rate snapshot follows the
// lesson start time. Same psql shell-out pattern and file-specific teacher as the other booking integration tests.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const FIXED_BOOKING_HOUR_UTC = 17;

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
const lastLine = (o: string) => o.split("\n").filter((l) => l.trim()).pop()?.trim() ?? "";

let teacherId: string;
let childId: string;
let subjectEnrollmentId: string;
let regularLessonTypeId: string;
let regularProductId: string;

function grantEntitlement(): void {
  const grantId = psql(
    `insert into entitlement_grants (child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at, is_paid)
     values ('${childId}', '${regularProductId}', null, 1, now() + interval '120 days', true) returning id;`
  );
  psql(`insert into entitlement_ledger (grant_id, event_type, amount, business_event_id) values ('${grantId}', 'grant', 1, 'addendum-grant-${Date.now()}-${grantId}');`);
}

function book(daysFromNow: number): string {
  grantEntitlement();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + daysFromNow);
  start.setUTCHours(FIXED_BOOKING_HOUR_UTC, 0, 0, 0);
  const end = new Date(start.getTime() + 120 * 60000);
  const row = psql(
    `select reservation_id, session_id from confirm_lesson_booking('${childId}', '${subjectEnrollmentId}', '${teacherId}', '${regularLessonTypeId}', '${start.toISOString()}', '${end.toISOString()}', 'addendum-book-${Date.now()}-${Math.random()}');`
  );
  return lastLine(row).split("|")[1];
}
const snapshot = (sessionId: string) => psql(`select hourly_rate_snapshot_minor from sessions where id = '${sessionId}';`);

beforeAll(() => {
  regularLessonTypeId = psql(`select id from lesson_types where code = 'regular';`);
  regularProductId = psql(`select id from entitlement_products where code = 'lesson_pack_10';`);
  const now = Date.now();
  teacherId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'addendum-teacher-${now}@example.com', 'x', now(), '{}', '{}', now(), now()) returning id;`
  );
  psql(`insert into profiles (id, role, name) values ('${teacherId}', 'teacher', '합의서 통합테스트 선생님');`);
  psql(`select set_teacher_rate('${teacherId}', 3000000, 'KRW', now() - interval '1 day');`);
  psql(`insert into teachers (id, status, hourly_rate_krw) values ('${teacherId}', 'active', 3000000);`);
  childId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'addendum-child-${now}@example.com', 'x', now(), '{}', '{}', now(), now()) returning id;`
  );
  psql(`insert into profiles (id, role, name) values ('${childId}', 'student', '합의서 통합테스트 학생'); insert into students (id, grade, status) values ('${childId}', '10학년', 'active');`);
  const householdId = psql(`insert into households (primary_guardian_id) values (null) returning id;`);
  psql(`insert into household_members (household_id, profile_id, role, is_primary) values ('${householdId}', '${childId}', 'child', true);`);
  const contractId = psql(`insert into contracts (household_id, child_id, status) values ('${householdId}', '${childId}', 'draft') returning id;`);
  subjectEnrollmentId = psql(`insert into subject_enrollments (child_id, subject_id, contract_id, status) values ('${childId}', '${SUBJECT_ID}', '${contractId}', 'planned') returning id;`);
  psql(`insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from, source) values ('${subjectEnrollmentId}', '${teacherId}', 'active', now() - interval '1 day', 'app');`);
  psql(`insert into teacher_availability_rules (teacher_id, day_of_week, start_time_local, end_time_local, timezone, created_by)
        select '${teacherId}', d, '00:00', '23:59', 'America/Los_Angeles', '${ADMIN_ID}' from generate_series(0,6) d;`);
});

afterAll(() => {
  psql(`delete from teacher_availability_rules where teacher_id = '${teacherId}' and created_by = '${ADMIN_ID}';`);
});

describe("apply_teacher_rate_addendum()", () => {
  it("applies from the effective date, keeps earlier lessons on the old rate, links the addendum and is idempotent", () => {
    const early = book(5); // starts before the effective date
    const late = book(50); // starts after it
    expect(snapshot(early)).toBe("3000000");
    expect(snapshot(late)).toBe("3000000");

    const effective = psql(`select (current_date + 20)::text;`);
    const contractId = psql(
      `insert into teacher_contracts (teacher_id, doc_type, status, signed_at, agreement_form, inputs_snapshot)
       values ('${teacherId}', 'teacher_rate_addendum', 'signed', now(), 'teacher_rate_addendum',
         '{"addendum":{"newAmountMinor":4000000,"newCurrency":"KRW","effectiveDate":"${effective}"}}'::jsonb) returning id;`
    );
    const histId = lastLine(psql(`select apply_teacher_rate_addendum('${contractId}');`));
    expect(lastLine(psql(`select apply_teacher_rate_addendum('${contractId}');`))).toBe(histId);

    const row = psql(`select amount_minor, currency, agreement_contract_id = '${contractId}', effective_until is null from teacher_rate_history where id = '${histId}';`);
    expect(row).toBe("4000000|KRW|t|t");
    const oldClosed = psql(`select count(*) from teacher_rate_history where teacher_id = '${teacherId}' and amount_minor = 3000000 and effective_until = (select effective_from from teacher_rate_history where id = '${histId}');`);
    expect(oldClosed).toBe("1");
    const startsLater = psql(`select effective_from > now() from teacher_rate_history where id = '${histId}';`);
    expect(startsLater).toBe("t");

    // already-booked lessons: before the date keep the old rate, after it move to the new rate
    expect(snapshot(early)).toBe("3000000");
    expect(snapshot(late)).toBe("4000000");
    // future-dated rate does not leak into the legacy cache yet
    expect(psql(`select hourly_rate_krw from teachers where id = '${teacherId}';`)).toBe("3000000");

    // lessons booked afterwards follow their own start time, not simply the newest row
    expect(snapshot(book(6))).toBe("3000000");
    expect(snapshot(book(55))).toBe("4000000");
  });

  it("refuses an unsigned addendum and a non-addendum contract", () => {
    const unsigned = psql(
      `insert into teacher_contracts (teacher_id, doc_type, status, agreement_form, inputs_snapshot) values ('${teacherId}', 'teacher_rate_addendum', 'sent', 'teacher_rate_addendum', '{}'::jsonb) returning id;`
    );
    expect(() => psql(`select apply_teacher_rate_addendum('${unsigned}');`)).toThrow(/서명이 완료되지 않은/);
    const main = psql(`insert into teacher_contracts (teacher_id, doc_type, status, agreement_form) values ('${teacherId}', 'x', 'signed', 'non_us_services') returning id;`);
    expect(() => psql(`select apply_teacher_rate_addendum('${main}');`)).toThrow(/시급 변경 합의서가 아닙니다/);
  });

  it("set_teacher_rate rejects currencies other than KRW/USD and the legacy cache only follows KRW", () => {
    expect(() => psql(`select set_teacher_rate('${teacherId}', 1000, 'EUR', now() + interval '400 days');`)).toThrow(/KRW 또는 USD/);
  });
});
