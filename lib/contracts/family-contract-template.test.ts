import { describe, expect, it } from "vitest";
import { UnfilledContractError } from "@/lib/legal/guard";
import { DATE_SIGNED_ANCHOR, FAMILY_CONTRACT_TEMPLATE_VERSION, SIGNATURE_ANCHOR, renderFamilyContractHtml } from "./family-contract-template";

const approval = {
  companyEntityName: "Alton Education LLC",
  approverName: "Do Kyung Kim",
  approverTitle: "Member, Do Kyung Kim",
  approvedAtLabel: "October 6, 2026 at 9:00 AM UTC",
  documentIdentifier: "cv1",
};
const base = {
  parentName: "Minji Kim",
  signerEmail: "minji@example.com",
  studentName: "Jihoon Kim",
  studentDateOfBirth: "2012-03-09",
  contractId: "cv-123",
  companyApproval: approval,
};

describe("renderFamilyContractHtml (parent agreement v0.3-EN-CA)", () => {
  it("fills every execution field and keeps the DocuSign anchors", () => {
    const html = renderFamilyContractHtml(base);
    expect(html).toContain("Minji Kim");
    expect(html).toContain("Jihoon Kim, March 9, 2012");
    expect(html).toContain(`cv-123 / ${FAMILY_CONTRACT_TEMPLATE_VERSION}`);
    expect(html).toContain("Alton Education LLC");
    expect(html).toContain("official@alton.education");
    expect(html).toContain("Do Kyung Kim, Member");
    expect(html).not.toContain("Do Kyung Kim, Member, Do Kyung Kim");
    expect(html.split(SIGNATURE_ANCHOR)).toHaveLength(2);
    expect(html.split(DATE_SIGNED_ANCHOR)).toHaveLength(2);
    expect(html).not.toMatch(/\[[^\]]+\]|_{3,}|\{\{/);
    expect(html).not.toMatch(/draft/i);
    expect(html).not.toMatch(/[가-힣]/);
  });

  it("contains all four regular-lesson consents and the consultation/trial exclusion", () => {
    const text = renderFamilyContractHtml(base);
    for (const phrase of ["video recording", "audio recording", "conversion of speech into a text transcript", "AI-assisted preparation and storage of lesson notes"]) {
      expect(text).toContain(phrase);
    }
    expect(text).toContain("Trial lessons are always excluded from recording, transcription and AI meeting notes, including after a contract is signed");
    expect(text).toContain("A first consultation is excluded from video and audio recording and from retained transcripts; AI meeting notes of a first consultation are prepared only where the requester consented when requesting the consultation, are visible only to ALTON staff, and are eligible for deletion one year after the consultation ends.");
    expect(text).toContain("A parent signature does not substitute for another participant");
  });

  it("adult student signs for themselves", () => {
    const html = renderFamilyContractHtml({ ...base, signerType: "adult_student", signerName: "Adult Lee", studentName: "Adult Lee" });
    expect(html).toContain("Adult Student");
    expect(html).toContain("Relationship to Student: Self");
  });

  it("escapes names", () => {
    const html = renderFamilyContractHtml({ ...base, parentName: 'A & "B"', studentName: "<S>" });
    expect(html).toContain("A &amp; &quot;B&quot;");
    expect(html).not.toContain("<S>");
  });

  it("blocks dispatch when a required value is missing", () => {
    expect(() => renderFamilyContractHtml({ ...base, studentDateOfBirth: "" })).toThrow();
    expect(() => renderFamilyContractHtml({ ...base, signerEmail: "" })).toThrow();
    expect(() => renderFamilyContractHtml({ ...base, contractId: "" })).toThrow();
    expect(() => renderFamilyContractHtml({ ...base, companyApproval: { ...approval, companyEntityName: "Other" } })).toThrow();
  });

  it("blocks dispatch when internal wording or a placeholder leaks into the text", () => {
    expect(() => renderFamilyContractHtml({ ...base, parentName: "[Complete before signature]" })).toThrow(UnfilledContractError);
    expect(() => renderFamilyContractHtml({ ...base, studentName: "Draft pending legal review" })).toThrow(UnfilledContractError);
  });
});
