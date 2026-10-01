import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// R12(Section 2, 2026-09-24) — closure_pending 30일 자동 폐쇄
// (close_expired_pending_accounts) + closed 계정 접근 감사
// (record_closed_account_access) 회귀 테스트. psql shell-out 패턴은
// account-status-protect-token.integration.test.ts와 동일.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

function asUser(userId: string, sql: string): string {
  return psql(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${userId}', false);
    ${sql}
    reset role;
  `);
}

function asServiceRole(sql: string): string {
  return psql(`
    set role service_role;
    do $$ begin perform set_config('request.jwt.claim.role', 'service_role', false); end $$;
    ${sql}
    reset role;
  `);
}

function createAdultStudent(label: string, status = "pending"): string {
  const now = Date.now();
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'closure-student-${label}-${now}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`
    insert into profiles (id, role, name, date_of_birth) values ('${id}', 'student', '폐쇄테스트 학생(${label})', ((now() at time zone 'utc')::date - interval '20 years')::date);
    insert into students (id, grade, status) values ('${id}', '5학년', '${status}');
  `);
  return id;
}

describe("close_expired_pending_accounts() / record_closed_account_access()", () => {
  it("① 30일이 지난 closure_pending 계정은 closed로 자동 전환되고 이벤트가 기록된다", () => {
    const studentId = createAdultStudent("expired");
    asUser(ADMIN_ID, `select transition_account_status('${studentId}'::uuid, 'active', '테스트 사전준비');`);
    asUser(ADMIN_ID, `select transition_account_status('${studentId}'::uuid, 'closure_pending', '폐쇄 요청');`);
    // account_status_events는 append-only 트리거가 UPDATE/DELETE를 막지만,
    // 이 테스트는 postgres superuser 세션으로 실행되므로 세션 트리거를 잠시
    // 끄고(session_replication_role) 이벤트 시각만 31일 전으로 되돌린다.
    psql(`
      set session_replication_role = replica;
      update account_status_events set created_at = now() - interval '31 days'
        where profile_id = '${studentId}' and new_status = 'closure_pending';
      set session_replication_role = default;
    `);

    const closedCount = asServiceRole(`select close_expired_pending_accounts();`);
    expect(Number(closedCount)).toBeGreaterThanOrEqual(1);

    const status = psql(`select status from students where id = '${studentId}';`);
    expect(status).toBe("closed");

    const event = psql(
      `select previous_status, new_status, reason from account_status_events where profile_id = '${studentId}' and new_status = 'closed';`
    );
    expect(event).toBe("closure_pending|closed|30일 철회 유예 만료로 자동 폐쇄");
  });

  it("② 30일이 안 지난 closure_pending 계정은 건드리지 않는다", () => {
    const studentId = createAdultStudent("not-yet-expired");
    asUser(ADMIN_ID, `select transition_account_status('${studentId}'::uuid, 'active', '테스트 사전준비');`);
    asUser(ADMIN_ID, `select transition_account_status('${studentId}'::uuid, 'closure_pending', '폐쇄 요청');`);

    asServiceRole(`select close_expired_pending_accounts();`);

    const status = psql(`select status from students where id = '${studentId}';`);
    expect(status).toBe("closure_pending");
  });

  it("③ 이미 closed로 넘어간 계정은 재실행해도 멱등하다(중복 전환·중복 이벤트 없음)", () => {
    const studentId = createAdultStudent("idempotent");
    asUser(ADMIN_ID, `select transition_account_status('${studentId}'::uuid, 'active', '테스트 사전준비');`);
    asUser(ADMIN_ID, `select transition_account_status('${studentId}'::uuid, 'closure_pending', '폐쇄 요청');`);
    psql(`
      set session_replication_role = replica;
      update account_status_events set created_at = now() - interval '31 days'
        where profile_id = '${studentId}' and new_status = 'closure_pending';
      set session_replication_role = default;
    `);
    asServiceRole(`select close_expired_pending_accounts();`);
    const secondRun = asServiceRole(`select close_expired_pending_accounts();`);
    expect(Number(secondRun)).toBe(0);

    const eventCount = Number(
      psql(`select count(*) from account_status_events where profile_id = '${studentId}' and new_status = 'closed';`)
    );
    expect(eventCount).toBe(1);
  });

  it("④ anon/authenticated(일반 사용자)는 close_expired_pending_accounts()를 호출할 수 없다", () => {
    const studentId = createAdultStudent("unauthorized-caller");
    expect(() =>
      asUser(studentId, `select close_expired_pending_accounts();`)
    ).toThrow(/관리자 또는 시스템만/);
  });

  it("⑤ record_closed_account_access — 사유 없이는 기록되지 않는다", () => {
    const studentId = createAdultStudent("access-no-reason");
    asUser(ADMIN_ID, `select transition_account_status('${studentId}'::uuid, 'active', '테스트 사전준비');`);
    asUser(ADMIN_ID, `select transition_account_status('${studentId}'::uuid, 'closure_pending', '폐쇄 요청');`);
    psql(`
      set session_replication_role = replica;
      update account_status_events set created_at = now() - interval '31 days'
        where profile_id = '${studentId}' and new_status = 'closure_pending';
      set session_replication_role = default;
    `);
    asServiceRole(`select close_expired_pending_accounts();`);

    expect(() =>
      asUser(ADMIN_ID, `select record_closed_account_access('${studentId}'::uuid, '');`)
    ).toThrow(/조회 사유를 입력해야 합니다/);

    const accessCount = Number(
      psql(`select count(*) from account_closure_access_events where profile_id = '${studentId}';`)
    );
    expect(accessCount).toBe(0);
  });

  it("⑥ record_closed_account_access — closed가 아닌 계정은 거부된다", () => {
    const studentId = createAdultStudent("access-not-closed");
    expect(() =>
      asUser(ADMIN_ID, `select record_closed_account_access('${studentId}'::uuid, '정상 사유');`)
    ).toThrow(/폐쇄된 계정이 아닙니다/);
  });

  it("⑦ record_closed_account_access — 사유와 함께 호출하면 감사 로그가 남는다", () => {
    const studentId = createAdultStudent("access-ok");
    asUser(ADMIN_ID, `select transition_account_status('${studentId}'::uuid, 'active', '테스트 사전준비');`);
    asUser(ADMIN_ID, `select transition_account_status('${studentId}'::uuid, 'closure_pending', '폐쇄 요청');`);
    psql(`
      set session_replication_role = replica;
      update account_status_events set created_at = now() - interval '31 days'
        where profile_id = '${studentId}' and new_status = 'closure_pending';
      set session_replication_role = default;
    `);
    asServiceRole(`select close_expired_pending_accounts();`);

    asUser(ADMIN_ID, `select record_closed_account_access('${studentId}'::uuid, '법무팀 요청으로 확인');`);

    const row = psql(
      `select profile_id, accessed_by, reason from account_closure_access_events where profile_id = '${studentId}';`
    );
    expect(row).toBe(`${studentId}|${ADMIN_ID}|법무팀 요청으로 확인`);
  });

  it("⑧ account_closure_access_events는 UPDATE/DELETE를 거부한다(append-only)", () => {
    const studentId = createAdultStudent("access-immutable");
    asUser(ADMIN_ID, `select transition_account_status('${studentId}'::uuid, 'active', '테스트 사전준비');`);
    asUser(ADMIN_ID, `select transition_account_status('${studentId}'::uuid, 'closure_pending', '폐쇄 요청');`);
    psql(`
      set session_replication_role = replica;
      update account_status_events set created_at = now() - interval '31 days'
        where profile_id = '${studentId}' and new_status = 'closure_pending';
      set session_replication_role = default;
    `);
    asServiceRole(`select close_expired_pending_accounts();`);
    asUser(ADMIN_ID, `select record_closed_account_access('${studentId}'::uuid, '변경 시도 테스트');`);

    expect(() =>
      psql(`update account_closure_access_events set reason = '조작 시도' where profile_id = '${studentId}';`)
    ).toThrow(/INSERT-only/);
  });
});
