import { execFileSync } from "node:child_process";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

// R3 Step 3 필수 검증 항목 — assert_guardian_consent_ok() 트리거
// (supabase/migrations/20260913000000_r3_contract_model_realignment.sql)가
// trial_sessions insert에서 실제로 fail-closed 동작을 하는지 로컬 Postgres에
// 직접 psql로 검증한다. 이 저장소는 DB 트리거/제약을 직접 검증할 때 mocked
// Supabase 클라이언트가 아니라 psql을 shell-out하는 패턴을 쓴다
// (e2e/minor-consent.spec.ts, e2e/account-lifecycle.spec.ts 등 참고) — 여기서는
// 브라우저가 필요 없으므로 Playwright 대신 vitest 안에서 같은 psql 패턴만
// 재사용한다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const GUARDIAN_ID = "bbbbbbbb-0000-0000-0000-000000000001"; // CHILD_ID의 실제 household guardian
const CHILD_ID = "cccccccc-0000-0000-0000-000000000002"; // 기존 student 프로필 재사용 (household 자녀)
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001"; // SAT Math
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000002"; // 기존 teacher 프로필
const POLICY_ID = "e2222222-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  });
}

function resetState() {
  psql(`
    delete from trial_sessions where child_id = '${CHILD_ID}';
    delete from consultations where child_id = '${CHILD_ID}';
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
    select revoke_guardian_consent(id, 'integration test reset') from guardian_consents
      where student_id = '${CHILD_ID}' and revoked_at is null;
    reset role;
    insert into consent_policy_versions (id, version, title, content_hash, effective_from, requires_reconsent)
    values ('${POLICY_ID}', 'e2e-v1', 'ALTON 개인정보 처리방침 e2e-v1', 'hash-e2e-v1', now() - interval '1 day', true)
    on conflict (id) do nothing;
  `);
}

function insertConsultation(): string {
  const out = psql(
    `insert into consultations (contact_name, contact_email, child_id) values ('테스트', 'trial-consent-test@example.com', '${CHILD_ID}') returning id;`
  );
  // psql -t -A는 RETURNING 결과 다음 줄에 "INSERT 0 1" 커맨드 태그도 함께 찍는다
  // — 첫 줄(uuid)만 취한다.
  return out.trim().split("\n")[0].trim();
}

function insertTrialSession(consultationId: string): { stdout: string; failed: boolean; message: string } {
  try {
    const stdout = psql(
      `insert into trial_sessions (consultation_id, child_id, subject_id, teacher_id, scheduled_at) ` +
        `values ('${consultationId}', '${CHILD_ID}', '${SUBJECT_ID}', '${TEACHER_ID}', now() + interval '1 day') returning id;`
    );
    return { stdout: stdout.trim(), failed: false, message: "" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { stdout: "", failed: true, message };
  }
}

describe("assert_guardian_consent_ok() — trial_sessions insert 트리거 (실제 DB)", () => {
  afterAll(() => {
    // 다른 e2e 스펙이 이 학생을 성인으로 가정하므로 원상복구.
    psql(`
      delete from trial_sessions where child_id = '${CHILD_ID}';
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
      select set_student_date_of_birth('${CHILD_ID}'::uuid, ((now() at time zone 'utc')::date - interval '20 years')::date);
      reset role;
    `);
  });

  beforeEach(() => {
    resetState();
  });

  it("생년월일이 없으면(fail-closed) 체험 세션 생성이 막힌다", async () => {
    psql(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
      update profiles set date_of_birth = null where id = '${CHILD_ID}';
      reset role;
    `);
    const consultationId = insertConsultation();

    const result = insertTrialSession(consultationId);
    expect(result.failed).toBe(true);
    expect(result.message).toMatch(/보호자 동의|guardian/i);
  });

  it("13세 미만이고 유효한 보호자 동의가 없으면 체험 세션 생성이 막힌다", async () => {
    psql(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
      select set_student_date_of_birth('${CHILD_ID}'::uuid, ((now() at time zone 'utc')::date - interval '10 years')::date);
      reset role;
    `);
    const consultationId = insertConsultation();

    const result = insertTrialSession(consultationId);
    expect(result.failed).toBe(true);
    expect(result.message).toMatch(/보호자 동의|guardian/i);
  });

  it("13세 미만이라도 유효한 보호자 동의가 있으면 체험 세션 생성이 허용된다", async () => {
    psql(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
      select set_student_date_of_birth('${CHILD_ID}'::uuid, ((now() at time zone 'utc')::date - interval '10 years')::date);
      reset role;
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${GUARDIAN_ID}', false);
      select consent_as_guardian('${CHILD_ID}'::uuid, '${POLICY_ID}'::uuid, now());
      reset role;
    `);
    const consultationId = insertConsultation();

    const result = insertTrialSession(consultationId);
    expect(result.failed).toBe(false);
    expect(result.stdout.length).toBeGreaterThan(0);
  });

  it("13세 이상이면 보호자 동의 없이도 체험 세션 생성이 허용된다", async () => {
    psql(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
      select set_student_date_of_birth('${CHILD_ID}'::uuid, ((now() at time zone 'utc')::date - interval '20 years')::date);
      reset role;
    `);
    const consultationId = insertConsultation();

    const result = insertTrialSession(consultationId);
    expect(result.failed).toBe(false);
  });
});
