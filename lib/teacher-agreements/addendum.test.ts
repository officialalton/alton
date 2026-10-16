import { beforeEach, describe, expect, it, vi } from "vitest";

const createEnvelopeMock = vi.fn();
vi.mock("@/lib/docusign", () => ({
  assertDocusignSandboxBaseUri: vi.fn(),
  createEnvelope: (...a: unknown[]) => createEnvelopeMock(...a),
}));

import { loadRateAddendumState, prepareRateAddendum, RateAddendumNotReadyError, sendRateAddendumInternal, todayPacific, validateAddendumInput } from "./addendum";
import { applyTeacherAgreementEnvelopeEvent } from "./webhook";
import { loadTeacherRateLock } from "./rate";

const NOW = new Date("2026-11-10T12:00:00Z");
const krPayout = { holderName: "Sora Park", bankName: "Shinhan Bank", last4: "1234", currency: "KRW" };
const baseArgs = {
  teacherName: "Sora Park",
  teacherEmail: "sora@alton.education",
  teacherAddress: "1 Main St, Seoul",
  workCountry: "KR",
  workRegion: null,
  workLocationDetail: "Seoul",
  signed: { id: "main-1", signedDate: "2026-11-02" },
  current: { amountMinor: 50000, currency: "KRW" as const },
  payoutAccount: krPayout,
  input: { newAmountMinor: 60000, newCurrency: "KRW" as const, effectiveDate: "2026-12-01" },
  agreementId: "add-1",
  now: NOW,
};

describe("validateAddendumInput / todayPacific", () => {
  it("requires a positive rate, a valid currency, a non-retroactive date and an actual change", () => {
    expect(todayPacific(new Date("2026-11-10T03:00:00Z"))).toBe("2026-11-09");
    expect(validateAddendumInput(baseArgs.input, baseArgs.current, NOW)).toEqual([]);
    expect(validateAddendumInput({ ...baseArgs.input, newAmountMinor: 0 }, baseArgs.current, NOW).length).toBeGreaterThan(0);
    expect(validateAddendumInput({ ...baseArgs.input, effectiveDate: "2026-11-01" }, baseArgs.current, NOW).join()).toContain("소급");
    expect(validateAddendumInput({ ...baseArgs.input, newAmountMinor: 50000 }, baseArgs.current, NOW).join()).toContain("현재 시급과 같은");
    expect(validateAddendumInput({ ...baseArgs.input, newCurrency: "EUR" as never }, baseArgs.current, NOW).join()).toContain("통화");
  });
});

describe("prepareRateAddendum", () => {
  it("renders previous/new rate, the existing agreement reference and the teacher signature anchor", () => {
    const r = prepareRateAddendum(baseArgs);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.html).toContain("Existing agreement ID: main-1");
    expect(r.html).toContain("Existing agreement signed date: November 2, 2026");
    expect(r.html).toContain("Previous hourly rate and currency: KRW 50,000 per 60 recognized minutes");
    expect(r.html).toContain("New hourly rate and currency: KRW 60,000 per 60 recognized minutes");
    expect(r.html).toContain("Effective date: December 1, 2026");
    expect(r.html).toContain("Teacher signature: /sig1/");
  });
  it("blocks without a signed agreement, address or payout account in the new currency", () => {
    expect(prepareRateAddendum({ ...baseArgs, signed: null }).ok).toBe(false);
    expect(prepareRateAddendum({ ...baseArgs, payoutAccount: null }).ok).toBe(false);
    const usd = prepareRateAddendum({ ...baseArgs, input: { ...baseArgs.input, newCurrency: "USD", newAmountMinor: 5000 } });
    expect(!usd.ok && usd.missing.join()).toContain("수취 계좌 통화");
    expect(prepareRateAddendum({ ...baseArgs, teacherAddress: null }).ok).toBe(false);
  });
});

function fakeAdmin(opts: { signed?: boolean; openAddendum?: boolean }) {
  const inserted: Record<string, unknown>[] = [];
  const q = (data: unknown) => {
    const c: Record<string, unknown> = {};
    for (const m of ["select", "eq", "not", "order", "limit", "in", "is"]) c[m] = () => c;
    c.maybeSingle = async () => ({ data, error: null });
    c.then = (res: (v: unknown) => unknown) => res({ data, error: null });
    return c;
  };
  let contractsCall = 0;
  return {
    inserted,
    from(table: string) {
      if (table === "teachers") return q({ workspace_email: "sora@alton.education" });
      if (table === "profiles") return q({ name: "Sora Park" });
      if (table === "teacher_workspace_provisioning") return q({ status: "created" });
      if (table === "teacher_agreement_inputs") return q({ work_country: "KR", work_region: null, work_location_detail: "Seoul", mailing_address: "1 Main St, Seoul", start_date: "2026-11-01", supervisor_name: null, prior_materials: null, engagement_type: "contractor" });
      if (table === "teacher_rate_history") return q({ id: "r1", amount_minor: 50000, currency: "KRW" });
      if (table === "teacher_payout_accounts") return q({ account_holder_name: "Sora Park", bank_name: "Shinhan Bank", account_number_last4: "1234", currency: "KRW" });
      if (table === "teacher_contracts") {
        // 1st: signed main agreement; 2nd: latest addendum row
        const n = contractsCall++;
        const rows = n % 2 === 0 ? (opts.signed === false ? [] : [{ id: "main-1", signed_at: "2026-11-02T20:00:00Z", agreement_form: "non_us_services" }]) : opts.openAddendum ? [{ status: "sent", docusign_envelope_status: "sent", sent_at: "2026-11-09", inputs_snapshot: { addendum: { effectiveDate: "2026-12-01" } } }] : [];
        return { ...q(rows), insert: async (row: Record<string, unknown>) => (inserted.push(row), { error: null }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

describe("sendRateAddendumInternal", () => {
  beforeEach(() => createEnvelopeMock.mockReset().mockResolvedValue({ envelopeId: "env-add" }));
  const params = { teacherId: "t1", actorUserId: "a1", webhookUrl: "https://example.test/hook", input: baseArgs.input, now: NOW };

  it("sends the addendum, records the amended agreement and the new rate WITHOUT touching the rate", async () => {
    const admin = fakeAdmin({});
    await sendRateAddendumInternal(admin as never, params);
    const arg = createEnvelopeMock.mock.calls[0][0];
    expect(arg.emailSubject).toBe("Alton Education Teacher Rate Change Addendum");
    expect(arg.documentHtml).toContain("New hourly rate and currency: KRW 60,000");
    expect(admin.inserted[0]).toMatchObject({
      agreement_form: "teacher_rate_addendum",
      amends_contract_id: "main-1",
      status: "sent",
      inputs_snapshot: { addendum: { previousAmountMinor: 50000, newAmountMinor: 60000, newCurrency: "KRW", effectiveDate: "2026-12-01" } },
    });
  });
  it("is blocked when no agreement is signed or an addendum is already awaiting signature", async () => {
    await expect(sendRateAddendumInternal(fakeAdmin({ signed: false }) as never, params)).rejects.toBeInstanceOf(RateAddendumNotReadyError);
    await expect(sendRateAddendumInternal(fakeAdmin({ openAddendum: true }) as never, params)).rejects.toThrow("서명 대기");
    expect(createEnvelopeMock).not.toHaveBeenCalled();
  });
  it("reports whether an addendum can be created", async () => {
    const s = await loadRateAddendumState(fakeAdmin({}) as never, "t1");
    expect(s.canCreate).toBe(true);
    const open = await loadRateAddendumState(fakeAdmin({ openAddendum: true }) as never, "t1");
    expect(open.canCreate).toBe(false);
    expect(open.latest).toMatchObject({ status: "sent", effectiveDate: "2026-12-01" });
  });
});

describe("addendum webhook and rate lock", () => {
  function adminWith(row: Record<string, unknown>) {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const updates: Record<string, unknown>[] = [];
    return {
      rpc,
      updates,
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }),
        update: (patch: Record<string, unknown>) => (updates.push(patch), { eq: () => ({ neq: async () => ({ error: null }) }) }),
      }),
    };
  }
  it("applies the new rate only when the addendum envelope completes (not on sent/declined)", async () => {
    const row = { id: "add-1", teacher_id: "t1", agreement_form: "teacher_rate_addendum", status: "sent", docusign_envelope_status: "sent", document_url: null };
    const sent = adminWith(row);
    await applyTeacherAgreementEnvelopeEvent(sent as never, "e", "delivered", "t");
    await applyTeacherAgreementEnvelopeEvent(sent as never, "e", "declined", "t");
    expect(sent.rpc).not.toHaveBeenCalled();
    const done = adminWith(row);
    await applyTeacherAgreementEnvelopeEvent(done as never, "e", "completed", "2026-11-20T00:00:00Z");
    expect(done.rpc).toHaveBeenCalledWith("apply_teacher_rate_addendum", { p_contract_id: "add-1" });
  });
  it("retries the idempotent apply on a repeated completion for an already-signed addendum, and skips it for consultants", async () => {
    const again = adminWith({ id: "add-1", teacher_id: "t1", agreement_form: "teacher_rate_addendum", status: "signed", docusign_envelope_status: "completed", document_url: "x" });
    await applyTeacherAgreementEnvelopeEvent(again as never, "e", "completed", "t");
    expect(again.rpc).toHaveBeenCalledTimes(1);
    const consultant = adminWith({ id: "c-1", teacher_id: "c1", agreement_form: "consultant_services", status: "sent", docusign_envelope_status: "sent", document_url: null, inputs_snapshot: {} });
    await applyTeacherAgreementEnvelopeEvent(consultant as never, "e", "completed", "t");
    expect(consultant.rpc).not.toHaveBeenCalled();
  });
  it("keeps the normal-edit rate lock once an agreement (or an addendum) is signed", async () => {
    const lockAdmin = (rows: unknown[]) => ({ from: () => ({ select: () => ({ eq: () => ({ not: async () => ({ data: rows, error: null }) }) }) }) });
    expect(await loadTeacherRateLock(lockAdmin([{ status: "signed", docusign_envelope_status: "completed" }]) as never, "t1")).toBe("signed_agreement");
  });
});
