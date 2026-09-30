import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { ACCOUNTS, DEV_PASSWORD, loginAs } from "./helpers";
import { findLatestEmailTo, extractTrialOnboardingRedeemUrl } from "./mailbox";

// M4 — 상담→체험→정규 전환 통합 골든 패스(요구사항 13번). 실브라우저로:
// 비로그인 상담(직접 seed, M1 자체 E2E가 별도로 커버) → 관리자 체험 진행
// 확정 → 온보딩 링크 발급 → 신규 보호자 계정 생성(redeem 라우트, R2
// invite/accept와 동일한 신뢰 경계; 이 시점에 체험수업권이 동의 없이 자동
// 지급된다) → 관리자 과목·선생님 배정 → 체험 예약(psql로 confirm_lesson_booking
// 직접 호출 — 예약 UI 자체는 R6 스펙이 이미 커버, 여기서는 M4 연결만 검증) →
// 완료 처리(→ 계약 자동 발송 outbox 'completed_trial' 큐잉 + 관리자 큐 화면 확인,
// 발송 게이트 꺼짐 → 발송 없음) → 선생님 리뷰 확정 →
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
// DocuSign 실제 발송·Stripe 실제 결제는 전혀 하지 않는다. 계약 자동 발송은
// CONTRACT_AUTO_DISPATCH_ENABLED 게이트가 꺼진 서버(기본값)를 전제로 큐 상태만
// 검증한다 — 스펙이 관리자 화면의 "자동 발송이 비활성화" 배너를 확인해 게이트가
// 꺼져 있지 않으면 "발송 실행" 클릭 전에 실패해 실발송을 막는다.
// 둘째 describe는 나머지 두 큐잉 트리거(직접 계정 생성 / 상담사 '정규 진행 권장')를
// 실제 화면 흐름으로 검증한다.

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
let dispatchJobId: string;
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
// 4번(부정 테스트)에서만 쓰는 정규 예약 시각.
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
    // 동의 화면이 없어졌으므로 체험수업권은 계정(자녀 카드) 생성과 동시에 자동 지급된다.
    expect(psql(`select trial_entitlement_grant_status from consultations where id = '${childCardId}';`)).toBe("granted");

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

  // 2026-09-29 정책 확정: 체험수업권은 동의 없이, 계정/상담 결과가 허용하는 즉시
  // 자동 지급된다. 상담 경로에서는 결과(trial_recommended)를 물려받은 자녀 카드가
  // 생성되는 순간(=test 2의 계정 생성) grant_trial_entitlement_for_consultation이
  // 실행된다 — 여기서는 그 결과를 RPC 수동 호출 없이 확인한다.
  test("4. 체험수업권이 동의 없이 자동 지급된다 (+ 부정 테스트)", async () => {
    test.setTimeout(60000);

    const trialGrantCount = psql(
      `select count(*) from entitlement_grants eg join entitlement_products ep on ep.id = eg.entitlement_product_id
       where eg.child_id = '${childId}' and ep.code = 'trial_lesson_grant';`
    );
    expect(trialGrantCount).toBe("1");
    expect(
      psql(
        `select coalesce(sum(el.amount), 0) from entitlement_ledger el join entitlement_grants eg on eg.id = el.grant_id
         join entitlement_products ep on ep.id = eg.entitlement_product_id
         where eg.child_id = '${childId}' and ep.code = 'trial_lesson_grant';`
      )
    ).toBe("1");
    // 상담 경로는 체험이 completed 되기 전에는 계약을 큐잉하지 않는다.
    expect(psql(`select count(*) from contract_dispatch_jobs where child_id = '${childId}';`)).toBe("0");

    // 부정 테스트: 정규(120분) 예약은 아직 정규 수업권이 없으므로 거부돼야
    // 한다(체험/정규 수업권 상호 오사용 차단, M2 방어를 M4 흐름에서도 재확인).
    expect(() =>
      psql(
        `select confirm_lesson_booking('${childId}', '${subjectEnrollmentId}', '${TEACHER_ID}', '${REGULAR_LESSON_TYPE_ID}', '${regularStartsAt}', '${regularEndsAt}', 'm4-e2e-negative-${Date.now()}');`
      )
    ).toThrow();
  });

  test("5. 체험 예약(60분) + 완료 처리", async () => {
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
    // 공유 로컬 DB/dev 서버가 다른 세션 부하로 느릴 때 리뷰 모달 로딩(서버 액션)이 15초를 넘길 수 있다.
    test.setTimeout(120000);
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
    await expect(modal).toBeVisible({ timeout: 60000 });

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

  // 계약 자동 발송 outbox — 체험 수업이 completed로 끝나면(test 5) DB 트리거가
  // contract_dispatch_jobs에 'completed_trial' 작업을 큐잉한다. 발송은 별도
  // 워커(CONTRACT_AUTO_DISPATCH_ENABLED 게이트)의 몫이라 여기서는 큐 상태와
  // 관리자 큐 화면만 확인한다.
  test("7. 체험 수업 완료 시 계약 발송 작업이 자동으로 큐에 쌓인다 (멱등)", async () => {
    test.setTimeout(60000);
    const jobs = psql(
      `select trigger_type || '|' || status || '|' || attempt_count || '|' || coalesce(subject_enrollment_id::text, '')
       from contract_dispatch_jobs where child_id = '${childId}';`
    );
    expect(jobs).toBe(`completed_trial|queued|0|${subjectEnrollmentId}`);
    dispatchJobId = psql(`select id from contract_dispatch_jobs where child_id = '${childId}' and trigger_type = 'completed_trial';`);

    // 멱등: 이미 completed인 세션의 재기록 / 같은 작업의 재큐잉은 새 작업을 만들지 않는다.
    psql(`update sessions set final_status = 'completed' where id = '${sessionId}';`);
    psql(`select enqueue_contract_dispatch_job('${childId}', 'completed_trial', '${subjectEnrollmentId}');`);
    expect(psql(`select count(*) from contract_dispatch_jobs where child_id = '${childId}';`)).toBe("1");
    // 취소·노쇼 등 completed가 아닌 전이는 작업을 만들지 않는다(같은 자녀의 다른 유형은 0건 유지).
    expect(
      psql(`select count(*) from contract_dispatch_jobs where child_id = '${childId}' and trigger_type <> 'completed_trial';`)
    ).toBe("0");
  });

  test("8. 관리자 큐 화면 표시 + 발송 게이트 꺼짐이면 아무 것도 발송하지 않는다", async ({ page }) => {
    test.setTimeout(60000);
    await loginAs(page, ACCOUNTS.admin);
    await page.goto("/admin?tab=consult");
    await page.getByRole("button", { name: "정규 계약 발송" }).click();
    const queue = page.getByTestId("contract-dispatch-queue");
    await expect(queue).toBeVisible({ timeout: 15000 });
    // 게이트 가드: 서버가 자동 발송 비활성이어야만 아래 "발송 실행"을 누른다.
    await expect(page.getByTestId("contract-dispatch-disabled-banner")).toBeVisible();

    const row = page.getByTestId(`contract-dispatch-job-${dispatchJobId}`);
    await expect(row).toBeVisible({ timeout: 15000 });
    await expect(row).toContainText(studentName);
    await expect(row).toContainText("체험 수업 완료 · 대기 중");

    await queue.getByRole("button", { name: "발송 실행" }).click();
    await expect(queue.getByText("자동 발송이 비활성화되어 있어 아무 것도 처리하지 않았습니다.")).toBeVisible({ timeout: 15000 });

    // 게이트가 꺼져 있으므로 작업은 그대로 대기, 계약·DocuSign 봉투도 그대로다.
    expect(psql(`select status || '|' || attempt_count from contract_dispatch_jobs where id = '${dispatchJobId}';`)).toBe("queued|0");
    expect(psql(`select count(*) from contract_versions where contract_id = (select contract_id from subject_enrollments where id = '${subjectEnrollmentId}') and docusign_envelope_id is not null;`)).toBe("0");
    expect(psql(`select status from contracts where id = (select contract_id from subject_enrollments where id = '${subjectEnrollmentId}');`)).toBe("draft");
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

// ---------------------------------------------------------------------------
// 계약 자동 발송 outbox의 나머지 두 트리거 — 직접 계정 생성 / 상담사 '정규 진행 권장'.
// (체험 completed 트리거는 위 골든 패스 test 7·8.) 둘 다 실제 화면 흐름으로 큐잉을
// 일으키고, 관리자 큐 화면 표시·멱등·발송 게이트 꺼짐을 확인한다. 실제 DocuSign·
// 이메일(로컬 Mailpit 제외) 발송은 없다.
// ---------------------------------------------------------------------------
const RUN = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

async function redeemAndCreateAccount(page: import("@playwright/test").Page, baseURL: string | undefined, token: string, expectedEmail: string) {
  await page.goto(`${baseURL}/api/trial-onboarding/redeem?token=${token}`);
  await expect(page).toHaveURL(/\/consult\/trial-onboarding\/confirm-email/, { timeout: 15000 });
  await expect(page.getByLabel("로그인 이메일")).toHaveValue(expectedEmail);
  await page.getByRole("button", { name: "이 이메일로 계속" }).click();
  await expect(page).toHaveURL(/\/set-password/, { timeout: 15000 });
  await page.getByLabel("새 비밀번호", { exact: true }).fill(DEV_PASSWORD);
  await page.getByLabel("새 비밀번호 확인").fill(DEV_PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "비밀번호 설정하고 계속하기" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/set-password"), { timeout: 15000 });
}

async function expectQueueRow(page: import("@playwright/test").Page, jobId: string, studentLabel: string, statusText: string) {
  await loginAs(page, ACCOUNTS.admin);
  await page.goto("/admin?tab=consult");
  await page.getByRole("button", { name: "정규 계약 발송" }).click();
  await expect(page.getByTestId("contract-dispatch-disabled-banner")).toBeVisible({ timeout: 15000 });
  const row = page.getByTestId(`contract-dispatch-job-${jobId}`);
  await expect(row).toBeVisible({ timeout: 15000 });
  await expect(row).toContainText(studentLabel);
  await expect(row).toContainText(statusText);
}

test.describe("M4 — 계약 자동 큐잉: 직접 계정 생성 · 정규 바로 진행 (실브라우저)", () => {
  const consultantId = randomUUID();
  const consultantName = `M4큐잉 컨설턴트 ${RUN}`;
  const directGuardianEmail = `m4q-direct-guardian-${RUN}@example.com`;
  const directStudentEmail = `m4q-direct-student-${RUN}@example.com`;
  const directStudentName = `M4큐잉 직접생성 학생 ${RUN}`;
  const regGuardianEmail = `m4q-reg-guardian-${RUN}@example.com`;
  const regStudentEmail = `m4q-reg-student-${RUN}@example.com`;
  const regStudentName = `M4큐잉 정규 학생 ${RUN}`;
  let directChildId = "";
  let directJobId = "";
  let regConsultationId = "";
  let regChildId = "";
  let regJobId = "";
  let regToken = "";

  test.beforeAll(() => {
    psql(`
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        email_change_token_current, phone_change, phone_change_token, reauthentication_token
      ) values (
        '00000000-0000-0000-0000-000000000000', '${consultantId}', 'authenticated', 'authenticated',
        'm4q-consultant-${RUN}@example.com', crypt('alton-dev-1234', gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', ''
      );
      insert into profiles (id, role, name) values ('${consultantId}', 'consultant', '${consultantName}');
    `);
    const prospect = psql(`insert into prospect_contacts (full_name, primary_email) values ('M4큐잉 정규 보호자 ${RUN}', '${regGuardianEmail}') returning id;`);
    // 결과 미기록 상태의 완료 상담 — 관리자(상담사 역할)가 화면에서 '정규 진행 권장'을 기록한다.
    regConsultationId = psql(
      `insert into consultations (source, status, contact_name, contact_email, starts_at, ends_at, completed_at, prospect_contact_id)
       values ('homepage', 'completed', 'M4큐잉 정규 보호자 ${RUN}', '${regGuardianEmail}', now() - interval '1 hour', now() - interval '30 minutes', now(), '${prospect}')
       returning id;`
    );
  });

  test.afterAll(() => {
    // 계정·큐 작업은 자녀 프로필 FK가 있어 지우지 않는다(실행 ID로 구분됨).
    // 이 스펙 전용 컨설턴트는 가능하면 정리하고, FK로 실패하면 실행 ID가 붙은 채 남는다.
    try {
      psql(`delete from consultant_assignments where consultant_id = '${consultantId}';`);
      psql(`delete from profiles where id = '${consultantId}';`);
      psql(`delete from auth.users where id = '${consultantId}';`);
    } catch {
      // ignore
    }
  });

  test("A1. 관리자: 직접 계정 생성 안내 발송", async ({ page }) => {
    test.setTimeout(60000);
    await loginAs(page, ACCOUNTS.admin);
    await page.goto("/admin?tab=consult");
    await page.getByRole("button", { name: "계정 생성", exact: true }).click();
    await page.getByRole("button", { name: "+ 부모 계정 생성" }).click();
    await page.getByPlaceholder("보호자 이름").fill(`M4큐잉 직접 보호자 ${RUN}`);
    await page.getByPlaceholder("보호자 이메일").fill(directGuardianEmail);
    await page.getByPlaceholder("학생 이름").fill(directStudentName);
    await page.getByPlaceholder("학생 이메일").fill(directStudentEmail);
    await expect(page.locator("select option", { hasText: consultantName })).toHaveCount(1, { timeout: 15000 });
    await page.locator("select").selectOption(consultantId);
    await page.getByRole("button", { name: "계정 생성 안내 발송" }).click();
    await expect(page.getByText("계정 생성 안내 발송 완료")).toBeVisible({ timeout: 15000 });
  });

  test("A2. 보호자 계정 생성 → 체험수업권 즉시 지급 + direct_account_created 큐잉", async ({ page, baseURL }) => {
    test.setTimeout(60000);
    const mail = await findLatestEmailTo(directGuardianEmail, "계정 생성 안내");
    const token = new URL(extractTrialOnboardingRedeemUrl(mail.html)).searchParams.get("token")!;
    await redeemAndCreateAccount(page, baseURL, token, directGuardianEmail);

    directChildId = psql(
      `select child_auth_user_id from trial_onboarding_link_students where student_email = '${directStudentEmail}' and status = 'created';`
    );
    expect(directChildId).toMatch(/^[0-9a-f-]{36}$/);
    // 계정 생성과 동시에 체험수업권이 'granted' — 동의 단계 없음.
    expect(
      psql(`select trial_entitlement_grant_status from trial_onboarding_link_students where child_auth_user_id = '${directChildId}';`)
    ).toBe("granted");
    const grantCount = () =>
      psql(
        `select count(*) from entitlement_grants eg join entitlement_products ep on ep.id = eg.entitlement_product_id
         where eg.child_id = '${directChildId}' and ep.code = 'trial_lesson_grant';`
      );
    expect(grantCount()).toBe("1");

    expect(psql(`select trigger_type || '|' || status || '|' || attempt_count from contract_dispatch_jobs where child_id = '${directChildId}';`)).toBe(
      "direct_account_created|queued|0"
    );
    directJobId = psql(`select id from contract_dispatch_jobs where child_id = '${directChildId}';`);
    // 멱등: 같은 이벤트·수업권 재지급 시도는 작업/수업권을 늘리지 않는다.
    psql(`select grant_trial_entitlement_for_student('${directChildId}');`);
    psql(`select enqueue_contract_dispatch_job('${directChildId}', 'direct_account_created');`);
    expect(psql(`select count(*) from contract_dispatch_jobs where child_id = '${directChildId}';`)).toBe("1");
    expect(grantCount()).toBe("1");
  });

  test("A3. 관리자 큐 화면에 '직접 계정 생성 · 대기 중'으로 보이고 게이트가 꺼져 있으면 발송하지 않는다", async ({ page }) => {
    test.setTimeout(60000);
    await expectQueueRow(page, directJobId, directStudentName, "직접 계정 생성 · 대기 중");
    await page.getByTestId("contract-dispatch-queue").getByRole("button", { name: "발송 실행" }).click();
    await expect(page.getByText("자동 발송이 비활성화되어 있어 아무 것도 처리하지 않았습니다.")).toBeVisible({ timeout: 15000 });
    expect(psql(`select status || '|' || attempt_count from contract_dispatch_jobs where id = '${directJobId}';`)).toBe("queued|0");
    expect(psql(`select count(*) from contract_versions where contract_id in (select id from contracts where child_id = '${directChildId}') and docusign_envelope_id is not null;`)).toBe("0");
  });

  test("B1. 상담사(관리자): 상담 결과 '정규 진행 권장' 기록 → 자녀 미확정이라 아직 큐잉 없음", async ({ page }) => {
    test.setTimeout(60000);
    await loginAs(page, ACCOUNTS.admin);
    await page.goto("/admin?tab=consult");
    await page.getByTestId(`kanban-card-${regConsultationId}`).click();
    const detail = page.getByTestId("consultation-card-detail");
    await expect(detail).toBeVisible({ timeout: 15000 });
    await detail.locator("select").selectOption("regular_recommended");
    await detail.getByPlaceholder("관리자 검토 요약(필수)").fill("M4 큐잉 E2E — 바로 정규 진행 권장");
    await detail.getByRole("button", { name: "기록", exact: true }).click();

    const sendButton = detail.getByRole("button", { name: "정규 등록 온보딩 안내 발송" });
    await expect(sendButton).toBeVisible({ timeout: 15000 });
    expect(psql(`select outcome from consultations where id = '${regConsultationId}';`)).toBe("regular_recommended");
    // 자녀가 아직 없으므로 큐잉이 지연된다.
    expect(psql(`select count(*) from consultations where family_root_consultation_id = '${regConsultationId}';`)).toBe("0");

    await detail.getByPlaceholder("보호자 이메일").fill(regGuardianEmail);
    await detail.getByPlaceholder("보호자 이름").fill(`M4큐잉 정규 보호자 ${RUN}`);
    await detail.getByPlaceholder("학생 이름").fill(regStudentName);
    await detail.getByPlaceholder("학생 이메일").fill(regStudentEmail);
    await sendButton.click();
    await expect(detail.getByTestId("trial-onboarding-link-progress-toggle")).toBeVisible({ timeout: 30000 });
    const mail = await findLatestEmailTo(regGuardianEmail, "온보딩 안내");
    regToken = new URL(extractTrialOnboardingRedeemUrl(mail.html)).searchParams.get("token")!;
    expect(regToken).toBeTruthy();
  });

  test("B2. 보호자 계정 생성 → 자녀 확정 시점에 regular_recommended 큐잉(체험수업권은 없음)", async ({ page, baseURL }) => {
    test.setTimeout(60000);
    await redeemAndCreateAccount(page, baseURL, regToken, regGuardianEmail);
    const cardId = psql(
      `select id from consultations where family_root_consultation_id = '${regConsultationId}' and is_child_onboarding_card;`
    );
    regChildId = psql(`select child_id from consultations where id = '${cardId}';`);
    expect(regChildId).toMatch(/^[0-9a-f-]{36}$/);

    expect(psql(`select trigger_type || '|' || status || '|' || attempt_count from contract_dispatch_jobs where child_id = '${regChildId}';`)).toBe(
      "regular_recommended|queued|0"
    );
    regJobId = psql(`select id from contract_dispatch_jobs where child_id = '${regChildId}';`);
    // 정규 바로 진행 경로는 체험을 거치지 않는다 — 체험수업권 미지급.
    expect(
      psql(
        `select count(*) from entitlement_grants eg join entitlement_products ep on ep.id = eg.entitlement_product_id
         where eg.child_id = '${regChildId}' and ep.code = 'trial_lesson_grant';`
      )
    ).toBe("0");
    // 멱등: 같은 이벤트 재발생(결과·child_id 재기록, 재큐잉)은 no-op.
    psql(`update consultations set outcome = 'regular_recommended', child_id = child_id where id = '${cardId}';`);
    psql(`select enqueue_contract_dispatch_job('${regChildId}', 'regular_recommended');`);
    expect(psql(`select count(*) from contract_dispatch_jobs where child_id = '${regChildId}';`)).toBe("1");
  });

  test("B3. 관리자 큐 화면에 '정규 바로 진행 · 대기 중'으로 보이고 발송은 없다", async ({ page }) => {
    test.setTimeout(60000);
    await expectQueueRow(page, regJobId, regStudentName, "정규 바로 진행 · 대기 중");
    await page.getByTestId("contract-dispatch-queue").getByRole("button", { name: "발송 실행" }).click();
    await expect(page.getByText("자동 발송이 비활성화되어 있어 아무 것도 처리하지 않았습니다.")).toBeVisible({ timeout: 15000 });
    expect(psql(`select status || '|' || attempt_count from contract_dispatch_jobs where id = '${regJobId}';`)).toBe("queued|0");
    expect(psql(`select count(*) from contract_versions where contract_id in (select id from contracts where child_id = '${regChildId}') and docusign_envelope_id is not null;`)).toBe("0");
  });
});
