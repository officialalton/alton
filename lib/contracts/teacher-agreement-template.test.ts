import { describe, expect, it } from "vitest";
import { UnfilledContractError } from "@/lib/legal/guard";
import {
  renderCaliforniaTeacherAgreementHtml,
  renderNonUsTeacherAgreementHtml,
  selectTeacherAgreementForm,
} from "./teacher-agreement-template";

const approval = { companyEntityName: "Alton Education LLC", approverName: "Do Kyung Kim", approverTitle: "CEO", approvedAtLabel: "October 6, 2026 at 9:00 AM UTC", documentIdentifier: "t1" };
const common = { teacherName: "Sora Park", teacherEmail: "sora@example.com", teacherAddress: "1 Main St", effectiveDate: "2026-11-01", priorMaterials: "None", companyApproval: approval };
const ca = { ...common, californiaWorkLocation: "Remote, San Jose, CA", supervisor: "Do Kyung Kim" };
const nonUs = {
  ...common,
  actualWorkCountryAndLocation: "South Korea, Seoul",
  nonLessonServicesScopeAndCompensation: "Review: USD 50 per hour",
  paymentMethodAndRecipientDetails: "Bank transfer",
};

describe("selectTeacherAgreementForm", () => {
  it("chooses by actual work location only", () => {
    expect(selectTeacherAgreementForm({ country: "US", region: "CA" })).toMatchObject({ form: "california_employment" });
    expect(selectTeacherAgreementForm({ country: "us", region: "California" })).toMatchObject({ form: "california_employment" });
    expect(selectTeacherAgreementForm({ country: "KR" })).toMatchObject({ form: "non_us_services" });
    expect(selectTeacherAgreementForm({ country: "US", region: "NY" }).form).toBeNull();
    expect(selectTeacherAgreementForm({ country: "US" }).form).toBeNull();
    expect(selectTeacherAgreementForm({ country: "" }).form).toBeNull();
  });
});

describe("teacher agreement rendering", () => {
  it("renders the California employment agreement with all four recording items", () => {
    const html = renderCaliforniaTeacherAgreementHtml(ca);
    expect(html).toContain("Teacher Employment Agreement");
    expect(html).toContain("USD $50.00");
    expect(html).toContain("Pacific Time (America/Los_Angeles)");
    expect(html).toContain("paid on the 20th of the same month");
    expect(html).toContain("5th of the following month");
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
    expect(html).toContain("paid on the 20th of the same month");
    expect(html).not.toMatch(/_{3,}|\[[^\]]+\]|draft/i);
  });
  it("never invents unresolved commercial values", () => {
    expect(() => renderNonUsTeacherAgreementHtml({ ...nonUs, paymentMethodAndRecipientDetails: " " })).toThrow(UnfilledContractError);
    expect(() => renderNonUsTeacherAgreementHtml({ ...nonUs, nonLessonServicesScopeAndCompensation: "" })).toThrow(UnfilledContractError);
    expect(() => renderCaliforniaTeacherAgreementHtml({ ...ca, supervisor: "" })).toThrow(UnfilledContractError);
  });
});
