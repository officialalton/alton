import { describe, expect, it, vi, beforeEach } from "vitest";

const adminRpcMock = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ rpc: adminRpcMock }),
}));
vi.mock("@/lib/admin-auth", () => ({
  requireAdminOrCapability: vi.fn().mockResolvedValue({ actorUserId: "admin1" }),
}));

import { confirmTrialIntentAction, createTrialOnboardingLinkAction } from "./trial-onboarding-actions";

describe("confirmTrialIntentAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("confirm_trial_intent RPC를 호출한다", async () => {
    adminRpcMock.mockResolvedValue({ error: null });
    await confirmTrialIntentAction("c1");
    expect(adminRpcMock).toHaveBeenCalledWith("confirm_trial_intent", { p_consultation_id: "c1" });
  });

  it("RPC 에러를 그대로 던진다(예: 관리자 추천 없이 확정 시도)", async () => {
    adminRpcMock.mockResolvedValue({ error: { message: "관리자 추천(trial_recommended) 결과가 기록된 상담만 체험 진행을 확정할 수 있습니다." } });
    await expect(confirmTrialIntentAction("c1")).rejects.toThrow("관리자 추천");
  });
});

describe("createTrialOnboardingLinkAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("student_email 등 전체 파라미터를 RPC에 그대로 전달한다", async () => {
    adminRpcMock.mockResolvedValue({ data: [{ link_id: "l1", raw_token: "tok" }], error: null });
    const result = await createTrialOnboardingLinkAction({
      consultationId: "c1",
      guardianEmail: "g@example.com",
      guardianName: "학부모",
      studentName: "학생",
      studentEmail: "s@example.com",
      studentGrade: "9학년",
    });
    expect(result).toEqual({ linkId: "l1", rawToken: "tok" });
    expect(adminRpcMock).toHaveBeenCalledWith("create_trial_onboarding_link", {
      p_consultation_id: "c1",
      p_guardian_email: "g@example.com",
      p_guardian_name: "학부모",
      p_student_name: "학생",
      p_student_email: "s@example.com",
      p_student_grade: "9학년",
    });
  });
});
