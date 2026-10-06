import { describe, expect, it } from "vitest";
import { canStartLessonCapture, evaluateLessonCapture, type RecordingGateInput } from "./recording-gate";
import { agreementCoversFourItems, agreementKindForForm } from "./recording-scope";

const ok: RecordingGateInput = {
  sessionKind: "regular_lesson",
  customerAgreement: { signed: true, templateVersion: "0.3-EN-CA" },
  providerAgreement: { signed: true, templateVersion: "0.2-EN" },
  providerKind: "teacher",
  under13: { isUnder13: false, guardianRelationshipVerified: false, consentRecorded: false, consentCurrent: false },
  additionalAttendees: [],
};
const codes = (i: RecordingGateInput) => evaluateLessonCapture(i).reasons.map((r) => r.code);

describe("evaluateLessonCapture — session type (execution rule)", () => {
  it("allows a regular lesson and a follow-up consultation when every record is in place", () => {
    expect(evaluateLessonCapture(ok)).toMatchObject({ allowed: true, reasons: [] });
    expect(evaluateLessonCapture({ ...ok, sessionKind: "follow_up_consultation", providerKind: "consultant", providerAgreement: { signed: true, templateVersion: "0.1-EN-CONSULTANT" } }).allowed).toBe(true);
  });
  it("never allows a first consultation or any trial lesson, even with every agreement and consent present", () => {
    expect(codes({ ...ok, sessionKind: "first_consultation" })).toEqual(["first_consultation_excluded"]);
    expect(codes({ ...ok, sessionKind: "trial_lesson" })).toEqual(["trial_lesson_excluded"]);
    // a trial held AFTER the contract was signed is still excluded (customer + teacher agreements are signed here)
    const afterSigning = evaluateLessonCapture({ ...ok, sessionKind: "trial_lesson" });
    expect(afterSigning.allowed).toBe(false);
    expect(afterSigning.reasons[0].message).toContain("including after a contract is signed");
  });
});

describe("evaluateLessonCapture — agreements and scope versions", () => {
  it("blocks when the customer or provider agreement is unsigned", () => {
    expect(codes({ ...ok, customerAgreement: { signed: false, templateVersion: null } })).toEqual(["customer_agreement_not_signed"]);
    expect(codes({ ...ok, providerAgreement: { signed: false, templateVersion: null } })).toEqual(["provider_agreement_not_signed"]);
  });
  it("blocks agreements signed on a version without the four items and asks for an amended agreement", () => {
    expect(codes({ ...ok, customerAgreement: { signed: true, templateVersion: "0.2-EN-CA" } })).toEqual(["customer_agreement_scope_outdated"]);
    expect(codes({ ...ok, providerAgreement: { signed: true, templateVersion: "0.1-LEGACY" } })).toEqual(["provider_agreement_scope_outdated"]);
    expect(codes({ ...ok, customerAgreement: { signed: true, templateVersion: null } })).toEqual(["customer_agreement_scope_outdated"]);
    expect(agreementCoversFourItems("teacher", "0.2-EN-CA")).toBe(true);
    expect(agreementCoversFourItems("consultant", "0.2-EN")).toBe(false);
    expect(agreementKindForForm("consultant_services")).toBe("consultant");
    expect(agreementKindForForm("teacher_rate_addendum")).toBeNull();
  });
  it("returns every blocking reason, not just the first", () => {
    const v = evaluateLessonCapture({ ...ok, customerAgreement: { signed: false, templateVersion: null }, providerAgreement: { signed: false, templateVersion: null } });
    expect(v.reasons.map((r) => r.code)).toEqual(["customer_agreement_not_signed", "provider_agreement_not_signed"]);
    expect(v.reason).toBe(v.reasons[0].message);
  });
});

describe("evaluateLessonCapture — participant consent", () => {
  const u13 = { isUnder13: true, guardianRelationshipVerified: true, consentRecorded: true, consentCurrent: true };
  it("under 13: needs a verified guardian relationship and consent valid for the current policy version", () => {
    expect(evaluateLessonCapture({ ...ok, under13: u13 }).allowed).toBe(true);
    expect(codes({ ...ok, under13: { ...u13, consentRecorded: false, guardianRelationshipVerified: false, consentCurrent: false } })).toEqual(["under13_guardian_consent_missing"]);
    expect(codes({ ...ok, under13: { ...u13, guardianRelationshipVerified: false } })).toEqual(["under13_guardian_relationship_unverified"]);
    expect(codes({ ...ok, under13: { ...u13, consentCurrent: false } })).toEqual(["under13_guardian_consent_outdated"]);
  });
  it("a customer signature is not the consent of every attendee: an additional attendee without notice or consent blocks capture", () => {
    expect(codes({ ...ok, additionalAttendees: [{ noticeGiven: true, consentRecorded: true }] })).toEqual([]);
    expect(codes({ ...ok, additionalAttendees: [{ label: "Sibling", noticeGiven: true, consentRecorded: false }] })).toEqual(["additional_attendee_consent_incomplete"]);
    expect(codes({ ...ok, additionalAttendees: [{ noticeGiven: false, consentRecorded: true }] })).toEqual(["additional_attendee_consent_incomplete"]);
    expect(codes({ ...ok, additionalAttendees: [{ noticeGiven: true, consentRecorded: true }, { noticeGiven: false, consentRecorded: false }] })).toEqual(["additional_attendee_consent_incomplete"]);
  });
  it("adds no per-lesson consent step: an ordinary adult-student lesson needs nothing beyond the signed agreements", () => {
    expect(evaluateLessonCapture(ok).allowed).toBe(true);
  });
});

describe("canStartLessonCapture (legacy flat input)", () => {
  const flat = { lessonKind: "regular" as const, customerAgreementSigned: true, teacherAgreementSigned: true, under13ConsentMissing: false };
  it("keeps the earlier behaviour", () => {
    expect(canStartLessonCapture(flat).allowed).toBe(true);
    expect(canStartLessonCapture({ ...flat, lessonKind: "trial" }).allowed).toBe(false);
    expect(canStartLessonCapture({ ...flat, lessonKind: "consultation" }).allowed).toBe(false);
    expect(canStartLessonCapture({ ...flat, customerAgreementSigned: false }).allowed).toBe(false);
    expect(canStartLessonCapture({ ...flat, teacherAgreementSigned: false }).allowed).toBe(false);
    expect(canStartLessonCapture({ ...flat, under13ConsentMissing: true }).allowed).toBe(false);
  });
});
