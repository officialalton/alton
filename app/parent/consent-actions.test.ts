import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();
const supabaseMock = { rpc: rpcMock };

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn().mockResolvedValue({
    user: { id: "guardian1" },
    profile: { role: "parent", name: "김민지" },
    supabase: supabaseMock,
  }),
}));

describe("consentForChild", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpcMock.mockResolvedValue({ error: null });
  });

  it("consent_as_guardian RPC를 호출한다", async () => {
    const { consentForChild } = await import("./consent-actions");
    await consentForChild("student1", "policy1");

    expect(rpcMock).toHaveBeenCalledWith(
      "consent_as_guardian",
      expect.objectContaining({
        p_student_id: "student1",
        p_policy_version_id: "policy1",
      })
    );
  });

  it("RPC 에러를 그대로 던진다", async () => {
    rpcMock.mockResolvedValue({ error: { message: "학생 본인은 동의할 수 없습니다." } });
    const { consentForChild } = await import("./consent-actions");
    await expect(consentForChild("student1", "policy1")).rejects.toThrow(
      "학생 본인은 동의할 수 없습니다."
    );
  });
});

describe("revokeChildConsent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpcMock.mockResolvedValue({ error: null });
  });

  it("revoke_guardian_consent RPC를 호출한다", async () => {
    const { revokeChildConsent } = await import("./consent-actions");
    await revokeChildConsent("consent1", "보호자 요청");

    expect(rpcMock).toHaveBeenCalledWith("revoke_guardian_consent", {
      p_consent_id: "consent1",
      p_reason: "보호자 요청",
    });
  });

  it("RPC 에러를 그대로 던진다", async () => {
    rpcMock.mockResolvedValue({
      error: { message: "본인(동의를 기록한 보호자) 또는 관리자만 철회할 수 있습니다." },
    });
    const { revokeChildConsent } = await import("./consent-actions");
    await expect(revokeChildConsent("consent1", "사유")).rejects.toThrow(
      "본인(동의를 기록한 보호자) 또는 관리자만 철회할 수 있습니다."
    );
  });
});

describe("setChildDateOfBirth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpcMock.mockResolvedValue({ error: null });
  });

  it("set_student_date_of_birth RPC를 호출한다", async () => {
    const { setChildDateOfBirth } = await import("./consent-actions");
    await setChildDateOfBirth("student1", "2016-01-01");

    expect(rpcMock).toHaveBeenCalledWith("set_student_date_of_birth", {
      p_student_id: "student1",
      p_date_of_birth: "2016-01-01",
    });
  });

  it("RPC 에러를 그대로 던진다", async () => {
    rpcMock.mockResolvedValue({
      error: { message: "해당 학생의 보호자 또는 관리자만 생년월일을 변경할 수 있습니다." },
    });
    const { setChildDateOfBirth } = await import("./consent-actions");
    await expect(setChildDateOfBirth("student1", "2016-01-01")).rejects.toThrow(
      "해당 학생의 보호자 또는 관리자만 생년월일을 변경할 수 있습니다."
    );
  });
});
