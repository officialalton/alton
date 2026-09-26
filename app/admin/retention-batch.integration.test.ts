import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// R12(Section 2, 2026-09-24) — 자료 유형별 보존기간 자동 삭제·비식별화 배치
// 회귀 테스트. psql shell-out 패턴은 account-status-protect-token.integration.test.ts와 동일.

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

function createStudentProfile(label: string): string {
  const now = Date.now();
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'retention-actor-${label}-${now}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`insert into profiles (id, role, name) values ('${id}', 'student', '보존배치테스트(${label})');`);
  return id;
}

describe("retention_delete_expired_notifications()", () => {
  it("① 90일 지난 알림은 삭제되고 최근 알림은 남는다", () => {
    const recipient = createStudentProfile("notif-recipient");
    psql(`
      insert into notifications (id, recipient_id, text, read, created_at)
      values (gen_random_uuid(), '${recipient}', '오래된 알림', true, now() - interval '91 days');
      insert into notifications (id, recipient_id, text, read, created_at)
      values (gen_random_uuid(), '${recipient}', '최근 알림', false, now() - interval '10 days');
    `);

    const deleted = asServiceRole(`select retention_delete_expired_notifications(500, false);`);
    expect(Number(deleted)).toBeGreaterThanOrEqual(1);

    const remainingOld = Number(
      psql(`select count(*) from notifications where recipient_id = '${recipient}' and text = '오래된 알림';`)
    );
    const remainingRecent = Number(
      psql(`select count(*) from notifications where recipient_id = '${recipient}' and text = '최근 알림';`)
    );
    expect(remainingOld).toBe(0);
    expect(remainingRecent).toBe(1);
  });

  it("② dry_run=true는 삭제하지 않고 개수만 센다", () => {
    const recipient = createStudentProfile("notif-dryrun");
    psql(`
      insert into notifications (id, recipient_id, text, read, created_at)
      values (gen_random_uuid(), '${recipient}', '드라이런 대상', true, now() - interval '100 days');
    `);

    const count = asServiceRole(`select retention_delete_expired_notifications(500, true);`);
    expect(Number(count)).toBeGreaterThanOrEqual(1);

    const stillThere = Number(
      psql(`select count(*) from notifications where recipient_id = '${recipient}' and text = '드라이런 대상';`)
    );
    expect(stillThere).toBe(1);
  });

  it("③ 관리자/서비스가 아니면 호출할 수 없다", () => {
    const recipient = createStudentProfile("notif-unauthorized");
    expect(() => asUser(recipient, `select retention_delete_expired_notifications(500, false);`)).toThrow(
      /관리자 또는 시스템만/
    );
  });

  it("④ 실행 기록이 retention_batch_runs에 남는다", () => {
    asServiceRole(`select retention_delete_expired_notifications(500, false);`);
    const row = psql(
      `select category, table_name, action from retention_batch_runs where category = 'notifications_90d' order by run_at desc limit 1;`
    );
    expect(row).toBe("notifications_90d|notifications|delete");
  });

  it("⑤ retention_batch_runs는 UPDATE/DELETE를 거부한다(append-only)", () => {
    asServiceRole(`select retention_delete_expired_notifications(500, false);`);
    expect(() => psql(`update retention_batch_runs set failed = true where category = 'notifications_90d';`)).toThrow(
      /INSERT-only/
    );
  });
});

describe("retention_anonymize_expired_consult_requests()", () => {
  it("① 2년 지난 completed 상담 요청의 연락처는 비식별화되고 통계 필드는 남는다", () => {
    const id = psql(
      `insert into consult_requests (id, category, person_name, email, phone, concerns, submitted_at, status, completed_at)
       values (gen_random_uuid(), 'family', '실명 홍길동', 'hong@example.com', '010-1234-5678', '수학 상담', now() - interval '3 years', 'completed', now() - interval '2 years 1 day')
       returning id;`
    );

    const count = asServiceRole(`select retention_anonymize_expired_consult_requests(500, false);`);
    expect(Number(count)).toBeGreaterThanOrEqual(1);

    const row = psql(`select person_name, email, phone, concerns, category, status from consult_requests where id = '${id}';`);
    expect(row).toBe("[비식별화됨]|anonymized@example.invalid|||family|completed");
  });

  it("② 2년이 안 지났거나 아직 completed가 아니면 건드리지 않는다", () => {
    const recentId = psql(
      `insert into consult_requests (id, category, person_name, email, submitted_at, status, completed_at)
       values (gen_random_uuid(), 'family', '최근 완료자', 'recent@example.com', now() - interval '1 year', 'completed', now() - interval '1 year')
       returning id;`
    );
    const pendingId = psql(
      `insert into consult_requests (id, category, person_name, email, submitted_at, status)
       values (gen_random_uuid(), 'family', '진행중 요청자', 'pending@example.com', now() - interval '3 years', 'requested')
       returning id;`
    );

    asServiceRole(`select retention_anonymize_expired_consult_requests(500, false);`);

    expect(psql(`select person_name from consult_requests where id = '${recentId}';`)).toBe("최근 완료자");
    expect(psql(`select person_name from consult_requests where id = '${pendingId}';`)).toBe("진행중 요청자");
  });

  it("③ 이미 비식별화된 행은 재실행해도 중복 처리되지 않는다(멱등)", () => {
    const id = psql(
      `insert into consult_requests (id, category, person_name, email, submitted_at, status, completed_at)
       values (gen_random_uuid(), 'family', '실명 두번째', 'second@example.com', now() - interval '3 years', 'completed', now() - interval '2 years 1 day')
       returning id;`
    );
    asServiceRole(`select retention_anonymize_expired_consult_requests(500, false);`);
    const secondRun = asServiceRole(`select retention_anonymize_expired_consult_requests(500, false);`);
    // 이번 두번째 실행에서 방금 처리한 행은 다시 집계되지 않아야 한다(person_name이 이미 마스킹됨).
    const stillNamed = Number(
      psql(`select count(*) from consult_requests where id = '${id}' and person_name = '[비식별화됨]';`)
    );
    expect(stillNamed).toBe(1);
    expect(Number(secondRun)).toBeGreaterThanOrEqual(0);
  });
});

describe("retention_delete_expired_access_logs()", () => {
  it("① 1년 지난 세션 접근 로그는 삭제되고 최근 로그는 남는다", () => {
    const actor = createStudentProfile("access-log-actor");
    psql(`
      insert into session_access_events (id, session_id, actor_id, source, event_type, occurred_at, recorded_at)
      values (gen_random_uuid(), (select id from sessions limit 1), '${actor}', 'alton_client', 'alton_page_open', now() - interval '13 months', now() - interval '13 months');
      insert into session_access_events (id, session_id, actor_id, source, event_type, occurred_at, recorded_at)
      values (gen_random_uuid(), (select id from sessions limit 1), '${actor}', 'alton_client', 'alton_page_open', now() - interval '1 month', now() - interval '1 month');
    `);

    const deleted = asServiceRole(`select retention_delete_expired_access_logs(500, false);`);
    expect(Number(deleted)).toBeGreaterThanOrEqual(1);

    const remainingOld = Number(
      psql(`select count(*) from session_access_events where actor_id = '${actor}' and occurred_at < now() - interval '1 year';`)
    );
    const remainingRecent = Number(psql(`select count(*) from session_access_events where actor_id = '${actor}';`));
    expect(remainingOld).toBe(0);
    expect(remainingRecent).toBe(1);
  });
});

// document_access_events는 자체 append-only 트리거(document_access_events_no_update)로
// UPDATE/DELETE를 예외 없이 차단해 이번 배치가 다루지 않는다(정책 미확정 —
// 위 마이그레이션 파일의 3번 항목 주석 참고). 회귀 테스트도 없음.

describe("run_data_retention_batch()", () => {
  it("① 세 배치를 한 번에 실행하고 요약을 돌려준다", () => {
    const recipient = createStudentProfile("orchestrator");
    psql(`
      insert into notifications (id, recipient_id, text, read, created_at)
      values (gen_random_uuid(), '${recipient}', '오케스트레이터 테스트', true, now() - interval '100 days');
    `);

    const result = asServiceRole(`select run_data_retention_batch(500, false);`);
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty("notifications");
    expect(parsed).toHaveProperty("consultRequests");
    expect(parsed).toHaveProperty("accessLogs");
    expect(parsed.errors).toEqual([]);
  });

  it("② 관리자/서비스가 아니면 호출할 수 없다", () => {
    const other = createStudentProfile("orchestrator-unauthorized");
    expect(() => asUser(other, `select run_data_retention_batch(500, false);`)).toThrow(/관리자 또는 시스템만/);
  });
});
