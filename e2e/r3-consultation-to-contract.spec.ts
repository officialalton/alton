import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { ACCOUNTS, loginAs } from "./helpers";

// R3 — 관리자 핵심 흐름: 상담 → 체험 → 제안서 → 계약(회사 선서명 → 발송 →
// 서명완료) 전체를 실제 admin UI로 검증한다.
//
// DocuSign 경계: sendContractForSignature 서버 액션은 실제 DocuSign REST 호출을
// 한다(lib/docusign.ts createEnvelope, .env.local에 실제 sandbox 자격증명이
// 설정돼 있다). Playwright page.route()는 브라우저 쪽 네트워크만 가로채고 이
// 호출은 Next 서버 프로세스 안에서 일어나므로 가로챌 수 없다 — 그리고 이
// 저장소에는 외부 서비스 호출을 스텁하는 기존 E2E 컨벤션이 없다(Workspace
// 계열은 WORKSPACE_*_ALLOW_REAL_CALLS 플래그로 앱 코드 자체에 스위치가 있지만
// DocuSign 발송에는 그런 플래그가 없다). 따라서: 실제 "발송" 버튼은 클릭하지
// 않는다. 대신 (a) 회사 선서명까지는 실제 UI로 수행하고, (b) "발송됨" 상태는
// psql로 발송 이후 상태(DocuSign가 실제로 만들었을 envelope 필드)만 흉내 내
// UI 렌더링을 검증하고, (c) 이후 완료 이벤트는 실제 webhook 라우트(같은
// origin, 외부 호출 아님)에 route.test.ts와 동일한 HMAC 서명 방식으로 직접
// POST해 실제 프로덕션 코드 경로로 상태를 completed/active로 전이시킨다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const HOUSEHOLD_ID = "aabbccdd-0000-0000-0000-000000000001";
const CHILD_ID = "cccccccc-0000-0000-0000-000000000002"; // 이서아 (17세, 성인 취급 — 동의 게이트 무관)
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001"; // SAT Math
const WEBHOOK_SECRET = process.env.DOCUSIGN_WEBHOOK_TOKEN ?? "";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  });
}

function cleanup() {
  psql(`
    delete from external_event_receipts where payload->>'test_marker' = 'r3-consultation-to-contract';
    delete from drive_artifacts where contract_id in (select id from contracts where child_id = '${CHILD_ID}');
    delete from contract_versions where contract_id in (select id from contracts where child_id = '${CHILD_ID}');
    delete from contracts where child_id = '${CHILD_ID}';
    delete from proposal_subjects where proposal_id in (select id from proposals where consultation_id in (select id from consultations where child_id = '${CHILD_ID}'));
    delete from proposals where consultation_id in (select id from consultations where child_id = '${CHILD_ID}');
    delete from trial_sessions where child_id = '${CHILD_ID}';
    delete from consultations where child_id = '${CHILD_ID}' or contact_email like 'r3-e2e-%@example.com';
  `);
}

function signWebhookBody(body: unknown): { rawBody: string; signature: string } {
  const rawBody = JSON.stringify(body);
  const signature = createHmac("sha256", WEBHOOK_SECRET).update(rawBody, "utf8").digest("base64");
  return { rawBody, signature };
}

test.describe("R3 — 상담→체험→제안서→계약 관리자 핵심 흐름", () => {
  test.skip(!WEBHOOK_SECRET, "DOCUSIGN_WEBHOOK_TOKEN이 로컬 env에 없어 웹훅 시뮬레이션을 할 수 없습니다.");

  test.beforeAll(() => cleanup());
  test.afterAll(() => cleanup());

  test("상담 등록부터 계약 서명완료(웹훅 시뮬레이션)까지", async ({ page, request, baseURL }) => {
    test.setTimeout(90000);
    const email = `r3-e2e-${Date.now()}@example.com`;

    // 1. 관리자 로그인 → 상담 등록
    await loginAs(page, ACCOUNTS.admin);
    await page.goto("/admin?tab=consult");
    await page.getByRole("button", { name: "상담 등록" }).click();
    await page.getByPlaceholder("보호자/학생 이름").fill("R3 E2E 보호자");
    await page.getByPlaceholder("이메일").fill(email);
    await page.getByPlaceholder("학년").fill("11학년");
    await page.getByRole("button", { name: "등록" }).click();

    const consultCard = page.locator('[data-testid^="consultation-card-"]', { hasText: email });
    await expect(consultCard).toBeVisible();

    // 2. 예약 → 완료
    await consultCard.getByRole("button", { name: "관리" }).click();
    await consultCard.locator('input[type="datetime-local"]').fill("2026-10-01T10:00");
    await consultCard.getByRole("button", { name: "예약", exact: true }).click();
    await expect(consultCard.getByText("예약됨", { exact: false })).toBeVisible();

    // consultationId를 뒤에서 쓰기 위해 DB에서 조회
    const consultationId = psql(
      `select id from consultations where contact_email = '${email}';`
    ).trim();
    expect(consultationId).toMatch(/^[0-9a-f-]{36}$/);
    psql(`update consultations set status = 'completed', completed_at = now() where id = '${consultationId}';`);

    // 3. 체험 생성 (UI, 체험 세션 탭)
    await page.goto("/admin?tab=consult");
    await page.getByRole("button", { name: "체험 관리" }).click();
    await page.getByRole("button", { name: "체험 생성" }).click();
    await page.locator("select").selectOption({ label: `R3 E2E 보호자 (${email})` });
    await page.getByPlaceholder("학생(child) ID").fill(CHILD_ID);
    await page.getByPlaceholder("과목 ID").fill(SUBJECT_ID);
    await page.getByPlaceholder("선생님 ID").fill(TEACHER_ID);
    await page.locator('input[type="datetime-local"]').fill("2026-10-05T10:00");
    await page.getByPlaceholder("체험 목표(goal) — 체험 전 사전 계획").fill("SAT Math 진단");
    await page.getByRole("button", { name: "체험 생성" }).last().click();
    // 서버 액션이 client-side 새로고침을 트리거하지 않으므로(이 탭 전체가
    // 아직 router.refresh()를 쓰지 않는다), 응답이 끝날 때까지만 기다린다 —
    // 화면 자체는 다음 단계에서 page.reload()로 새로 가져온다.
    await page.waitForTimeout(3000);

    const trialId = psql(
      `select id from trial_sessions where consultation_id = '${consultationId}';`
    ).trim();
    expect(trialId).toMatch(/^[0-9a-f-]{36}$/);

    // 4. 체험 완료 처리 (결과 노트/추천)
    await page.reload();
    await page.getByRole("button", { name: "체험 관리" }).click();
    const trialCard = page.locator(`[data-testid="trial-card-${trialId}"]`);
    await trialCard.getByRole("button", { name: "관리" }).click();
    await trialCard.getByPlaceholder("결과 노트").fill("기초 개념은 탄탄, 응용 문제 훈련 필요");
    await trialCard.getByPlaceholder("추천 사항").fill("SAT Math 주 2회 12주 추천");
    await trialCard.getByRole("button", { name: "체험 완료 처리" }).click();
    await page.waitForTimeout(3000);

    // 이 탭은 서버 액션 후 자동으로 목록을 새로고침하지 않는다(발견한 사항 —
    // 보고서 참고) — 실제 관리자도 지금은 새로고침해야 상태 변화를 본다.
    await page.reload();
    await page.getByRole("button", { name: "체험 관리" }).click();
    await expect(trialCard.getByText("(completed)")).toBeVisible();

    // 5. 제안서 생성 → 발송 → 수락
    await page.getByRole("button", { name: "제안서 관리" }).click();
    await page.getByRole("button", { name: "제안서 생성" }).click();
    await page.locator("select").selectOption({ label: "이서아 · SAT Math" });
    await page.getByPlaceholder("추천 선생님 ID").fill(TEACHER_ID);
    await page.getByPlaceholder("추천 과목 ID").fill(SUBJECT_ID);
    await page.getByPlaceholder("추천 회차 수").fill("12");
    await page.getByPlaceholder("가격(원 단위, 최소단위)").fill("1200000");
    await page.getByRole("button", { name: "제안서 생성" }).last().click();
    await page.waitForTimeout(3000);

    const proposalId = psql(
      `select id from proposals where consultation_id = '${consultationId}';`
    ).trim();
    expect(proposalId).toMatch(/^[0-9a-f-]{36}$/);

    await page.reload();
    await page.getByRole("button", { name: "제안서 관리" }).click();
    const proposalCard = page.locator(`[data-testid="proposal-card-${proposalId}"]`);
    await proposalCard.getByRole("button", { name: "발송" }).click();
    await page.waitForTimeout(3000);
    await page.reload();
    await page.getByRole("button", { name: "제안서 관리" }).click();
    await expect(proposalCard.getByText("(sent)")).toBeVisible();
    await proposalCard.getByRole("button", { name: "수락 처리" }).click();
    await page.waitForTimeout(3000);
    await page.reload();
    await page.getByRole("button", { name: "제안서 관리" }).click();
    await expect(proposalCard.getByText("(accepted)")).toBeVisible();

    // 6. 계약 생성 (수락된 제안서로부터)
    await page.goto("/admin?tab=contracts");
    const newContractRow = page.locator(`[data-testid="new-contract-row-${proposalId}"]`);
    await expect(newContractRow).toBeVisible();
    await expect(newContractRow.getByText("계약을 생성할 수 없습니다")).toHaveCount(0);
    await newContractRow.getByRole("button", { name: "계약 생성" }).click();
    await expect(newContractRow).toHaveCount(0);

    const contractId = psql(`select id from contracts where child_id = '${CHILD_ID}';`).trim();
    expect(contractId).toMatch(/^[0-9a-f-]{36}$/);
    const contractVersionId = psql(
      `select id from contract_versions where contract_id = '${contractId}';`
    ).trim();

    // 7. 회사 선서명 (실제 UI 액션)
    await page.reload();
    const contractCard = page.locator(`[data-testid="contract-card-${contractId}"]`);
    await contractCard.getByRole("button", { name: "관리" }).click();
    await expect(contractCard.getByText("회사 선서명: 대기")).toBeVisible();
    await contractCard.getByRole("button", { name: "회사 선서명 승인" }).click();
    await page.waitForTimeout(3000);
    await page.reload();
    await contractCard.getByRole("button", { name: "관리" }).click();
    await expect(contractCard.getByText("회사 선서명: 완료", { exact: false })).toBeVisible();

    // 8. "발송" 버튼은 실제 DocuSign 호출을 트리거하므로 클릭하지 않는다 — 대신
    // 발송이 활성화 가능한 상태(회사 선서명 완료, envelope 없음)인지만 UI로 확인한다.
    await expect(contractCard.getByPlaceholder("수신자 이메일")).toBeEnabled();

    // 9. 발송 결과를 psql로 흉내낸다(=실제 DocuSign 응답으로 sendContractForSignature가
    // 저장했을 값과 동일한 모양) — DocuSign에는 어떤 네트워크 요청도 보내지 않는다.
    const fakeEnvelopeId = `env-e2e-${randomUUID()}`;
    psql(`
      update contract_versions set docusign_envelope_id = '${fakeEnvelopeId}',
        docusign_envelope_status = 'sent', docusign_status_updated_at = now()
        where id = '${contractVersionId}';
      update contracts set status = 'sent' where id = '${contractId}';
    `);

    await page.reload();
    await contractCard.getByRole("button", { name: "관리" }).click();
    await expect(contractCard.getByText("Envelope: sent", { exact: false })).toBeVisible();
    await expect(contractCard.getByText("(발송됨)")).toBeVisible();

    // 10. 실제 webhook 라우트에 envelope-completed 이벤트를 정식 HMAC 서명으로
    // POST한다 — 이건 로컬 dev 서버 자기 자신에 대한 same-origin 호출이라
    // "외부 서비스 호출"이 아니라 우리 자신의 webhook 핸들러 코드를 검증하는 것이다.
    const payload = {
      event: "envelope-completed",
      data: { envelopeId: fakeEnvelopeId },
      test_marker: "r3-consultation-to-contract",
    };
    const { rawBody, signature } = signWebhookBody(payload);
    const webhookRes = await request.post(`${baseURL}/api/webhooks/docusign`, {
      data: rawBody,
      headers: { "X-DocuSign-Signature-1": signature, "Content-Type": "application/json" },
    });
    expect(webhookRes.status()).toBe(200);

    // 11. UI에서 계약이 서명완료 → 결제 가능 상태(active)로 반영됐는지 확인.
    await page.reload();
    await contractCard.getByRole("button", { name: "관리" }).click();
    await expect(contractCard.getByText("(활성)")).toBeVisible();
    await expect(contractCard.getByText("Envelope: completed", { exact: false })).toBeVisible();

    const finalStatus = psql(`select status from contracts where id = '${contractId}';`).trim();
    expect(finalStatus).toBe("active");
  });
});
