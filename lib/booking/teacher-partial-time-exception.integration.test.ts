import { execFileSync } from "node:child_process";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

// 2026-09-06 — M4 UAT 남은 마지막 이슈(#5): "반복 규칙으로 특정 요일이 열려 있어도
// 그중 일부 시간대만 개별로 휴무 지정할 수 있어야 한다"를 실제 DB 함수
// `is_teacher_slot_open()`(supabase/migrations/20260926000000_r6_availability_and_booking.sql)
// 호출로 못박는다. 스키마(teacher_availability_exceptions.start_time_local/end_time_local)와
// 이 함수는 R6에서 이미 부분 시간 예외를 지원하도록 구현돼 있었다 — 이번 라운드는 그
// 사실을 직접 검증하고, 선생님 포털 UI(TeacherAvailabilityTab)에서 그 값을 등록할 수
// 있게 하는 것이 실제 작업이었다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

let teacherId: string;
let adminId: string;

beforeAll(() => {
  adminId = psql(`select id from profiles where role = 'admin' limit 1;`);

  const now = Date.now();
  const authEmail = `partial-exception-teacher-${now}@example.com`;
  teacherId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${authEmail}', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`insert into profiles (id, role, name) values ('${teacherId}', 'teacher', '부분휴무 테스트 선생님');`);

  // 매주 수요일 09:00~17:00 반복 오픈.
  psql(`
    insert into teacher_availability_rules (teacher_id, day_of_week, start_time_local, end_time_local, timezone, effective_from, created_by)
    values ('${teacherId}', 3, '09:00', '17:00', 'America/Los_Angeles', '2026-01-01', '${adminId}');
  `);
});

afterAll(() => {
  psql(`delete from teacher_availability_exceptions where teacher_id = '${teacherId}';`);
  psql(`delete from teacher_availability_rules where teacher_id = '${teacherId}';`);
  psql(`delete from profiles where id = '${teacherId}';`);
  psql(`delete from auth.users where id = '${teacherId}';`);
});

// 다음 수요일(과거가 아닌) 날짜를 찾는다 — 예외 없이도 항상 재현 가능하도록.
function nextWednesdayDateKey(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const daysUntilWed = (3 - day + 7) % 7 || 7;
  const wed = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilWed));
  return wed.toISOString().slice(0, 10);
}

describe("is_teacher_slot_open — 부분 시간 예외", () => {
  it("예외 등록 전에는 반복 규칙 시간대 전체가 열려 있다", () => {
    const dateKey = nextWednesdayDateKey();
    const openMorning = psql(
      `select is_teacher_slot_open('${teacherId}', ('${dateKey} 09:00:00'::timestamp at time zone 'America/Los_Angeles'), ('${dateKey} 11:00:00'::timestamp at time zone 'America/Los_Angeles'));`
    );
    const openAfternoon = psql(
      `select is_teacher_slot_open('${teacherId}', ('${dateKey} 14:00:00'::timestamp at time zone 'America/Los_Angeles'), ('${dateKey} 16:00:00'::timestamp at time zone 'America/Los_Angeles'));`
    );
    expect(openMorning).toBe("t");
    expect(openAfternoon).toBe("t");
  });

  it("특정 날짜의 일부 시간대만 부분 휴무로 등록하면 그 시간대만 닫히고 나머지는 그대로 열려 있다", () => {
    const dateKey = nextWednesdayDateKey();
    psql(`
      insert into teacher_availability_exceptions (teacher_id, exception_date, kind, start_time_local, end_time_local, timezone, created_by)
      values ('${teacherId}', '${dateKey}', 'blocked', '12:00', '13:00', 'America/Los_Angeles', '${adminId}');
    `);

    // 부분 휴무 시간대(12:00~13:00)와 겹치는 슬롯은 닫혀야 한다.
    const blockedSlot = psql(
      `select is_teacher_slot_open('${teacherId}', ('${dateKey} 12:00:00'::timestamp at time zone 'America/Los_Angeles'), ('${dateKey} 12:30:00'::timestamp at time zone 'America/Los_Angeles'));`
    );
    expect(blockedSlot).toBe("f");

    // 부분 휴무 이전(09:00~11:00)과 이후(14:00~16:00) 시간대는 그대로 열려 있어야 한다.
    const beforeBlock = psql(
      `select is_teacher_slot_open('${teacherId}', ('${dateKey} 09:00:00'::timestamp at time zone 'America/Los_Angeles'), ('${dateKey} 11:00:00'::timestamp at time zone 'America/Los_Angeles'));`
    );
    const afterBlock = psql(
      `select is_teacher_slot_open('${teacherId}', ('${dateKey} 14:00:00'::timestamp at time zone 'America/Los_Angeles'), ('${dateKey} 16:00:00'::timestamp at time zone 'America/Los_Angeles'));`
    );
    expect(beforeBlock).toBe("t");
    expect(afterBlock).toBe("t");

    // 다른 날짜(다음 주 같은 요일)는 이 예외의 영향을 받지 않는다.
    const otherWedIso = `${dateKey}`;
    const nextWeek = new Date(new Date(`${otherWedIso}T00:00:00Z`).getTime() + 7 * 24 * 60 * 60_000)
      .toISOString()
      .slice(0, 10);
    const otherWeekOpen = psql(
      `select is_teacher_slot_open('${teacherId}', ('${nextWeek} 12:00:00'::timestamp at time zone 'America/Los_Angeles'), ('${nextWeek} 12:30:00'::timestamp at time zone 'America/Los_Angeles'));`
    );
    expect(otherWeekOpen).toBe("t");
  });
});
