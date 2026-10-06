import { beforeEach, describe, expect, it, vi } from "vitest";

const createEnvelopeMock = vi.fn();
vi.mock("@/lib/docusign", () => ({
  assertDocusignSandboxBaseUri: vi.fn(),
  createEnvelope: (...a: unknown[]) => createEnvelopeMock(...a),
}));

import { consultantChecklist, consultantCurrencyFor, prepareConsultantAgreement, type ConsultantAgreementInputs } from "./prepare";
import { ConsultantAgreementNotReadyError, loadConsultantAgreementState, sendConsultantAgreementInternal } from "./send";
import { validateConsultantAgreementInputs } from "./validate-inputs";

const krInputs: ConsultantAgreementInputs = {
  work_country: "KR",
  work_region: null,
  work_location_detail: "Seoul",
  mailing_address: "1 Teheran-ro, Seoul",
  start_date: "2026-11-01",
  monthly_fee_minor: 2_000_000,
  monthly_fee_currency: "KRW",
  monthly_scope: "Admissions roadmap, application planning and monthly parent meetings",
  prior_materials: null,
};
const base = {
  consultantName: "Min Kim",
  workspaceEmail: "min@alton.education",
  payoutAccount: { holderName: "Min Kim", bankName: "Shinhan Bank", last4: "9876", currency: "KRW" },
};

describe("prepareConsultantAgreement", () => {
  it("renders the consultant agreement with the monthly fee, scope, bank-transfer text and the consultant signature anchor", () => {
    const r = prepareConsultantAgreement({ ...base, inputs: krInputs });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.recipientEmail).toBe("min@alton.education");
    expect(r.html).toContain("Monthly fee: KRW 2,000,000 per month");
    expect(r.html).toContain("Consultant signature: /sig1/");
    expect(r.html).toContain("account ending 9876; currency: KRW");
    expect(r.html).toContain("<p>None</p>");
    expect(r.html).not.toMatch(/Accepted monthly amount|Identified in the executed/);
  });
  it("supports US consultants in USD and blocks other countries and currency mismatches", () => {
    const us = prepareConsultantAgreement({
      ...base,
      payoutAccount: { holderName: "Min Kim", bankName: "Chase", last4: "1111", currency: "USD" },
      inputs: { ...krInputs, work_country: "US", work_region: "CA", monthly_fee_minor: 350_000, monthly_fee_currency: "USD" },
    });
    expect(us.ok && us.html).toContain("Monthly fee: USD $3,500.00 per month");
    expect(consultantCurrencyFor("JP")).toBeNull();
    const jp = prepareConsultantAgreement({ ...base, inputs: { ...krInputs, work_country: "JP" } });
    expect(!jp.ok && jp.missing.join()).toContain("통화가 설정되지 않음");
    const mismatch = prepareConsultantAgreement({ ...base, inputs: { ...krInputs, monthly_fee_currency: "USD" } });
    expect(!mismatch.ok && mismatch.missing.join()).toContain("KRW");
    const usNoState = prepareConsultantAgreement({ ...base, inputs: { ...krInputs, work_country: "US" } });
    expect(!usNoState.ok && usNoState.missing.join()).toContain("근무 주");
  });
  it("lists every missing item (account, scope, fee, workspace) and mirrors it in the checklist", () => {
    const r = prepareConsultantAgreement({ consultantName: "Min Kim", workspaceEmail: null, payoutAccount: null, inputs: { ...krInputs, monthly_scope: null, monthly_fee_minor: null } });
    expect(r.ok).toBe(false);
    const bad = consultantChecklist({ consultantName: "x", workspaceEmail: null, payoutAccount: null, inputs: { ...krInputs, monthly_scope: null, monthly_fee_minor: null } })
      .filter((c) => !c.ok)
      .map((c) => c.key)
      .sort();
    expect(bad).toEqual(["fee", "payout_account", "scope", "workspace"]);
    expect(consultantChecklist({ ...base, inputs: krInputs }).every((c) => c.ok)).toBe(true);
  });
});

describe("validateConsultantAgreementInputs", () => {
  it("stores USD as cents and KRW as won, never converting between them", () => {
    const usd = validateConsultantAgreementInputs({ work_country: "us", work_region: "CA", monthly_fee_amount: "3500.50", monthly_fee_currency: "usd" });
    expect(usd.ok && usd.value).toMatchObject({ work_country: "US", monthly_fee_minor: 350050, monthly_fee_currency: "USD" });
    const krw = validateConsultantAgreementInputs({ work_country: "KR", work_region: "Seoul", monthly_fee_amount: "2000000", monthly_fee_currency: "KRW" });
    expect(krw.ok && krw.value).toMatchObject({ monthly_fee_minor: 2000000, work_region: null });
    expect(validateConsultantAgreementInputs({ monthly_fee_amount: "0", monthly_fee_currency: "KRW" }).ok).toBe(false);
    expect(validateConsultantAgreementInputs({ monthly_fee_amount: "10", monthly_fee_currency: "EUR" }).ok).toBe(false);
    expect(validateConsultantAgreementInputs({ prior_materials: "Account 1002-345-678901" }).ok).toBe(false);
  });
});

function fakeAdmin(opts: { inputs: ConsultantAgreementInputs | null; existing?: { status: string; docusign_envelope_status: string }[] }) {
  const inserted: Record<string, unknown>[] = [];
  const q = (data: unknown) => {
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "not", "order", "limit", "in"]) chain[m] = () => chain;
    chain.maybeSingle = async () => ({ data, error: null });
    chain.then = (res: (v: unknown) => unknown) => res({ data, error: null });
    return chain;
  };
  return {
    inserted,
    from(table: string) {
      if (table === "profiles") return q({ name: "Min Kim" });
      if (table === "consultant_workspace_provisioning") return q({ workspace_email: "min@alton.education" });
      if (table === "teacher_agreement_inputs") return q(opts.inputs);
      if (table === "consultant_payout_accounts") return q({ account_holder_name: "Min Kim", bank_name: "Shinhan Bank", account_number_last4: "9876", currency: "KRW" });
      if (table === "teacher_contracts") return { ...q(opts.existing ?? []), insert: async (row: Record<string, unknown>) => (inserted.push(row), { error: null }) };
      throw new Error(`unexpected table ${table}`);
    },
  };
}

describe("sendConsultantAgreementInternal", () => {
  beforeEach(() => createEnvelopeMock.mockReset().mockResolvedValue({ envelopeId: "env-c1" }));
  const params = { consultantId: "c1", actorUserId: "a1", webhookUrl: "https://example.test/hook" };
  it("sends an English envelope to the consultant and records a consultant_services agreement", async () => {
    const admin = fakeAdmin({ inputs: krInputs });
    await sendConsultantAgreementInternal(admin as never, params);
    const arg = createEnvelopeMock.mock.calls[0][0];
    expect(arg.emailSubject).toBe("Alton Education Consultant Agreement");
    expect(arg.recipientEmail).toBe("min@alton.education");
    expect(arg.documentHtml).toContain("Consultant signature: /sig1/");
    expect(admin.inserted[0]).toMatchObject({ teacher_id: "c1", agreement_form: "consultant_services", docusign_envelope_id: "env-c1", status: "sent" });
  });
  it("blocks before DocuSign when inputs are missing and refuses to resend over signed/open agreements", async () => {
    await expect(sendConsultantAgreementInternal(fakeAdmin({ inputs: { ...krInputs, monthly_scope: null } }) as never, params)).rejects.toBeInstanceOf(ConsultantAgreementNotReadyError);
    await expect(sendConsultantAgreementInternal(fakeAdmin({ inputs: krInputs, existing: [{ status: "signed", docusign_envelope_status: "completed" }] }) as never, params)).rejects.toThrow("서명 완료");
    await expect(sendConsultantAgreementInternal(fakeAdmin({ inputs: krInputs, existing: [{ status: "sent", docusign_envelope_status: "delivered" }] }) as never, params)).rejects.toThrow("서명 대기");
    expect(createEnvelopeMock).toHaveBeenCalledTimes(0);
  });
  it("loads the admin state with checklist, ready flag and the fee amount text", async () => {
    const s = await loadConsultantAgreementState(fakeAdmin({ inputs: krInputs }) as never, "c1");
    expect(s.status).toBe("not_sent");
    expect(s.ready).toBe(true);
    expect(s.inputs?.monthly_fee_amount).toBe("2000000");
    expect(s.checklist.every((c) => c.ok)).toBe(true);
  });
});
