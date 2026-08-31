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

  it("관리자가 아니면 requireAdmin에서 차단된다", async () => {
    profileSingleMock.mockResolvedValue({ data: { role: "parent" } });
    const { recordManualGuardianConsent } = await import("./consent-actions");
    await expect(
      recordManualGuardianConsent({
        studentId: "student1",
        policyVersionId: "policy1",
        consentedBy: "guardian1",
        verificationReference: "증빙",
      })
    ).rejects.toThrow("관리자만 사용할 수 있습니다.");
  });
});
