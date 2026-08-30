import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn().mockResolvedValue({ data: { user: { id: "teacher1" } } });
const profileSingleMock = vi.fn().mockResolvedValue({ data: { role: "teacher" } });
const updateEqMock = vi.fn().mockResolvedValue({ error: null });
const updateMock = vi.fn(() => ({ eq: updateEqMock }));

const redirectMock = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => {
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ single: profileSingleMock }) }) };
      }
      if (table === "teachers") {
        return { update: updateMock };
      }
      throw new Error(`unexpected table ${table}`);
    },
    rpc: vi.fn().mockResolvedValue({ data: "active", error: null }),
  }),
}));

describe("submitCalendlyOnboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "teacher1" } } });
    profileSingleMock.mockResolvedValue({ data: { role: "teacher" } });
    updateEqMock.mockResolvedValue({ error: null });
  });

  it("본인의 calendly_scheduling_url만 저장한다(status는 더 이상 바꾸지 않음)", async () => {
    const { submitCalendlyOnboarding } = await import("./onboarding-actions");
    await submitCalendlyOnboarding("https://calendly.com/seoyeon-teacher/session");

    expect(updateMock).toHaveBeenCalledWith({
      calendly_scheduling_url: "https://calendly.com/seoyeon-teacher/session",
    });
    expect(updateEqMock).toHaveBeenCalledWith("id", "teacher1");
  });

  it("로그인하지 않았으면 /login으로 리다이렉트한다", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { submitCalendlyOnboarding } = await import("./onboarding-actions");
    await expect(submitCalendlyOnboarding("https://calendly.com/x")).rejects.toThrow(
      "REDIRECT:/login"
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
