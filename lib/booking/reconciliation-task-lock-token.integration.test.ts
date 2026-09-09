import { execFileSync, spawn } from "node:child_process";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

// 배치 2-3 corrective(20261259000000) — bypass_reconciliation_task_lock GUC를
// status_transition_tokens 1회용 토큰으로 교체한 뒤의 회귀 테스트. 대상은
// reconciliation_task_update_guard() 트리거 + resolve_session_reconciliation_task() +
// set_reconciliation_task_student_cancelled_disposition() + recomplete_session()
// (이전 pending 대사 작업을 superseded로 전환하는 부분만)뿐이다. psql shell-out
// 패턴은 lib/booking/session-final-judgment.integration.test.ts와 동일 —
// bookSession()/reopen_session()/recomplete_session() 조합으로 pending 대사
// 작업을 만든다. 다른 통합 테스트 파일과의 teacher_availability_rules 레이스를
// 피하기 위해 이 파일 전용 신규 선생님(99999999-...-001)을 쓴다(기존 파일들의
// 코멘트에 문서화된 것과 동일한 원칙).

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const TEACHER_ID = "99999999-0000-0000-0000-000000000001"; // 이 파일 전용
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001"; // SAT Math
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

function asAdmin(sql: string): string {
  return psql(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
    ${sql}
    reset role;
  `);
}

// asAdmin()은 set_config()도 SELECT라 그 반환값(설정된 값 자체)까지 출력에 섞인다 —
// 실제 호출 결과값이 필요할 때는 마지막 비어있지 않은 줄만 취한다.
function lastLine(output: string): string {
  const lines = output.split("\n").filter((l) => l.trim().length > 0);
  return lines[lines.length - 1]?.trim() ?? "";
}

let childId: string;
let subjectEnrollmentId: string;
let regularLessonTypeId: string;
let regularProductId: string;

function grantRegularEntitlement(): string {
  const grantId = psql(
    `insert into entitlement_grants (child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at, is_paid)
     values ('${childId}', '${regularProductId}', null, 1, now() + interval '90 days', true) returning id;`
  );
  psql(
    `insert into entitlement_ledger (grant_id, event_type, amount, business_event_id) values ('${grantId}', 'grant', 1, 'reconc-lock-grant-${Date.now()}-${grantId}');`
  );
  return grantId;
}

const FIXED_BOOKING_HOUR_UTC = 17;

function bookSession(daysFromNow: number, durationMinutes: number): { reservationId: string; sessionId: string } {
  const startsAtDate = new Date();
  startsAtDate.setUTCDate(startsAtDate.getUTCDate() + daysFromNow);
  startsAtDate.setUTCHours(FIXED_BOOKING_HOUR_UTC, 0, 0, 0);
  const startsAt = startsAtDate.toISOString();
  const endsAt = new Date(startsAtDate.getTime() + durationMinutes * 60000).toISOString();
  const row = psql(
    `select reservation_id, session_id from confirm_lesson_booking('${childId}', '${subjectEnrollmentId}', '${TEACHER_ID}', '${regularLessonTypeId}', '${startsAt}', '${endsAt}', 'reconc-lock-book-${Date.now()}-${Math.random()}');`
  );
  const [reservationId, sessionId] = row.split("|");
  return { reservationId, sessionId };
}

// completed로 확정한 뒤 reopen+recomplete(teacher_no_show)까지 마쳐서 pending 대사
// 작업 1건(consume→release, required=+1)이 만들어진 상태로 되돌려주는 공용 헬퍼.
function setupPendingTask(daysFromNow: number): { sessionId: string; reservationId: string; grantId: string; taskId: string } {
  grantRegularEntitlement();
  const { sessionId, reservationId } = bookSession(daysFromNow, 120);
  psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
  psql(
    `update reservations set starts_at = starts_at - interval '365 days', ends_at = ends_at - interval '365 days' where id = (select reservation_id from sessions where id = '${sessionId}');`
  );
  psql(`select finalize_lesson_session('${sessionId}', 'completed', '${TEACHER_ID}', '완료(오판정)');`);
  const grantId = psql(`select grant_id from entitlement_ledger where reservation_id = '${reservationId}' and event_type = 'hold';`);

  asAdmin(`
    select reopen_session('${sessionId}', '재검토 필요');
    select recomplete_session('${sessionId}', 'teacher_no_show', '실제로는 선생님 노쇼였음');
  `);
  const taskId = psql(`select id from session_judgment_reconciliation_tasks where session_id = '${sessionId}' and status = 'pending';`);
  return { sessionId, reservationId, grantId, taskId };
}

beforeAll(() => {
  regularLessonTypeId = psql(`select id from lesson_types where code = 'regular';`);
  regularProductId = psql(`select id from entitlement_products where code = 'lesson_pack_10';`);

  const now = Date.now();
  const authEmail = `reconc-lock-integration-${now}@example.com`;
  childId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${authEmail}', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`
    insert into profiles (id, role, name) values ('${childId}', 'student', '대사토큰 통합테스트 학생');
    insert into students (id, grade, status) values ('${childId}', '10학년', 'active');
  `);

  const householdId = psql(`insert into households (primary_guardian_id) values (null) returning id;`);
  psql(
    `insert into household_members (household_id, profile_id, role, is_primary)
     values ('${householdId}', '${childId}', 'child', true);`
  );
  const contractId = psql(
    `insert into contracts (household_id, child_id, status) values ('${householdId}', '${childId}', 'draft') returning id;`
  );
  subjectEnrollmentId = psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status)
     values ('${childId}', '${SUBJECT_ID}', '${contractId}', 'planned') returning id;`
  );

  psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', '${TEACHER_ID}', 'authenticated', 'authenticated', 'reconc-lock-teacher-${now}@example.com', 'x', now(), '{}', '{}', now(), now())
     on conflict (id) do nothing;`
  );
  psql(`insert into profiles (id, role, name) values ('${TEACHER_ID}', 'teacher', '대사토큰 통합테스트 선생님') on conflict (id) do nothing;`);
  psql(`select set_teacher_rate('${TEACHER_ID}', 3000000, 'KRW', now() - interval '1 day');`);
  psql(`insert into teachers (id, status) values ('${TEACHER_ID}', 'active') on conflict (id) do nothing;`);
  psql(
    `insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from, source)
     values ('${subjectEnrollmentId}', '${TEACHER_ID}', 'active', now() - interval '1 day', 'app');`
  );
  psql(
    `insert into teacher_availability_rules (teacher_id, day_of_week, start_time_local, end_time_local, timezone, created_by)
     select '${TEACHER_ID}', d, '00:00', '23:59', 'America/Los_Angeles', '${ADMIN_ID}' from generate_series(0,6) d;`
  );
});

afterAll(() => {
  psql(`delete from teacher_availability_rules where teacher_id = '${TEACHER_ID}' and created_by = '${ADMIN_ID}';`);
});

describe("reconciliation_task_update_guard() — status_transition_tokens 1회용 토큰(corrective 회귀)", () => {
  it("① 정상 경로 — resolve_session_reconciliation_task() resolved 분기(전제 일치)", () => {
    const { taskId, grantId } = setupPendingTask(10);
    const balanceBefore = Number(psql(`select coalesce(sum(amount),0) from entitlement_ledger where grant_id = '${grantId}';`));

    const result = lastLine(asAdmin(`select resolve_session_reconciliation_task('${taskId}', '정상 반영');`));
    expect(result).toBe("resolved");

    const status = psql(`select status from session_judgment_reconciliation_tasks where id = '${taskId}';`);
    expect(status).toBe("resolved");

    const balanceAfter = Number(psql(`select coalesce(sum(amount),0) from entitlement_ledger where grant_id = '${grantId}';`));
    expect(balanceAfter).toBe(balanceBefore + 1);

    const tokenLeft = Number(
      psql(`select count(*) from status_transition_tokens where table_name = 'session_judgment_reconciliation_tasks' and row_id = '${taskId}';`)
    );
    expect(tokenLeft).toBe(0);
  });

  it("① 정상 경로 — resolve_session_reconciliation_task() needs_review 분기(작업 생성 이후 다른 adjust 존재)", () => {
    const { taskId, grantId } = setupPendingTask(11);
    // 작업 생성 이후 같은 grant에 다른 경로(예: 수동 조정)로 adjust가 이미
    // 적용됐다고 가정 — 저장된 조정량이 더 이상 유효하지 않으므로 반영을
    // 거부하고 needs_review로 전환해야 한다(entitlement_ledger는 INSERT-only라
    // 직접 INSERT 자체는 허용된다 — UPDATE/DELETE만 reject_ledger_mutation()이 막는다).
    psql(
      `insert into entitlement_ledger (grant_id, event_type, amount, business_event_id) values ('${grantId}', 'adjust', -1, 'reconc-lock-manual-adjust-${Date.now()}');`
    );

    const result = lastLine(asAdmin(`select resolve_session_reconciliation_task('${taskId}', '전제 재확인');`));
    expect(result).toBe("needs_review");
    const status = psql(`select status from session_judgment_reconciliation_tasks where id = '${taskId}';`);
    expect(status).toBe("needs_review");

    const tokenLeft = Number(
      psql(`select count(*) from status_transition_tokens where table_name = 'session_judgment_reconciliation_tasks' and row_id = '${taskId}';`)
    );
    expect(tokenLeft).toBe(0);
  });

  it("① 정상 경로 — set_reconciliation_task_student_cancelled_disposition()", () => {
    grantRegularEntitlement();
    const { sessionId } = bookSession(12, 120);
    psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
    psql(
      `update reservations set starts_at = starts_at - interval '365 days', ends_at = ends_at - interval '365 days' where id = (select reservation_id from sessions where id = '${sessionId}');`
    );
    psql(`select finalize_lesson_session('${sessionId}', 'completed', '${TEACHER_ID}', '완료(오판정)');`);
    asAdmin(`
      select reopen_session('${sessionId}', '재검토 필요');
      select recomplete_session('${sessionId}', 'student_cancelled', '실제로는 학생 취소였음(취소 기록 없음)');
    `);
    const taskId = psql(`select id from session_judgment_reconciliation_tasks where session_id = '${sessionId}' and status = 'pending';`);
    // 취소 기록이 없으므로 자동 판정 실패 — expected_entitlement_disposition은 null이어야 한다.
    const expectedBefore = psql(`select coalesce(expected_entitlement_disposition, 'null') from session_judgment_reconciliation_tasks where id = '${taskId}';`);
    expect(expectedBefore).toBe("null");

    asAdmin(`select set_reconciliation_task_student_cancelled_disposition('${taskId}', 'release', '취소 기록 없어 수동 선택');`);
    const [disposition, reason] = psql(
      `select expected_entitlement_disposition, admin_disposition_reason from session_judgment_reconciliation_tasks where id = '${taskId}';`
    ).split("|");
    expect(disposition).toBe("release");
    expect(reason).toBe("취소 기록 없어 수동 선택");

    const tokenLeft = Number(
      psql(`select count(*) from status_transition_tokens where table_name = 'session_judgment_reconciliation_tasks' and row_id = '${taskId}';`)
    );
    expect(tokenLeft).toBe(0);
  });

  it("② 직접 UPDATE 거부 — 토큰 없이 status를 직접 바꾸면 거부된다", () => {
    const { taskId } = setupPendingTask(13);
    expect(() => psql(`update session_judgment_reconciliation_tasks set status = 'resolved' where id = '${taskId}';`)).toThrow(
      /지정된 함수를 통해서만/
    );
    const status = psql(`select status from session_judgment_reconciliation_tasks where id = '${taskId}';`);
    expect(status).toBe("pending");
  });

  it("② 직접 DELETE 거부 — GUC/토큰 상태와 무관하게 항상 거부된다", () => {
    const { taskId } = setupPendingTask(14);
    // 유효한 supersede 토큰을 심어도 DELETE 자체는 별개 트리거(GUC 무관하게 항상 거부)로 막힌다.
    psql(
      `insert into status_transition_tokens (table_name, row_id, action) values ('session_judgment_reconciliation_tasks', '${taskId}', 'reconciliation_task_supersede');`
    );
    expect(() => psql(`delete from session_judgment_reconciliation_tasks where id = '${taskId}';`)).toThrow(
      /resolve_session_reconciliation_task\(\)를 통해서만/
    );
    const stillExists = Number(psql(`select count(*) from session_judgment_reconciliation_tasks where id = '${taskId}';`));
    expect(stillExists).toBe(1);
  });

  it("③ 레거시 GUC 무효화 — app.bypass_reconciliation_task_lock을 직접 SET해도 효과 없음", () => {
    const { taskId } = setupPendingTask(15);
    expect(() =>
      psql(`
        select set_config('app.bypass_reconciliation_task_lock', 'true', false);
        update session_judgment_reconciliation_tasks set status = 'resolved' where id = '${taskId}';
      `)
    ).toThrow(/지정된 함수를 통해서만/);
    const status = psql(`select status from session_judgment_reconciliation_tasks where id = '${taskId}';`);
    expect(status).toBe("pending");
  });

  it("④ 임시 테이블 위조 차단 — 동명 temp status_transition_tokens에 위조 토큰을 심어도 거부된다", () => {
    const { taskId } = setupPendingTask(16);
    expect(() =>
      psql(`
        create temp table status_transition_tokens (table_name text, row_id uuid, action text, xact_id bigint, created_at timestamptz);
        insert into status_transition_tokens (table_name, row_id, action, xact_id) values
          ('session_judgment_reconciliation_tasks', '${taskId}', 'reconciliation_task_resolve', txid_current());
        update session_judgment_reconciliation_tasks set status = 'resolved' where id = '${taskId}';
      `)
    ).toThrow(/지정된 함수를 통해서만/);
    const status = psql(`select status from session_judgment_reconciliation_tasks where id = '${taskId}';`);
    expect(status).toBe("pending");
  });

  it("④' 다른 action 값(needs_review) 토큰만으로는 superseded 전이를 열 수 없다", () => {
    const { taskId } = setupPendingTask(17);
    psql(
      `insert into status_transition_tokens (table_name, row_id, action) values ('session_judgment_reconciliation_tasks', '${taskId}', 'reconciliation_task_needs_review');`
    );
    expect(() => psql(`update session_judgment_reconciliation_tasks set status = 'superseded' where id = '${taskId}';`)).toThrow(
      /지정된 함수를 통해서만/
    );
    const status = psql(`select status from session_judgment_reconciliation_tasks where id = '${taskId}';`);
    expect(status).toBe("pending");
    // 소비되지 않은(다른 action) 토큰은 남아 있어야 한다 — 이 트리거가 그 토큰을 삭제하지 않았음을 확인.
    const leftoverWrongToken = Number(
      psql(
        `select count(*) from status_transition_tokens where table_name = 'session_judgment_reconciliation_tasks' and row_id = '${taskId}' and action = 'reconciliation_task_needs_review';`
      )
    );
    expect(leftoverWrongToken).toBe(1);
    psql(`delete from status_transition_tokens where row_id = '${taskId}';`);
  });

  it("⑤ 다건 pending 작업 — 같은 세션에 여러 pending 작업이 걸려 있으면 recomplete_session()이 행마다 개별 토큰을 발급·소비한다", () => {
    const { sessionId, taskId: firstTaskId } = setupPendingTask(20);
    // 실제로는 세션당 pending이 보통 1건이지만, 다건 케이스를 재현하기 위해
    // 같은 세션에 pending 대사 작업 2건을 추가로 직접 INSERT한다(INSERT는
    // reconciliation_task_update_guard()의 대상이 아니므로 토큰 없이도 허용됨 —
    // 이 트리거는 UPDATE만 가드한다).
    const extraTaskId1 = psql(`
      insert into session_judgment_reconciliation_tasks (session_id, prior_final_status, new_final_status, reason)
      values ('${sessionId}', 'completed', 'teacher_no_show', '다건 케이스 재현용 추가 pending 1')
      returning id;
    `);
    const extraTaskId2 = psql(`
      insert into session_judgment_reconciliation_tasks (session_id, prior_final_status, new_final_status, reason)
      values ('${sessionId}', 'completed', 'teacher_no_show', '다건 케이스 재현용 추가 pending 2')
      returning id;
    `);
    const pendingCountBefore = Number(
      psql(`select count(*) from session_judgment_reconciliation_tasks where session_id = '${sessionId}' and status = 'pending';`)
    );
    expect(pendingCountBefore).toBe(3); // 원 작업 1 + 추가 2

    asAdmin(`
      select reopen_session('${sessionId}', '재검토2 — 다건 supersede 재현');
      select recomplete_session('${sessionId}', 'student_no_show', '2차 재판정 — 다건 supersede');
    `);

    const supersededIds = psql(
      `select string_agg(id::text, ',' order by id) from session_judgment_reconciliation_tasks where id in ('${firstTaskId}','${extraTaskId1}','${extraTaskId2}') and status = 'superseded';`
    );
    expect(new Set(supersededIds.split(","))).toEqual(new Set([firstTaskId, extraTaskId1, extraTaskId2]));

    // 행마다 정확히 자기 몫의 토큰 1건씩 발급·소비됐는지 — 소비 후 남은 토큰은 0이어야 한다.
    const leftoverTokens = Number(
      psql(
        `select count(*) from status_transition_tokens where table_name = 'session_judgment_reconciliation_tasks' and row_id in ('${firstTaskId}','${extraTaskId1}','${extraTaskId2}');`
      )
    );
    expect(leftoverTokens).toBe(0);

    // 새 재판정 결과를 반영하는 새 pending 작업이 정확히 1건 생성됐다(3건을 superseded로
    // 전환한 것과 무관하게 이 함수는 항상 새 작업을 1건만 INSERT한다).
    const newPendingCount = Number(
      psql(`select count(*) from session_judgment_reconciliation_tasks where session_id = '${sessionId}' and status = 'pending';`)
    );
    expect(newPendingCount).toBe(1);
  });

  it("⑥ 정산 원장 반영 실패 시 전체 롤백 — resolve_session_reconciliation_task()가 adjust_entitlement() 이후, status UPDATE 이전에 실패하면 토큰/status/entitlement_ledger 전부 롤백된다", () => {
    const { taskId, grantId } = setupPendingTask(21);
    const balanceBefore = Number(psql(`select coalesce(sum(amount),0) from entitlement_ledger where grant_id = '${grantId}';`));

    psql(`
      create or replace function force_reconciliation_resolve_failure_for_test()
      returns trigger language plpgsql as $$
      begin
        if new.status = 'resolved' then
          raise exception 'forced failure for reconciliation resolve atomicity test';
        end if;
        return new;
      end;
      $$;
    `);
    psql(`
      create trigger force_reconciliation_resolve_failure
        before update on session_judgment_reconciliation_tasks
        for each row execute function force_reconciliation_resolve_failure_for_test();
    `);

    try {
      expect(() => asAdmin(`select resolve_session_reconciliation_task('${taskId}', '강제 실패 테스트');`)).toThrow(
        /forced failure/
      );

      const status = psql(`select status from session_judgment_reconciliation_tasks where id = '${taskId}';`);
      expect(status).toBe("pending"); // status UPDATE 자체가 롤백됨

      const tokenCount = Number(
        psql(`select count(*) from status_transition_tokens where table_name = 'session_judgment_reconciliation_tasks' and row_id = '${taskId}';`)
      );
      expect(tokenCount).toBe(0); // 토큰 INSERT도 같은 트랜잭션이므로 함께 롤백

      const balanceAfter = Number(psql(`select coalesce(sum(amount),0) from entitlement_ledger where grant_id = '${grantId}';`));
      expect(balanceAfter).toBe(balanceBefore); // adjust_entitlement()의 entitlement_ledger 행까지 롤백
    } finally {
      psql(`drop trigger if exists force_reconciliation_resolve_failure on session_judgment_reconciliation_tasks;`);
      psql(`drop function if exists force_reconciliation_resolve_failure_for_test();`);
    }
  });

  it("⑦ 경합 결과 A — recomplete_session()이 먼저 잠금을 잡으면 superseded로 전이되고, 뒤이은 resolve_session_reconciliation_task()는 명시적으로 반려된다", async () => {
    const { sessionId, taskId } = setupPendingTask(22);

    // recomplete_session()의 supersede UPDATE가 실행되는 동안 잠깐 멈춰(pg_sleep)
    // resolve_session_reconciliation_task()의 for update가 그 잠금 뒤에서 대기하도록
    // 강제하는 임시 트리거. 실제 프로덕션 코드는 건드리지 않는다 — 테스트 전용.
    psql(`
      create or replace function delay_reconciliation_supersede_for_test()
      returns trigger language plpgsql as $$
      begin
        if new.status = 'superseded' then
          perform pg_sleep(0.6);
        end if;
        return new;
      end;
      $$;
    `);
    psql(`
      create trigger delay_reconciliation_supersede
        before update on session_judgment_reconciliation_tasks
        for each row execute function delay_reconciliation_supersede_for_test();
    `);

    function runRecomplete(): Promise<{ ok: boolean; output: string }> {
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
            select reopen_session('${sessionId}', '경합 재현');
            select recomplete_session('${sessionId}', 'student_no_show', '경합 결과 A 재현');
            reset role;
          `,
        ]);
        let output = "";
        child.stdout.on("data", (d) => (output += d.toString()));
        child.stderr.on("data", (d) => (output += d.toString()));
        child.on("close", (code) => resolve({ ok: code === 0, output }));
      });
    }

    function runResolve(): Promise<{ ok: boolean; output: string }> {
      return new Promise((resolve) => {
        setTimeout(() => {
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
              select resolve_session_reconciliation_task('${taskId}', '경합 결과 A 재현 — 반영 시도');
              reset role;
            `,
          ]);
          let output = "";
          child.stdout.on("data", (d) => (output += d.toString()));
          child.stderr.on("data", (d) => (output += d.toString()));
          child.on("close", (code) => resolve({ ok: code === 0, output }));
        }, 150); // recomplete_session()이 먼저 잠금을 잡을 시간을 준다.
      });
    }

    try {
      const [recompleteResult, resolveResult] = await Promise.all([runRecomplete(), runResolve()]);
      expect(recompleteResult.ok).toBe(true);
      expect(resolveResult.ok).toBe(false); // 명시적으로 반려(무효 전이) — 조용한 성공/no-op이 아니다.
      expect(resolveResult.output).toMatch(/superseded/);

      const finalStatus = psql(`select status from session_judgment_reconciliation_tasks where id = '${taskId}';`);
      expect(finalStatus).toBe("superseded"); // 이중 전이 없음 — resolved로 바뀌지 않았다.

      const tokenLeft = Number(
        psql(`select count(*) from status_transition_tokens where table_name = 'session_judgment_reconciliation_tasks' and row_id = '${taskId}';`)
      );
      expect(tokenLeft).toBe(0);
    } finally {
      psql(`drop trigger if exists delay_reconciliation_supersede on session_judgment_reconciliation_tasks;`);
      psql(`drop function if exists delay_reconciliation_supersede_for_test();`);
    }
  });

  it("⑧ 경합 결과 B — resolve_session_reconciliation_task()가 먼저 잠금을 잡으면 resolved로 전이되고, 뒤이은 recomplete_session()은 그 행을 건드리지 않은 채 새 대사 작업 행을 INSERT한다", async () => {
    const { sessionId, taskId, grantId } = setupPendingTask(23);
    const balanceBefore = Number(psql(`select coalesce(sum(amount),0) from entitlement_ledger where grant_id = '${grantId}';`));

    psql(`
      create or replace function delay_reconciliation_resolve_for_test()
      returns trigger language plpgsql as $$
      begin
        if new.status = 'resolved' then
          perform pg_sleep(0.6);
        end if;
        return new;
      end;
      $$;
    `);
    psql(`
      create trigger delay_reconciliation_resolve
        before update on session_judgment_reconciliation_tasks
        for each row execute function delay_reconciliation_resolve_for_test();
    `);

    function runResolve(): Promise<{ ok: boolean; output: string }> {
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
            select resolve_session_reconciliation_task('${taskId}', '경합 결과 B 재현 — 먼저 반영');
            reset role;
          `,
        ]);
        let output = "";
        child.stdout.on("data", (d) => (output += d.toString()));
        child.stderr.on("data", (d) => (output += d.toString()));
        child.on("close", (code) => resolve({ ok: code === 0, output }));
      });
    }

    function runRecomplete(): Promise<{ ok: boolean; output: string }> {
      return new Promise((resolve) => {
        setTimeout(() => {
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
              select reopen_session('${sessionId}', '경합 재현');
              select recomplete_session('${sessionId}', 'student_no_show', '경합 결과 B 재현 — 뒤늦은 재판정');
              reset role;
            `,
          ]);
          let output = "";
          child.stdout.on("data", (d) => (output += d.toString()));
          child.stderr.on("data", (d) => (output += d.toString()));
          child.on("close", (code) => resolve({ ok: code === 0, output }));
        }, 150); // resolve_session_reconciliation_task()가 먼저 잠금을 잡을 시간을 준다.
      });
    }

    try {
      const [resolveResult, recompleteResult] = await Promise.all([runResolve(), runRecomplete()]);
      expect(resolveResult.ok).toBe(true);
      expect(recompleteResult.ok).toBe(true); // recomplete_session()은 실패하지 않는다 — 그냥 그 행을 건드리지 않을 뿐.

      // 원래 행은 resolved 그대로 — recomplete_session()이 mutate하지 않았다.
      const [finalStatus, resolvedBy] = psql(
        `select status, resolved_by::text from session_judgment_reconciliation_tasks where id = '${taskId}';`
      ).split("|");
      expect(finalStatus).toBe("resolved");
      expect(resolvedBy).toBe(ADMIN_ID);

      const balanceAfter = Number(psql(`select coalesce(sum(amount),0) from entitlement_ledger where grant_id = '${grantId}';`));
      expect(balanceAfter).toBe(balanceBefore + 1); // resolve의 adjust_entitlement()만 적용됐다.

      // recomplete_session()의 새 재판정 결과를 반영하는 새 행이 별도 id로 INSERT됐다.
      const newTaskRow = psql(
        `select id, status from session_judgment_reconciliation_tasks where session_id = '${sessionId}' and id <> '${taskId}' order by created_at desc limit 1;`
      );
      const [newTaskId, newTaskStatus] = newTaskRow.split("|");
      expect(newTaskId).not.toBe(taskId);
      expect(newTaskStatus).toBe("pending");

      const tokenLeft = Number(
        psql(`select count(*) from status_transition_tokens where table_name = 'session_judgment_reconciliation_tasks' and row_id in ('${taskId}', '${newTaskId}');`)
      );
      expect(tokenLeft).toBe(0);
    } finally {
      psql(`drop trigger if exists delay_reconciliation_resolve on session_judgment_reconciliation_tasks;`);
      psql(`drop function if exists delay_reconciliation_resolve_for_test();`);
    }
  });
});
