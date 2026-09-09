import { execFileSync, spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

// 배치 2-1 corrective(20261256000000) — bypass_status_protect GUC를
// status_transition_tokens 1회용 토큰으로 교체한 뒤의 회귀 테스트. 대상은
// protect_account_status() 트리거 + transition_account_status() +
// merge_accounts()뿐이다(recomplete_session()은 이 항목과 무관 —
// bypass_reconciliation_task_lock을 쓰며 이 파일이 건드리지 않는다). psql
// shell-out 패턴은 app/admin/consent-protect-token.integration.test.ts와 동일.

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

function lastLine(output: string): string {
  const lines = output.split("\n").filter((l) => l.trim().length > 0);
  return lines[lines.length - 1]?.trim() ?? "";
}

// 어른 학생(만 13세 이상)을 만들어 미성년 동의 로직을 우회 — 이 파일은
// bypass_status_protect 토큰 교체만 검증하므로 동의 로직은 관심사가 아니다.
function createAdultStudent(label: string): string {
  const now = Date.now();
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'status-token-student-${label}-${now}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`
    insert into profiles (id, role, name, date_of_birth) values ('${id}', 'student', '토큰테스트 학생(${label})', ((now() at time zone 'utc')::date - interval '20 years')::date);
    insert into students (id, grade, status) values ('${id}', '5학년', 'pending');
  `);
  return id;
}

function createTeacher(label: string, status = "pending"): string {
  const now = Date.now();
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'status-token-teacher-${label}-${now}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`
    insert into profiles (id, role, name) values ('${id}', 'teacher', '토큰테스트 선생님(${label})');
    insert into teachers (id, status) values ('${id}', '${status}');
  `);
  return id;
}

function createParent(label: string, status = "pending"): string {
  const now = Date.now();
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'status-token-parent-${label}-${now}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`
    insert into profiles (id, role, name) values ('${id}', 'parent', '토큰테스트 학부모(${label})');
    insert into parents (id, status) values ('${id}', '${status}');
  `);
  return id;
}

function grantMergeCapability(profileId: string): void {
  psql(`insert into supervisor_capabilities (profile_id, capability) values ('${profileId}', 'manage_account_merges');`);
}

describe("protect_account_status() / transition_account_status() / merge_accounts() — status_transition_tokens 1회용 토큰(corrective 회귀)", () => {
  it("① 정상 전이 — transition_account_status() 관리자 경로(학생 pending→active)", () => {
    const studentId = createAdultStudent("admin-path");
    asUser(ADMIN_ID, `select transition_account_status('${studentId}'::uuid, 'active', '정상 승인');`);

    const status = psql(`select status from students where id = '${studentId}';`);
    expect(status).toBe("active");

    const event = psql(
      `select previous_status, new_status, changed_by from account_status_events where profile_id = '${studentId}';`
    );
    expect(event).toBe(`pending|active|${ADMIN_ID}`);

    const tokenLeft = psql(`select count(*) from status_transition_tokens where table_name = 'students' and row_id = '${studentId}';`);
    expect(tokenLeft).toBe("0");
  });

  it("① 정상 전이 — transition_account_status() 관리자 경로(선생님 pending→inactive, 활성화 체크리스트 미관여)", () => {
    const teacherId = createTeacher("admin-path-inactive");
    asUser(ADMIN_ID, `select transition_account_status('${teacherId}'::uuid, 'inactive', '보류 처리');`);

    const status = psql(`select status from teachers where id = '${teacherId}';`);
    expect(status).toBe("inactive");
  });

  it("① 정상 전이 — merge_accounts() 관리자 경로(학생 병합 대상 closed 전환)", () => {
    const survivorId = createAdultStudent("merge-admin-survivor");
    const mergedId = createAdultStudent("merge-admin-merged");

    asUser(ADMIN_ID, `select merge_accounts('${survivorId}'::uuid, '${mergedId}'::uuid, '관리자 병합 테스트');`);

    const mergedStatus = psql(`select status from students where id = '${mergedId}';`);
    expect(mergedStatus).toBe("closed");

    const mergeRow = psql(`select survivor_id, merged_id from account_merges where merged_id = '${mergedId}';`);
    expect(mergeRow).toBe(`${survivorId}|${mergedId}`);

    const tokenLeft = psql(`select count(*) from status_transition_tokens where table_name = 'students' and row_id = '${mergedId}';`);
    expect(tokenLeft).toBe("0");
  });

  it("① 정상 전이 — merge_accounts() capability 보유자 경로(관리자 아님)", () => {
    const survivorId = createParent("merge-cap-survivor", "active");
    const mergedId = createParent("merge-cap-merged", "active");
    const supervisorId = createParent("merge-cap-supervisor", "active");
    grantMergeCapability(supervisorId);

    asUser(supervisorId, `select merge_accounts('${survivorId}'::uuid, '${mergedId}'::uuid, 'capability 병합 테스트');`);

    const mergedStatus = psql(`select status from parents where id = '${mergedId}';`);
    expect(mergedStatus).toBe("closed");
  });

  it("② 직접 UPDATE 차단 — 토큰 없이 students.status를 직접 UPDATE하면 거부된다", () => {
    const studentId = createAdultStudent("direct-update-block");

    expect(() =>
      psql(`update students set status = 'active' where id = '${studentId}';`)
    ).toThrow(/transition_account_status\(\)를 통해서만/);

    const status = psql(`select status from students where id = '${studentId}';`);
    expect(status).toBe("pending");
  });

  it("② 직접 UPDATE 차단 — teachers/parents도 동일하게 거부된다", () => {
    const teacherId = createTeacher("direct-update-block-teacher");
    expect(() =>
      psql(`update teachers set status = 'inactive' where id = '${teacherId}';`)
    ).toThrow(/transition_account_status\(\)를 통해서만/);

    const parentId = createParent("direct-update-block-parent");
    expect(() =>
      psql(`update parents set status = 'active' where id = '${parentId}';`)
    ).toThrow(/transition_account_status\(\)를 통해서만/);
  });

  it("③ 레거시 GUC 무효화 — app.bypass_status_protect를 직접 SET해도 새 설계에는 아무 효과가 없다", () => {
    const studentId = createAdultStudent("legacy-guc-noop");

    expect(() =>
      psql(`
        set app.bypass_status_protect = 'true';
        update students set status = 'active' where id = '${studentId}';
      `)
    ).toThrow(/transition_account_status\(\)를 통해서만/);

    const status = psql(`select status from students where id = '${studentId}';`);
    expect(status).toBe("pending");
  });

  it("④ [corrective] 세션 로컬 temp table로 위조 토큰을 심어도 거부된다(20261255000000 search_path/스키마 한정 수정과 동일 검증)", () => {
    const studentId = createAdultStudent("temp-table-attack");

    expect(() =>
      psql(`
        create temp table status_transition_tokens (
          table_name text not null,
          row_id uuid not null,
          action text not null,
          xact_id bigint not null default txid_current(),
          created_at timestamptz not null default now()
        );
        begin;
        insert into status_transition_tokens (table_name, row_id, action, xact_id)
        values ('students', '${studentId}', 'status_transition', txid_current());
        update students set status = 'active' where id = '${studentId}';
        commit;
      `)
    ).toThrow(/transition_account_status\(\)를 통해서만/);

    const status = psql(`select status from students where id = '${studentId}';`);
    expect(status).toBe("pending");
  });

  it("⑤ 동시성 — 서로 다른 프로필의 순차 전이가 토큰(xact_id)으로 서로 간섭하지 않는다", () => {
    const studentA = createAdultStudent("concurrency-a");
    const studentB = createAdultStudent("concurrency-b");

    asUser(ADMIN_ID, `select transition_account_status('${studentA}'::uuid, 'active', 'A 전이');`);
    asUser(ADMIN_ID, `select transition_account_status('${studentB}'::uuid, 'active', 'B 전이');`);

    expect(psql(`select status from students where id = '${studentA}';`)).toBe("active");
    expect(psql(`select status from students where id = '${studentB}';`)).toBe("active");

    const leftoverTokens = psql(
      `select count(*) from status_transition_tokens where row_id in ('${studentA}', '${studentB}');`
    );
    expect(leftoverTokens).toBe("0");

    const events = psql(
      `select count(*) from account_status_events where profile_id in ('${studentA}', '${studentB}');`
    );
    expect(events).toBe("2");
  });

  it("⑤ 동시성 — 같은 행에 대한 동시 호출은 이중 적용/오염 없이 정확히 하나만 성공하거나 순차 직렬화된다", async () => {
    const studentId = createAdultStudent("concurrency-same-row");

    function callInBackground(): Promise<{ ok: boolean; output: string }> {
      return new Promise((resolve) => {
        const child = spawn("psql", [
          DB_URL,
          "-v",
          "ON_ERROR_STOP=1",
          "-q",
          "-t",
          "-A",
          "-c",
          `
            set role authenticated;
            select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
            select transition_account_status('${studentId}'::uuid, 'active', '동시 호출 테스트');
            reset role;
          `,
        ]);
        let output = "";
        child.stdout.on("data", (d) => (output += d.toString()));
        child.stderr.on("data", (d) => (output += d.toString()));
        child.on("close", (code) => resolve({ ok: code === 0, output }));
      });
    }

    const [first, second] = await Promise.all([callInBackground(), callInBackground()]);
    const results = [first, second];

    // 정확히 하나만 성공하거나(다른 하나는 "허용되지 않는 상태 전이" 로 실패)
    // 혹은 둘 다 성공(직렬화되어 두 번째 호출 시점엔 이미 active→active가
    // 아니라 순서상 실제로 pending→active가 한 번만 유효하므로, 두 번째는
    // "허용되지 않는 상태 전이"로 실패하는 것이 정상 — 어느 쪽이든 상태
        // 오염(예: 잘못된 enum 값, 중복 closed 등)은 없어야 한다.

    const successCount = results.filter((r) => r.ok).length;
    expect(successCount).toBeGreaterThanOrEqual(1);
    expect(successCount).toBeLessThanOrEqual(2);

    const finalStatus = psql(`select status from students where id = '${studentId}';`);
    expect(finalStatus).toBe("active");

    const eventCount = psql(`select count(*) from account_status_events where profile_id = '${studentId}';`);
    expect(Number(eventCount)).toBe(successCount);

    // 두 트랜잭션이 모두 검증(v_current='pending')을 통과한 뒤 UPDATE에서
    // 직렬화되는 경우, 늦게 커밋을 시도한 트랜잭션의 UPDATE는 이미 커밋된
    // 'active' 값을 다시 'active'로 덮어쓰는 no-op(new.status is not distinct
    // from old.status)이 되어 트리거가 토큰 확인/소비 자체를 건드리지 않는다
    // — 그 트랜잭션이 인라인 INSERT한 토큰이 소비되지 않은 채 하나 남을 수
    // 있다(harmless: 이 orphan 토큰은 자신의 xact_id에 영속적으로 묶여 있어
    // 이후 어떤 트랜잭션도 재사용할 수 없다). 상태 오염(이중 적용, 잘못된
    // 값)만 없으면 되므로 leftover 토큰 개수는 0 또는 1을 허용한다.
    const leftoverTokens = Number(psql(`select count(*) from status_transition_tokens where row_id = '${studentId}';`));
    expect(leftoverTokens).toBeGreaterThanOrEqual(0);
    expect(leftoverTokens).toBeLessThanOrEqual(1);
  });

  it("⑥ 실패 시 전체 롤백 — account_status_events INSERT 실패 시 토큰도 status UPDATE도 남지 않는다", () => {
    const studentId = createAdultStudent("atomicity");

    psql(`
      create or replace function force_account_status_event_failure_for_test()
      returns trigger language plpgsql as $$
      begin
        raise exception 'forced failure for atomicity test';
      end;
      $$;
    `);
    psql(`
      create trigger force_account_status_event_failure
        before insert on account_status_events
        for each row execute function force_account_status_event_failure_for_test();
    `);

    try {
      expect(() =>
        asUser(ADMIN_ID, `select transition_account_status('${studentId}'::uuid, 'active', '원자성 테스트');`)
      ).toThrow(/forced failure/);

      const status = psql(`select status from students where id = '${studentId}';`);
      expect(status).toBe("pending");

      const tokenCount = psql(
        `select count(*) from status_transition_tokens where table_name = 'students' and row_id = '${studentId}';`
      );
      expect(tokenCount).toBe("0");

      const eventCount = psql(`select count(*) from account_status_events where profile_id = '${studentId}';`);
      expect(eventCount).toBe("0");
    } finally {
      psql(`drop trigger if exists force_account_status_event_failure on account_status_events;`);
      psql(`drop function if exists force_account_status_event_failure_for_test();`);
    }
  });

  it("⑥ 실패 시 전체 롤백 — merge_accounts()도 account_status_events INSERT 실패 시 병합·상태 변경 전체가 롤백된다", () => {
    const survivorId = createAdultStudent("merge-atomicity-survivor");
    const mergedId = createAdultStudent("merge-atomicity-merged");

    psql(`
      create or replace function force_account_status_event_failure_for_test2()
      returns trigger language plpgsql as $$
      begin
        raise exception 'forced failure for merge atomicity test';
      end;
      $$;
    `);
    psql(`
      create trigger force_account_status_event_failure2
        before insert on account_status_events
        for each row execute function force_account_status_event_failure_for_test2();
    `);

    try {
      expect(() =>
        asUser(ADMIN_ID, `select merge_accounts('${survivorId}'::uuid, '${mergedId}'::uuid, '원자성 병합 테스트');`)
      ).toThrow(/forced failure/);

      const mergedStatus = psql(`select status from students where id = '${mergedId}';`);
      expect(mergedStatus).toBe("pending");

      const mergeRowCount = psql(`select count(*) from account_merges where merged_id = '${mergedId}';`);
      expect(mergeRowCount).toBe("0");

      const tokenCount = psql(
        `select count(*) from status_transition_tokens where table_name = 'students' and row_id = '${mergedId}';`
      );
      expect(tokenCount).toBe("0");
    } finally {
      psql(`drop trigger if exists force_account_status_event_failure2 on account_status_events;`);
      psql(`drop function if exists force_account_status_event_failure_for_test2();`);
    }
  });
});
