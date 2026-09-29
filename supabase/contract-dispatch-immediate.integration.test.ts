import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { insertReservationInBand } from "@/test/reservation-slots";

// 2026-09-29 — 이벤트 직후 즉시 발송 워커(lib/contract-dispatch/immediate.ts)를 실제 로컬 DB로
// 검증한다. DocuSign(sendRegularContractForSubjectEnrollment)은 모킹 — 실제 발송·이메일·Google
// 호출 없음. 공유 로컬 DB이므로 이 파일이 만든 자녀의 작업만 처리되는지(범위 한정)도 확인한다.

const sendMock = vi.fn();
vi.mock("@/lib/regular-contract-send", () => ({
  sendRegularContractForSubjectEnrollment: (...a: unknown[]) => sendMock(...a),
}));

// vitest는 .env.local을 자동 로드하지 않는다 — 로컬 Supabase일 때만 직접 읽는다(원격이면 중단).
function loadLocalSupabaseEnv() {
  const text = readFileSync(path.resolve(__dirname, "../.env.local"), "utf-8");
  const get = (n: string) => text.match(new RegExp(`^${n}=(.*)$`, "m"))?.[1]?.trim().replace(/^["']|["']$/g, "");
  const url = get("NEXT_PUBLIC_SUPABASE_URL");
  if (!url || !/127\.0\.0\.1|localhost/.test(url)) throw new Error("로컬 Supabase가 아니면 실행하지 않는다");
  process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  process.env.SUPABASE_SECRET_KEY = get("SUPABASE_SECRET_KEY");
}
loadLocalSupabaseEnv();

import { runContractDispatchNow } from "@/lib/contract-dispatch/immediate";

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

function createChildAuthProfile(label: string): string {
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`insert into profiles (id, role, name) values ('${id}', 'student', '${label}');`);
  psql(`insert into students (id, grade, status) values ('${id}', '10학년', 'active');`);
  return id;
}

function createHousehold(childId: string): string {
  const guardianId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'outbox-guardian-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  // 원시 SQL로 넣은 auth.users는 토큰 컬럼이 NULL이라 GoTrue admin API(getUserById)가 실패한다.
  psql(
    `update auth.users set confirmation_token = '', recovery_token = '', email_change = '', email_change_token_new = '', email_change_token_current = '', reauthentication_token = '', phone_change = '', phone_change_token = '' where id = '${guardianId}';`
  );
  psql(`insert into profiles (id, role, name) values ('${guardianId}', 'parent', '아웃박스보호자');`);
  psql(`insert into parents (id) values ('${guardianId}');`);
  const householdId = psql(`insert into households (primary_guardian_id) values ('${guardianId}') returning id;`);
  psql(
    `insert into household_members (household_id, profile_id, role, is_primary) values
       ('${householdId}', '${guardianId}', 'guardian', true),
       ('${householdId}', '${childId}', 'child', true);`
  );
  return householdId;
}

function createSubjectEnrollment(householdId: string, childId: string): string {
  const contractId = psql(
    `insert into contracts (household_id, child_id, status) values ('${householdId}', '${childId}', 'draft') returning id;`
  );
  return psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status)
     values ('${childId}', '${SUBJECT_ID}', '${contractId}', 'planned') returning id;`
  );
}

function createSession(subjectEnrollmentId: string, lessonTypeCode: "trial" | "regular", finalStatus: string): string {
  const lessonTypeId = psql(`select id from lesson_types where code = '${lessonTypeCode}';`);
  // 재실행 안전: 공용 seed 선생님이므로 파일 전용 날짜 구간의 빈 슬롯에 넣는다.
  const reservationId = insertReservationInBand(psql, {
    band: "contract-dispatch-immediate",
    enrollmentId: subjectEnrollmentId,
    teacherId: TEACHER_ID,
  });
  const [startsAt, endsAt] = psql(
    `select starts_at::text || '|' || ends_at::text from reservations where id = '${reservationId}';`
  ).split("|");
  return psql(
    `insert into sessions (reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes, final_status, actual_start_at, actual_end_at, finalized_at, final_actor_id)
     values ('${reservationId}', '${subjectEnrollmentId}', '${TEACHER_ID}', '${lessonTypeId}', 60,
       '${finalStatus}',
       case when '${finalStatus}' = 'scheduled' then null else '${startsAt}'::timestamptz end,
       case when '${finalStatus}' not in ('scheduled', 'live') then '${endsAt}'::timestamptz else null end,
       case when '${finalStatus}' not in ('scheduled', 'live') then now() else null end,
       case when '${finalStatus}' not in ('scheduled', 'live') then '${ADMIN_ID}'::uuid else null end
     ) returning id;`
  );
}


const ORIGINAL = process.env.CONTRACT_AUTO_DISPATCH_ENABLED;
beforeEach(() => {
  sendMock.mockReset();
  sendMock.mockResolvedValue({ status: "sent" });
});
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.CONTRACT_AUTO_DISPATCH_ENABLED;
  else process.env.CONTRACT_AUTO_DISPATCH_ENABLED = ORIGINAL;
});

function trialCompletedChild(label: string) {
  const childId = createChildAuthProfile(label);
  const householdId = createHousehold(childId);
  const enrollmentId = createSubjectEnrollment(householdId, childId);
  const sessionId = createSession(enrollmentId, "trial", "completed");
  return { childId, sessionId };
}
const jobStatus = (childId: string) =>
  psql(`select status from contract_dispatch_jobs where child_id = '${childId}';`);

describe("runContractDispatchNow — 실제 DB, DocuSign 모킹", () => {
  it("비활성이면 큐는 queued 그대로이고 발송·claim이 없다", async () => {
    delete process.env.CONTRACT_AUTO_DISPATCH_ENABLED;
    const { childId, sessionId } = trialCompletedChild("imm-off");
    expect(jobStatus(childId)).toBe("queued");
    await runContractDispatchNow({ sessionId });
    expect(jobStatus(childId)).toBe("queued");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("활성이면 체험 완료 세션의 작업만 즉시 발송(sent)하고, 무관한 자녀의 작업은 건드리지 않는다", async () => {
    process.env.CONTRACT_AUTO_DISPATCH_ENABLED = "true";
    const mine = trialCompletedChild("imm-on");
    const other = trialCompletedChild("imm-other");
    await runContractDispatchNow({ sessionId: mine.sessionId });
    expect(jobStatus(mine.childId)).toBe("sent");
    expect(jobStatus(other.childId)).toBe("queued");
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][1]).toMatchObject({ childId: mine.childId });
  });

  it("같은 이벤트를 동시에·다시 처리해도 재발송하지 않는다(멱등)", async () => {
    process.env.CONTRACT_AUTO_DISPATCH_ENABLED = "true";
    const { childId, sessionId } = trialCompletedChild("imm-twice");
    await Promise.all([runContractDispatchNow({ sessionId }), runContractDispatchNow({ sessionId })]);
    await runContractDispatchNow({ sessionId });
    expect(jobStatus(childId)).toBe("sent");
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("발송 실패는 던지지 않고 retryable_failed로 남겨 크론 백스톱이 재시도하게 한다", async () => {
    process.env.CONTRACT_AUTO_DISPATCH_ENABLED = "true";
    sendMock.mockResolvedValue({ status: "failed", error: "docusign down(mock)" });
    const { childId, sessionId } = trialCompletedChild("imm-fail");
    await expect(runContractDispatchNow({ sessionId })).resolves.toBeUndefined();
    expect(jobStatus(childId)).toBe("retryable_failed");
  });
});
