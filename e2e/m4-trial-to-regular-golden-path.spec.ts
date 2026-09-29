import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { ACCOUNTS, DEV_PASSWORD, loginAs } from "./helpers";
import { findLatestEmailTo, extractTrialOnboardingRedeemUrl } from "./mailbox";

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
let childCardId: string;
let guardianEmail: string;
let studentEmail: string;
let studentName: string;
let childId: string;
let subjectEnrollmentId: string;
let initialAssignmentId: string;
let rawToken: string;
let sessionId: string;
let contractId: string;
let contractVersionId: string;
let purchaseId: string;
let regularGrantId: string;
// 예약 가능 창은 24시간 후 ~ 8주 이내(is_within_booking_window)다. 공용 선생님(박서연)의
// 다른 실행/스펙 예약과 teacher_buffer_violation·reservations_no_overlap이 겹칠 수
// 있어, 무작위 시각으로 예약하되 충돌하면 다른 시각으로 다시 시도한다. 다른 스펙이 같은 선생님에게
// 고정 오프셋(예: c2 스펙의 now+500시간≈21일)으로 예약하므로 그 구간을 피해 30~50일 뒤 대역을 쓴다.
function randomSlotStartMs(): number {
  return Date.now() + (30 + Math.floor(Math.random() * 20)) * 24 * 60 * 60 * 1000 + Math.floor(Math.random() * 1440) * 60_000;
}
function bookWithRetry(lessonTypeId: string, minutes: number, keyPrefix: string): { sessionId: string; startsAt: string; endsAt: string } {
  let lastError: unknown;
  for (let attempt = 0; attempt < 15; attempt++) {
    const startMs = randomSlotStartMs();
    const startsAt = new Date(startMs).toISOString();
    const endsAt = new Date(startMs + minutes * 60_000).toISOString();
    try {
      const sessionId = psql(
        `select session_id from confirm_lesson_booking('${childId}', '${subjectEnrollmentId}', '${TEACHER_ID}', '${lessonTypeId}', '${startsAt}', '${endsAt}', '${keyPrefix}-${Date.now()}-${attempt}');`
      ).trim();
      return { sessionId, startsAt, endsAt };
    } catch (e) {
      lastError = e;
      if (!/teacher_buffer_violation|reservations_no_overlap|teacher_slot_not_open/.test(String(e))) throw e;
    }
  }
  throw lastError;
}
// 4번 fixme(부정 테스트)에서만 쓰는 정규 예약 시각.
const regularStartsAt = new Date(randomSlotStartMs()).toISOString();
const regularEndsAt = new Date(new Date(regularStartsAt).getTime() + 120 * 60000).toISOString();

test.describe.configure({ mode: "serial" });

test.describe("M4 — 상담→체험→정규 전환 골든 패스 (실브라우저)", () => {
  test.skip(!WEBHOOK_SECRET, "DOCUSIGN_WEBHOOK_TOKEN이 로컬 env에 없어 웹훅 시뮬레이션을 할 수 없습니다.");

  test.beforeAll(() => {
    const now = Date.now();
    guardianEmail = `m4-guardian-${now}@example.com`;
    studentEmail = `m4-student-${now}@example.com`;
    // 실행마다 학생 이름이 달라야 일정 카드 등 이름 기반 로케이터가 이전 실행 잔재와 섞이지 않는다.
    studentName = `M4 골든패스 학생 ${now}`;

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
    // 이번 실행의 수업 세션·리뷰만 지운다 — 남기면 공용 선생님(박서연)의 일정 탭
    // 지난 수업 목록이 실행마다 불어난다. 예약(reservations)은 entitlement_ledger가
    // 참조하는 재무 감사 이력이라 지울 수 없어 그대로 둔다(무작위 시각이라 충돌하지 않음).
    if (subjectEnrollmentId) {
      psql(`delete from lesson_reviews where subject_enrollment_id = '${subjectEnrollmentId}';`);
      psql(`delete from sessions where subject_enrollment_id = '${subjectEnrollmentId}';`);
    }
    psql(`delete from teacher_availability_rules where teacher_id = '${TEACHER_ID}' and created_by = 'aaaaaaaa-0000-0000-0000-000000000001';`);
    // 나머지(consultations/households/students/parents/subject_enrollments/
    // teacher_assignments/trial_* 등)는 정리하지 않는다 — 신규 학생·보호자를
    // 새로 만들어내는 흐름이라 다른 스펙 고정 seed와 겹치지 않는다. 다음
    // `npx supabase db reset --local`로 정리되는 것을 전제로 한다.
  });

  test("1. 관리자: 체험 진행 확정 → 온보딩 링크 발급", async ({ page }) => {
    test.setTimeout(60000);
    await loginAs(page, ACCOUNTS.admin);
    // 2026-09-10 이후 이 흐름은 매칭 탭 하단 표가 아니라 Onboarding(consult) 탭의
    // "신규 현황" 칸반 카드 상세 안에서 진행된다.
    await page.goto("/admin?tab=consult");
    await page.getByTestId(`kanban-card-${consultationId}`).click();
    const detail = page.getByTestId("consultation-card-detail");
    await expect(detail).toBeVisible({ timeout: 15000 });

    await detail.getByRole("button", { name: /체험 진행 확정/ }).click();
    // 체험 희망 확정이 끝나면 온보딩 안내 발송 폼이 나타난다.
    const sendButton = detail.getByRole("button", { name: "체험 온보딩 안내 발송" });
    await expect(sendButton).toBeVisible({ timeout: 15000 });

    await detail.getByPlaceholder("보호자 이메일").fill(guardianEmail);
    await detail.getByPlaceholder("보호자 이름").fill("M4 골든패스 보호자");
    await detail.getByPlaceholder("학생 이름").fill(studentName);
    await detail.getByPlaceholder("학생 이메일").fill(studentEmail);
    await sendButton.click();

    // 실제로 Mailpit에 발송된 메일에서 redeem 링크를 추출한다(요구사항: 실제
    // 이메일은 안 보내되 로컬 SMTP/Mailpit 경로로 내용을 검증) — 관리자 화면에
    // 노출되는 "개발 환경 전용" 링크에 의존하지 않는다(운영에서는 그 링크
    // 자체가 없다는 것도 이 방식으로 자연히 증명된다).
    const mail = await findLatestEmailTo(guardianEmail, "체험 수업 온보딩 안내");
    rawToken = new URL(extractTrialOnboardingRedeemUrl(mail.html)).searchParams.get("token")!;
    expect(rawToken).toBeTruthy();

    // 발송이 끝나면 카드 상세에 "발송 내역 보기"(링크 진행 현황)가 나타난다. 폼은
    // 보호자가 링크를 열어 계정이 연결될 때까지 남아 있으므로, 중복 클릭 방지는
    // UI가 아니라 서버 멱등성이 맡는다 — 같은 입력으로 다시 눌러도 새 메일 없이
    // "이미 발송된 안내입니다"로 응답해야 한다.
    await expect(detail.getByTestId("trial-onboarding-link-progress-toggle")).toBeVisible({ timeout: 15000 });
    await detail.getByRole("button", { name: "체험 온보딩 안내 발송" }).click();
    await expect(page.getByText("이미 발송된 안내입니다(중복 발송 안 함)")).toBeVisible({ timeout: 15000 });
  });

  test("2. 신규 보호자: 온보딩 링크로 계정 생성", async ({ page, baseURL }) => {
    test.setTimeout(60000);
    await page.goto(`${baseURL}/api/trial-onboarding/redeem?token=${rawToken}`);
    // 이제 redeem은 바로 계정을 만들지 않고 로그인 이메일 확인 화면으로 먼저
    // 보낸다(prospect 이메일과 로그인 이메일을 분리 처리하기 위함).
    await expect(page).toHaveURL(/\/consult\/trial-onboarding\/confirm-email/, { timeout: 15000 });
    await expect(page.getByLabel("로그인 이메일")).toHaveValue(guardianEmail);
    // 확인은 GET 링크가 아니라 POST(Server Action) 버튼이다 — 메일 스캐너가 링크를
    // 미리 열어도 계정이 만들어지지 않게 하려는 의도적 설계(9a8aaf5).
    await page.getByRole("button", { name: "이 이메일로 계속" }).click();
    await expect(page).toHaveURL(/\/set-password/, { timeout: 15000 });

    await page.getByLabel("새 비밀번호", { exact: true }).fill(DEV_PASSWORD);
    await page.getByLabel("새 비밀번호 확인").fill(DEV_PASSWORD);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "비밀번호 설정하고 계속하기" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/set-password"), { timeout: 15000 });

    // 계정이 만들어지면 원 상담(가족) 카드는 이력으로 남고, 학생별 온보딩 카드가
    // 새로 생겨 그 카드가 child_id를 갖는다(이후 배정·계약은 이 카드에서 진행).
    childCardId = psql(
      `select id from consultations where family_root_consultation_id = '${consultationId}' and is_child_onboarding_card;`
    );
    expect(childCardId).toMatch(/^[0-9a-f-]{36}$/);
    childId = psql(`select child_id from consultations where id = '${childCardId}';`);
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
    // 최초 과목·선생님 배정은 (계정 생성이 끝난 뒤) 같은 칸반 카드 상세의
    // "과목·선생님 배정" 폼에서 과목 → 선생님 순으로 클릭한다. 매칭 탭은 이제
    // 매칭 대기 학생 목록만 다룬다.
    await page.goto("/admin?tab=consult");
    await page.getByTestId(`kanban-card-${childCardId}`).click();
    const assignForm = page.getByTestId("subject-teacher-assign-form");
    await expect(assignForm).toBeVisible({ timeout: 15000 });
    await assignForm.getByTestId(`assign-subject-${SUBJECT_ID}`).click();
    await assignForm.getByTestId(`assign-teacher-${TEACHER_ID}`).click();
    await expect(assignForm).toHaveCount(0, { timeout: 15000 });

    subjectEnrollmentId = psql(
      `select id from subject_enrollments where child_id = '${childId}' and subject_id = '${SUBJECT_ID}';`
    );
    expect(subjectEnrollmentId).toMatch(/^[0-9a-f-]{36}$/);
    initialAssignmentId = psql(
      `select id from teacher_assignments where subject_enrollment_id = '${subjectEnrollmentId}' and status = 'active';`
    );
    expect(initialAssignmentId).toMatch(/^[0-9a-f-]{36}$/);
  });

  // TODO(2026-09-28, 초기 고객 절차 단순화, task_aab5c4d1): 체험 Smart Notes
  // 동의 화면(app/consult/trial-onboarding/page.tsx, TrialConsentButton.tsx)을
  // 없애면서 이 단계가 가리키던 동의 UI 자체가 사라졌다. 체험수업권은 이제
  // 동의 없이 자동 지급되지만, 정확히 어느 시점에 자동 지급되는지(관리자가
  // outcome='trial_recommended'를 기록하는 시점 vs child_id가 실제로 연결되는
  // 시점)가 별도 세션(task_aab5c4d1)에서 재검토 중이다 — 그 결과가 나오면 이
  // 테스트를 "동의 화면 없이, 과목·선생님 배정 완료 시점에 자동 지급됨을
  // 확인"하는 내용으로 다시 써야 한다. 지금은 삭제된 라우트로 이동하던 코드만
  // 제거해 스펙이 깨지지 않게 해뒀다 — 아래 assertion은 그 세션이 실제로
  // 자동 지급 트리거를 완성한 뒤에만 통과한다.
  test.fixme("4. 체험수업권이 동의 없이 자동 지급된다 (+ 부정 테스트)", async () => {
    test.setTimeout(60000);

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
    // 체험수업권 자동 지급의 정확한 트리거 시점은 아직 별도 세션(task_aab5c4d1)에서
    // 검토 중이라(위 4번 fixme) 여기서는 지급 함수를 직접 호출해 예약 이후 단계를
    // 계속 검증한다. 트리거가 확정되면 이 호출과 4번을 함께 정리한다.
    psql(`select grant_trial_entitlement_for_student('${childId}');`);
    const trial = bookWithRetry(TRIAL_LESSON_TYPE_ID, 60, "m4-e2e-trial");
    sessionId = trial.sessionId;
    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/);

    const trialHoldExists = psql(
      `select count(*) from entitlement_ledger el join entitlement_grants eg on eg.id = el.grant_id
       join entitlement_products ep on ep.id = eg.entitlement_product_id
       where eg.child_id = '${childId}' and ep.code = 'trial_lesson_grant' and el.event_type = 'hold';`
    );
    expect(trialHoldExists).toBe("1");

    psql(`update sessions set final_status = 'completed', actual_start_at = '${trial.startsAt}', actual_end_at = '${trial.endsAt}' where id = '${sessionId}';`);
  });

  test("6. 선생님: 체험 리뷰 작성 → 확정", async ({ page }) => {
    test.setTimeout(60000);
    await loginAs(page, "seoyeon@example.com");
    // 수업 리뷰(체험/정규 공용)는 배정 탭이 아니라 일정 탭 > 지난 수업 카드의
    // "수업 리뷰 작성" 모달에서 쓴다. 완료된 수업은 시각과 무관하게 지난 수업이다.
    await page.goto("/teacher?tab=lesson-schedule");
    await page.getByRole("button", { name: "지난 수업" }).click();
    // 지난 수업은 페이지네이션되고 이전 실행의 세션이 쌓여 있을 수 있어, 학생
    // 필터 칩으로 이번 실행의 학생만 남긴다.
    await page.getByRole("button", { name: studentName, exact: true }).click();
    const lessonCard = page
      .locator("div.border-\\[1\\.5px\\].rounded-xl")
      .filter({ hasText: studentName })
      .filter({ has: page.getByRole("button", { name: "수업 리뷰 작성" }) })
      .first();
    await lessonCard.getByRole("button", { name: "수업 리뷰 작성" }).click();
    const modal = page.locator("div.fixed").filter({ has: page.getByRole("heading", { name: "수업 리뷰 작성" }) });
    await expect(modal).toBeVisible({ timeout: 15000 });

    await modal.getByLabel("고객에게 보여줄 종합 의견").fill("M4 골든패스 학생과의 체험 수업 — 기초 개념 이해도 우수, 정규 진행 추천.");
    // 확정하려면 먼저 초안이 저장돼 있어야 한다 — 초안 저장(비공개) → 공개 확정 →
    // 확인 순서로 클릭한다(공개는 되돌릴 수 없는 고객 노출 행동이라 UI가 인라인
    // 확인 단계를 한 번 더 거친다).
    await modal.getByRole("button", { name: "초안 저장(비공개)" }).click();
    await expect(modal.getByRole("button", { name: "공개 확정" })).toBeEnabled({ timeout: 15000 });
    await modal.getByRole("button", { name: "공개 확정" }).click();
    await modal.getByRole("button", { name: "네, 공개합니다" }).click();
    await expect(modal).toHaveCount(0, { timeout: 15000 });

    const reviewStatus = psql(
      `select status from lesson_reviews where regular_session_id = '${sessionId}' or trial_session_id = '${sessionId}';`
    );
    expect(reviewStatus).toBe("final");
  });

  // TODO(2026-09-28, 초기 고객 절차 단순화): "정규 진행 희망" 버튼(TrialConversionPanel)을
  // 없앴다 — 계약 발송은 이제 학부모 클릭이 아니라 체험 completed 이벤트
  // 기준 outbox(contract_dispatch_jobs, 이번 작업에서 구현 중)로 트리거된다.
  // outbox가 완성되면 이 단계는 "체험 수업이 completed로 종료되면 계약 발송
  // 작업이 자동으로 큐에 쌓인다"로 다시 써야 한다.
  test.fixme("7. 체험 수업 완료 시 계약 발송 작업이 자동으로 큐에 쌓인다", async () => {
    test.setTimeout(60000);
  });

  // TODO(2026-09-29, e2e 갱신): 예전 "정규 계약 발송 대기" 표(정규 진행 희망 버튼이
  // 만들던 trial_regular_progress_selections 기반 원클릭 발송)는 위 7번과 같은
  // 이유로 더 이상 이 흐름의 진입점이 아니다 — 계약 발송은 체험 completed 이벤트
  // 기준 contract_dispatch_jobs outbox(CONTRACT_AUTO_DISPATCH_ENABLED 게이트)가
  // 맡는다. outbox 경로가 확정되면 7번과 함께 "발송 작업이 큐에 쌓이고 발송 실패
  // 시 draft로 남는다"로 다시 쓴다. 9번 이후는 계약 버전을 직접 준비해 이어간다.
  test.fixme("8. 계약 발송 outbox → 발송 실패 시 draft 유지", async () => {
    test.setTimeout(60000);
  });

  test("8b. 준비: 회사 승인이 끝난 계약 버전(발송 전 draft)", async () => {
    contractId = psql(`select contract_id from subject_enrollments where id = '${subjectEnrollmentId}';`);
    expect(contractId).toMatch(/^[0-9a-f-]{36}$/);
    contractVersionId = psql(
      `insert into contract_versions (contract_id, version_number, price_policy_snapshot, company_signing_entity, company_signed_at, company_signed_by)
       values ('${contractId}', 1, '{}'::jsonb, 'do_kyung_kim_individual', now(), 'aaaaaaaa-0000-0000-0000-000000000001') returning id;`
    );
    expect(contractVersionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(psql(`select status from contracts where id = '${contractId}';`)).toBe("draft");
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

  test("10. 정규상품 구매 시뮬레이션 + 서명 완료 시 과목 자동 활성화 확인", async () => {
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

    // 과목 수강 활성화는 더 이상 관리자가 누르지 않는다 — 9번의 DocuSign 서명완료
    // 웹훅이 계약을 active로 만들 때 autoActivateReadySubjectEnrollments()가
    // planned → active를 자동으로 처리한다(2026-09-05 사용자 지시).
    expect(psql(`select status from subject_enrollments where id = '${subjectEnrollmentId}';`)).toBe("active");
  });

  test("11. 불변식 확인 + 같은 배정으로 정규 예약", async () => {
    // 정규 전환 후에도 체험 때 배정된 teacher_assignment가 그대로다(요구사항
    // 10 — 새 배정·승계 제안 없음).
    const finalAssignmentId = psql(
      `select id from teacher_assignments where subject_enrollment_id = '${subjectEnrollmentId}' and status = 'active';`
    );
    expect(finalAssignmentId).toBe(initialAssignmentId);

    // 같은 선생님·같은 배정으로 120분 정규 예약이 바로 가능해야 한다.
    const regularBooking = bookWithRetry(REGULAR_LESSON_TYPE_ID, 120, "m4-e2e-regular");
    expect(regularBooking.sessionId).toMatch(/^[0-9a-f-]{36}$/);

    const regularHoldExists = psql(
      `select count(*) from entitlement_ledger where grant_id = '${regularGrantId}' and event_type = 'hold';`
    );
    expect(regularHoldExists).toBe("1");
  });
});
