import { execFileSync, spawn } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// 배치 2-4 corrective(20261261000000, 마지막 항목) — bypass_session_lock GUC를
// 전용 테이블 session_invariant_unlock_tokens 1회용 토큰으로 교체한 뒤의 회귀
// 테스트. 대상: prevent_direct_final_status_update(),
// prevent_material_version_reassignment(), reopen_session(). recomplete_session()은
// 이 GUC를 전혀 쓰지 않으므로(별도 corrective가 이미 다른 GUC를 대체) 이 파일의
// 대상이 아니며 건드리지 않는다. psql shell-out 패턴은
// app/admin/account-status-protect-token.integration.test.ts와 동일.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001"; // 기존 admin 프로필
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000002"; // 기존 시드 학생(household 소속)
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000002"; // 기존 시드 선생님
const HOUSEHOLD_ID = "aabbccdd-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001"; // SAT Math

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

// contracts에 "child당 활성 계약 1개" unique 제약(contracts_one_active_per_child)이
// 있어 매 테스트마다 새 계약을 만들 수 없다 — 이 파일 전체가 공유하는 계약/과목
// 등록 1개를 beforeAll에서 한 번만 만들고, 매 테스트는 그 위에 자신만의
// reservation + session만 새로 만든다(세션 잠금 불변식 검증에는 계약/등록 자체가
// 관심사가 아니므로 공유해도 무방 — r8-cutover.integration.test.ts와 달리 이
// 파일은 세션을 여러 개 필요로 하므로 공유 등록 위에 세션만 여러 개 얹는
// 방식을 쓴다).
let SHARED_CONTRACT_ID = "";
let SHARED_ENROLLMENT_ID = "";

beforeAll(() => {
  const ids = psql(`select gen_random_uuid() || '|' || gen_random_uuid();`).split("|");
  [SHARED_CONTRACT_ID, SHARED_ENROLLMENT_ID] = ids;
  psql(`
    insert into contracts (id, household_id, child_id, status)
    values ('${SHARED_CONTRACT_ID}', '${HOUSEHOLD_ID}', '${STUDENT_ID}', 'active');
    insert into subject_enrollments (id, child_id, subject_id, contract_id, status)
    values ('${SHARED_ENROLLMENT_ID}', '${STUDENT_ID}', '${SUBJECT_ID}', '${SHARED_CONTRACT_ID}', 'active');
  `);
});

afterAll(() => {
  psql(`
    delete from subject_enrollments where id = '${SHARED_ENROLLMENT_ID}';
    delete from contract_versions where contract_id = '${SHARED_CONTRACT_ID}';
    delete from contracts where id = '${SHARED_CONTRACT_ID}';
  `);
});

type SessionFixture = {
  sessionId: string;
  reservationId: string;
};

// reservations_no_overlap 제약 때문에 매 fixture마다 서로 겹치지 않는 시간대를
// 써야 한다 — 호출 순서대로 1시간씩 뒤로 미룬 슬롯을 배정한다.
let nextSlotOffsetHours = 0;

function createSessionFixture(finalStatus: string, materialVersionId?: string): SessionFixture {
  const ids = psql(`select gen_random_uuid() || '|' || gen_random_uuid();`).split("|");
  const [reservationId, sessionId] = ids;
  const offset = nextSlotOffsetHours;
  nextSlotOffsetHours += 1;

  // material_version_id는 INSERT 컬럼 목록에 넣는다 — prevent_material_version_reassignment()
  // 트리거는 `before update of material_version_id`에만 걸려 있으므로(최초
  // 배정을 INSERT로 하는 것은 정책상 항상 허용, 20261219000000 주석 참고) 이
  // 값을 가진 fixture를 만드는 데 토큰이 필요 없다.
  const materialVersionColumn = materialVersionId ? `, material_version_id` : "";
  const materialVersionValue = materialVersionId ? `, '${materialVersionId}'` : "";

  psql(`
    insert into reservations (id, kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status)
    values ('${reservationId}', 'lesson', '${SHARED_ENROLLMENT_ID}', '${TEACHER_ID}', now() + interval '${offset} hours' - interval '10 minutes', now() + interval '${offset} hours' + interval '50 minutes', 'confirmed');
    insert into sessions (id, reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes, final_status${materialVersionColumn})
    select '${sessionId}', '${reservationId}', '${SHARED_ENROLLMENT_ID}', '${TEACHER_ID}', id, 60, '${finalStatus}'${materialVersionValue}
    from lesson_types where code = 'regular';
  `);

  return { sessionId, reservationId };
}

function cleanupSessionFixture(fixture: SessionFixture): void {
  psql(`
    delete from session_status_events where session_id = '${fixture.sessionId}';
    delete from sessions where id = '${fixture.sessionId}';
    delete from reservations where id = '${fixture.reservationId}';
  `);
}

function createCurriculumVersion(label: string): string {
  const docId = psql(
    `insert into curriculum_docs (id, title, subject_id, owner_type, status)
     values (gen_random_uuid(), 'session-lock-token-${label}', '${SUBJECT_ID}', 'admin', 'published')
     returning id;`
  );
  const versionId = psql(
    `insert into curriculum_doc_versions (id, curriculum_doc_id, version_number, snapshot)
     values (gen_random_uuid(), '${docId}', 1, '{}'::jsonb)
     returning id;`
  );
  return versionId;
}

describe("prevent_direct_final_status_update() / prevent_material_version_reassignment() / reopen_session() — session_invariant_unlock_tokens 1회용 토큰(corrective 회귀, 배치 2-4)", () => {
  it("① 직접 변경 차단 — 토큰 없이 sessions.final_status를 직접 UPDATE하면 거부된다", () => {
    const fixture = createSessionFixture("completed");
    try {
      expect(() =>
        psql(`update sessions set final_status = 'live' where id = '${fixture.sessionId}';`)
      ).toThrow(/reopen_session\(\)\/recomplete_session\(\)로만/);
    } finally {
      cleanupSessionFixture(fixture);
    }
  });

  it("① 직접 변경 차단 — 토큰 없이 sessions.material_version_id를 직접 UPDATE하면 거부된다", () => {
    const fixture = createSessionFixture("completed");
    const versionId = createCurriculumVersion("direct-block");
    try {
      expect(() =>
        psql(`update sessions set material_version_id = '${versionId}' where id = '${fixture.sessionId}';`)
      ).toThrow(/변경할 수 없습니다/);
    } finally {
      cleanupSessionFixture(fixture);
    }
  });

  it("② 기존 GUC 무효화 — app.bypass_session_lock을 직접 SET해도 새 설계에는 아무 효과가 없다(final_status)", () => {
    const fixture = createSessionFixture("completed");
    try {
      expect(() =>
        psql(`
          set app.bypass_session_lock = 'true';
          update sessions set final_status = 'live' where id = '${fixture.sessionId}';
        `)
      ).toThrow(/reopen_session\(\)\/recomplete_session\(\)로만/);
    } finally {
      cleanupSessionFixture(fixture);
    }
  });

  it("② 기존 GUC 무효화 — app.bypass_session_lock을 직접 SET해도 새 설계에는 아무 효과가 없다(material_version_id)", () => {
    const fixture = createSessionFixture("completed");
    const versionId = createCurriculumVersion("legacy-guc-noop");
    try {
      expect(() =>
        psql(`
          set app.bypass_session_lock = 'true';
          update sessions set material_version_id = '${versionId}' where id = '${fixture.sessionId}';
        `)
      ).toThrow(/변경할 수 없습니다/);
    } finally {
      cleanupSessionFixture(fixture);
    }
  });

  it("③ 임시 테이블 위조 차단 — 세션 로컬 temp table로 위조 토큰을 심어도 거부된다(final_status)", () => {
    const fixture = createSessionFixture("completed");
    try {
      expect(() =>
        psql(`
          create temp table session_invariant_unlock_tokens (
            session_id uuid not null,
            invariant text not null,
            xact_id bigint not null default txid_current(),
            created_at timestamptz not null default now()
          );
          begin;
          insert into session_invariant_unlock_tokens (session_id, invariant, xact_id)
          values ('${fixture.sessionId}', 'final_status', txid_current());
          update sessions set final_status = 'live' where id = '${fixture.sessionId}';
          commit;
        `)
      ).toThrow(/reopen_session\(\)\/recomplete_session\(\)로만/);
    } finally {
      cleanupSessionFixture(fixture);
    }
  });

  it("③ 임시 테이블 위조 차단 — 세션 로컬 temp table로 위조 토큰을 심어도 거부된다(material_version_id)", () => {
    const fixture = createSessionFixture("completed");
    const versionId = createCurriculumVersion("temp-table-attack");
    try {
      expect(() =>
        psql(`
          create temp table session_invariant_unlock_tokens (
            session_id uuid not null,
            invariant text not null,
            xact_id bigint not null default txid_current(),
            created_at timestamptz not null default now()
          );
          begin;
          insert into session_invariant_unlock_tokens (session_id, invariant, xact_id)
          values ('${fixture.sessionId}', 'material_version_id', txid_current());
          update sessions set material_version_id = '${versionId}' where id = '${fixture.sessionId}';
          commit;
        `)
      ).toThrow(/변경할 수 없습니다/);
    } finally {
      cleanupSessionFixture(fixture);
    }
  });

  it("④ 재개방 정상 경로 — reopen_session() 관리자 호출이 completed → live 전이에 성공한다", () => {
    const fixture = createSessionFixture("completed");
    try {
      asUser(ADMIN_ID, `select reopen_session('${fixture.sessionId}'::uuid, '정상 재개방 테스트');`);

      const status = psql(`select final_status from sessions where id = '${fixture.sessionId}';`);
      expect(status).toBe("live");

      const event = psql(
        `select event_type, previous_final_status, new_final_status from session_status_events where session_id = '${fixture.sessionId}';`
      );
      expect(event).toBe("reopened|completed|live");

      const tokenLeft = psql(
        `select count(*) from session_invariant_unlock_tokens where session_id = '${fixture.sessionId}';`
      );
      expect(tokenLeft).toBe("0");
    } finally {
      cleanupSessionFixture(fixture);
    }
  });

  it("⑤ [핵심] 재개방 중 material_version_id 변경 차단 — reopen_session()은 final_status 토큰만 발급하므로, 같은 트랜잭션에서 material_version_id를 바꾸려는 시도는 거부된다(GUC 공유 시절의 교차오염 버그 회귀 증명)", () => {
    // fixture는 이미 material_version_id가 배정된 상태로 만든다(최초 배정은
    // INSERT라 트리거 대상이 아니다) — 그래야 old.material_version_id is not
    // null 조건이 걸려서, reopen_session()이 final_status를 'live'로 먼저
    // 바꿔놓아도(같은 트랜잭션 안에서 old.final_status가 이미 'live'로
    // 보이게 되어 두 번째 조건은 통과하더라도) 첫 번째 조건(이미 배정된
    // material_version_id의 재배정 차단)이 여전히 막는다 — 이것이 바로
    // 공유 GUC 시절 실제로 존재했던 부작용 시나리오(이미 배정된 자료를
    // reopen 트랜잭션 안에서 몰래 바꿔치기)를 정확히 재현한다.
    const originalVersionId = createCurriculumVersion("cross-contamination-original");
    const fixture = createSessionFixture("completed", originalVersionId);
    const versionId = createCurriculumVersion("cross-contamination");
    try {
      // 공유 GUC 시절이었다면 reopen_session()이 켜는 동안 material_version_id
      // 락도 함께 풀려 이 UPDATE가 통과했을 것이다 — 전용 테이블 + invariant
      // 분리 설계에서는 reopen_session()이 'final_status' 토큰만 심으므로
      // 'material_version_id' 토큰이 없어 반드시 거부되어야 한다.
      expect(() =>
        asUser(
          ADMIN_ID,
          `
            select reopen_session('${fixture.sessionId}'::uuid, '교차오염 회귀 테스트');
            update sessions set material_version_id = '${versionId}' where id = '${fixture.sessionId}';
          `
        )
      ).toThrow(/재배정할 수 없습니다/);

      // 트랜잭션 전체가 롤백되므로(psql -c는 세미콜론 여러 문장을 한 트랜잭션으로
      // 묶어 실행하고, 마지막 문장 실패 시 명시적 commit이 없으면 전체가
      // 롤백된다) reopen_session()이 심었던 final_status 전이 자체도 커밋되지
      // 않았어야 한다.
      const status = psql(`select final_status from sessions where id = '${fixture.sessionId}';`);
      expect(status).toBe("completed");

      const tokenLeft = psql(
        `select count(*) from session_invariant_unlock_tokens where session_id = '${fixture.sessionId}';`
      );
      expect(tokenLeft).toBe("0");
    } finally {
      cleanupSessionFixture(fixture);
    }
  });

  it("⑥ 동시 재개방 — 같은 세션에 대한 두 동시 reopen_session() 호출은 정확히 하나만 성공하고 토큰/이벤트가 오염되지 않는다", async () => {
    const fixture = createSessionFixture("completed");

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
            select reopen_session('${fixture.sessionId}'::uuid, '동시 재개방 테스트');
            reset role;
          `,
        ]);
        let output = "";
        child.stdout.on("data", (d) => (output += d.toString()));
        child.stderr.on("data", (d) => (output += d.toString()));
        child.on("close", (code) => resolve({ ok: code === 0, output }));
      });
    }

    try {
      const [first, second] = await Promise.all([callInBackground(), callInBackground()]);
      const results = [first, second];

      // reopen_session()은 이미 `select final_status ... for update`로 대상
      // 세션 행을 잠근다 — 나중에 잠금을 얻은 호출은 이미 'live'로 바뀐 상태를
      // 다시 읽고 "아직 확정되지 않은 세션은 재개방할 필요가 없습니다"로
      // 거부되어야 한다(정확히 하나만 성공).
      const successCount = results.filter((r) => r.ok).length;
      expect(successCount).toBe(1);

      const failed = results.find((r) => !r.ok);
      expect(failed).toBeDefined();
      expect(failed!.output).toMatch(/재개방할 필요가 없습니다/);

      const finalStatus = psql(`select final_status from sessions where id = '${fixture.sessionId}';`);
      expect(finalStatus).toBe("live");

      const eventCount = Number(
        psql(`select count(*) from session_status_events where session_id = '${fixture.sessionId}' and event_type = 'reopened';`)
      );
      expect(eventCount).toBe(1);

      const leftoverTokens = Number(
        psql(`select count(*) from session_invariant_unlock_tokens where session_id = '${fixture.sessionId}';`)
      );
      expect(leftoverTokens).toBe(0);
    } finally {
      cleanupSessionFixture(fixture);
    }
  });

  it("⑦ 실패 시 전체 롤백 — session_status_events INSERT 실패 시 토큰도 final_status UPDATE도 남지 않는다", () => {
    const fixture = createSessionFixture("completed");

    psql(`
      create or replace function force_session_status_event_failure_for_test()
      returns trigger language plpgsql as $$
      begin
        raise exception 'forced failure for session reopen atomicity test';
      end;
      $$;
    `);
    psql(`
      create trigger force_session_status_event_failure
        before insert on session_status_events
        for each row execute function force_session_status_event_failure_for_test();
    `);

    try {
      expect(() =>
        asUser(ADMIN_ID, `select reopen_session('${fixture.sessionId}'::uuid, '원자성 테스트');`)
      ).toThrow(/forced failure/);

      const status = psql(`select final_status from sessions where id = '${fixture.sessionId}';`);
      expect(status).toBe("completed");

      const tokenCount = psql(
        `select count(*) from session_invariant_unlock_tokens where session_id = '${fixture.sessionId}';`
      );
      expect(tokenCount).toBe("0");

      const eventCount = psql(
        `select count(*) from session_status_events where session_id = '${fixture.sessionId}' and event_type = 'reopened';`
      );
      expect(eventCount).toBe("0");
    } finally {
      psql(`drop trigger if exists force_session_status_event_failure on session_status_events;`);
      psql(`drop function if exists force_session_status_event_failure_for_test();`);
      cleanupSessionFixture(fixture);
    }
  });
});
