import { beforeEach, describe, expect, it, vi } from "vitest";

const createEnvelopeMock = vi.fn();
const uploadMock = vi.fn();
const downloadMock = vi.fn();
vi.mock("@/lib/drive-artifacts", () => ({ uploadArtifactToDrive: (...a: unknown[]) => uploadMock(...a) }));
vi.mock("@/lib/docusign", () => ({
  downloadCompletedDocument: (...a: unknown[]) => downloadMock(...a),
  downloadCertificateOfCompletion: (...a: unknown[]) => downloadMock(...a),
  assertDocusignSandboxBaseUri: vi.fn(),
  createEnvelope: (...a: unknown[]) => createEnvelopeMock(...a),
}));

import { prepareTeacherAgreement, type TeacherAgreementInputs } from "./prepare";
import { sendTeacherAgreementInternal, TeacherAgreementNotReadyError } from "./send";
import { validateTeacherAgreementInputs } from "./validate-inputs";
import { archiveSignedTeacherAgreements } from "./archive";
import { applyTeacherAgreementEnvelopeEvent } from "./webhook";
import { deriveAgreementStatus } from "./status";
import { agreementChecklist } from "./prepare";
import { recordAcceptedRate, loadTeacherRateLock } from "./rate";

const caInputs: TeacherAgreementInputs = {
  work_country: "US",
  work_region: "CA",
  work_location_detail: "Remote from San Jose, CA",
  mailing_address: "1 Main St, San Jose, CA 95112",
  start_date: "2026-11-01",
  supervisor_name: "Do Kyung Kim",
  prior_materials: "None",
  payment_details: null,
  engagement_type: "employee",
};
const krInputs: TeacherAgreementInputs = {
  ...caInputs,
  work_country: "KR",
  work_region: null,
  work_location_detail: "Seoul",
  supervisor_name: null,
  payment_details: "Bank transfer to the account on file",
  engagement_type: "contractor",
};
const base = { rate: { amountMinor: 50000, currency: "KRW" as const }, teacherName: "Sora Park", workspaceEmail: "sora@alton.education", workspaceProvisioned: true };

describe("prepareTeacherAgreement", () => {
  it("contractor US (CA included) is blocked with a Korean message until the contractor text exists", () => {
    const usRate = { amountMinor: 5000, currency: "USD" as const };
    for (const region of ["CA", "TX"]) {
      const r = prepareTeacherAgreement({ ...base, rate: usRate, inputs: { ...caInputs, engagement_type: "contractor", payment_details: "ACH, USD", work_region: region } });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.form).toBe("us_contractor_services");
        expect(r.missing).toContain("미국(캘리포니아 외) 프리랜서 계약서 양식 준비 중");
      }
    }
  });
  it("employee in California gets the employment agreement with the USD rate; employee elsewhere is blocked", () => {
    const usRate = { amountMinor: 5000, currency: "USD" as const };
    const ok = prepareTeacherAgreement({ ...base, rate: usRate, inputs: caInputs });
    expect(ok.ok && ok.form).toBe("california_employment");
    if (ok.ok) expect(ok.html).toContain("USD $50.00 per hour of compensable time");
    const tx = prepareTeacherAgreement({ ...base, rate: usRate, inputs: { ...caInputs, work_region: "TX" } });
    expect(!tx.ok && tx.missing.join()).toContain("캘리포니아");
  });
  it("renders None when no prior materials were entered", () => {
    const r = prepareTeacherAgreement({ ...base, inputs: { ...krInputs, prior_materials: null } });
    expect(r.ok).toBe(true);
  });
  it("requires the currency to match the work country", () => {
    const r = prepareTeacherAgreement({ ...base, rate: { amountMinor: 5000, currency: "USD" }, inputs: krInputs });
    expect(!r.ok && r.missing.join()).toContain("KRW");
  });
  it("selects the non-US form for a work country outside the US", () => {
    const r = prepareTeacherAgreement({ ...base, inputs: krInputs });
    expect(r.ok && r.form).toBe("non_us_services");
    if (r.ok) {
      expect(r.html).toContain("South Korea");
      expect(r.html).toContain("KRW 50,000 per 60 recognized minutes");
      expect(r.html).not.toContain("USD");
      expect(r.html).toMatch(/30 days/);
      expect(r.html).toContain("Pacific Time");
    }
  });
  it("blocks non-US without a rate or with an unconfigured currency", () => {
    const noRate = prepareTeacherAgreement({ ...base, rate: null, inputs: krInputs });
    expect(!noRate.ok && noRate.missing.join()).toContain("시급");
    const jp = prepareTeacherAgreement({ ...base, inputs: { ...krInputs, work_country: "JP" } });
    expect(!jp.ok && jp.missing.join()).toContain("통화");
  });
  it("lists every missing input and never sends a blank form", () => {
    const r = prepareTeacherAgreement({ ...base, inputs: { ...krInputs, payment_details: " ", mailing_address: null } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toEqual(expect.arrayContaining(["우편 주소", "지급 방법·수령 정보"]));
  });
  it("blocks when the Workspace account is not provisioned or the location is unknown", () => {
    expect(prepareTeacherAgreement({ ...base, workspaceProvisioned: false, inputs: krInputs }).ok).toBe(false);
    expect(prepareTeacherAgreement({ ...base, workspaceEmail: "x@gmail.com", inputs: krInputs }).ok).toBe(false);
    expect(prepareTeacherAgreement({ ...base, inputs: { ...krInputs, work_country: "" } }).ok).toBe(false);
    expect(prepareTeacherAgreement({ ...base, inputs: null }).ok).toBe(false);
  });
  it("blocks when internal wording leaks into an input", () => {
    const r = prepareTeacherAgreement({ ...base, inputs: { ...krInputs, mailing_address: "TBD pending legal review" } });
    expect(r.ok).toBe(false);
  });
});

describe("validateTeacherAgreementInputs payment details", () => {
  it("rejects full account or tax numbers but allows the last 4 digits", () => {
    expect(validateTeacherAgreementInputs({ payment_details: "Bank transfer, KRW, Sora Park, account ending 1234" }).ok).toBe(true);
    expect(validateTeacherAgreementInputs({ payment_details: "Account 1002-345-678901" }).ok).toBe(false);
    expect(validateTeacherAgreementInputs({ payment_details: "SSN 123-45-6789" }).ok).toBe(false);
    expect(validateTeacherAgreementInputs({ engagement_type: "boss" }).ok).toBe(false);
    const d = validateTeacherAgreementInputs({});
    expect(d.ok && d.value.engagement_type).toBe("contractor");
  });
});

describe("validateTeacherAgreementInputs", () => {
  it("normalizes and validates", () => {
    const v = validateTeacherAgreementInputs({ work_country: "us", work_region: "CA", start_date: "2026-11-01", mailing_address: " 1 Main St " });
    expect(v.ok && v.value.work_country).toBe("US");
    expect(v.ok && v.value.mailing_address).toBe("1 Main St");
    expect(validateTeacherAgreementInputs({ work_country: "USA" }).ok).toBe(false);
    expect(validateTeacherAgreementInputs({ start_date: "2026-02-31" }).ok).toBe(false);
    const kr = validateTeacherAgreementInputs({ work_country: "KR", work_region: "Seoul" });
    expect(kr.ok && kr.value.work_region).toBeNull();
  });
});

function fakeAdmin(opts: { inputs: TeacherAgreementInputs | null; existing?: { status: string; docusign_envelope_status: string }[] }) {
  const inserted: Record<string, unknown>[] = [];
  const q = (data: unknown) => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const m of ["select", "eq", "not", "order", "limit", "in", "is"]) chain[m] = self;
    chain.maybeSingle = async () => ({ data, error: null });
    chain.then = (res: (v: unknown) => unknown) => res({ data, error: null });
    return chain;
  };
  return {
    inserted,
    from(table: string) {
      if (table === "teachers") return q({ workspace_email: "sora@alton.education" });
      if (table === "profiles") return q({ name: "Sora Park" });
      if (table === "teacher_workspace_provisioning") return q({ status: "created" });
      if (table === "teacher_agreement_inputs") return q(opts.inputs);
      if (table === "teacher_rate_history") return q({ id: "r1", amount_minor: 50000, currency: "KRW" });
      if (table === "teacher_contracts")
        return {
          ...q(opts.existing ?? []),
          insert: async (row: Record<string, unknown>) => {
            inserted.push(row);
            return { error: null };
          },
        };
      throw new Error(`unexpected table ${table}`);
    },
  };
}

describe("sendTeacherAgreementInternal", () => {
  beforeEach(() => createEnvelopeMock.mockReset().mockResolvedValue({ envelopeId: "env-1" }));
  const params = { teacherId: "t1", actorUserId: "a1", webhookUrl: "https://example.test/hook" };

  it("sends an English envelope to the Workspace address and records it", async () => {
    const admin = fakeAdmin({ inputs: krInputs });
    const r = await sendTeacherAgreementInternal(admin as never, params);
    expect(r.envelopeId).toBe("env-1");
    const arg = createEnvelopeMock.mock.calls[0][0];
    expect(arg.recipientEmail).toBe("sora@alton.education");
    expect(arg.emailSubject).toBe("Alton Education Teacher Agreement");
    expect(arg.documentHtml).toContain("/sig1/");
    expect(admin.inserted[0]).toMatchObject({ teacher_id: "t1", agreement_form: "non_us_services", template_version: "0.2-EN", inputs_snapshot: expect.objectContaining({ rate: { amountMinor: 50000, currency: "KRW" } }), docusign_envelope_id: "env-1", status: "sent" });
  });
  it("blocks before DocuSign when inputs are missing", async () => {
    await expect(sendTeacherAgreementInternal(fakeAdmin({ inputs: { ...krInputs, payment_details: null } }) as never, params)).rejects.toBeInstanceOf(
      TeacherAgreementNotReadyError
    );
    expect(createEnvelopeMock).not.toHaveBeenCalled();
  });
  it("refuses to resend over a signed or open agreement", async () => {
    await expect(sendTeacherAgreementInternal(fakeAdmin({ inputs: krInputs, existing: [{ status: "signed", docusign_envelope_status: "completed" }] }) as never, params)).rejects.toThrow("서명 완료");
    await expect(sendTeacherAgreementInternal(fakeAdmin({ inputs: krInputs, existing: [{ status: "sent", docusign_envelope_status: "sent" }] }) as never, params)).rejects.toThrow("서명 대기");
    expect(createEnvelopeMock).not.toHaveBeenCalled();
  });
});

describe("applyTeacherAgreementEnvelopeEvent", () => {
  function adminWith(row: Record<string, unknown> | null) {
    const updates: Record<string, unknown>[] = [];
    return {
      updates,
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }),
        update: (patch: Record<string, unknown>) => {
          updates.push(patch);
          return { eq: () => ({ neq: async () => ({ error: null }) }) };
        },
      }),
    };
  }
  it("ignores envelopes that are not teacher agreements", async () => {
    expect(await applyTeacherAgreementEnvelopeEvent(adminWith(null) as never, "e", "completed", "now")).toBe(false);
  });
  it("marks signed on completion and stores a document reference", async () => {
    const a = adminWith({ id: "c1", status: "sent", docusign_envelope_status: "sent", document_url: null });
    expect(await applyTeacherAgreementEnvelopeEvent(a as never, "env-9", "completed", "2026-11-01T00:00:00Z")).toBe(true);
    expect(a.updates[0]).toMatchObject({ status: "signed", docusign_envelope_status: "completed", document_url: "docusign-envelope:env-9", drive_sync_status: "queued" });
  });
  it("records declined without signing, and never rewrites a signed record or regresses", async () => {
    const d = adminWith({ id: "c1", status: "sent", docusign_envelope_status: "sent", document_url: null });
    await applyTeacherAgreementEnvelopeEvent(d as never, "e", "declined", "t");
    expect(d.updates[0]).toMatchObject({ docusign_envelope_status: "declined" });
    expect(d.updates[0]).not.toHaveProperty("status");
    const s = adminWith({ id: "c1", status: "signed", docusign_envelope_status: "completed", document_url: "x" });
    expect(await applyTeacherAgreementEnvelopeEvent(s as never, "e", "voided", "t")).toBe(true);
    expect(s.updates).toHaveLength(0);
    const r = adminWith({ id: "c1", status: "sent", docusign_envelope_status: "declined", document_url: null });
    await applyTeacherAgreementEnvelopeEvent(r as never, "e", "delivered", "t");
    expect(r.updates).toHaveLength(0);
  });
});

describe("archiveSignedTeacherAgreements", () => {
  function archAdmin(rows: Record<string, unknown>[]) {
    const updates: Record<string, unknown>[] = [];
    const sel: Record<string, unknown> = {};
    for (const m of ["eq", "in", "not"]) sel[m] = () => sel;
    sel.then = (res: (v: unknown) => unknown) => res({ data: rows, error: null });
    sel.maybeSingle = async () => ({ data: { name: "Sora Park" }, error: null });
    return {
      updates,
      from: () => ({
        select: () => sel,
        update: (patch: Record<string, unknown>) => {
          updates.push(patch);
          const u: Record<string, unknown> = {};
          u.eq = () => u;
          u.in = () => u;
          u.select = async () => ({ data: [{ id: "x" }], error: null });
          u.then = (res: (v: unknown) => unknown) => res({ error: null });
          return u;
        },
      }),
    };
  }
  const row = { id: "c1", teacher_id: "t1", docusign_envelope_id: "env-1", drive_retry_count: 0, template_version: "0.2-EN-CA", signed_at: "2026-11-01T12:00:00Z" };
  beforeEach(() => {
    downloadMock.mockReset().mockResolvedValue(Buffer.from("pdf"));
    uploadMock.mockReset().mockResolvedValue({ driveFileId: "drv1", personFolderId: "pf1" });
  });
  it("uploads the signed PDF and records the Drive reference", async () => {
    const a = archAdmin([row]);
    expect(await archiveSignedTeacherAgreements(a as never)).toMatchObject({ attempted: 1, succeeded: 1 });
    expect(uploadMock.mock.calls[0][0].fileName).toBe("teacher_agreement_c1_0.2-EN-CA_2026-11-01.pdf");
    expect(uploadMock.mock.calls[1][0].fileName).toBe("teacher_agreement_c1_0.2-EN-CA_2026-11-01_certificate.pdf");
    expect(uploadMock.mock.calls[0][0].destination.identity).toMatchObject({ contractId: "c1", docKind: "signed_document" });
    expect(uploadMock.mock.calls[0][0].destination).toMatchObject({ kind: "teacher", personId: "t1", personName: "Sora Park" });
    expect(a.updates.at(-1)).toMatchObject({ drive_sync_status: "succeeded", drive_file_id: "drv1", drive_folder_id: "pf1", drive_certificate_file_id: "drv1", document_url: "https://drive.google.com/file/d/drv1/view" });
  });
  it("keeps the signed state and marks the row retryable when Drive fails", async () => {
    uploadMock.mockRejectedValue(new Error("drive down"));
    const a = archAdmin([row]);
    expect(await archiveSignedTeacherAgreements(a as never)).toMatchObject({ failed: 1, succeeded: 0 });
    const last = a.updates.at(-1)!;
    expect(last).toMatchObject({ drive_sync_status: "retryable_failed", drive_retry_count: 1, drive_last_error: "drive down" });
    expect(last).not.toHaveProperty("status");
    expect(last).not.toHaveProperty("document_url");
  });
  it("escalates to manual review after repeated failures", async () => {
    uploadMock.mockRejectedValue(new Error("x"));
    const a = archAdmin([{ ...row, drive_retry_count: 5 }]);
    expect(await archiveSignedTeacherAgreements(a as never)).toMatchObject({ manualReview: 1 });
  });
});

describe("rate flow", () => {
  function rateAdmin(current: { id: string; amount_minor: number; currency: string } | null, contracts: Record<string, unknown>[] = []) {
    const calls = { rpc: [] as unknown[], updates: [] as unknown[] };
    const chain = (data: unknown) => {
      const c: Record<string, unknown> = {};
      for (const m of ["select", "eq", "is", "not"]) c[m] = () => c;
      c.maybeSingle = async () => ({ data, error: null });
      c.then = (res: (v: unknown) => unknown) => res({ data, error: null });
      return c;
    };
    return {
      calls,
      rpc: async (n: string, a: unknown) => (calls.rpc.push([n, a]), { error: null }),
      from: (t: string) =>
        t === "teacher_rate_history"
          ? { ...chain(current), update: (p: unknown) => (calls.updates.push(p), { eq: () => ({ is: async () => ({ error: null }) }) }) }
          : chain(contracts),
    };
  }
  const contract = { id: "c1", teacher_id: "t1", inputs_snapshot: { rate: { amountMinor: 50000, currency: "KRW" } } };
  it("links the current rate to the contract without creating a duplicate", async () => {
    const a = rateAdmin({ id: "r1", amount_minor: 50000, currency: "KRW" });
    await recordAcceptedRate(a as never, contract);
    expect(a.calls.rpc).toHaveLength(0);
    expect(a.calls.updates).toEqual([{ agreement_contract_id: "c1" }]);
  });
  it("creates a history row with the accepted value when the current rate differs", async () => {
    const a = rateAdmin({ id: "r1", amount_minor: 40000, currency: "KRW" });
    await recordAcceptedRate(a as never, contract);
    expect(a.calls.rpc[0]).toEqual(["set_teacher_rate", { p_teacher_id: "t1", p_amount_minor: 50000, p_currency: "KRW" }]);
  });
  it("locks the rate while an agreement is open or signed", async () => {
    expect(await loadTeacherRateLock(rateAdmin(null, [{ status: "sent", docusign_envelope_status: "sent" }]) as never, "t1")).toBe("open_agreement");
    expect(await loadTeacherRateLock(rateAdmin(null, [{ status: "signed", docusign_envelope_status: "completed" }]) as never, "t1")).toBe("signed_agreement");
    expect(await loadTeacherRateLock(rateAdmin(null, [{ status: "sent", docusign_envelope_status: "declined" }]) as never, "t1")).toBeNull();
  });
});

describe("agreement checklist and list status", () => {
  it("is all-ok only when the send path is ready, and names the failing items", () => {
    const ok = agreementChecklist({ ...base, inputs: krInputs });
    expect(ok.every((c) => c.ok)).toBe(true);
    const bad = agreementChecklist({ ...base, workspaceProvisioned: false, rate: null, inputs: { ...krInputs, mailing_address: null } });
    expect(bad.filter((c) => !c.ok).map((c) => c.key).sort()).toEqual(["location", "rate", "workspace"]);
    const wrongCurrency = agreementChecklist({ ...base, rate: { amountMinor: 5000, currency: "USD" }, inputs: krInputs });
    expect(wrongCurrency.find((c) => c.key === "rate")?.ok).toBe(false);
    const us = agreementChecklist({ ...base, rate: { amountMinor: 5000, currency: "USD" }, inputs: { ...krInputs, work_country: "US", work_region: "TX" } });
    expect(us.find((c) => c.key === "engagement")?.ok).toBe(false);
  });
  it("derives the chip status", () => {
    expect(deriveAgreementStatus(null)).toBe("not_sent");
    expect(deriveAgreementStatus({ status: "sent", docusign_envelope_status: "delivered" })).toBe("sent");
    expect(deriveAgreementStatus({ status: "signed", docusign_envelope_status: "completed" })).toBe("signed");
    expect(deriveAgreementStatus({ status: "sent", docusign_envelope_status: "declined" })).toBe("declined");
  });
});
