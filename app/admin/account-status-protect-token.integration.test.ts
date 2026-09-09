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

// 만 13세 미만 학생 — 미성년 동의 게이트 테스트용.
function createMinorStudent(label: string): string {
  const now = Date.now();
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'status-token-minor-${label}-${now}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`
    insert into profiles (id, role, name, date_of_birth) values ('${id}', 'student', '토큰테스트 미성년 학생(${label})', ((now() at time zone 'utc')::date - interval '10 years')::date);
    insert into students (id, grade, status) values ('${id}', '4학년', 'pending');
  `);
  return id;
}

function grantGuardianConsent(studentId: string): void {
  psql(`
    insert into consent_policy_versions (id, version, title, content_hash, effective_from, requires_reconsent)
    select gen_random_uuid(), 'v-status-token-test', '토큰 테스트 정책', 'hash-status-token-test', now() - interval '1 day', false
    where not exists (select 1 from consent_policy_versions where version = 'v-status-token-test');
    insert into guardian_consents (student_id, policy_version_id, consented_by, verification_method)
    select '${studentId}', id, '${ADMIN_ID}', 'test'
    from consent_policy_versions where version = 'v-status-token-test';
  `);
}

// 선생님 활성화 체크리스트(7개 조건)를 전부 충족시킨다 — 정상 pending→active
// 경로와 활성화 게이트 테스트에서 재사용.
function satisfyTeacherActivationChecklist(teacherId: string): void {
  psql(`
    insert into teacher_workspace_provisioning
      (workspace_email, workspace_email_normalized, personal_contact_email, workspace_recovery_email,
       linked_teacher_id, created_by, workspace_created_at, first_login_at, linked_at)
    values
      ('ws-${teacherId}@example.com', lower('ws-${teacherId}@example.com'), 'personal-${teacherId}@example.com',
       'recovery-${teacherId}@example.com', '${teacherId}', '${ADMIN_ID}', now(), now(), now());
    insert into teacher_rate_history (teacher_id, amount_minor, effective_from, created_by)
    values ('${teacherId}', 30000, now() - interval '1 day', '${ADMIN_ID}');
    update teachers set onboarding_completed_at = now() where id = '${teacherId}';
    insert into teacher_contracts (teacher_id, doc_type, status, signed_at)
    values ('${teacherId}', 'contract', 'signed', now());
  `);
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

  it("⑤ 동시성 — 서로 다른 프로필의 동시 전이는 계속 독립적으로 성공한다(false serialization 없음)", async () => {
    const studentA = createAdultStudent("concurrency-a");
    const teacherB = createTeacher("concurrency-b");
    satisfyTeacherActivationChecklist(teacherB);

    function callInBackground(profileId: string, newStatus: string): Promise<{ ok: boolean; output: string }> {
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
            select transition_account_status('${profileId}'::uuid, '${newStatus}', '동시 호출 테스트(서로 다른 행)');
            reset role;
          `,
        ]);
        let output = "";
        child.stdout.on("data", (d) => (output += d.toString()));
        child.stderr.on("data", (d) => (output += d.toString()));
        child.on("close", (code) => resolve({ ok: code === 0, output }));
      });
    }

    const [resA, resB] = await Promise.all([
      callInBackground(studentA, "active"),
      callInBackground(teacherB, "active"),
    ]);

    expect(resA.ok).toBe(true);
    expect(resB.ok).toBe(true);

    expect(psql(`select status from students where id = '${studentA}';`)).toBe("active");
    expect(psql(`select status from teachers where id = '${teacherB}';`)).toBe("active");

    const eventsA = Number(psql(`select count(*) from account_status_events where profile_id = '${studentA}';`));
    const eventsB = Number(psql(`select count(*) from account_status_events where profile_id = '${teacherB}';`));
    expect(eventsA).toBe(1);
    expect(eventsB).toBe(1);

    const leftoverTokens = Number(
      psql(`select count(*) from status_transition_tokens where row_id in ('${studentA}', '${teacherB}');`)
    );
    expect(leftoverTokens).toBe(0);
  });

  it("⑤ 동시성 — 같은 행에 대한 동시 pending→active 호출은 정확히 하나만 성공하고 이벤트/토큰이 오염되지 않는다(corrective: FOR UPDATE 행 잠금)", async () => {
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

    // (corrective) 행 잠금(FOR UPDATE) + 잠금 후 재검증 덕분에, 나중에 잠금을
    // 얻은 호출은 이미 'active'로 바뀐 상태를 다시 읽고 "허용되지 않는 상태
    // 전이입니다"로 명확히 거부된다 — 정확히 하나만 성공해야 한다(이전
    // 버전처럼 둘 다 성공하는 경우는 더 이상 없다).
    const successCount = results.filter((r) => r.ok).length;
    expect(successCount).toBe(1);

    const failed = results.find((r) => !r.ok);
    expect(failed).toBeDefined();
    expect(failed!.output).toMatch(/허용되지 않는 상태 전이입니다/);

    const finalStatus = psql(`select status from students where id = '${studentId}';`);
    expect(finalStatus).toBe("active");

    // 상태 이벤트 정확히 1건 — 이중 기록 없음.
    const eventCount = Number(psql(`select count(*) from account_status_events where profile_id = '${studentId}';`));
    expect(eventCount).toBe(1);

    // 토큰 잔존 0건 — 실패한 호출은 잠금+재검증이 토큰 INSERT보다 먼저
    // 일어나므로 애초에 토큰을 INSERT하지 못한 채 예외로 실패한다. 성공한
    // 호출이 INSERT한 토큰은 protect_account_status() 트리거가 UPDATE
    // 시점에 소비한다.
    const leftoverTokens = Number(psql(`select count(*) from status_transition_tokens where row_id = '${studentId}';`));
    expect(leftoverTokens).toBe(0);
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

  // transition_account_status()의 v_valid 목록(20261257000000)에 있는 10개
  // 전이 전부를 각자의 유효한 시작 상태에서 실제로 호출해 증명한다.
  describe("⑦ 허용된 10개 상태 전이 전부", () => {
    const cases: Array<{ from: string; to: string }> = [
      { from: "pending", to: "active" },
      { from: "pending", to: "inactive" },
      { from: "active", to: "suspended" },
      { from: "suspended", to: "active" },
      { from: "active", to: "closure_pending" },
      { from: "suspended", to: "closure_pending" },
      { from: "closure_pending", to: "closed" },
      { from: "active", to: "inactive" },
      { from: "suspended", to: "inactive" },
      { from: "inactive", to: "active" },
    ];

    it.each(cases)("$from → $to", ({ from, to }) => {
      const parentId = createParent(`transition-${from}-${to}`, from);

      asUser(ADMIN_ID, `select transition_account_status('${parentId}'::uuid, '${to}', '전이 목록 검증');`);

      const status = psql(`select status from parents where id = '${parentId}';`);
      expect(status).toBe(to);

      const event = psql(
        `select previous_status, new_status from account_status_events where profile_id = '${parentId}';`
      );
      expect(event).toBe(`${from}|${to}`);
    });
  });

  // 13세 미만 학생 → active 게이트: is_under_13() && !has_valid_guardian_consent().
  describe("⑧ 미성년 동의 게이트", () => {
    it("유효한 보호자 동의 없이 13세 미만 학생을 active로 전환하면 거부된다", () => {
      const minorId = createMinorStudent("no-consent");

      expect(() =>
        asUser(ADMIN_ID, `select transition_account_status('${minorId}'::uuid, 'active', '동의 없음 테스트');`)
      ).toThrow(/13세 미만 학생은 유효한 보호자 동의 없이/);

      const status = psql(`select status from students where id = '${minorId}';`);
      expect(status).toBe("pending");
    });

    it("유효한 보호자 동의가 있으면 13세 미만 학생도 active로 전환할 수 있다", () => {
      const minorId = createMinorStudent("with-consent");
      grantGuardianConsent(minorId);

      asUser(ADMIN_ID, `select transition_account_status('${minorId}'::uuid, 'active', '동의 있음 테스트');`);

      const status = psql(`select status from students where id = '${minorId}';`);
      expect(status).toBe("active");
    });
  });

  // 선생님 활성화 게이트: get_teacher_activation_checklist()의 7개 조건이
  // 전부 satisfied여야 pending → active가 허용된다.
  describe("⑨ 선생님 활성화 게이트", () => {
    it("활성화 선행조건이 충족되지 않으면 거부된다", () => {
      const teacherId = createTeacher("activation-gate-unmet");

      expect(() =>
        asUser(ADMIN_ID, `select transition_account_status('${teacherId}'::uuid, 'active', '선행조건 미충족 테스트');`)
      ).toThrow(/선생님 활성화 선행조건이 충족되지 않았습니다/);

      const status = psql(`select status from teachers where id = '${teacherId}';`);
      expect(status).toBe("pending");
    });

    it("활성화 선행조건 7개를 모두 충족하면 active로 전환할 수 있다", () => {
      const teacherId = createTeacher("activation-gate-met");
      satisfyTeacherActivationChecklist(teacherId);

      asUser(ADMIN_ID, `select transition_account_status('${teacherId}'::uuid, 'active', '선행조건 충족 테스트');`);

      const status = psql(`select status from teachers where id = '${teacherId}';`);
      expect(status).toBe("active");
    });
  });
});
