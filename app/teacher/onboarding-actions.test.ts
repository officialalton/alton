import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn().mockResolvedValue({ data: { user: { id: "teacher1" } } });
const updateEqMock = vi.fn().mockResolvedValue({ error: null });
const updateMock = vi.fn(() => ({ eq: updateEqMock }));
const fromMock = vi.fn(() => ({ update: updateMock }));

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));

describe("submitCalendlyOnboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "teacher1" } } });
    updateEqMock.mockResolvedValue({ error: null });
  });

  it("본인의 calendly_scheduling_url을 저장하고 status를 active로 바꾼다", async () => {
    const { submitCalendlyOnboarding } = await import("./onboarding-actions");
    await submitCalendlyOnboarding("https://calendly.com/seoyeon-teacher/session");

    expect(fromMock).toHaveBeenCalledWith("teachers");
    expect(updateMock).toHaveBeenCalledWith({
      calendly_scheduling_url: "https://calendly.com/seoyeon-teacher/session",
      status: "active",
    });
    expect(updateEqMock).toHaveBeenCalledWith("id", "teacher1");
  });

  it("로그인하지 않았으면 에러를 던진다", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { submitCalendlyOnboarding } = await import("./onboarding-actions");
    await expect(submitCalendlyOnboarding("https://calendly.com/x")).rejects.toThrow(
      "로그인이 필요합니다."
    );
  });

  it("빈 URL이면 에러를 던진다", async () => {
    const { submitCalendlyOnboarding } = await import("./onboarding-actions");
    await expect(submitCalendlyOnboarding("  ")).rejects.toThrow(
      "Calendly 예약 링크를 입력해주세요."
    );
  });

  it("저장이 실패하면 에러를 던진다", async () => {
    updateEqMock.mockResolvedValue({ error: { message: "권한 없음" } });
    const { submitCalendlyOnboarding } = await import("./onboarding-actions");
    await expect(
      submitCalendlyOnboarding("https://calendly.com/x")
    ).rejects.toThrow("권한 없음");
  });
});
