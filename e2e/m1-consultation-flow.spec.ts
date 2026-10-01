import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { loginAs, ACCOUNTS } from "./helpers";
import { findLatestEmailTo } from "./mailbox";

// M1 — 홈페이지 상담 신청 → 관리자 컨설턴트 배정 → 예약 링크 발송 → 고객이 링크에서
// 시간 선택 → 상담 확정까지의 실브라우저 E2E.
//
// 2026-09-29 갱신 — 2026-09-22(컨설턴트 스펙 Phase 2b)부터 랜딩 폼에는 슬롯 선택이
// 없다. 신청은 접수만 되고(status='requested', starts_at=null), 관리자가 어드미션
// 컨설턴트를 배정한 뒤 "링크 보내기"를 누르면 그 컨설턴트 전용 예약 링크(/schedule/
// <token>)가 이메일로 나가며, 고객이 그 링크에서 컨설턴트의 가능 시간 중 하나를
// 골라야 상담이 확정된다. 예전의 "승인 대기 → 수락" 경로는 이 흐름에서 쓰이지 않는다.
//
// CALENDAR_SYNC_ALLOW_REAL_CALLS는 기본 false이므로 실제 Google Calendar/Meet API는
// 호출되지 않는다 — 확정 후 google_sync_status가 'pending/failed/reconciliation_needed'
// 로 남는 것(예약 자체는 절대 막지 않는 graceful degradation)까지 확인한다.
// 이메일은 로컬 Mailpit에만 간다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

const RUN_ID = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
const PARENT_NAME = `M1E2E 보호자 ${RUN_ID}`;
const PARENT_EMAIL = `m1-e2e-${RUN_ID}@example.com`;
const CONSULTANT_NAME = `M1E2E 컨설턴트 ${RUN_ID}`;
const CONSULTANT_ID = randomUUID();
let consultationId = "";
const extraConsultationIds: string[] = [];
let autoAssignOn = false;

test.describe.configure({ mode: "serial" });

test.describe("M1 — 홈페이지 상담 신청→컨설턴트 배정→예약 링크 흐름 (실브라우저)", () => {
  test.beforeAll(() => {
    // 자동배정이 켜져 있으면 신청이 미배정 큐를 거치지 않는다 — 전역 설정이라 이 스펙이
    // 바꾸지 않고, 켜져 있으면 스킵한다.
    autoAssignOn = psql(`select auto_assign_enabled from consultant_assignment_settings where id;`) === "t";
    if (autoAssignOn) return;

    // 이 스펙 전용 컨설턴트 + 그 컨설턴트 개인 가능시간(매일 09~20시).
    psql(`
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        email_change_token_current, phone_change, phone_change_token, reauthentication_token
      ) values (
        '00000000-0000-0000-0000-000000000000', '${CONSULTANT_ID}', 'authenticated', 'authenticated',
        'm1-e2e-consultant-${RUN_ID}@example.com', crypt('alton-dev-1234', gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', ''
      );
      insert into profiles (id, role, name) values ('${CONSULTANT_ID}', 'consultant', '${CONSULTANT_NAME}');
      insert into consult_availability_rules (weekday, start_time, end_time, consultant_id)
        select d, '09:00', '20:00', '${CONSULTANT_ID}' from generate_series(0, 6) d;
    `);
  });

  test.afterAll(() => {
    if (consultationId) {
      // consultations는 consultation_status_events(INSERT-only 감사 이력)가 참조해 지울 수
      // 없다. 대신 취소 처리해 시간대 배타 제약(consultations_no_overlap이 requested/
      // scheduled만 대상으로 함)에서 빼 다음 실행·다른 스펙과 슬롯이 겹치지 않게 한다.
      psql(`update consultations set status = 'cancelled' where id = '${consultationId}' and status in ('requested', 'scheduled');`);
    }
    for (const id of extraConsultationIds) {
      psql(`update consultations set status = 'cancelled' where id = '${id}' and status in ('requested', 'scheduled');`);
    }
    psql(`delete from consult_availability_rules where consultant_id = '${CONSULTANT_ID}';`);
  });

  test("홈페이지 신청 → 접수만 되고(일정 없음) 관리자 미배정 큐에 나타난다", async ({ page, context }) => {
    test.skip(autoAssignOn, "자동배정이 켜져 있어 미배정 큐를 거치지 않는다.");
    await page.goto("/");
    await page.getByLabel("학부모 이름").fill(PARENT_NAME);
    await page.getByRole("textbox", { name: "이메일" }).fill(PARENT_EMAIL);
    // 랜딩 폼에는 더 이상 캘린더/시간 선택이 없다.
    await expect(page.getByTestId("consult-slot-calendar")).toHaveCount(0);

    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "상담 신청하기" }).click();
    await expect(page.getByText("상담 신청이 접수되었습니다.")).toBeVisible();
    await expect(page.getByText(/담당 컨설턴트가 배정되면 예약 링크를 이메일로 보내드립니다/)).toBeVisible();

    const row = psql(
      `select id || '|' || status || '|' || coalesce(starts_at::text, 'null') from consultations where contact_email = '${PARENT_EMAIL}';`
    ).split("|");
    consultationId = row[0];
    expect(row[1]).toBe("requested");
    expect(row[2]).toBe("null");

    const adminPage = await context.newPage();
    await loginAs(adminPage, ACCOUNTS.admin);
    await adminPage.goto("/admin?tab=consultants");
    await expect(adminPage.getByText(PARENT_NAME)).toBeVisible();
  });

  test("관리자가 컨설턴트 배정 → 링크 보내기 → 고객이 링크에서 시간 선택 → 상담 확정", async ({ page, browser }) => {
    test.skip(autoAssignOn, "자동배정이 켜져 있어 미배정 큐를 거치지 않는다.");
    test.setTimeout(90000);

    await loginAs(page, ACCOUNTS.admin);
    await page.goto("/admin?tab=consultants");

    const unassignedCard = page.locator("div.border-\\[1\\.5px\\].rounded-xl").filter({ hasText: PARENT_NAME }).filter({ has: page.locator("select") });
    await unassignedCard.locator("select").selectOption({ label: CONSULTANT_NAME });
    await unassignedCard.getByRole("button", { name: "배정" }).click();

    const awaitingCard = page.locator("div.border-\\[1\\.5px\\].rounded-xl").filter({ hasText: PARENT_NAME }).filter({ has: page.getByRole("button", { name: "링크 보내기" }) });
    await expect(awaitingCard).toBeVisible({ timeout: 30000 });
    await awaitingCard.getByRole("button", { name: "링크 보내기" }).click();
    await expect(
      page.locator("div.border-\\[1\\.5px\\].rounded-xl").filter({ hasText: PARENT_NAME }).getByText("링크 발송됨")
    ).toBeVisible({ timeout: 15000 });

    // 실제로 (로컬 Mailpit에) 발송된 메일에서 예약 링크를 꺼낸다.
    const mail = await findLatestEmailTo(PARENT_EMAIL);
    const match = mail.html.match(/https?:\/\/[^\s"<]+\/schedule\/[0-9a-f]+/);
    expect(match, "메일 본문에서 예약 링크를 찾지 못했습니다").not.toBeNull();
    const schedulePath = new URL(match![0]).pathname;

    // 고객(비로그인)이 링크에서 컨설턴트의 가능 시간 중 하나를 고른다.
    const customerContext = await browser.newContext();
    const customer = await customerContext.newPage();
    await customer.goto(schedulePath);
    await expect(customer.getByText("상담 시간을 선택해 주세요")).toBeVisible();
    const calendar = customer.getByTestId("consult-slot-calendar");
    await expect(calendar).toBeVisible();
    let dayWithSlot = calendar.locator("button:has(span.rounded-full)").first();
    for (let attempt = 0; attempt < 3 && (await dayWithSlot.count()) === 0; attempt++) {
      await calendar.getByRole("button", { name: "다음 달" }).click();
      dayWithSlot = calendar.locator("button:has(span.rounded-full)").first();
    }
    await expect(dayWithSlot).toBeVisible();
    // 다른 실행·스펙의 상담과 시간이 겹치지 않도록 첫 슬롯이 아니라 무작위 날짜·시간을 고른다
    // (홈페이지 신청은 미배정 시간 행이라 consultations_unassigned_no_overlap이 전사 단위로 막는다;
    // 배정된 상담은 컨설턴트별 consultations_no_overlap 이다 — 20261908000000).
    const badgedDays = calendar.locator("button:has(span.rounded-full)");
    await badgedDays.nth(Math.floor(Math.random() * (await badgedDays.count()))).click();
    const timeButtons = customer.getByRole("group", { name: "상담 희망 시간 선택" }).locator("button");
    await timeButtons.nth(Math.floor(Math.random() * (await timeButtons.count()))).click();
    await expect(customer.getByTestId("consult-slot-confirmation")).toBeVisible();
    await customer.getByRole("button", { name: "이 시간으로 확정하기" }).click();
    // 확정 자체는 DB 상태로 확인한다. "확정되었습니다" 성공 화면은 아래 별도 테스트가 다룬다.
    await expect
      .poll(() => psql(`select status from consultations where id = '${consultationId}';`), { timeout: 15000 })
      .toBe("scheduled");
    await customerContext.close();

    const finalStatus = psql(`select status from consultations where id = '${consultationId}';`);
    expect(finalStatus).toBe("scheduled");
    expect(psql(`select admissions_consultant_id from consultations where id = '${consultationId}';`)).toBe(CONSULTANT_ID);
    // 실제 Google API 호출이 비활성화된 상태이므로 Calendar 동기화는 성공하지 않는다 —
    // 예약(상담 확정) 자체는 절대 막히지 않는다는 것이 이 검증의 핵심.
    const syncStatus = psql(`select google_sync_status from consultations where id = '${consultationId}';`);
    expect(["pending", "failed", "reconciliation_needed"]).toContain(syncStatus);
  });

  // 2026-09-29 회귀 방지: 예전에는 ScheduleForm 재조회로 성공 직후 '유효하지 않거나 만료된 링크'가 떴다(수정됨).
  test("예약 성공 직후 고객 화면은 확정 안내를 보여준다", async ({ browser }) => {
    test.skip(autoAssignOn, "자동배정이 켜져 있어 이 스펙 전용 컨설턴트를 만들지 않았다.");

    const email = `m1-e2e-direct-${RUN_ID}@example.com`;
    const token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "").slice(0, 16);
    const id = psql(
      `insert into consultations (source, status, contact_name, contact_email, admissions_consultant_id, intake_owner_id)
       values ('homepage', 'requested', 'M1E2E 직접 보호자 ${RUN_ID}', '${email}', '${CONSULTANT_ID}', '${CONSULTANT_ID}') returning id;`
    );
    extraConsultationIds.push(id);
    psql(
      `insert into consultation_scheduling_links (consultation_id, consultant_id, token, expires_at)
       values ('${id}', '${CONSULTANT_ID}', '${token}', now() + interval '1 day');`
    );

    const context = await browser.newContext();
    const customer = await context.newPage();
    await customer.goto(`/schedule/${token}`);
    const calendar = customer.getByTestId("consult-slot-calendar");
    await expect(calendar).toBeVisible();
    const badgedDays = calendar.locator("button:has(span.rounded-full)");
    await badgedDays.nth(Math.floor(Math.random() * (await badgedDays.count()))).click();
    const timeButtons = customer.getByRole("group", { name: "상담 희망 시간 선택" }).locator("button");
    await timeButtons.nth(Math.floor(Math.random() * (await timeButtons.count()))).click();
    await customer.getByRole("button", { name: "이 시간으로 확정하기" }).click();

    await expect(customer.getByText("상담 일정이 확정되었습니다.")).toBeVisible({ timeout: 10000 });
    await context.close();
  });
});
