import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { psql, createFamily, cleanupFamily, type FixtureFamily } from "./fixtures";

// R6 — 자체 예약(신규 sessions/reservations) 실브라우저 E2E. 신규 예약→수업권 hold→취소→
// 수업권 release까지의 핵심 흐름을 검증한다. Google Calendar/Meet 실제 생성은
// CALENDAR_SYNC_ALLOW_REAL_CALLS 기본 false로 이 테스트에서도 검증하지 않는다(별도
// Google Sandbox 승인 필요 — R6 스펙 5절). 출결·수업권 최종소진·정산 판정은 R7 범위라
// 이 E2E에도 포함하지 않는다(2026-09-02 사용자 지시로 R6 범위에서 명시 제외됨).
// **(2026-09-03 갱신)** 개별 회차 예약용 Calendly/Zoom은 실제 Google Sandbox 통합 검증
// 통과 후 완전히 제거됐다 — 상담(consult_requests) 예약 Calendly는 애초에 이 스펙의
// 범위가 아니었고 ConsultForm으로 독립적으로 동작해 영향 없음.
//
// 2026-09-24 — 공용 시드 보호자(김민지)의 household에 박준서를 얹어 쓰던 것을
// 이 스펙 전용 부모+자녀+household로 옮김(e2e/fixtures.ts) — 공용 household를
// 더 이상 건드리지 않는다.
//
// 2026-09-24(2차) — 2026-09-19 UAT 반영으로 예약 진입이 독립 "Bookings"
// 탭(activeTab id: "bookings")으로 바뀌었고, 그 화면은 hideHeader로 열려
// "정규수업 예약" 제목 자체가 더 이상 렌더되지 않는다(제목이 없다고 검증을
// 지우지 않고, 실제 화면 구조에 맞춰 갱신한다). 슬롯도 이전엔 바로
// 보였지만 이제 "+ 새 수업 예약하기"를 먼저 열어야 과목·선생님 선택과
// 슬롯이 나온다.

const TEACHER_ID = "dddddddd-0000-0000-0000-000000000002"; // 이도현 선생님 — 유효한 시급 이력 보유(seed)
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001"; // SAT Math

let family: FixtureFamily;
let CHILD_ID: string;
let contractId: string;
let enrollmentId: string;
let grantId: string;

test.describe.configure({ mode: "serial" });

test.describe("R6 — 정규수업 예약 흐름 (실브라우저)", () => {
  test.beforeAll(() => {
    family = createFamily("r6-booking", { childNames: ["E2E R6예약테스트 학생"] });
    CHILD_ID = family.children[0].id;

    contractId = psql(
      `insert into contracts (household_id, child_id, status) values ('${family.householdId}', '${CHILD_ID}', 'active') returning id;`
    );
    enrollmentId = psql(
      `insert into subject_enrollments (child_id, subject_id, contract_id, status) values ('${CHILD_ID}', '${SUBJECT_ID}', '${contractId}', 'active') returning id;`
    );
    const adminId = psql(`select id from profiles where role='admin' limit 1;`);
    psql(
      `insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from, changed_by) values ('${enrollmentId}', '${TEACHER_ID}', 'active', now() - interval '1 day', '${adminId}');`
    );

    const productId = psql(`select id from entitlement_products limit 1;`);
    grantId = psql(
      `insert into entitlement_grants (child_id, entitlement_product_id, original_quantity, expires_at) values ('${CHILD_ID}', '${productId}', 5, now() + interval '90 days') returning id;`
    );
    psql(`insert into entitlement_ledger (grant_id, event_type, amount, business_event_id) values ('${grantId}', 'grant', 5, 'e2e-r6-grant');`);

    psql(
      `insert into teacher_availability_rules (teacher_id, day_of_week, start_time_local, end_time_local, timezone, created_by) select '${TEACHER_ID}', d, '00:00', '23:59', 'America/Los_Angeles', '${adminId}' from generate_series(0,6) d;`
    );
  });

  test.afterAll(() => {
    // entitlement_ledger는 R1부터 설계상 INSERT-only(재무 감사 이력) — 그 행이 참조하는
    // reservations/entitlement_grants는 물리 삭제할 수 없다(e2e/r4-purchase-flow.spec.ts의
    // 동일한 관례 참고). 여기서 지울 수 있는 것만 지우고, 나머지는 상태 전환으로 다음 실행이
    // unique 제약(child당 active 과목수강 1개, 선생님 겹침방지 등)과 충돌하지 않게만 만든다.
    psql(`delete from booking_notification_outbox where reservation_id in (select id from reservations where subject_enrollment_id = '${enrollmentId}');`);
    psql(`delete from reservation_cancellations where reservation_id in (select id from reservations where subject_enrollment_id = '${enrollmentId}');`);
    psql(`delete from teacher_availability_rules where teacher_id = '${TEACHER_ID}' and created_by = (select id from profiles where role='admin' limit 1);`);
    cleanupFamily(family);
  });

  test("보호자: 슬롯 예약 → 수업권 hold → 취소 → 수업권 release", async ({ page }) => {
    // 수업권 hold는 FIFO(만료 임박 순)로 어느 grant든 골라 쓸 수 있으므로(R1
    // hold_entitlement, 이 스펙이 만든 grant가 아니라 이 child의 다른 기존 grant가 뽑힐 수도
    // 있다) 특정 grantId의 잔액이 아니라 "예약에 실제로 걸린 hold/release 원장 이벤트"로
    // 검증한다 — 이게 FIFO 선택과 무관하게 항상 정확하다.
    await loginAs(page, family.parentEmail);
    await page.goto(`/parent?tab=bookings&child=${CHILD_ID}`);

    // hideHeader라 "정규수업 예약" 제목은 없다. showBookingForm의 초기값이
    // upcomingBookings.length === 0이라(app/student/LessonBookingTab.tsx) —
    // 이 fixture 학생은 예정된 수업이 아직 없으므로 "+ 새 수업 예약하기"를
    // 누를 필요 없이 폼(과목·선생님 선택)이 이미 펼쳐진 채로 로드된다.
    await expect(page.getByText("과목·선생님 선택")).toBeVisible({ timeout: 15000 });

    const firstSlotButton = page.locator("button").filter({ hasText: /오전|오후/ }).first();
    await expect(firstSlotButton).toBeVisible({ timeout: 15000 });
    await firstSlotButton.click();

    // R6 11/N: 슬롯 클릭은 이제 바로 확정하지 않고 요약 확인 카드를 띄운다(정책 #3
    // "시간 선택 후 요약 확인을 거쳐 최종 확정") — "최종 확정"을 한 번 더 눌러야 한다.
    await expect(page.getByText("예약 확인")).toBeVisible();
    await page.getByRole("button", { name: "최종 확정" }).click();

    await expect(page.getByText("예약이 확정됐습니다.")).toBeVisible({ timeout: 15000 });

    const reservationId = psql(
      `select id from reservations where subject_enrollment_id = '${enrollmentId}' and status='confirmed' limit 1;`
    );
    expect(reservationId).toBeTruthy();

    const holdAmount = Number(
      psql(`select amount from entitlement_ledger where reservation_id = '${reservationId}' and event_type = 'hold';`)
    );
    expect(holdAmount).toBe(-1);

    const outboxCount = Number(
      psql(`select count(*) from booking_notification_outbox where reservation_id = '${reservationId}';`)
    );
    expect(outboxCount).toBeGreaterThan(0);

    await page.getByRole("button", { name: "취소", exact: true }).first().click();
    await page.getByPlaceholder("예: 일정이 바뀌었어요").fill("E2E 테스트 취소");
    await page.getByRole("button", { name: "취소 확정" }).click();

    await expect(page.getByText("예약이 취소됐습니다.")).toBeVisible({ timeout: 15000 });

    const releaseAmount = Number(
      psql(`select amount from entitlement_ledger where reservation_id = '${reservationId}' and event_type = 'release';`)
    );
    expect(releaseAmount).toBe(1);

    const reservationStatus = psql(`select status from reservations where id = '${reservationId}';`);
    expect(reservationStatus).toBe("cancelled");
  });
});
