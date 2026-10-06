import { describe, expect, it } from "vitest";
import { GENERATED_LEGAL_DOCUMENTS } from "@/lib/legal/documents/generated";
import { assertNoUnreplacedInputDescriptions, findUnreplacedInputDescriptions } from "@/lib/legal/guard";
import { UnfilledContractError } from "@/lib/legal/guard";
import {
  renderCaliforniaTeacherAgreementHtml,
  renderNonUsTeacherAgreementHtml,
  selectTeacherAgreementForm,
  renderUsContractorTeacherAgreementHtml,
  renderConsultantAgreementHtml,
  renderRateAddendumHtml,
} from "./teacher-agreement-template";

const approval = { companyEntityName: "Alton Education LLC", approverName: "Do Kyung Kim", approverTitle: "CEO", approvedAtLabel: "October 6, 2026 at 9:00 AM UTC", documentIdentifier: "t1" };
const common = { teacherName: "Sora Park", teacherEmail: "sora@example.com", teacherAddress: "1 Main St", effectiveDate: "2026-11-01", priorMaterials: "None", companyApproval: approval };
const ca = { ...common, lessonRate: { amountMinor: 5000, currency: "USD" as const }, californiaWorkLocation: "Remote, San Jose, CA", supervisor: "Do Kyung Kim" };
const nonUs = {
  ...common,
  actualWorkCountryAndLocation: "South Korea, Seoul",
  paymentMethodAndRecipientDetails: "Bank transfer (wire) to the recipient account on file.",
  lessonRate: { amountMinor: 50000, currency: "KRW" as const },
};

describe("selectTeacherAgreementForm", () => {
  it("chooses by actual work location only", () => {
    // All teachers are independent contractors; the California employment form is kept but never selected.
    expect(selectTeacherAgreementForm({ country: "US", region: "CA" })).toMatchObject({ form: "us_contractor_services" });
    expect(selectTeacherAgreementForm({ country: "US", region: "CA", engagementType: "employee" })).toMatchObject({ form: "california_employment" });
    expect(selectTeacherAgreementForm({ country: "US", region: "TX", engagementType: "employee" }).form).toBeNull();
    expect(selectTeacherAgreementForm({ country: "KR", engagementType: "employee" }).form).toBeNull();
    expect(selectTeacherAgreementForm({ country: "us", region: "TX" })).toMatchObject({ form: "us_contractor_services" });
    expect(selectTeacherAgreementForm({ country: "KR" })).toMatchObject({ form: "non_us_services" });
    expect(selectTeacherAgreementForm({ country: "JP" }).form).toBeNull();
    expect(selectTeacherAgreementForm({ country: "" }).form).toBeNull();
  });
});

describe("teacher agreement rendering", () => {
  it("renders the California employment agreement with all four recording items", () => {
    const html = renderCaliforniaTeacherAgreementHtml(ca);
    expect(html).toContain("Teacher Employment Agreement");
    expect(html).toContain("USD $50.00");
    expect(html).toContain("Pacific Time (America/Los_Angeles)");
    expect(html).toContain("paid no later than the 26th of the same month");
    expect(html).toContain("10th of the following month");
    expect(html).toContain("payment is made on the preceding business day");
    expect(html).toContain("/sig1/");
    for (const p of ["video recording", "audio recording", "text transcript", "AI-assisted preparation"]) expect(html).toContain(p);
    expect(html).not.toMatch(/_{3,}|\[[^\]]+\]|draft/i);
  });
  it("renders the non-US services agreement", () => {
    const html = renderNonUsTeacherAgreementHtml(nonUs);
    expect(html).toContain("Services Outside the United States");
    expect(html).toContain("Termination notice period: 30 days");
    expect(html).toContain("Borne by the Company");
    expect(html).toContain("payment is made on the preceding business day");
    expect(html).toContain("paid no later than the 26th of the same month");
    expect(html).not.toMatch(/_{3,}|\[[^\]]+\]|draft/i);
  });
  it("renders the system USD rate in the California form", () => {
    expect(renderCaliforniaTeacherAgreementHtml(ca)).toContain("USD $50.00 per hour of compensable time");
  });
  const us = { ...common, actualWorkCountryAndLocation: "United States, CA — San Jose", paymentMethodAndRecipientDetails: "Bank transfer (wire) to the recipient account on file. Recipient: Sora Park; bank: Chase; account ending 4321; currency: USD", lessonRate: { amountMinor: 5000, currency: "USD" as const } };
  it("renders the US contractor agreement with real values, anchors and Schedule B", () => {
    const html = renderUsContractorTeacherAgreementHtml(us);
    expect(html).toContain("Lesson fee: USD $50.00 per 60 recognized minutes");
    expect(html).toContain("Teacher legal name, address, and email: Sora Park; 1 Main St; sora@example.com");
    expect(html).toContain("Payment method and recipient details: Bank transfer (wire) to the recipient account on file. Recipient: Sora Park");
    expect(html.match(/\/sig1\//g)).toHaveLength(1);
    expect(html.match(/\/date1\//g)).toHaveLength(1);
    expect(html).toContain("Company electronic approval: recorded");
    expect(html).not.toMatch(/Identified in the executed|recorded in the executed (payment|work|recipient)|identified here in the executed/);
    expect(html).toContain("<p>None</p>");
    expect(html).not.toContain("List retained materials");
  });
  const consultant = { ...common, actualWorkCountryAndLocation: "South Korea, Seoul", paymentMethodAndRecipientDetails: "Bank transfer (wire) to the recipient account on file.", monthlyFee: { amountMinor: 2000000, currency: "KRW" as const }, monthlyServiceScope: "Admissions roadmap and monthly parent meetings" };
  it("renders the consultant agreement: monthly fee, scope, consultant signs at the signature anchor", () => {
    const html = renderConsultantAgreementHtml(consultant);
    expect(html).toContain("Monthly fee: KRW 2,000,000 per month");
    expect(html).toContain("Monthly service scope: Admissions roadmap and monthly parent meetings");
    expect(html).toContain("Consultant name: Sora Park");
    expect(html).toContain("Consultant signature: /sig1/");
    expect(html.match(/\/sig1\//g)).toHaveLength(1);
    expect(html.match(/\/date1\//g)).toHaveLength(1);
    expect(html).not.toMatch(/Accepted monthly amount|Accepted scope and deliverables/);
  });
  it("renders the rate change addendum with previous/new rate and existing agreement reference", () => {
    const html = renderRateAddendumHtml({ ...common, actualWorkCountryAndLocation: "South Korea, Seoul", existingAgreementId: "11111111-2222-3333-4444-555555555555", existingAgreementSignedDate: "2026-11-02", previousRate: { amountMinor: 50000, currency: "KRW" }, newRate: { amountMinor: 60000, currency: "KRW" }, effectiveDate: "2027-01-01" });
    expect(html).toContain("Existing agreement ID: 11111111-2222-3333-4444-555555555555");
    expect(html).toContain("Previous hourly rate and currency: KRW 50,000 per 60 recognized minutes");
    expect(html).toContain("New hourly rate and currency: KRW 60,000 per 60 recognized minutes");
    expect(html).toContain("Effective date: January 1, 2027");
    expect(html).toContain("Teacher signature: /sig1/");
    expect(html).not.toMatch(/Identifier of the executed|Recorded signature completion|Newly accepted amount/);
  });
  it("fails when an input description from the source would remain (unreplaced check)", () => {
    expect(() => assertNoUnreplacedInputDescriptions("Lesson fee: Teacher's accepted hourly rate per 60 recognized minutes")).toThrow(UnfilledContractError);
    expect(() => assertNoUnreplacedInputDescriptions("Existing agreement ID: Identifier of the executed Existing Agreement.")).toThrow(UnfilledContractError);
    for (const key of ["teacherUsContractor", "consultantServices", "teacherRateAddendum"] as const) {
      expect(findUnreplacedInputDescriptions(JSON.stringify(GENERATED_LEGAL_DOCUMENTS[key])).length).toBeGreaterThan(0);
    }
  });
  it("rejects a bad rate in the contractor forms", () => {
    expect(() => renderUsContractorTeacherAgreementHtml({ ...us, lessonRate: { amountMinor: 0, currency: "USD" } })).toThrow(UnfilledContractError);
    expect(() => renderConsultantAgreementHtml({ ...consultant, monthlyServiceScope: " " })).toThrow(UnfilledContractError);
  });
  it("never invents unresolved commercial values", () => {
    expect(() => renderNonUsTeacherAgreementHtml({ ...nonUs, paymentMethodAndRecipientDetails: " " })).toThrow(UnfilledContractError);
    expect(() => renderCaliforniaTeacherAgreementHtml({ ...ca, supervisor: "" })).toThrow(UnfilledContractError);
  });
});
