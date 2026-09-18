import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { beforeAll, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

// 2026-09-18(제품 오너 지시, 2차 정정) — 이전 버전은 route.ts의 SQL을 테스트
// 파일 안에 따로 베껴 써서 검증했는데, 그러면 운영 코드가 바뀌어도 테스트는
// 계속 통과하는 드리프트가 생긴다는 지적을 받았다. 이번 버전은 route.ts가 실제로
// 호출하는 것과 정확히 같은 두 SECURITY DEFINER 함수(claim_smart_notes_generation_
// event, enqueue_smart_notes_reader_grant_task, supabase/migrations/
// 20261414000000)를 이 테스트도 그대로 호출한다 — 이 저장소의 다른 모든
// *.integration.test.ts와 동일하게 psql로 함수를 호출해 실제 Postgres 제약(unique
// index, 원자적 INSERT ... ON CONFLICT DO NOTHING RETURNING)을 검증한다.
//
// 순차 재전송(select-then-upsert)만으로는 "동시(concurrent) 배달" 경합을 막지
// 못한다는 지적도 반영해, 같은 메시지를 정말로 병렬 요청(Promise.all)으로 여러 번
// 동시에 함수 호출해 정확히 1건만 살아남는지 검증한다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

async function psqlAsync(sql: string): Promise<string> {
  const { stdout } = await execFileAsync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  });
  return stdout.trim();
}

const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";

function createSession(): string {
  const now = Date.now();
  const regularLessonTypeId = psql(`select id from lesson_types where code = 'regular';`);
  const authEmail = `m4-webhook-idempotency-${now}-${Math.random().toString(36).slice(2)}@example.com`;
  const childId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${authEmail}', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`
    insert into profiles (id, role, name) values ('${childId}', 'student', 'M4 웹훅 멱등 테스트 학생');
    insert into students (id, grade, status) values ('${childId}', '10학년', 'active');
  `);
  const householdId = psql(`insert into households (primary_guardian_id) values (null) returning id;`);
  psql(`insert into household_members (household_id, profile_id, role, is_primary) values ('${householdId}', '${childId}', 'child', true);`);
  const contractId = psql(
    `insert into contracts (household_id, child_id, status) values ('${householdId}', '${childId}', 'draft') returning id;`
  );
  const subjectEnrollmentId = psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status)
     values ('${childId}', '${SUBJECT_ID}', '${contractId}', 'active') returning id;`
  );
  // booking window/entitlement 규칙과 무관하게 세션 존재만 필요하므로
  // confirm_lesson_booking을 거치지 않는다 — 다른 통합 테스트의 예약 fixture와
  // 시간대 충돌을 피하려고 아주 먼 미래+무작위 오프셋 슬롯을 쓴다.
  const startsAtDate = new Date(now + (365 + Math.floor(Math.random() * 3000)) * 24 * 60 * 60 * 1000);
  const startsAt = startsAtDate.toISOString();
  const endsAt = new Date(startsAtDate.getTime() + 60 * 60000).toISOString();
  const reservationId = psql(
    `insert into reservations (kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status)
     values ('lesson', '${subjectEnrollmentId}', '${TEACHER_ID}', '${startsAt}', '${endsAt}', 'confirmed')
     returning id;`
  );
  return psql(
    `insert into sessions (reservation_id, teacher_id, subject_enrollment_id, lesson_type_id, final_status, scheduled_duration_minutes)
     values ('${reservationId}', '${TEACHER_ID}', '${subjectEnrollmentId}', '${regularLessonTypeId}', 'completed', 60)
     returning id;`
  );
}

/** route.ts가 실제로 호출하는 것과 동일한 RPC. null이 오면 "이미 클레임됨"(중복). */
function claimSmartNotesEvent(params: {
  pubsubMessageId: string;
  sessionId: string;
  driveFileId: string;
}): string {
  return psql(
    `select coalesce(claim_smart_notes_generation_event(
      '${params.pubsubMessageId}', '${params.sessionId}', null, 'test-meeting-code', 'conferenceRecords/test-record',
      '${params.driveFileId}', 'smart_notes_document_generated', true, '{}'::jsonb
    )::text, '');`
  );
}

async function claimSmartNotesEventAsync(params: {
  pubsubMessageId: string;
  sessionId: string;
  driveFileId: string;
}): Promise<string> {
  return psqlAsync(
    `select coalesce(claim_smart_notes_generation_event(
      '${params.pubsubMessageId}', '${params.sessionId}', null, 'test-meeting-code', 'conferenceRecords/test-record',
      '${params.driveFileId}', 'smart_notes_document_generated', true, '{}'::jsonb
    )::text, '');`
  );
}

function enqueueDriveGrant(params: { sessionId: string; driveFileId: string; studentEmail: string }): string {
  return psql(
    `select coalesce(enqueue_smart_notes_reader_grant_task('${params.sessionId}', '${params.driveFileId}', '${params.studentEmail}')::text, '');`
  );
}

async function enqueueDriveGrantAsync(params: { sessionId: string; driveFileId: string; studentEmail: string }): Promise<string> {
  return psqlAsync(
    `select coalesce(enqueue_smart_notes_reader_grant_task('${params.sessionId}', '${params.driveFileId}', '${params.studentEmail}')::text, '');`
  );
}

describe("claim_smart_notes_generation_event/enqueue_smart_notes_reader_grant_task — 순차 재전송 멱등성(실제 Postgres)", () => {
  let sessionId: string;
  let pubsubMessageId: string;

  beforeAll(() => {
    sessionId = createSession();
    pubsubMessageId = `idempotency-seq-${Date.now()}`;
  });

  it("같은 pubsub_message_id를 3번 순차 클레임하면 최초 1번만 id를 반환하고 나머지는 빈 값(중복)이다", () => {
    const first = claimSmartNotesEvent({ pubsubMessageId, sessionId, driveFileId: "test-drive-file-id" });
    const second = claimSmartNotesEvent({ pubsubMessageId, sessionId, driveFileId: "test-drive-file-id" });
    const third = claimSmartNotesEvent({ pubsubMessageId, sessionId, driveFileId: "test-drive-file-id" });

    expect(first).not.toBe("");
    expect(second).toBe("");
    expect(third).toBe("");

    const count = psql(`select count(*) from smart_notes_generation_events where pubsub_message_id = '${pubsubMessageId}';`);
    expect(count).toBe("1");
  });

  it("같은 세션·원본·대상 이메일로 3번 순차 enqueue하면 최초 1번만 id를 반환하고 session_drive_tasks도 1행만 남는다", () => {
    const first = enqueueDriveGrant({ sessionId, driveFileId: "test-drive-file-id", studentEmail: "child@example.com" });
    const second = enqueueDriveGrant({ sessionId, driveFileId: "test-drive-file-id", studentEmail: "child@example.com" });
    const third = enqueueDriveGrant({ sessionId, driveFileId: "test-drive-file-id", studentEmail: "child@example.com" });

    expect(first).not.toBe("");
    expect(second).toBe("");
    expect(third).toBe("");

    const count = psql(
      `select count(*) from session_drive_tasks where session_id = '${sessionId}' and task_type = 'smart_notes_reader_grant';`
    );
    expect(count).toBe("1");
  });

  it("작업이 succeeded로 끝난 뒤에는 같은 세션·원본·대상으로 재권한 부여 작업을 다시 만들 수 있다(정당한 재부여를 막지 않음)", () => {
    psql(
      `update session_drive_tasks set status = 'succeeded'
       where session_id = '${sessionId}' and task_type = 'smart_notes_reader_grant';`
    );
    const reEnqueued = enqueueDriveGrant({ sessionId, driveFileId: "test-drive-file-id", studentEmail: "child@example.com" });
    expect(reEnqueued).not.toBe("");

    const count = psql(
      `select count(*) from session_drive_tasks where session_id = '${sessionId}' and task_type = 'smart_notes_reader_grant';`
    );
    expect(count).toBe("2");
  });
});

describe("claim_smart_notes_generation_event/enqueue_smart_notes_reader_grant_task — 동시(concurrent) 배달 경합 방지(실제 Postgres, 병렬 요청)", () => {
  let sessionId: string;

  beforeAll(() => {
    sessionId = createSession();
  });

  it("같은 pubsub_message_id를 10개 요청으로 동시에 클레임해도 정확히 1개만 성공하고, smart_notes_generation_events도 1행만 남는다", async () => {
    const pubsubMessageId = `idempotency-concurrent-${Date.now()}`;
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        claimSmartNotesEventAsync({ pubsubMessageId, sessionId, driveFileId: "concurrent-drive-file-id" })
      )
    );

    const claimed = results.filter((r) => r !== "");
    expect(claimed).toHaveLength(1);

    const count = psql(`select count(*) from smart_notes_generation_events where pubsub_message_id = '${pubsubMessageId}';`);
    expect(count).toBe("1");
  });

  it("같은 세션·원본·대상 이메일로 Drive 권한 부여 작업을 10개 요청으로 동시에 enqueue해도 정확히 1개만 성공하고, session_drive_tasks도 1행만 남는다", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        enqueueDriveGrantAsync({ sessionId, driveFileId: "concurrent-drive-file-id-2", studentEmail: "concurrent-child@example.com" })
      )
    );

    const enqueued = results.filter((r) => r !== "");
    expect(enqueued).toHaveLength(1);

    const count = psql(
      `select count(*) from session_drive_tasks
       where session_id = '${sessionId}' and task_type = 'smart_notes_reader_grant'
         and payload->>'fileId' = 'concurrent-drive-file-id-2' and payload->>'studentEmail' = 'concurrent-child@example.com';`
    );
    expect(count).toBe("1");
  });
});
