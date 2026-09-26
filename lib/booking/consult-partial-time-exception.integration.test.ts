import { execFileSync } from "node:child_process";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

// 2026-09-07 — 제품 오너 지적: 공용 상담 가능시간 관리 화면이 "하루 단위로 통 휴무일
// 지정하는 기능만 있어서" 특정 날짜의 일부 시간대만 휴무/임시오픈으로 등록할 수 없었다.
// `list_open_consult_slots()`(20261009000000_m1_consultation_unification.sql)가
// `is_closed` 예외 행이 있으면 start_time/end_time 값과 무관하게 항상 종일 차단하던
// 버그를 20261217000000_m4_consult_availability_partial_exceptions.sql에서 정정했다
// (teacher_availability_exceptions/is_teacher_slot_open()과 동일한 부분 시간 예외
// 패턴). 이 테스트는 실제 DB 함수 호출로 그 정정을 못박는다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

// 다음주 수요일(과거가 아닌) 날짜를 찾는다 — 예외 없이도 항상 재현 가능하도록.
function nextWednesdayDateKey(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const daysUntilWed = (3 - day + 7) % 7 || 7;
  const wed = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilWed + 7));
  return wed.toISOString().slice(0, 10);
}

let dateKey: string;

beforeAll(() => {
  dateKey = nextWednesdayDateKey();
  // 매주 수요일 09:00~18:00 반복 오픈(공용 상담 가능시간 — teacher_id 없음).
  psql(`
    insert into consult_availability_rules (weekday, start_time, end_time, timezone, active)
    values (3, '09:00', '18:00', 'America/Los_Angeles', true)
    on conflict do nothing;
  `);
});

afterAll(() => {
  psql(`delete from consult_availability_exceptions where exception_date = '${dateKey}';`);
  psql(`delete from consult_availability_rules where weekday = 3 and start_time = '09:00' and end_time = '18:00';`);
});

function openSlotTimesOnDate(): string[] {
  const out = psql(
    `select to_char(slot_starts_at at time zone 'America/Los_Angeles', 'HH24:MI')
     from list_open_consult_slots(('${dateKey} 00:00:00'::timestamp at time zone 'America/Los_Angeles'), ('${dateKey} 23:59:59'::timestamp at time zone 'America/Los_Angeles'))
     order by slot_starts_at;`
  );
  return out.split("\n").filter(Boolean);
}

describe("list_open_consult_slots — 부분 시간 예외", () => {
  it("예외 등록 전에는 반복 규칙 시간대 전체(09~18시)가 슬롯 후보로 열려 있다", () => {
    const times = openSlotTimesOnDate();
    expect(times).toContain("09:00");
    expect(times).toContain("12:00");
    expect(times).toContain("17:00");
  });

  it("특정 날짜의 일부 시간대(12:00~13:00)만 부분 휴무로 등록하면 그 시간대만 빠지고 나머지는 그대로 열려 있다", () => {
    psql(`
      insert into consult_availability_exceptions (exception_date, is_closed, start_time, end_time, reason)
      values ('${dateKey}', true, '12:00', '13:00', '테스트 부분 휴무');
    `);

    const times = openSlotTimesOnDate();
    expect(times).not.toContain("12:00");
    // 부분 휴무 이전/이후 시간대는 그대로 열려 있어야 한다.
    expect(times).toContain("09:00");
    expect(times).toContain("11:00");
    expect(times).toContain("13:00");
    expect(times).toContain("17:00");
  });
});
