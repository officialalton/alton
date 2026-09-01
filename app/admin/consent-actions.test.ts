import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn().mockResolvedValue({ data: { user: { id: "admin1" } } });
const profileSingleMock = vi.fn().mockResolvedValue({ data: { role: "admin" } });
const rpcMock = vi.fn();

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => {
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ single: profileSingleMock }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
    rpc: rpcMock,
  }),
}));

describe("recordManualGuardianConsent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "admin1" } } });
    profileSingleMock.mockResolvedValue({ data: { role: "admin" } });
    rpcMock.mockResolvedValue({ error: null });
  });

  it("증빙이 있으면 record_manual_guardian_consent RPC를 호출한다", async () => {
    const { recordManualGuardianConsent } = await import("./consent-actions");
    await recordManualGuardianConsent({
      studentId: "student1",
      policyVersionId: "policy1",
      consentedBy: "guardian1",
      verificationReference: "전화 통화 녹취 ID: CALL-1",
    });

    expect(rpcMock).toHaveBeenCalledWith(
      "record_manual_guardian_consent",
      expect.objectContaining({
        p_student_id: "student1",
        p_policy_version_id: "policy1",
        p_consented_by: "guardian1",
        p_verification_reference: "전화 통화 녹취 ID: CALL-1",
      })
    );
  });

  it("증빙이 비어있으면 RPC를 호출하지 않고 에러를 던진다", async () => {
    const { recordManualGuardianConsent } = await import("./consent-actions");
    await expect(
      recordManualGuardianConsent({
        studentId: "student1",
        policyVersionId: "policy1",
        consentedBy: "guardian1",
        verificationReference: "   ",
      })
    ).rejects.toThrow("수동 확인 증빙을 입력해주세요.");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("관리자가 아니고 manage_guardian_consent capability도 없으면 차단된다", async () => {
    profileSingleMock.mockResolvedValue({ data: { role: "parent" } });
    rpcMock.mockImplementation((fn: string) => {
      if (fn === "current_user_has_capability") return Promise.resolve({ data: false });
      throw new Error(`unexpected rpc ${fn}`);
    });
    const { recordManualGuardianConsent } = await import("./consent-actions");
    await expect(
      recordManualGuardianConsent({
        studentId: "student1",
        policyVersionId: "policy1",
        consentedBy: "guardian1",
        verificationReference: "증빙",
      })
    ).rejects.toThrow("이 작업을 수행할 권한이 없습니다.");
  });

  it("관리자가 아니어도 manage_guardian_consent capability가 있으면 통과한다", async () => {
    profileSingleMock.mockResolvedValue({ data: { role: "parent" } });
    rpcMock.mockImplementation((fn: string) => {
      if (fn === "current_user_has_capability") return Promise.resolve({ data: true });
      if (fn === "record_manual_guardian_consent") return Promise.resolve({ error: null });
      throw new Error(`unexpected rpc ${fn}`);
    });
    const { recordManualGuardianConsent } = await import("./consent-actions");
    await recordManualGuardianConsent({
      studentId: "student1",
      policyVersionId: "policy1",
      consentedBy: "guardian1",
      verificationReference: "증빙",
    });
    expect(rpcMock).toHaveBeenCalledWith("current_user_has_capability", {
      p_capability: "manage_guardian_consent",
    });
  });
});
