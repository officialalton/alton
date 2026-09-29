import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// R11(문의·면담) — household_messages/meeting_requests RLS
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

// 2026-09-22(사용자 지시) — household 전체가 공유하는 끝없는 대화 대신 "문의"(household_inquiries)
// 단위 스레드로 바뀌었다. household_messages.inquiry_id가 not null이라 먼저 문의를 열어야 한다.
describe("household_inquiries / household_messages RLS", () => {
  it("보호자는 자기 household 문의만 열고 메시지를 쓰고 볼 수 있다(다른 household는 불가)", () => {
    const a = setupHousehold("msg-a");
    const b = setupHousehold("msg-b");

    // 본인 household에는 문의를 열고 메시지를 정상 작성할 수 있다.
    const inquiryId = psqlAsUser(
      a.guardianId,
      `insert into household_inquiries (household_id, opened_by, opened_by_role) values ('${a.householdId}', '${a.guardianId}', 'guardian') returning id;`
    );
    psqlAsUser(
      a.guardianId,
      `insert into household_messages (household_id, inquiry_id, sender_id, sender_role, body) values ('${a.householdId}', '${inquiryId}', '${a.guardianId}', 'guardian', '문의합니다');`
    );
    const ownCount = psqlAsUser(a.guardianId, `select count(*) from household_messages where household_id = '${a.householdId}';`);
    expect(ownCount).toBe("1");

    // 다른 household(b)에는 문의 insert 자체가 거부된다(RLS with check 위반).
    expect(() =>
      psqlAsUser(
        a.guardianId,
        `insert into household_inquiries (household_id, opened_by, opened_by_role) values ('${b.householdId}', '${a.guardianId}', 'guardian');`
      )
    ).toThrow();

    // 다른 household(b)의 문의·메시지는 조회도 되지 않는다(RLS select 필터).
    const crossCount = psqlAsUser(a.guardianId, `select count(*) from household_messages where household_id = '${b.householdId}';`);
    expect(crossCount).toBe("0");
  });

  it("관리자는 모든 household 문의를 조회·작성·종료할 수 있고, 종료된 문의엔 메시지를 남길 수 없다", () => {
    const a = setupHousehold("msg-admin");
    const adminId = createAuthUser("msg-admin-user");
    psqlAsSuperuser(`insert into profiles (id, role, name) values ('${adminId}', 'admin', '관리자');`);

    const inquiryId = psqlAsUser(
      a.guardianId,
      `insert into household_inquiries (household_id, opened_by, opened_by_role) values ('${a.householdId}', '${a.guardianId}', 'guardian') returning id;`
    );
    psqlAsUser(
      a.guardianId,
      `insert into household_messages (household_id, inquiry_id, sender_id, sender_role, body) values ('${a.householdId}', '${inquiryId}', '${a.guardianId}', 'guardian', '질문 있습니다');`
    );
    psqlAsUser(
      adminId,
      `insert into household_messages (household_id, inquiry_id, sender_id, sender_role, body) values ('${a.householdId}', '${inquiryId}', '${adminId}', 'admin', '답변드립니다');`
    );
    const adminVisibleCount = psqlAsUser(adminId, `select count(*) from household_messages where household_id = '${a.householdId}';`);
    expect(adminVisibleCount).toBe("2");

    psqlAsUser(adminId, `select close_household_inquiry('${inquiryId}');`);
    const closedStatus = psqlAsUser(adminId, `select status from household_inquiries where id = '${inquiryId}';`);
    expect(closedStatus).toBe("closed");

    // 종료된 문의엔 보호자든 관리자든 메시지를 남길 수 없다(재문의는 새 문의로).
    expect(() =>
      psqlAsUser(
        a.guardianId,
        `insert into household_messages (household_id, inquiry_id, sender_id, sender_role, body) values ('${a.householdId}', '${inquiryId}', '${a.guardianId}', 'guardian', '재문의합니다');`
      )
    ).toThrow();
  });
});

describe("meeting_requests — consultations와 완전 분리", () => {
  it("보호자가 본인 household로 면담을 신청할 수 있고, 파이프라인(consultations) 테이블에는 어떤 행도 생기지 않는다", () => {
    const a = setupHousehold("meeting-a");

    const meetingId = psqlAsUser(
      a.guardianId,
      `insert into meeting_requests (household_id, child_id, subject, requested_by)
       values ('${a.householdId}', '${a.childId}', '성적 상담', '${a.guardianId}')
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
      `insert into meeting_requests (household_id, requested_by, starts_at, ends_at) values ('${a.householdId}', '${a.guardianId}', null, null);`
    );
    const visibleToOther = psqlAsUser(b.guardianId, `select count(*) from meeting_requests where household_id = '${a.householdId}';`);
    expect(visibleToOther).toBe("0");
  });
});
