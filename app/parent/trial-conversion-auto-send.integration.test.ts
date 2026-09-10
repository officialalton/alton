import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

// currentRequestOrigin()(lib/request-origin.ts)은 next/headers를 통해 실제
// HTTP 요청 스코프를 요구한다 — 이 서버 액션 밖(vitest 프로세스)에서는 그
// 스코프가 없어 "headers was called outside a request scope"로 죽는다. 이
// 테스트가 검증하려는 것은 DocuSign webhook URL 생성이 아니라 RPC/DB 상태
// 전이와 발송 멱등성이므로, 그 부분만 고정값으로 흉내낸다(app/admin/
// trial-onboarding-actions.test.ts도 같은 이유로 이 모듈을 목으로 대체한다).
vi.mock("@/lib/request-origin", () => ({ currentRequestOrigin: () => Promise.resolve("http://localhost:3010") }));

import { sendRegularContractForSubjectEnrollment } from "@/lib/regular-contract-send";

// 2026-09-06(제품 오너 정책 변경 — 정규 진행 희망 확인 시 자동 계약 발송)
// 실제 로컬 Postgres(supabase db reset --local)에 대고, confirm_regular_progress_intent
// RPC(보호자가 "정규 진행 희망"을 확인할 때 호출되는 실제 DB 함수)와
// sendRegularContractForSubjectEnrollment(app/parent/trial-conversion-actions.ts의
// confirmRegularProgressIntent가 내부적으로 그대로 호출하는 함수)를 실제로
// 실행해 확인한다. next/headers 쿠키 컨텍스트가 필요한 requireUser()는 이
// 테스트 프로세스에서 재현할 수 없어(서버 액션 자체는 app/parent/
// trial-conversion-actions.test.ts에서 목으로 이미 검증) 그 두 단계(RPC +
// 자동 발송 함수)를 여기서는 직접 이어붙여 호출한다 — 이 두 호출의 순서·
// 인자가 confirmRegularProgressIntent 본문과 정확히 같다.
//
// 검증 대상:
// 1) 보호자 세션(anon key + password 로그인)으로 confirm_regular_progress_intent
//    RPC를 호출하면 실제로 trial_regular_progress_selections에 행이 남는다.
// 2) 그 직후 sendRegularContractForSubjectEnrollment를 호출하면 계약이
//    draft→(회사 선서명까지) 진행되고, 로컬 환경(DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS
//    미설정)에서는 DocuSign 발송이 실패해 status: "failed"로 돌아온다 —
//    이게 바로 Preview에서도 재현되는 게이트이고, 이 실패가 위 1)의 보호자
//    확인 자체를 되돌리지 않는다(선택 레코드는 그대로 남아있다)는 것도 함께 확인.
// 3) 이미 envelope가 발급된(자동 발송 성공을 흉내낸) 계약 버전에 같은 함수를
//    다시 호출(관리자 수동 버튼 재클릭에 해당)해도 새 envelope를 만들지
//    않고 "already_sent"를 반환한다(멱등성).

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const GUARDIAN_PASSWORD = "test-password-12345";

const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const admin = createClient("http://127.0.0.1:54421", SERVICE_ROLE_KEY);

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

async function createGuardian(label: string): Promise<{ id: string; email: string }> {
  const email = `auto-send-guardian-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: GUARDIAN_PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(error?.message ?? "guardian 생성 실패");
  psql(`insert into profiles (id, role, name) values ('${data.user.id}', 'parent', '${label}');`);
  psql(`insert into parents (id) values ('${data.user.id}');`);
  return { id: data.user.id, email };
}

function createChild(label: string): string {
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`insert into profiles (id, role, name) values ('${id}', 'student', '${label}');`);
  psql(`insert into students (id, grade, status) values ('${id}', '10학년', 'active');`);
  return id;
}

function createHouseholdWithChild(guardianId: string, childId: string): string {
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

// 확정된 체험 리뷰(final) 1건을 만든다 — confirm_regular_progress_intent RPC의
// 전제 조건(lesson_reviews에 lesson_type='trial' and status='final' 존재).
function createFinalTrialReview(subjectEnrollmentId: string): void {
  const trialLessonTypeId = psql(`select id from lesson_types where code = 'trial';`);
  const randomDaysOut = 400 + Math.floor(Math.random() * 100000);
  const startsAt = new Date(Date.now() + randomDaysOut * 60 * 60 * 1000).toISOString();
  const endsAt = new Date(new Date(startsAt).getTime() + 60 * 60000).toISOString();
  const reservationId = psql(
    `insert into reservations (kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status)
     values ('lesson', '${subjectEnrollmentId}', '${TEACHER_ID}', '${startsAt}', '${endsAt}', 'confirmed') returning id;`
  );
  const sessionId = psql(
    `insert into sessions (reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes, final_status, actual_start_at, actual_end_at, finalized_at, final_actor_id)
     values ('${reservationId}', '${subjectEnrollmentId}', '${TEACHER_ID}', '${trialLessonTypeId}', 60, 'completed', '${startsAt}', '${endsAt}', now(), '${ADMIN_ID}')
     returning id;`
  );
  psql(
    `insert into lesson_reviews (lesson_type, trial_session_id, subject_enrollment_id, teacher_id, status, final_text, finalized_at)
     values ('trial', '${sessionId}', '${subjectEnrollmentId}', '${TEACHER_ID}', 'final', '실제 통합 테스트용 확정 리뷰', now());`
  );
}

async function signInAsGuardian(email: string) {
  const client = createClient("http://127.0.0.1:54421", ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password: GUARDIAN_PASSWORD });
  if (error) throw new Error(error.message);
  return client;
}

describe("정규 진행 희망 확인 → 자동 계약 발송(실제 DB/실제 함수 호출)", () => {
  it("보호자 확인 RPC 성공 직후 자동 발송을 시도하면 로컬 DocuSign 게이트에서 실패하지만, 정규 진행 희망 확인 자체는 그대로 남는다", async () => {
    const guardian = await createGuardian("자동발송보호자1");
    const childId = createChild("자동발송자녀1");
    const householdId = createHouseholdWithChild(guardian.id, childId);
    const enrollmentId = createSubjectEnrollment(householdId, childId);
    createFinalTrialReview(enrollmentId);

    // 1) 보호자가 "정규 진행 희망"을 확인 — 실제 서버 액션과 동일한 RPC 호출.
    const guardianClient = await signInAsGuardian(guardian.email);
    const { data: selectionId, error: rpcError } = await guardianClient.rpc("confirm_regular_progress_intent", {
      p_subject_enrollment_id: enrollmentId,
    });
    expect(rpcError).toBeNull();
    expect(selectionId).toBeTruthy();

    const selectionRow = psql(
      `select id from trial_regular_progress_selections where subject_enrollment_id = '${enrollmentId}';`
    );
    expect(selectionRow).toBe(selectionId);

    // 2) confirmRegularProgressIntent가 바로 이어서 호출하는 자동 발송 함수.
    //    로컬에는 DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS가 없으므로 DocuSign 발송은
    //    항상 실패한다(assertion 대상은 "실패해도 예외를 던지지 않고 failed로
    //    돌아온다"는 것) — 이게 바로 confirmRegularProgressIntent의 try/catch가
    //    감싸는 정확한 실패 케이스(Preview 게이트와 동일 원인).
    const result = await sendRegularContractForSubjectEnrollment(admin, {
      childId,
      subjectEnrollmentId: enrollmentId,
      guardianEmail: guardian.email,
      guardianName: "자동발송보호자1",
      childName: "자동발송자녀1",
      approverName: "Do Kyung Kim",
      approverTitle: "CEO, Do Kyung Kim",
      triggeredByUserId: guardian.id,
    });
    expect(result.status).toBe("failed");

    // 보호자의 "정규 진행 희망 확인" 자체는 자동 발송 실패와 무관하게 그대로
    // 남아있다 — best-effort 설계의 핵심.
    const selectionStillThere = psql(
      `select count(*) from trial_regular_progress_selections where subject_enrollment_id = '${enrollmentId}';`
    );
    expect(selectionStillThere).toBe("1");

    // 계약은 회사 선서명까지는 진행됐지만(draft) DocuSign envelope는 없다 —
    // 관리자가 수동 버튼으로 재시도할 수 있는 상태.
    const contractId = psql(`select contract_id from subject_enrollments where id = '${enrollmentId}';`);
    const versionRow = psql(
      `select company_signed_at is not null, docusign_envelope_id is null from contract_versions where contract_id = '${contractId}';`
    );
    expect(versionRow).toBe("t|t");
  });

  it("이미 envelope가 발급된 계약 버전에 다시 호출(관리자 수동 재클릭에 해당)해도 중복 발송하지 않는다(멱등)", async () => {
    const guardian = await createGuardian("자동발송보호자2");
    const childId = createChild("자동발송자녀2");
    const householdId = createHouseholdWithChild(guardian.id, childId);
    const enrollmentId = createSubjectEnrollment(householdId, childId);
    createFinalTrialReview(enrollmentId);

    const guardianClient = await signInAsGuardian(guardian.email);
    await guardianClient.rpc("confirm_regular_progress_intent", { p_subject_enrollment_id: enrollmentId });

    // 1차 자동 발송(로컬에서는 실패) — 계약 버전이 만들어진다.
    await sendRegularContractForSubjectEnrollment(admin, {
      childId,
      subjectEnrollmentId: enrollmentId,
      guardianEmail: guardian.email,
      guardianName: "자동발송보호자2",
      childName: "자동발송자녀2",
      approverName: "Do Kyung Kim",
      approverTitle: "CEO, Do Kyung Kim",
      triggeredByUserId: guardian.id,
    });

    const contractId = psql(`select contract_id from subject_enrollments where id = '${enrollmentId}';`);
    const contractVersionId = psql(
      `select id from contract_versions where contract_id = '${contractId}' and version_status = 'active' order by version_number desc limit 1;`
    );
    // 실제 DocuSign 발송 성공(관리자가 실서비스에서 보는 상태)을 흉내내 envelope를
    // 직접 채운다 — 이 테스트의 목적은 DocuSign 자체가 아니라 "이미 발송된
    // 계약에 재시도해도 중복 발송하지 않는다"는 멱등성이다.
    psql(
      `update contract_versions set docusign_envelope_id = 'env-simulated-sent', docusign_envelope_status = 'sent' where id = '${contractVersionId}';`
    );

    // 관리자가 수동으로 "회사 승인 및 계약 발송" 버튼을 눌러도(=같은 함수 재호출)
    // 새 envelope를 만들지 않고 already_sent로 반환해야 한다.
    const result = await sendRegularContractForSubjectEnrollment(admin, {
      childId,
      subjectEnrollmentId: enrollmentId,
      guardianEmail: guardian.email,
      guardianName: "자동발송보호자2",
      childName: "자동발송자녀2",
      approverName: "Do Kyung Kim",
      approverTitle: "CEO, Do Kyung Kim",
      triggeredByUserId: ADMIN_ID,
    });
    expect(result).toEqual({ status: "already_sent", contractVersionId, envelopeId: "env-simulated-sent" });

    const versionCount = psql(
      `select count(*) from contract_versions where contract_id = '${contractId}';`
    );
    expect(versionCount).toBe("1"); // 새 버전이 만들어지지 않았다.
  });
});

describe("정규 진행 희망 확인 — 체험 리뷰 게이트 제거(2026-09-10, P0-5, 실제 DB)", () => {
  it("확정된(final) 체험 리뷰가 전혀 없어도 confirm_regular_progress_intent RPC가 성공한다", async () => {
    const guardian = await createGuardian("리뷰없는보호자1");
    const childId = createChild("리뷰없는자녀1");
    const householdId = createHouseholdWithChild(guardian.id, childId);
    const enrollmentId = createSubjectEnrollment(householdId, childId);
    // createFinalTrialReview()를 의도적으로 호출하지 않는다 — lesson_reviews에
    // 이 subject_enrollment에 대한 행이 전혀 없는 상태에서 RPC를 호출한다.

    const guardianClient = await signInAsGuardian(guardian.email);
    const { data: selectionId, error: rpcError } = await guardianClient.rpc("confirm_regular_progress_intent", {
      p_subject_enrollment_id: enrollmentId,
    });

    expect(rpcError).toBeNull();
    expect(selectionId).toBeTruthy();

    const selectionRow = psql(
      `select id from trial_regular_progress_selections where subject_enrollment_id = '${enrollmentId}';`
    );
    expect(selectionRow).toBe(selectionId);
  });

  it("이미 다른 가족(household) 소유 수강에는 여전히 예외를 던진다(리뷰 게이트만 제거, 권한 확인은 유지)", async () => {
    const guardian = await createGuardian("남의보호자1");
    const otherGuardian = await createGuardian("진짜보호자1");
    const childId = createChild("남의자녀1");
    const householdId = createHouseholdWithChild(otherGuardian.id, childId);
    const enrollmentId = createSubjectEnrollment(householdId, childId);

    const guardianClient = await signInAsGuardian(guardian.email);
    const { error: rpcError } = await guardianClient.rpc("confirm_regular_progress_intent", {
      p_subject_enrollment_id: enrollmentId,
    });

    expect(rpcError).not.toBeNull();
    expect(rpcError?.message).toContain("본인 가족의 과목 수강에 대해서만");
  });

  it("이미 접수된 수강에 다시 호출하면 새 행을 만들지 않고 기존 id를 그대로 반환한다(멱등, 리뷰 게이트 제거 후에도 유지)", async () => {
    const guardian = await createGuardian("멱등보호자1");
    const childId = createChild("멱등자녀1");
    const householdId = createHouseholdWithChild(guardian.id, childId);
    const enrollmentId = createSubjectEnrollment(householdId, childId);

    const guardianClient = await signInAsGuardian(guardian.email);
    const first = await guardianClient.rpc("confirm_regular_progress_intent", {
      p_subject_enrollment_id: enrollmentId,
    });
    const second = await guardianClient.rpc("confirm_regular_progress_intent", {
      p_subject_enrollment_id: enrollmentId,
    });

    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect(second.data).toBe(first.data);

    const count = psql(
      `select count(*) from trial_regular_progress_selections where subject_enrollment_id = '${enrollmentId}';`
    );
    expect(count).toBe("1");
  });
});
