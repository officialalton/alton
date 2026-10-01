import { describe, expect, it } from "vitest";
import {
  decideSubjectEnrollmentActivation,
  decideReturningSubjectEnrollment,
  decideTrialTeacherSuccessionProposal,
} from "./subject-enrollment-decision";

describe("decideSubjectEnrollmentActivation", () => {
  it("both ready -> can activate", () => {
    expect(
      decideSubjectEnrollmentActivation({ contractStatus: "active", activationReady: true })
    ).toEqual({ canActivate: true });
  });

  it("contract not active, entitlement ok -> blocked contract_not_active", () => {
    expect(
      decideSubjectEnrollmentActivation({ contractStatus: "draft", activationReady: true })
    ).toEqual({ canActivate: false, blockedBy: "contract_not_active" });
  });

  it("contract active, no entitlement -> blocked no_paid_entitlement", () => {
    // activationReady=false with contract active implies entitlement missing
    // per the RPC contract (both preconditions collapsed into one boolean by DB,
    // so at app layer we still separate contract state from that boolean).
    expect(
      decideSubjectEnrollmentActivation({ contractStatus: "active", activationReady: false })
    ).toEqual({ canActivate: false, blockedBy: "no_paid_entitlement" });
  });

  it("neither ready -> blocked both", () => {
    expect(
      decideSubjectEnrollmentActivation({ contractStatus: "draft", activationReady: false })
    ).toEqual({ canActivate: false, blockedBy: "both" });
  });
});

describe("decideReturningSubjectEnrollment", () => {
  it("reuses a live enrollment when one exists", () => {
    expect(
      decideReturningSubjectEnrollment({
        hasEndedEnrollmentForSubject: true,
        hasLiveEnrollmentForSubject: true,
      })
    ).toEqual({ decision: "reuse_live_enrollment" });
  });

  it("never revives an ended enrollment - always creates new", () => {
    expect(
      decideReturningSubjectEnrollment({
        hasEndedEnrollmentForSubject: true,
        hasLiveEnrollmentForSubject: false,
      })
    ).toEqual({ decision: "create_new_enrollment" });
  });

  it("brand new subject (no history at all) -> create new", () => {
    expect(
      decideReturningSubjectEnrollment({
        hasEndedEnrollmentForSubject: false,
        hasLiveEnrollmentForSubject: false,
      })
    ).toEqual({ decision: "create_new_enrollment" });
  });
});

describe("decideTrialTeacherSuccessionProposal", () => {
  it("all conditions met -> can propose, curriculum not required", () => {
    expect(
      decideTrialTeacherSuccessionProposal({
        isActive: true,
        hasSubjectQualification: true,
        hasCurriculum: false,
        hasValidRate: true,
      })
    ).toEqual({ canPropose: true });
  });

  it("not active -> blocked", () => {
    const result = decideTrialTeacherSuccessionProposal({
      isActive: false,
      hasSubjectQualification: true,
      hasCurriculum: true,
      hasValidRate: true,
    });
    expect(result).toEqual({ canPropose: false, blockedBy: ["not_active"] });
  });

  it("missing qualification and rate -> both reported", () => {
    const result = decideTrialTeacherSuccessionProposal({
      isActive: true,
      hasSubjectQualification: false,
      hasCurriculum: false,
      hasValidRate: false,
    });
    expect(result).toEqual({
      canPropose: false,
      blockedBy: ["no_subject_qualification", "no_valid_rate"],
    });
  });
});
