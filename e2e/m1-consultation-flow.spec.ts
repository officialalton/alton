import { execFileSync } from "node:child_process";
import { test, expect } from "@playwright/test";
import { loginAs, ACCOUNTS } from "./helpers";

// M1 — 홈페이지 상담 신청 → 관리자 수락 → 상담 확정까지의 실브라우저 E2E.
// CALENDAR_SYNC_ALLOW_REAL_CALLS는 기본 false이므로 이 테스트에서도 실제 Google
// Calendar/Meet API는 호출되지 않는다 — 수락 후 google_sync_status가 'failed' 또는
// 'reconciliation_needed'로 남는 것(예약 자체는 절대 막지 않는 graceful degradation)
// 까지 확인한다. 실제 Sandbox 검증은 R6와 동일하게 별도 승인 절차를 거친다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

test.describe.configure({ mode: "serial" });

test.describe("M1 — 홈페이지 상담 신청→관리자 수락 흐름 (실브라우저)", () => {
  test.beforeAll(() => {
    // 이 스펙 전용 반복 가능시간을 등록해 다른 스펙과 슬롯이 겹치지 않게 한다.
    psql(`insert into consult_availability_rules (weekday, start_time, end_time) values (extract(dow from (now() + interval '10 day'))::smallint, '09:00', '20:00');`);
  });

  test("홈페이지에서 신청 → 관리자가 승인 대기 목록에서 확인 → 수락 → 예정 상담에 표시", async ({ page, context }) => {
    await page.goto("/");
    await page.getByLabel("학부모 이름").fill("이서아 보호자(M1 E2E)");
    await page.getByRole("textbox", { name: "이메일" }).fill(`m1-e2e-${Date.now()}@example.com`);

    // 슬롯 목록이 로드될 때까지 대기 후 첫 옵션 선택(관리자 등록 반복 가능시간 기준).
    const select = page.getByLabel("상담 희망 시간");
    await expect(select).toBeVisible();
    await page.waitForFunction(() => {
      const el = document.querySelector('select[aria-label="상담 희망 시간"]') as HTMLSelectElement | null;
      return !!el && el.options.length > 1;
    });
    const options = await select.locator("option").all();
    const value = await options[1].getAttribute("value");
    await select.selectOption(value!);

    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "상담 신청하기" }).click();

    await expect(page.getByText("상담 신청이 접수되었습니다.")).toBeVisible();

    // DB에서 방금 만든 상담이 requested 상태로 존재하는지 확인.
    const status = psql(`select status from consultations order by requested_at desc limit 1;`);
    expect(status).toBe("requested");
    const consultationId = psql(`select id from consultations order by requested_at desc limit 1;`);

    // 관리자 로그인 후 상담 운영 탭에서 수락.
    const adminPage = await context.newPage();
    await loginAs(adminPage, ACCOUNTS.admin);
    await adminPage.goto("/admin?tab=consult");
    await adminPage.getByText("상담 운영(신청·수락·캘린더)").click();
    await expect(adminPage.getByText("이서아 보호자(M1 E2E)")).toBeVisible();
    await adminPage.getByRole("button", { name: "수락(Calendar·Meet 생성)" }).first().click();

    await expect(adminPage.getByText("승인 대기 상담 신청 (0)")).toBeVisible({ timeout: 15_000 });

    const finalStatus = psql(`select status from consultations where id = '${consultationId}';`);
    expect(finalStatus).toBe("scheduled");
    // 실제 Google API 호출이 비활성화된 상태이므로 Calendar 동기화는 성공하지 않는다 —
    // 예약(상담 확정) 자체는 절대 막히지 않는다는 것이 이 검증의 핵심.
    const syncStatus = psql(`select google_sync_status from consultations where id = '${consultationId}';`);
    expect(["pending", "failed", "reconciliation_needed"]).toContain(syncStatus);
  });
});
