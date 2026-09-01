import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { test, expect } from "@playwright/test";
import { ACCOUNTS, loginAs } from "./helpers";

// R3 — 계약 버전 상태 전이 E2E: 발송 → declined 웹훅 → void, 재발송(새 버전) →
// 새 버전은 회사 선서명을 다시 거쳐야 발송 가능함을 확인한다.
//
// DocuSign 경계(공통 노트): 실제 발송은 하지 않는다 — psql로 발송 결과를
// 흉내내고, declined 이벤트는 실제 webhook 라우트에 정식 HMAC 서명으로 보내
// 진짜 프로덕션 코드 경로(void 전이)를 검증한다.
//
// 알려진 한계: "발송 성공 시 이전 active 버전이 superseded로 전이"되는 동작은
// sendContractForSignature 서버 액션 내부(실제 createEnvelope 성공 이후)에서만
// 일어난다. 그 함수를 실제로 호출하면 진짜 DocuSign sandbox를 때리게 되므로
// 이 E2E에서는 호출하지 않는다 — 이 전이 자체는
// app/admin/consultation-actions.test.ts의 "발송 성공 시 같은 계약의 다른
// active 버전을 superseded로 전이한다(재발송 지원)" 유닛 테스트가 목(mock)
// DocuSign으로 이미 검증한다. 여기서는 그 앞뒤 — "새 버전은 재선서명 전엔
// 발송 불가"라는 UI 게이트 — 만 실제 브라우저로 확인한다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const HOUSEHOLD_ID = "aabbccdd-0000-0000-0000-000000000001";
const CHILD_ID = "cccccccc-0000-0000-0000-000000000002";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  });
}

function cleanup() {
  psql(`
    delete from contract_versions where contract_id in (select id from contracts where child_id = '${CHILD_ID}');
    delete from contracts where child_id = '${CHILD_ID}';
    delete from proposal_subjects where proposal_id in (select id from proposals where consultation_id in (select id from consultations where contact_email like 'r3-version-e2e-%@example.com'));
    delete from proposals where consultation_id in (select id from consultations where contact_email like 'r3-version-e2e-%@example.com');
    delete from trial_sessions where child_id = '${CHILD_ID}';
    delete from consultations where contact_email like 'r3-version-e2e-%@example.com';
  `);
}

test.describe("R3 — 계약 버전 상태 전이 (declined → void → 재발송)", () => {
  const secret = process.env.DOCUSIGN_WEBHOOK_TOKEN ?? "";
  test.skip(!secret, "DOCUSIGN_WEBHOOK_TOKEN이 로컬 env에 없어 웹훅 시뮬레이션을 할 수 없습니다.");

  test.beforeAll(() => cleanup());
  test.afterAll(() => cleanup());

  test("v1 declined로 void → 재발송 시 v2는 재선서명 전엔 발송 불가", async ({ page, request, baseURL }) => {
    test.setTimeout(90000);
    const email = `r3-version-e2e-${Date.now()}@example.com`;

    // 1. 상담 → 체험 → 완료 → 제안서 → 수락 → 계약(v1) 생성까지 UI로 빠르게 진행.
    await loginAs(page, ACCOUNTS.admin);
    await page.goto("/admin?tab=consult");
    await page.getByRole("button", { name: "상담 등록" }).click();
    await page.getByPlaceholder("보호자/학생 이름").fill("R3 버전전이 보호자");
    await page.getByPlaceholder("이메일").fill(email);
    await page.getByRole("button", { name: "등록" }).click();

    const consultCard = page.locator('[data-testid^="consultation-card-"]', { hasText: email });
    await expect(consultCard).toBeVisible();
    const consultationId = psql(`select id from consultations where contact_email = '${email}';`).trim();

    await page.getByRole("button", { name: "체험 관리" }).click();
    await page.getByRole("button", { name: "체험 생성" }).click();
    await page.locator("select").selectOption({ label: `R3 버전전이 보호자 (${email})` });
    await page.getByPlaceholder("학생(child) ID").fill(CHILD_ID);
    await page.getByPlaceholder("과목 ID").fill(SUBJECT_ID);
    await page.getByPlaceholder("선생님 ID").fill(TEACHER_ID);
    await page.locator('input[type="datetime-local"]').fill("2026-10-05T10:00");
    await page.getByRole("button", { name: "체험 생성" }).last().click();
    await page.waitForTimeout(3000);

    const trialId = psql(`select id from trial_sessions where consultation_id = '${consultationId}';`).trim();
    await page.reload();
    await page.getByRole("button", { name: "체험 관리" }).click();
    const trialCard = page.locator(`[data-testid="trial-card-${trialId}"]`);
    await trialCard.getByRole("button", { name: "관리" }).click();
    await trialCard.getByRole("button", { name: "체험 완료 처리" }).click();
    await page.waitForTimeout(3000);

    await page.reload();
    await page.getByRole("button", { name: "제안서 관리" }).click();
    await page.getByRole("button", { name: "제안서 생성" }).click();
    await page.locator("select").selectOption({ label: "이서아 · SAT Math" });
    await page.getByPlaceholder("추천 선생님 ID").fill(TEACHER_ID);
    await page.getByPlaceholder("추천 과목 ID").fill(SUBJECT_ID);
    await page.getByPlaceholder("추천 회차 수").fill("12");
    await page.getByPlaceholder("가격(원 단위, 최소단위)").fill("1200000");
    await page.getByRole("button", { name: "제안서 생성" }).last().click();
    await page.waitForTimeout(3000);

    const proposalId = psql(`select id from proposals where consultation_id = '${consultationId}';`).trim();
    await page.reload();
    await page.getByRole("button", { name: "제안서 관리" }).click();
    const proposalCard = page.locator(`[data-testid="proposal-card-${proposalId}"]`);
    await proposalCard.getByRole("button", { name: "발송" }).click();
    await page.waitForTimeout(3000);
    await page.reload();
    await page.getByRole("button", { name: "제안서 관리" }).click();
    await proposalCard.getByRole("button", { name: "수락 처리" }).click();
    await page.waitForTimeout(3000);

    await page.goto("/admin?tab=contracts");
    const newContractRow = page.locator(`[data-testid="new-contract-row-${proposalId}"]`);
    await newContractRow.getByRole("button", { name: "계약 생성" }).click();
    await page.waitForTimeout(3000);

    const contractId = psql(`select id from contracts where child_id = '${CHILD_ID}';`).trim();
    const v1Id = psql(
      `select id from contract_versions where contract_id = '${contractId}' order by version_number asc limit 1;`
    ).trim();

    // 2. v1 회사 선서명 → 발송 결과를 psql로 흉내(실제 DocuSign 호출 없음).
    await page.reload();
    const contractCard = page.locator(`[data-testid="contract-card-${contractId}"]`);
    await contractCard.getByRole("button", { name: "관리" }).click();
    await contractCard.getByRole("button", { name: "회사 선서명 승인" }).click();
    await page.waitForTimeout(3000);

    const envelopeV1 = `env-e2e-v1-${Date.now()}`;
    psql(`
      update contract_versions set docusign_envelope_id = '${envelopeV1}',
        docusign_envelope_status = 'sent', docusign_status_updated_at = now(), version_status = 'active'
        where id = '${v1Id}';
      update contracts set status = 'sent' where id = '${contractId}';
    `);

    // 3. 실제 webhook 라우트로 declined 이벤트를 정식 서명으로 보낸다 — 진짜
    // 프로덕션 코드 경로(void 전이 + 사유 저장)를 검증한다.
    function sign(body: string): string {
      return createHmac("sha256", secret).update(body, "utf8").digest("base64");
    }
    const declinedPayload = JSON.stringify({
      event: "envelope-declined",
      data: {
        envelopeId: envelopeV1,
        envelopeSummary: { recipients: { signers: [{ declineReason: "보호자가 조건 재검토 요청" }] } },
      },
    });
    const declinedRes = await request.post(`${baseURL}/api/webhooks/docusign`, {
      data: declinedPayload,
      headers: { "X-DocuSign-Signature-1": sign(declinedPayload), "Content-Type": "application/json" },
    });
    expect(declinedRes.status()).toBe(200);

    // 4. UI에 void + 사유가 보여야 한다.
    await page.reload();
    await contractCard.getByRole("button", { name: "관리" }).click();
    await expect(contractCard.getByText("(무효)")).toBeVisible();
    await expect(contractCard.getByText("무효화: 보호자가 조건 재검토 요청", { exact: false })).toBeVisible();

    const voidedStatus = psql(`select status, void_reason from contracts where id = '${contractId}';`).trim();
    expect(voidedStatus).toContain("void");
    expect(voidedStatus).toContain("보호자가 조건 재검토 요청");

    // 5. 재발송(새 버전 v2) — 실제 UI 액션, DocuSign 호출 없음.
    await contractCard.getByRole("button", { name: "새 버전으로 재발송 준비" }).click();
    await page.waitForTimeout(3000);

    await page.reload();
    await contractCard.getByRole("button", { name: "관리" }).click();
    await expect(contractCard.getByText("최신 버전 (v2)")).toBeVisible();

    // 6. v2는 회사 선서명이 안 됐으므로 발송이 막혀야 한다(이메일 입력란이
    // 렌더되지 않고, 안내 문구만 보여야 한다).
    await expect(contractCard.getByText("발송 버튼은 회사 선서명이 완료되어야 활성화됩니다.")).toBeVisible();
    await expect(contractCard.getByPlaceholder("수신자 이메일")).toHaveCount(0);

    const v2Id = psql(
      `select id from contract_versions where contract_id = '${contractId}' order by version_number desc limit 1;`
    ).trim();
    const v2SignedAt = psql(
      `select coalesce(company_signed_at::text, 'null') from contract_versions where id = '${v2Id}';`
    ).trim();
    expect(v2SignedAt).toBe("null");

    // 7. v2 회사 선서명을 완료하면 그제서야 발송 입력란이 열린다.
    await contractCard.getByRole("button", { name: "회사 선서명 승인" }).click();
    await page.waitForTimeout(3000);
    await page.reload();
    await contractCard.getByRole("button", { name: "관리" }).click();
    await expect(contractCard.getByPlaceholder("수신자 이메일")).toBeVisible();
  });
});
