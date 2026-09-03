import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { ACCOUNTS, DEV_PASSWORD, loginAs } from "./helpers";

// M4 — 상담→체험→정규 전환 통합 골든 패스(요구사항 13번). 실브라우저로:
// 비로그인 상담(직접 seed, M1 자체 E2E가 별도로 커버) → 관리자 체험 진행
// 확정 → 온보딩 링크 발급 → 신규 보호자 계정 생성(redeem 라우트, R2
// invite/accept와 동일한 신뢰 경계) → 관리자 과목·선생님 배정 → 보호자 Smart
// Notes 동의(+ 체험수업권 자동 지급) → 체험 예약(psql로 confirm_lesson_booking
// 직접 호출 — 예약 UI 자체는 R6 스펙이 이미 커버, 여기서는 M4 연결만 검증) →
// 완료 처리 → 선생님 리뷰 확정 → 보호자 정규 진행 희망 → 관리자 원클릭 계약
// 발송(DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS 비활성 — mock 실패 경로만 검증) →
// DocuSign 웹훅 시뮬레이션(r3-consultation-to-contract.spec.ts와 동일한 HMAC
// 서명 same-origin POST 기법)으로 계약 active 전환 → 정규상품 구매 시뮬레이션 →
// 과목 활성화 → 같은 teacher_assignment로 120분 정규 예약까지.
//
// r5-subject-enrollment-flow.spec.ts와 동일하게 역할(admin/guardian/teacher)마다
// 별도 test()로 나눈다 — Playwright test()는 각각 독립된 브라우저 컨텍스트를
// 기본 제공하므로, 한 test() 안에서 context.newPage()로 여러 역할을 오가다
// 세션 쿠키가 서로 덮어써지는 문제를 원천적으로 피할 수 있다(실제로 단일
// test()로 처음 작성했을 때 admin 세션이 guardian 세션으로 바뀌는 문제를
// 겪었음 — 원인 확정 대신 검증된 패턴으로 구조를 바꿔 해결).
//
// DocuSign 실제 발송·Stripe 실제 결제는 전혀 하지 않는다(요구사항: 이번엔
// mock/Sandbox 비활성 경로만 검증).

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001"; // SAT Math
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001"; // 박서연
const WEBHOOK_SECRET = process.env.DOCUSIGN_WEBHOOK_TOKEN ?? "";
// lesson_types/entitlement_products 관련 id는 seed.sql에서 gen_random_uuid()
// 기본값으로 생성돼 db reset마다 값이 바뀐다 — 하드코딩하지 않고 beforeAll에서
// code 기준으로 조회한다.
let TRIAL_LESSON_TYPE_ID: string;
let REGULAR_LESSON_TYPE_ID: string;
let REGULAR_PRODUCT_ID: string;
let REGULAR_VERSION_ID: string;

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

function signWebhookBody(body: unknown): { rawBody: string; signature: string } {
  const rawBody = JSON.stringify(body);
  const signature = createHmac("sha256", WEBHOOK_SECRET).update(rawBody, "utf8").digest("base64");
  return { rawBody, signature };
}

let consultationId: string;
let guardianEmail: string;
let studentEmail: string;
let childId: string;
let subjectEnrollmentId: string;
let initialAssignmentId: string;
let rawToken: string;
let sessionId: string;
let contractId: string;
let contractVersionId: string;
let purchaseId: string;
let regularGrantId: string;
const regularStartsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
const regularEndsAt = new Date(new Date(regularStartsAt).getTime() + 120 * 60000).toISOString();

test.describe.configure({ mode: "serial" });

test.describe("M4 — 상담→체험→정규 전환 골든 패스 (실브라우저)", () => {
  test.skip(!WEBHOOK_SECRET, "DOCUSIGN_WEBHOOK_TOKEN이 로컬 env에 없어 웹훅 시뮬레이션을 할 수 없습니다.");

  test.beforeAll(() => {
    const now = Date.now();
    guardianEmail = `m4-guardian-${now}@example.com`;
    studentEmail = `m4-student-${now}@example.com`;

    const prospectContactId = psql(
      `insert into prospect_contacts (full_name, primary_email) values ('M4 골든패스 보호자', '${guardianEmail}') returning id;`
    );
    consultationId = psql(
      `insert into consultations (source, status, outcome, contact_name, contact_email, starts_at, ends_at, prospect_contact_id)
       values ('homepage', 'completed', 'trial_recommended', 'M4 골든패스 보호자', '${guardianEmail}', now(), now() + interval '30 minutes', '${prospectContactId}')
       returning id;`
    );

    const adminId = "aaaaaaaa-0000-0000-0000-000000000001";
    psql(
      `insert into teacher_availability_rules (teacher_id, day_of_week, start_time_local, end_time_local, timezone, created_by)
       select '${TEACHER_ID}', d, '00:00', '23:59', 'America/Los_Angeles', '${adminId}' from generate_series(0,6) d;`
    );

    TRIAL_LESSON_TYPE_ID = psql(`select id from lesson_types where code = 'trial';`);
    REGULAR_LESSON_TYPE_ID = psql(`select id from lesson_types where code = 'regular';`);
    REGULAR_PRODUCT_ID = psql(`select id from entitlement_products where code = 'lesson_pack_1';`);
    REGULAR_VERSION_ID = psql(`select id from entitlement_product_versions where entitlement_product_id = '${REGULAR_PRODUCT_ID}' limit 1;`);
  });

  test.afterAll(() => {
    psql(`delete from teacher_availability_rules where teacher_id = '${TEACHER_ID}' and created_by = 'aaaaaaaa-0000-0000-0000-000000000001';`);
    // 나머지(consultations/households/students/parents/subject_enrollments/
    // teacher_assignments/trial_* 등)는 정리하지 않는다 — 신규 학생·보호자를
    // 새로 만들어내는 흐름이라 다른 스펙 고정 seed와 겹치지 않는다. 다음
    // `npx supabase db reset --local`로 정리되는 것을 전제로 한다.
  });

  test("1. 관리자: 체험 진행 확정 → 온보딩 링크 발급", async ({ page }) => {
    test.setTimeout(60000);
    await loginAs(page, ACCOUNTS.admin);
    await page.goto("/admin?tab=matching");

    const onboardingPanel = page.locator("div").filter({
      has: page.getByRole("heading", { name: "상담 → 체험 → 정규 전환 (M4)" }),
    }).first();
    await expect(onboardingPanel.getByRole("heading", { name: "상담 → 체험 → 정규 전환 (M4)" })).toBeVisible({
      timeout: 15000,
    });

    const candidateRow = onboardingPanel
      .locator("div.border-\\[1\\.5px\\].border-grey-200.rounded-xl")
      .filter({ hasText: guardianEmail })
      .first();
    await expect(candidateRow).toBeVisible();
    await candidateRow.getByRole("button", { name: "체험 진행 확정" }).click();
    await expect(candidateRow.getByText("체험 진행 확정: 완료")).toBeVisible({ timeout: 15000 });

    await candidateRow.getByRole("button", { name: "온보딩 링크 발급" }).click();
    await candidateRow.getByPlaceholder("보호자 이메일").fill(guardianEmail);
    await candidateRow.getByPlaceholder("보호자 이름").fill("M4 골든패스 보호자");
    await candidateRow.getByPlaceholder("학생 이름").fill("M4 골든패스 학생");
    await candidateRow.getByPlaceholder("학생 이메일").fill(studentEmail);
    await candidateRow.getByRole("button", { name: "링크 발급" }).click();

    const linkText = await candidateRow.locator("div").filter({ hasText: "/api/trial-onboarding/redeem" }).last().innerText();
    const tokenMatch = linkText.match(/token=([0-9a-f]+)/);
    expect(tokenMatch).toBeTruthy();
    rawToken = tokenMatch![1];
  });

  test("2. 신규 보호자: 온보딩 링크로 계정 생성", async ({ page, baseURL }) => {
    test.setTimeout(60000);
    await page.goto(`${baseURL}/api/trial-onboarding/redeem?token=${rawToken}`);
    await expect(page).toHaveURL(/\/set-password/, { timeout: 15000 });

    await page.getByLabel("새 비밀번호", { exact: true }).fill(DEV_PASSWORD);
    await page.getByLabel("새 비밀번호 확인").fill(DEV_PASSWORD);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "비밀번호 설정하고 계속하기" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/set-password"), { timeout: 15000 });

    childId = psql(`select child_id from consultations where id = '${consultationId}';`);
    expect(childId).toMatch(/^[0-9a-f-]{36}$/);

    // is_under_13()은 date_of_birth가 없으면 fail-closed(true)로 판정해 계약
    // 활성화(9번 단계)를 막는다 — 이 골든 패스는 만 13세 미만 동의 게이트 자체를
    // 검증하는 것이 아니므로(그 게이트는 기존 출시 blocker로 별도 유지),
    // r3-consultation-to-contract.spec.ts와 동일하게 성인(17세) 학생으로
    // 취급되도록 생년월일을 채운다.
    // profiles.date_of_birth는 본인이 직접 못 바꾸도록 트리거(protect_date_of_birth)
    // 가 is_admin()/보호자 관계를 확인한다 — psql(service_role, auth.uid() 없음)로
    // 그냥 UPDATE하면 트리거가 거부하므로, 관리자로 가장한 세션 설정을 잠깐 쓴다.
    psql(`
      set role authenticated;
      select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', false);
      update profiles set date_of_birth = (now() - interval '17 years')::date where id = '${childId}';
      reset role;
    `);
  });

  test("3. 관리자: 과목 수강 + 선생님 배정", async ({ page }) => {
    test.setTimeout(60000);
    await loginAs(page, ACCOUNTS.admin);
    await page.goto("/admin?tab=matching");

    const candidateRow = page
      .locator("div").filter({
        has: page.getByRole("heading", { name: "상담 → 체험 → 정규 전환 (M4)" }),
      }).first()
      .locator("div.border-\\[1\\.5px\\].border-grey-200.rounded-xl")
      .filter({ hasText: guardianEmail })
      .first();
    await expect(candidateRow.getByText("계정 연결: 완료")).toBeVisible({ timeout: 15000 });
    await candidateRow.getByRole("button", { name: "과목 수강 + 선생님 배정" }).click();
    await candidateRow.getByPlaceholder("과목 ID").fill(SUBJECT_ID);
    await candidateRow.getByPlaceholder("선생님 ID").fill(TEACHER_ID);
    await candidateRow.getByRole("button", { name: "배정 확정" }).click();
    await expect(candidateRow.getByPlaceholder("과목 ID")).toHaveCount(0, { timeout: 15000 });

    subjectEnrollmentId = psql(
      `select id from subject_enrollments where child_id = '${childId}' and subject_id = '${SUBJECT_ID}';`
    );
    expect(subjectEnrollmentId).toMatch(/^[0-9a-f-]{36}$/);
    initialAssignmentId = psql(
      `select id from teacher_assignments where subject_enrollment_id = '${subjectEnrollmentId}' and status = 'active';`
    );
    expect(initialAssignmentId).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("4. 보호자: Smart Notes 동의 → 체험수업권 자동 지급 (+ 부정 테스트)", async ({ page }) => {
    test.setTimeout(60000);
    await loginAs(page, guardianEmail);
    await page.goto("/consult/trial-onboarding");
    await expect(page.getByText("M4 골든패스 학생")).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "Smart Notes 이용에 동의합니다" }).click();
    await expect(page.getByText(/동의 완료/)).toBeVisible({ timeout: 15000 });

    const trialGrantCount = psql(
      `select count(*) from entitlement_grants eg join entitlement_products ep on ep.id = eg.entitlement_product_id
       where eg.child_id = '${childId}' and ep.code = 'trial_lesson_grant';`
    );
    expect(trialGrantCount).toBe("1");

    // 부정 테스트: 정규(120분) 예약은 아직 정규 수업권이 없으므로 거부돼야
    // 한다(체험/정규 수업권 상호 오사용 차단, M2 방어를 M4 흐름에서도 재확인).
    expect(() =>
      psql(
        `select confirm_lesson_booking('${childId}', '${subjectEnrollmentId}', '${TEACHER_ID}', '${REGULAR_LESSON_TYPE_ID}', '${regularStartsAt}', '${regularEndsAt}', 'm4-e2e-negative-${Date.now()}');`
      )
    ).toThrow();
  });

  test("5. 체험 예약(60분) + 완료 처리", async () => {
    const trialStartsAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const trialEndsAt = new Date(new Date(trialStartsAt).getTime() + 60 * 60000).toISOString();
    const bookingRow = psql(
      `select session_id from confirm_lesson_booking('${childId}', '${subjectEnrollmentId}', '${TEACHER_ID}', '${TRIAL_LESSON_TYPE_ID}', '${trialStartsAt}', '${trialEndsAt}', 'm4-e2e-trial-${Date.now()}');`
    );
    sessionId = bookingRow.trim();
    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/);

    const trialHoldExists = psql(
      `select count(*) from entitlement_ledger el join entitlement_grants eg on eg.id = el.grant_id
       join entitlement_products ep on ep.id = eg.entitlement_product_id
       where eg.child_id = '${childId}' and ep.code = 'trial_lesson_grant' and el.event_type = 'hold';`
    );
    expect(trialHoldExists).toBe("1");

    psql(`update sessions set final_status = 'completed', actual_start_at = '${trialStartsAt}', actual_end_at = '${trialEndsAt}' where id = '${sessionId}';`);
  });

  test("6. 선생님: 체험 리뷰 작성 → 확정", async ({ page }) => {
    test.setTimeout(60000);
    await loginAs(page, "seoyeon@example.com");
    await page.goto("/teacher?tab=assignments");
    const reviewPanel = page.locator("div").filter({
      has: page.getByRole("heading", { name: "체험 수업 리뷰 작성" }),
    }).first();
    await expect(reviewPanel.getByRole("heading", { name: "체험 수업 리뷰 작성" })).toBeVisible({ timeout: 15000 });
    // reviewPanel은 "div".filter({has: heading}).first()로 찾아 실제로는 페이지의
    // 매우 바깥쪽 조상 div까지 포함한다 — AssignmentsTab에 이미 있는 배정 카드들도
    // 같은 border 클래스를 쓰므로, textarea를 실제로 담은 div로 한 번 더 좁힌다.
    const reviewRow = reviewPanel
      .locator("div.border-\\[1\\.5px\\].border-grey-200.rounded-xl")
      .filter({ has: page.locator("textarea") })
      .first();
    await reviewRow.locator("textarea").fill("M4 골든패스 학생과의 체험 수업 — 기초 개념 이해도 우수, 정규 진행 추천.");
    // finalize_trial_lesson_review()는 먼저 초안이 있어야 확정할 수 있다 —
    // 초안 저장 → 확정 순서로 클릭한다.
    await reviewRow.getByRole("button", { name: "초안 저장" }).click();
    await expect(reviewRow.getByText("초안 저장됨")).toBeVisible({ timeout: 15000 });
    await reviewRow.getByRole("button", { name: "리뷰 확정" }).click();
    await expect(reviewPanel).toHaveCount(0, { timeout: 15000 });
  });

  test("7. 보호자: 확정 리뷰 확인 → 정규 진행 희망", async ({ page }) => {
    test.setTimeout(60000);
    await loginAs(page, guardianEmail);
    await page.goto("/parent?tab=enrollment");
    await expect(page.getByText(/기초 개념 이해도 우수/)).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "정규 진행 희망합니다" }).click();
    await expect(page.getByText(/정규 진행 희망이 접수됐습니다/)).toBeVisible({ timeout: 15000 });
  });

  test("8. 관리자: 원클릭 정규 계약 발송(mock 실패 경로)", async ({ page }) => {
    test.setTimeout(60000);
    await loginAs(page, ACCOUNTS.admin);
    await page.goto("/admin?tab=matching");
    await expect(page.getByRole("heading", { name: "정규 계약 발송 대기" })).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "정규 계약 발송" }).click();
    await expect(page.getByText(/발송 실패\(재처리 가능\)/)).toBeVisible({ timeout: 20000 });

    contractId = psql(`select id from contracts where child_id = '${childId}';`);
    expect(contractId).toMatch(/^[0-9a-f-]{36}$/);
    contractVersionId = psql(`select id from contract_versions where contract_id = '${contractId}';`);
    expect(contractVersionId).toMatch(/^[0-9a-f-]{36}$/);
    const companySignedAt = psql(`select company_signed_at from contract_versions where id = '${contractVersionId}';`);
    expect(companySignedAt).not.toBe("");
    const draftStatus = psql(`select status from contracts where id = '${contractId}';`);
    expect(draftStatus).toBe("draft"); // 발송 실패했으므로 여전히 draft — 성공으로 표시 안 함.
  });

  test("9. DocuSign 웹훅 시뮬레이션 → 계약 active 전환", async ({ request, baseURL }) => {
    const fakeEnvelopeId = `env-m4-e2e-${randomUUID()}`;
    psql(`
      update contract_versions set docusign_envelope_id = '${fakeEnvelopeId}',
        docusign_envelope_status = 'sent', docusign_status_updated_at = now()
        where id = '${contractVersionId}';
      update contracts set status = 'sent' where id = '${contractId}';
    `);
    const payload = {
      event: "envelope-completed",
      data: { envelopeId: fakeEnvelopeId },
      test_marker: "m4-trial-to-regular-golden-path",
    };
    const { rawBody, signature } = signWebhookBody(payload);
    const webhookRes = await request.post(`${baseURL}/api/webhooks/docusign`, {
      data: rawBody,
      headers: { "X-DocuSign-Signature-1": signature, "Content-Type": "application/json" },
    });
    expect(webhookRes.status()).toBe(200);

    const activeStatus = psql(`select status from contracts where id = '${contractId}';`);
    expect(activeStatus).toBe("active");
  });

  test("10. 정규상품 구매 시뮬레이션 → 관리자 과목 활성화", async ({ page }) => {
    test.setTimeout(60000);
    const householdId = psql(`select household_id from household_members where profile_id = '${childId}' and role = 'child';`);
    purchaseId = psql(
      `insert into purchases (household_id, child_id, contract_id, entitlement_product_id, product_version_id, quantity, unit_price_minor, package_price_minor, total_minor, validity_months, status)
       values ('${householdId}', '${childId}', '${contractId}', '${REGULAR_PRODUCT_ID}', '${REGULAR_VERSION_ID}', 1, 50000, 50000, 50000, 6, 'succeeded') returning id;`
    );
    regularGrantId = psql(
      `insert into entitlement_grants (child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at)
       values ('${childId}', '${REGULAR_PRODUCT_ID}', '${purchaseId}', 1, now() + interval '6 months') returning id;`
    );
    // 실제 R4 구매 완료 웹훅은 entitlement_grants와 함께 초기 'grant' 이벤트를
    // entitlement_ledger에 항상 같이 남긴다(hold_entitlement은 ledger 합계로 잔량을
    // 계산하므로 이 행이 없으면 방금 만든 grant가 "잔량 0"으로 보인다) — 여기서도
    // 그 한 쌍을 그대로 재현한다.
    psql(
      `insert into entitlement_ledger (grant_id, event_type, amount, business_event_id)
       values ('${regularGrantId}', 'grant', 1, 'm4-e2e-purchase-grant:${purchaseId}');`
    );

    await loginAs(page, ACCOUNTS.admin);
    await page.goto("/admin?tab=matching");
    const matchingPanel = page.locator("div").filter({
      has: page.getByRole("heading", { name: "과목 수강 · 선생님 배정 (R5)" }),
    }).first();
    await expect(matchingPanel.getByRole("heading", { name: "과목 수강 · 선생님 배정 (R5)" })).toBeVisible({ timeout: 15000 });
    await matchingPanel.getByRole("button", { name: "M4 골든패스 학생", exact: true }).click();
    const enrollmentRow = matchingPanel
      .locator("div.border-\\[1\\.5px\\].border-grey-200.rounded-xl")
      .filter({ hasText: "SAT Math" })
      .first();
    await expect(enrollmentRow).toBeVisible({ timeout: 15000 });
    await enrollmentRow.getByRole("button", { name: "활성화" }).click();
    await expect(enrollmentRow.getByText(/active/)).toBeVisible({ timeout: 15000 });
  });

  test("11. 불변식 확인 + 같은 배정으로 정규 예약", async () => {
    // 정규 전환 후에도 체험 때 배정된 teacher_assignment가 그대로다(요구사항
    // 10 — 새 배정·승계 제안 없음).
    const finalAssignmentId = psql(
      `select id from teacher_assignments where subject_enrollment_id = '${subjectEnrollmentId}' and status = 'active';`
    );
    expect(finalAssignmentId).toBe(initialAssignmentId);

    // 같은 선생님·같은 배정으로 120분 정규 예약이 바로 가능해야 한다.
    const regularBookingRow = psql(
      `select session_id from confirm_lesson_booking('${childId}', '${subjectEnrollmentId}', '${TEACHER_ID}', '${REGULAR_LESSON_TYPE_ID}', '${regularStartsAt}', '${regularEndsAt}', 'm4-e2e-regular-${Date.now()}');`
    );
    expect(regularBookingRow.trim()).toMatch(/^[0-9a-f-]{36}$/);

    const regularHoldExists = psql(
      `select count(*) from entitlement_ledger where grant_id = '${regularGrantId}' and event_type = 'hold';`
    );
    expect(regularHoldExists).toBe("1");
  });
});
