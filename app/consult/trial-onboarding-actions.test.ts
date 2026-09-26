import { describe, expect, it, vi, beforeEach } from "vitest";

const { adminRpcMock, userRpcMock, adminFromMock } = vi.hoisted(() => ({
  adminRpcMock: vi.fn(),
  userRpcMock: vi.fn(),
  adminFromMock: vi.fn(),
}));
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ rpc: adminRpcMock, from: adminFromMock }),
}));
vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn().mockResolvedValue({ supabase: { rpc: userRpcMock }, user: { id: "guardian1" } }),
}));

import {
  previewTrialOnboardingLink,
  linkExistingGuardianToTrialOnboarding,
  recordTrialSmartNotesConsent,
} from "./trial-onboarding-actions";

describe("previewTrialOnboardingLink", () => {
  beforeEach(() => vi.clearAllMocks());

  it("RPC 결과를 camelCase로 매핑한다", async () => {
    adminRpcMock.mockResolvedValue({
      data: [
        {
          link_id: "l1",
          consultation_id: "c1",
          guardian_email: "g@example.com",
          guardian_name: "학부모",
          student_name: "학생",
          student_email: "s@example.com",
          student_grade: "9학년",
        },
      ],
      error: null,
    });
    const result = await previewTrialOnboardingLink("tok");
    expect(result).toEqual({
      linkId: "l1",
      consultationId: "c1",
      guardianEmail: "g@example.com",
      guardianName: "학부모",
      studentName: "학생",
      studentEmail: "s@example.com",
      studentGrade: "9학년",
    });
    expect(adminRpcMock).toHaveBeenCalledWith("redeem_trial_onboarding_link", { p_token: "tok" });
  });

  it("링크가 없으면 에러를 던진다", async () => {
    adminRpcMock.mockResolvedValue({ data: [], error: null });
    await expect(previewTrialOnboardingLink("bad")).rejects.toThrow("유효하지 않은 온보딩 링크");
  });
});

describe("linkExistingGuardianToTrialOnboarding", () => {
  beforeEach(() => vi.clearAllMocks());

  it("로그인한 보호자 세션의 supabase 클라이언트로 RPC를 호출한다(auth.uid() 기준 소유권은 DB에서 재검증)", async () => {
    userRpcMock.mockResolvedValue({ data: [{ household_id: "h1", child_id: "child1" }], error: null });
    const result = await linkExistingGuardianToTrialOnboarding({ linkId: "l1", existingChildId: "child1" });
    expect(result).toEqual({ householdId: "h1", childId: "child1" });
    expect(userRpcMock).toHaveBeenCalledWith("link_existing_guardian_to_trial_onboarding", {
      p_link_id: "l1",
      p_existing_child_id: "child1",
    });
  });
});

describe("recordTrialSmartNotesConsent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("동의 기록 후 연결된 상담을 찾아 체험수업권 지급까지 이어간다", async () => {
    userRpcMock.mockResolvedValue({ data: "consent1", error: null });
    adminFromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: () => Promise.resolve({ data: { id: "consult1" }, error: null }),
            }),
          }),
        }),
      }),
    });
    adminRpcMock.mockResolvedValue({ error: null });

    const result = await recordTrialSmartNotesConsent({ childId: "child1", policyVersion: "v0.1" });

    expect(result).toEqual({ consentId: "consent1", grantAttempted: true, grantError: null });
    expect(userRpcMock).toHaveBeenCalledWith("record_trial_smart_notes_consent", {
      p_child_id: "child1",
      p_policy_version: "v0.1",
    });
    expect(adminRpcMock).toHaveBeenCalledWith("grant_trial_entitlement_for_consultation", {
      p_consultation_id: "consult1",
    });
  });

  it("연결된 상담이 없으면 지급을 시도하지 않는다", async () => {
    userRpcMock.mockResolvedValue({ data: "consent1", error: null });
    adminFromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
      }),
    });

    const result = await recordTrialSmartNotesConsent({ childId: "child1", policyVersion: "v0.1" });
    expect(result).toEqual({ consentId: "consent1", grantAttempted: false, grantError: null });
    expect(adminRpcMock).not.toHaveBeenCalledWith("grant_trial_entitlement_for_consultation", expect.anything());
  });
});
