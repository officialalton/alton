import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// R11(문의·면담) — household_messages/meeting_requests RLS + list_open_meeting_slots()
// RPC를 로컬 Postgres에 직접 psql로 검증한다(app/consult/existing-guardian-reconsult.
// integration.test.ts와 동일한 패턴). auth.uid()는 request.jwt.claims 세션 변수에서
// 읽으므로(2026-09-06 실제 버그 수정 세션에서 확인한 정의 그대로), `set local role
// authenticated; set local request.jwt.claims = '{"sub":"..."}'`로 실제 보호자/관리자
// 세션을 흉내내 RLS 정책까지 실제로 태운다(postgres 슈퍼유저 연결로는 RLS를
// 우회하므로 의미가 없다 — 반드시 role을 authenticated로 바꿔야 한다).

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

function psqlAsSuperuser(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}

/** authenticated role + 특정 사용자 jwt로 세션을 흉내내 RLS를 실제로 태운다. */
function psqlAsUser(userId: string, sql: string): string {
  const wrapped = `
    begin;
    set local role authenticated;
    set local request.jwt.claims = '{"sub":"${userId}","role":"authenticated"}';
    ${sql}
    commit;
  `;
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", wrapped], { encoding: "utf-8" }).trim();
}

function createAuthUser(label: string): string {
  return psqlAsSuperuser(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
}

function setupHousehold(label: string): { guardianId: string; householdId: string; childId: string } {
  const guardianId = createAuthUser(`${label}-guardian`);
  psqlAsSuperuser(`insert into profiles (id, role, name) values ('${guardianId}', 'parent', '${label}보호자');`);
  psqlAsSuperuser(`insert into parents (id) values ('${guardianId}');`);
  const householdId = psqlAsSuperuser(`insert into households (primary_guardian_id) values ('${guardianId}') returning id;`);
  psqlAsSuperuser(`insert into household_members (household_id, profile_id, role, is_primary) values ('${householdId}', '${guardianId}', 'guardian', true);`);
  const childId = createAuthUser(`${label}-child`);
  psqlAsSuperuser(`insert into profiles (id, role, name) values ('${childId}', 'student', '${label}자녀');`);
  psqlAsSuperuser(`insert into household_members (household_id, profile_id, role) values ('${householdId}', '${childId}', 'child');`);
  return { guardianId, householdId, childId };
}

describe("household_messages RLS", () => {
  it("보호자는 자기 household 메시지만 쓰고 볼 수 있다(다른 household는 불가)", () => {
    const a = setupHousehold("msg-a");
    const b = setupHousehold("msg-b");

    // 본인 household에는 정상 작성 가능.
    psqlAsUser(
      a.guardianId,
      `insert into household_messages (household_id, sender_id, sender_role, body) values ('${a.householdId}', '${a.guardianId}', 'guardian', '문의합니다');`
    );
    const ownCount = psqlAsUser(a.guardianId, `select count(*) from household_messages where household_id = '${a.householdId}';`);
    expect(ownCount).toBe("1");

    // 다른 household(b)에는 insert 자체가 거부된다(RLS with check 위반).
    expect(() =>
      psqlAsUser(
        a.guardianId,
        `insert into household_messages (household_id, sender_id, sender_role, body) values ('${b.householdId}', '${a.guardianId}', 'guardian', '남의 집 문의');`
      )
    ).toThrow();

    // 다른 household(b)의 메시지는 조회도 되지 않는다(RLS select 필터).
    const crossCount = psqlAsUser(a.guardianId, `select count(*) from household_messages where household_id = '${b.householdId}';`);
    expect(crossCount).toBe("0");
  });

  it("관리자는 모든 household 문의를 조회·작성할 수 있다", () => {
    const a = setupHousehold("msg-admin");
    const adminId = createAuthUser("msg-admin-user");
    psqlAsSuperuser(`insert into profiles (id, role, name) values ('${adminId}', 'admin', '관리자');`);

    psqlAsUser(
      a.guardianId,
      `insert into household_messages (household_id, sender_id, sender_role, body) values ('${a.householdId}', '${a.guardianId}', 'guardian', '질문 있습니다');`
    );
    psqlAsUser(
      adminId,
      `insert into household_messages (household_id, sender_id, sender_role, body) values ('${a.householdId}', '${adminId}', 'admin', '답변드립니다');`
    );
    const adminVisibleCount = psqlAsUser(adminId, `select count(*) from household_messages where household_id = '${a.householdId}';`);
    expect(adminVisibleCount).toBe("2");

    psqlAsUser(adminId, `update household_messages set status = 'resolved' where household_id = '${a.householdId}';`);
    const resolvedCount = psqlAsUser(adminId, `select count(*) from household_messages where household_id = '${a.householdId}' and status = 'resolved';`);
    expect(resolvedCount).toBe("2");
  });
});

describe("meeting_requests — consultations와 완전 분리", () => {
  it("보호자가 본인 household로 면담을 신청할 수 있고, 파이프라인(consultations) 테이블에는 어떤 행도 생기지 않는다", () => {
    const a = setupHousehold("meeting-a");

    const meetingId = psqlAsUser(
      a.guardianId,
      `insert into meeting_requests (household_id, child_id, subject, requested_by, starts_at, ends_at)
       values ('${a.householdId}', '${a.childId}', '성적 상담', '${a.guardianId}', now() + interval '1 day', now() + interval '1 day 1 hour')
       returning id;`
    );
    expect(meetingId.length).toBeGreaterThan(0);

    // 다른 병렬 테스트가 동시에 consultations를 만들 수 있으므로 전체 카운트 비교(레이스
    // 조건) 대신, 이번에 만든 자녀/가족을 참조하는 상담이 하나도 없는지 범위를 좁혀 확인한다.
    const consultationsForThisChild = psqlAsSuperuser(
      `select count(*) from consultations where child_id = '${a.childId}' or contact_email in (select email from auth.users where id = '${a.guardianId}');`
    );
    expect(consultationsForThisChild).toBe("0");

    // consultations 테이블과의 FK 관계 자체가 없다(스키마 레벨 분리 확인).
    const fkToConsultations = psqlAsSuperuser(
      `select count(*) from information_schema.constraint_column_usage ccu
       join information_schema.table_constraints tc on tc.constraint_name = ccu.constraint_name
       where tc.table_name = 'meeting_requests' and ccu.table_name = 'consultations';`
    );
    expect(fkToConsultations).toBe("0");
  });

  it("다른 household의 보호자는 면담 요청을 볼 수 없다", () => {
    const a = setupHousehold("meeting-b1");
    const b = setupHousehold("meeting-b2");
    psqlAsUser(
      a.guardianId,
      `insert into meeting_requests (household_id, requested_by, starts_at, ends_at) values ('${a.householdId}', '${a.guardianId}', now() + interval '1 day', now() + interval '1 day 1 hour');`
    );
    const visibleToOther = psqlAsUser(b.guardianId, `select count(*) from meeting_requests where household_id = '${a.householdId}';`);
    expect(visibleToOther).toBe("0");
  });
});

describe("list_open_meeting_slots() — 면담 전용 가용시간(상담 slots와 분리)", () => {
  it("면담 전용 반복 가능시간만 반영하고, 상담(list_open_consult_slots)과 결과가 섞이지 않는다", () => {
    // 상담 쪽에만 규칙을 등록(비교군) — 면담 슬롯 계산에 영향을 주면 안 된다.
    psqlAsSuperuser(`delete from consult_availability_rules;`);
    psqlAsSuperuser(`insert into consult_availability_rules (weekday, start_time, end_time) select generate_series(0,6), '08:00', '09:00';`);

    psqlAsSuperuser(`delete from meeting_availability_rules;`);
    psqlAsSuperuser(`insert into meeting_availability_rules (weekday, start_time, end_time) select generate_series(0,6), '14:00', '15:00';`);

    const from = new Date();
    const to = new Date(from.getTime() + 3 * 24 * 60 * 60 * 1000);
    const meetingSlots = psqlAsSuperuser(
      `select count(*) from list_open_meeting_slots('${from.toISOString()}', '${to.toISOString()}');`
    );
    expect(Number(meetingSlots)).toBeGreaterThan(0);

    // 면담 규칙 시간대(14:00~15:00 PT)와 상담 규칙 시간대(08:00~09:00 PT)가
    // 겹치지 않으므로, 면담 슬롯 목록에 상담 슬롯 시간대가 섞여 나오면 안 된다.
    const overlapCount = psqlAsSuperuser(
      `select count(*) from list_open_meeting_slots('${from.toISOString()}', '${to.toISOString()}') m
       join list_open_consult_slots('${from.toISOString()}', '${to.toISOString()}') c on m.slot_starts_at = c.slot_starts_at;`
    );
    expect(overlapCount).toBe("0");
  });

  it("면담 예외(휴무)로 등록한 날짜는 슬롯에서 제외된다", () => {
    psqlAsSuperuser(`delete from meeting_availability_rules;`);
    psqlAsSuperuser(`insert into meeting_availability_rules (weekday, start_time, end_time) select generate_series(0,6), '14:00', '15:00';`);
    psqlAsSuperuser(`delete from meeting_availability_exceptions;`);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const tomorrowDate = tomorrow.toISOString().slice(0, 10);
    psqlAsSuperuser(`insert into meeting_availability_exceptions (exception_date, is_closed) values ('${tomorrowDate}', true);`);

    const from = new Date();
    const to = new Date(from.getTime() + 2 * 24 * 60 * 60 * 1000);
    const slotsOnClosedDay = psqlAsSuperuser(
      `select count(*) from list_open_meeting_slots('${from.toISOString()}', '${to.toISOString()}') where slot_starts_at::date = '${tomorrowDate}';`
    );
    expect(slotsOnClosedDay).toBe("0");
  });
});
