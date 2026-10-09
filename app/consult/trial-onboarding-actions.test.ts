import { describe, expect, it, vi, beforeEach } from "vitest";

const { adminRpcMock } = vi.hoisted(() => ({
  adminRpcMock: vi.fn(),
}));
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ rpc: adminRpcMock }),
}));

import {
  previewTrialOnboardingLink,
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
    await expect(previewTrialOnboardingLink("bad")).rejects.toThrow("This onboarding link is invalid");
  });
});
