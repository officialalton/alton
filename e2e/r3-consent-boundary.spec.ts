import { execFileSync } from "node:child_process";
import { test, expect } from "@playwright/test";
import { ACCOUNTS, loginAs } from "./helpers";

// R3 — 보호자 동의 → 체험 생성 → 계약 → 결제 진입 경계(R3/R4 handoff) E2E.
//
// 동의 게이트 자체(assert_guardian_consent_ok 트리거의 경계값 로직)는 이미
// app/admin/trial-sessions-guardian-consent.integration.test.ts에서 psql로
// 철저히 검증했다 — 여기서는 그 결과가 실제 관리자 UI에서 "친화적인 오류
// 메시지"로 정확히 드러나는지, 동의를 채운 뒤 실제로 흐름이 계속되는지만 본다.
//
// DocuSign 경계는 e2e/r3-consultation-to-contract.spec.ts와 동일 — 실제 발송은
// 하지 않고 psql로 발송 결과를 흉내낸 뒤 실제 webhook 라우트로 completed 이벤트를
// 보내 active 전이를 검증한다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const HOUSEHOLD_ID = "aabbccdd-0000-0000-0000-000000000001";
const CHILD_ID = "cccccccc-0000-0000-0000-000000000002"; // 이서아 — 이 스펙 동안만 미성년으로 전환
const GUARDIAN_ID = "bbbbbbbb-0000-0000-0000-000000000001";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";
const POLICY_ID = "e2222222-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  });
}

function cleanup() {
  psql(`
    delete from contract_versions where contract_id in (select id from contracts where child_id = '${CHILD_ID}');
    delete from contracts where child_id = '${CHILD_ID}';
    delete from proposal_subjects where proposal_id in (select id from proposals where consultation_id in (select id from consultations where contact_email like 'r3-consent-e2e-%@example.com'));
    delete from proposals where consultation_id in (select id from consultations where contact_email like 'r3-consent-e2e-%@example.com');
    delete from trial_sessions where child_id = '${CHILD_ID}';
    delete from consultations where contact_email like 'r3-consent-e2e-%@example.com';
  `);
}

function restoreChildAdult() {
  psql(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
    select set_student_date_of_birth('${CHILD_ID}'::uuid, ((now() at time zone 'utc')::date - interval '17 years')::date);
    reset role;
  `);
}

test.describe("R3 — 보호자 동의 → 계약/결제 진입 경계", () => {
  test.beforeAll(() => {
    cleanup();
    psql(`
      insert into consent_policy_versions (id, version, title, content_hash, effective_from, requires_reconsent)
      values ('${POLICY_ID}', 'e2e-v1', 'ALTON 개인정보 처리방침 e2e-v1', 'hash-e2e-v1', now() - interval '1 day', true)
      on conflict (id) do nothing;
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
      select revoke_guardian_consent(id, 'r3 e2e setup reset') from guardian_consents
        where student_id = '${CHILD_ID}' and revoked_at is null;
      reset role;
    `);
  });

  test.afterAll(() => {
    cleanup();
    restoreChildAdult();
  });

  test("생년월일/동의 없는 자녀는 체험 생성이 UI에서 친화적으로 막히고, 동의 이후엔 계약→active까지 이어진다", async ({
    page,
    request,
    baseURL,
  }) => {
    test.setTimeout(90000);
    const email = `r3-consent-e2e-${Date.now()}@example.com`;

    // 1. 생년월일 자체를 비운다 — 가장 이른 차단 지점.
    psql(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
      update profiles set date_of_birth = null where id = '${CHILD_ID}';
      reset role;
    `);

    await loginAs(page, ACCOUNTS.admin);
    await page.goto("/admin?tab=consult");
    await page.getByRole("button", { name: "상담 등록" }).click();
    await page.getByPlaceholder("보호자/학생 이름").fill("R3 동의경계 보호자");
    await page.getByPlaceholder("이메일").fill(email);
    await page.getByRole("button", { name: "등록" }).click();

    const consultCard = page.locator('[data-testid^="consultation-card-"]', { hasText: email });
    await expect(consultCard).toBeVisible();
    const consultationId = psql(`select id from consultations where contact_email = '${email}';`).trim();

    await page.getByRole("button", { name: "체험 관리" }).click();
    await page.getByRole("button", { name: "체험 생성" }).click();
    await page.locator("select").selectOption({ label: `R3 동의경계 보호자 (${email})` });
    await page.getByPlaceholder("학생(child) ID").fill(CHILD_ID);
    await page.getByPlaceholder("과목 ID").fill(SUBJECT_ID);
    await page.getByPlaceholder("선생님 ID").fill(TEACHER_ID);
    await page.locator('input[type="datetime-local"]').fill("2026-10-05T10:00");
    await page.getByRole("button", { name: "체험 생성" }).last().click();

    // 2. UI가 raw Postgres 에러(예: 코드/제약조건 이름)가 아니라 친화적인
    // 한국어 안내를 보여줘야 한다.
    const errorLocator = page.locator("p", { hasText: "보호자 동의" });
    await expect(errorLocator).toBeVisible();
    const errorText = (await errorLocator.textContent()) ?? "";
    expect(errorText).not.toMatch(/23514|SQLSTATE|constraint ".*" of relation/i);
    expect(errorText).toContain("체험 세션 생성");

    // 3. 아직 체험이 생성되지 않았어야 한다.
    expect(psql(`select count(*) from trial_sessions where child_id = '${CHILD_ID}';`).trim()).toBe("0");

    // 4. 생년월일을 만 13세 미만으로 채우되 동의는 아직 없음 — 여전히 막혀야 한다.
    psql(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
      select set_student_date_of_birth('${CHILD_ID}'::uuid, ((now() at time zone 'utc')::date - interval '10 years')::date);
      reset role;
    `);
    await page.getByRole("button", { name: "체험 생성" }).last().click();
    await expect(errorLocator).toBeVisible();
    expect(psql(`select count(*) from trial_sessions where child_id = '${CHILD_ID}';`).trim()).toBe("0");

    // 5. 보호자 동의를 기록한다(R2 동의 API 재사용 — UI 대신 실제 RPC를 직접
    // 호출해 R2 동의 흐름 자체를 재검증하지 않고 그 결과만 전제로 삼는다).
    psql(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${GUARDIAN_ID}', false);
      select consent_as_guardian('${CHILD_ID}'::uuid, '${POLICY_ID}'::uuid, now());
      reset role;
    `);

    // 6. 이제 같은 폼으로 체험 생성이 성공해야 한다.
    await page.getByRole("button", { name: "체험 생성" }).last().click();
    await page.waitForTimeout(4000);

    const trialId = psql(`select id from trial_sessions where child_id = '${CHILD_ID}';`).trim();
    expect(trialId).toMatch(/^[0-9a-f-]{36}$/);

    // 7. 체험 완료 → 제안서 → 수락 → 계약 생성까지 빠르게 이어간다(핵심 흐름
    // 스펙에서 이미 각 단계 UI를 상세히 검증했으므로 여기서는 경계 도달만 확인).
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

    const proposalId = psql(
      `select id from proposals where consultation_id = '${consultationId}';`
    ).trim();
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
    const contractVersionId = psql(
      `select id from contract_versions where contract_id = '${contractId}';`
    ).trim();

    await page.reload();
    const contractCard = page.locator(`[data-testid="contract-card-${contractId}"]`);
    await contractCard.getByRole("button", { name: "관리" }).click();
    await contractCard.getByRole("button", { name: "회사 선서명 승인" }).click();
    await page.waitForTimeout(3000);

    // 8. 발송은 실제 DocuSign 호출이라 클릭하지 않는다 — psql로 발송 결과를
    // 흉내내고, 실제 webhook 라우트에 completed 이벤트를 보내 R3/R4 경계까지
    // 확인한다(R4/Stripe 코드는 아직 없으므로 여기서 멈춘다).
    const secret = process.env.DOCUSIGN_WEBHOOK_TOKEN ?? "";
    test.skip(!secret, "DOCUSIGN_WEBHOOK_TOKEN 미설정");
    const envelopeId = `env-e2e-consent-${Date.now()}`;
    psql(`
      update contract_versions set docusign_envelope_id = '${envelopeId}',
        docusign_envelope_status = 'sent', docusign_status_updated_at = now()
        where id = '${contractVersionId}';
      update contracts set status = 'sent' where id = '${contractId}';
    `);

    const { createHmac } = await import("node:crypto");
    const payload = JSON.stringify({ event: "envelope-completed", data: { envelopeId } });
    const signature = createHmac("sha256", secret).update(payload, "utf8").digest("base64");
    const res = await request.post(`${baseURL}/api/webhooks/docusign`, {
      data: payload,
      headers: { "X-DocuSign-Signature-1": signature, "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(200);

    const finalStatus = psql(`select status from contracts where id = '${contractId}';`).trim();
    expect(finalStatus).toBe("active"); // R3/R4 결제 진입 경계 — 여기서 멈춘다.
  });
});
