import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// R12(상담 신청·메신저 V1) — meeting_request_messages/household_message_reads RLS를
// 로컬 Postgres에 직접 psql로 검증한다(app/consult/r11-inquiry-and-meeting.integration.
// test.ts와 동일한 패턴). auth.uid()는 request.jwt.claims 세션 변수에서 읽으므로,
// `set local role authenticated; set local request.jwt.claims = '{"sub":"..."}'`로
// 실제 보호자/학생/교사/관리자 세션을 흉내내 RLS 정책까지 실제로 태운다(postgres
// 슈퍼유저 연결로는 RLS를 우회하므로 의미가 없다).

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

function psqlAsSuperuser(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}

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

function createMeetingRequest(householdId: string, guardianId: string): string {
  return psqlAsUser(
    guardianId,
    `insert into meeting_requests (household_id, requested_by, content) values ('${householdId}', '${guardianId}', '상담 내용') returning id;`
  );
}

function createAdmin(label: string): string {
  const adminId = createAuthUser(label);
  psqlAsSuperuser(`insert into profiles (id, role, name) values ('${adminId}', 'admin', '관리자');`);
  return adminId;
}

function createTeacher(label: string): string {
  const teacherId = createAuthUser(label);
  psqlAsSuperuser(`insert into profiles (id, role, name) values ('${teacherId}', 'teacher', '${label}선생님');`);
  return teacherId;
}

describe("household_messages / meeting_requests — 학생·교사 권한 없음(R12 재확인)", () => {
  it("학생 계정은 household_messages를 조회·작성할 수 없다", () => {
    const a = setupHousehold("hm-student");
    psqlAsUser(
      a.guardianId,
      `insert into household_messages (household_id, sender_id, sender_role, body) values ('${a.householdId}', '${a.guardianId}', 'guardian', '메신저 메시지');`
    );
    const studentVisibleCount = psqlAsUser(a.childId, `select count(*) from household_messages where household_id = '${a.householdId}';`);
    expect(studentVisibleCount).toBe("0");
    expect(() =>
      psqlAsUser(
        a.childId,
        `insert into household_messages (household_id, sender_id, sender_role, body) values ('${a.householdId}', '${a.childId}', 'guardian', '학생이 쓴 메시지');`
      )
    ).toThrow();
  });

  it("교사 계정은 household_messages를 조회·작성할 수 없다", () => {
    const a = setupHousehold("hm-teacher");
    const teacherId = createTeacher("hm-teacher-user");
    psqlAsUser(
      a.guardianId,
      `insert into household_messages (household_id, sender_id, sender_role, body) values ('${a.householdId}', '${a.guardianId}', 'guardian', '메신저 메시지');`
    );
    const teacherVisibleCount = psqlAsUser(teacherId, `select count(*) from household_messages where household_id = '${a.householdId}';`);
    expect(teacherVisibleCount).toBe("0");
    expect(() =>
      psqlAsUser(
        teacherId,
        `insert into household_messages (household_id, sender_id, sender_role, body) values ('${a.householdId}', '${teacherId}', 'admin', '교사가 쓴 메시지');`
      )
    ).toThrow();
  });

  it("학생 계정은 meeting_requests(상담 신청)를 조회·작성할 수 없다", () => {
    const a = setupHousehold("mr-student");
    const mrId = createMeetingRequest(a.householdId, a.guardianId);
    const studentVisibleCount = psqlAsUser(a.childId, `select count(*) from meeting_requests where id = '${mrId}';`);
    expect(studentVisibleCount).toBe("0");
    expect(() =>
      psqlAsUser(
        a.childId,
        `insert into meeting_requests (household_id, requested_by, content) values ('${a.householdId}', '${a.childId}', '학생이 신청한 상담');`
      )
    ).toThrow();
  });

  it("교사 계정은 meeting_requests(상담 신청)를 조회·작성할 수 없다", () => {
    const a = setupHousehold("mr-teacher");
    const mrId = createMeetingRequest(a.householdId, a.guardianId);
    const teacherId = createTeacher("mr-teacher-user");
    const teacherVisibleCount = psqlAsUser(teacherId, `select count(*) from meeting_requests where id = '${mrId}';`);
    expect(teacherVisibleCount).toBe("0");
    expect(() =>
      psqlAsUser(
        teacherId,
        `insert into meeting_requests (household_id, requested_by, content) values ('${a.householdId}', '${teacherId}', '교사가 신청한 상담');`
      )
    ).toThrow();
  });

  it("관리자는 household_messages/meeting_requests를 모든 household에서 조회·작성할 수 있다", () => {
    const a = setupHousehold("hm-mr-admin");
    const adminId = createAdmin("hm-mr-admin-user");
    psqlAsUser(
      a.guardianId,
      `insert into household_messages (household_id, sender_id, sender_role, body) values ('${a.householdId}', '${a.guardianId}', 'guardian', '문의합니다');`
    );
    psqlAsUser(
      adminId,
      `insert into household_messages (household_id, sender_id, sender_role, body) values ('${a.householdId}', '${adminId}', 'admin', '답변드립니다');`
    );
    const adminVisibleMessages = psqlAsUser(adminId, `select count(*) from household_messages where household_id = '${a.householdId}';`);
    expect(adminVisibleMessages).toBe("2");

    const mrId = createMeetingRequest(a.householdId, a.guardianId);
    const adminVisibleMr = psqlAsUser(adminId, `select count(*) from meeting_requests where id = '${mrId}';`);
    expect(adminVisibleMr).toBe("1");
    psqlAsUser(adminId, `update meeting_requests set status = 'confirming' where id = '${mrId}';`);
    const statusAfter = psqlAsSuperuser(`select status from meeting_requests where id = '${mrId}';`);
    expect(statusAfter).toBe("confirming");
  });
});

describe("meeting_request_messages RLS", () => {
  it("보호자는 본인 household의 상담 신청 대화만 쓰고 볼 수 있다(다른 household는 불가)", () => {
    const a = setupHousehold("mrm-a");
    const b = setupHousehold("mrm-b");
    const mrId = createMeetingRequest(a.householdId, a.guardianId);

    psqlAsUser(
      a.guardianId,
      `insert into meeting_request_messages (meeting_request_id, sender_id, sender_role, body) values ('${mrId}', '${a.guardianId}', 'guardian', '문의합니다');`
    );
    const ownCount = psqlAsUser(a.guardianId, `select count(*) from meeting_request_messages where meeting_request_id = '${mrId}';`);
    expect(ownCount).toBe("1");

    // 다른 household(b)의 보호자는 이 상담 신청 건을 조회할 수 없다.
    const crossCount = psqlAsUser(b.guardianId, `select count(*) from meeting_request_messages where meeting_request_id = '${mrId}';`);
    expect(crossCount).toBe("0");

    // 다른 household(b)의 보호자는 이 상담 신청 건에 메시지를 쓸 수도 없다.
    expect(() =>
      psqlAsUser(
        b.guardianId,
        `insert into meeting_request_messages (meeting_request_id, sender_id, sender_role, body) values ('${mrId}', '${b.guardianId}', 'guardian', '남의 집 상담에 메시지');`
      )
    ).toThrow();
  });

  it("자녀(학생) 계정은 부모의 상담 신청 대화를 조회하거나 쓸 수 없다", () => {
    const a = setupHousehold("mrm-child");
    const mrId = createMeetingRequest(a.householdId, a.guardianId);
    psqlAsUser(
      a.guardianId,
      `insert into meeting_request_messages (meeting_request_id, sender_id, sender_role, body) values ('${mrId}', '${a.guardianId}', 'guardian', '문의합니다');`
    );

    const childVisibleCount = psqlAsUser(a.childId, `select count(*) from meeting_request_messages where meeting_request_id = '${mrId}';`);
    expect(childVisibleCount).toBe("0");

    expect(() =>
      psqlAsUser(
        a.childId,
        `insert into meeting_request_messages (meeting_request_id, sender_id, sender_role, body) values ('${mrId}', '${a.childId}', 'guardian', '자녀가 쓴 메시지');`
      )
    ).toThrow();
  });

  it("교사 계정은 상담 신청 대화를 조회하거나 쓸 수 없다", () => {
    const a = setupHousehold("mrm-teacher");
    const mrId = createMeetingRequest(a.householdId, a.guardianId);
    psqlAsUser(
      a.guardianId,
      `insert into meeting_request_messages (meeting_request_id, sender_id, sender_role, body) values ('${mrId}', '${a.guardianId}', 'guardian', '문의합니다');`
    );
    const teacherId = createTeacher("mrm-teacher-user");

    const teacherVisibleCount = psqlAsUser(teacherId, `select count(*) from meeting_request_messages where meeting_request_id = '${mrId}';`);
    expect(teacherVisibleCount).toBe("0");

    expect(() =>
      psqlAsUser(
        teacherId,
        `insert into meeting_request_messages (meeting_request_id, sender_id, sender_role, body) values ('${mrId}', '${teacherId}', 'admin', '교사가 쓴 메시지');`
      )
    ).toThrow();
  });

  it("관리자는 모든 household의 상담 신청 대화를 조회·작성할 수 있다", () => {
    const a = setupHousehold("mrm-admin");
    const mrId = createMeetingRequest(a.householdId, a.guardianId);
    const adminId = createAdmin("mrm-admin-user");

    psqlAsUser(
      a.guardianId,
      `insert into meeting_request_messages (meeting_request_id, sender_id, sender_role, body) values ('${mrId}', '${a.guardianId}', 'guardian', '문의합니다');`
    );
    psqlAsUser(
      adminId,
      `insert into meeting_request_messages (meeting_request_id, sender_id, sender_role, body) values ('${mrId}', '${adminId}', 'admin', '답변드립니다');`
    );
    const adminVisibleCount = psqlAsUser(adminId, `select count(*) from meeting_request_messages where meeting_request_id = '${mrId}';`);
    expect(adminVisibleCount).toBe("2");
  });
});

describe("household_message_reads RLS", () => {
  it("보호자는 본인 household의 읽음 기록만 쓰고 볼 수 있다(다른 household는 불가)", () => {
    const a = setupHousehold("hmr-a");
    const b = setupHousehold("hmr-b");

    psqlAsUser(
      a.guardianId,
      `insert into household_message_reads (household_id, viewer_role, last_read_at) values ('${a.householdId}', 'guardian', now());`
    );
    const ownCount = psqlAsUser(a.guardianId, `select count(*) from household_message_reads where household_id = '${a.householdId}';`);
    expect(ownCount).toBe("1");

    // 다른 household(b)의 읽음 기록을 만들 수 없다.
    expect(() =>
      psqlAsUser(
        a.guardianId,
        `insert into household_message_reads (household_id, viewer_role, last_read_at) values ('${b.householdId}', 'guardian', now());`
      )
    ).toThrow();

    // 다른 household(b)의 읽음 기록을 조회할 수도 없다.
    const crossCount = psqlAsUser(a.guardianId, `select count(*) from household_message_reads where household_id = '${b.householdId}';`);
    expect(crossCount).toBe("0");
  });

  it("자녀(학생) 계정은 읽음 기록을 쓸 수 없다", () => {
    const a = setupHousehold("hmr-child");
    expect(() =>
      psqlAsUser(
        a.childId,
        `insert into household_message_reads (household_id, viewer_role, last_read_at) values ('${a.householdId}', 'guardian', now());`
      )
    ).toThrow();
  });

  it("교사 계정은 읽음 기록을 조회·작성할 수 없다", () => {
    const a = setupHousehold("hmr-teacher");
    const teacherId = createTeacher("hmr-teacher-user");
    expect(() =>
      psqlAsUser(
        teacherId,
        `insert into household_message_reads (household_id, viewer_role, last_read_at) values ('${a.householdId}', 'admin', now());`
      )
    ).toThrow();
    const teacherVisibleCount = psqlAsUser(teacherId, `select count(*) from household_message_reads where household_id = '${a.householdId}';`);
    expect(teacherVisibleCount).toBe("0");
  });

  it("관리자는 자신의 role('admin')로 모든 household의 읽음 기록을 쓰고, 전체를 조회할 수 있다", () => {
    const a = setupHousehold("hmr-admin");
    const adminId = createAdmin("hmr-admin-user");

    psqlAsUser(
      adminId,
      `insert into household_message_reads (household_id, viewer_role, last_read_at) values ('${a.householdId}', 'admin', now());`
    );
    const adminOwnRow = psqlAsUser(adminId, `select count(*) from household_message_reads where household_id = '${a.householdId}' and viewer_role = 'admin';`);
    expect(adminOwnRow).toBe("1");

    // 관리자는 viewer_role='guardian'으로는 쓸 수 없다(그 role의 with check가 거부).
    expect(() =>
      psqlAsUser(
        adminId,
        `insert into household_message_reads (household_id, viewer_role, last_read_at) values ('${a.householdId}', 'guardian', now());`
      )
    ).toThrow();
  });
});

describe("meeting_requests — 5단계 상태 확장 후에도 RLS는 그대로 유지된다", () => {
  it("다른 household의 보호자는 5단계로 확장된 상태의 상담 신청도 볼 수 없다", () => {
    const a = setupHousehold("mr5-a");
    const b = setupHousehold("mr5-b");
    const mrId = createMeetingRequest(a.householdId, a.guardianId);
    psqlAsSuperuser(`update meeting_requests set status = 'confirming' where id = '${mrId}';`);

    const visibleToOther = psqlAsUser(b.guardianId, `select count(*) from meeting_requests where id = '${mrId}';`);
    expect(visibleToOther).toBe("0");

    const visibleToOwner = psqlAsUser(a.guardianId, `select status from meeting_requests where id = '${mrId}';`);
    expect(visibleToOwner).toBe("confirming");
  });

  it("보호자는 status를 직접 바꿀 수 없다(관리자만 진행 상태를 바꿀 수 있어야 한다)", () => {
    const a = setupHousehold("mr5-guardian-update");
    const mrId = createMeetingRequest(a.householdId, a.guardianId);
    // update 자체는 정책상 select 필터를 통과하지 못하면 0 rows affected(에러는 안 남).
    psqlAsUser(a.guardianId, `update meeting_requests set status = 'scheduled' where id = '${mrId}';`);
    const statusAfter = psqlAsSuperuser(`select status from meeting_requests where id = '${mrId}';`);
    expect(statusAfter).toBe("requested");
  });
});
