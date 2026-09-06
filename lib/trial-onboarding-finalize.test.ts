import { beforeEach, describe, expect, it, vi } from "vitest";

const createUserMock = vi.fn();
const generateLinkMock = vi.fn();
const deleteUserMock = vi.fn().mockResolvedValue({ error: null });
const rpcMock = vi.fn();
const updateEqMock = vi.fn().mockResolvedValue({ error: null });
const fromMock = vi.fn(() => ({ update: () => ({ eq: updateEqMock }) }));
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { createUser: createUserMock, generateLink: generateLinkMock, deleteUser: deleteUserMock } },
    rpc: rpcMock,
    from: fromMock,
  }),
}));

const sendEmailMock = vi.fn();
vi.mock("@/lib/email", () => ({
  sendEmail: (params: unknown) => sendEmailMock(params),
  escapeHtml: (v: string) => v,
}));

import { createGuardianAndStudentThenRedirect } from "./trial-onboarding-finalize";

const BASE_PARAMS = {
  url: new URL("https://alton-preview.vercel.app/api/trial-onboarding/confirm-email"),
  linkId: "link-1",
  guardianEmail: "guardian@example.com",
  guardianName: "보호자",
  studentEmail: "student@example.com",
  studentName: "학생",
};

beforeEach(() => {
  vi.clearAllMocks();
  updateEqMock.mockResolvedValue({ error: null });
  createUserMock
    .mockResolvedValueOnce({ data: { user: { id: "guardian-id" } }, error: null })
    .mockResolvedValueOnce({ data: { user: { id: "student-id" } }, error: null });
  rpcMock.mockImplementation((fnName: string) =>
    fnName === "find_auth_user_id_by_email"
      ? Promise.resolve({ data: null, error: null })
      : Promise.resolve({ error: null })
  );
  generateLinkMock.mockImplementation(async ({ email }: { email: string }) => ({
    data: { properties: { hashed_token: `hash-for-${email}` } },
    error: null,
  }));
});

describe("createGuardianAndStudentThenRedirect — 학생 비밀번호 설정 메일", () => {
  it("보호자·학생 계정 생성 성공 시 학생 이메일로 비밀번호 설정 링크를 보낸다", async () => {
    await createGuardianAndStudentThenRedirect(BASE_PARAMS);

    expect(generateLinkMock).toHaveBeenCalledWith({ type: "recovery", email: "guardian@example.com" });
    expect(generateLinkMock).toHaveBeenCalledWith({ type: "recovery", email: "student@example.com" });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const emailArgs = sendEmailMock.mock.calls[0][0];
    expect(emailArgs.to).toBe("student@example.com");
    expect(emailArgs.html).toContain("hash-for-student%40example.com");
  });

  it("발송 성공 시 trial_onboarding_links.student_invite_status를 sent로 기록한다", async () => {
    await createGuardianAndStudentThenRedirect(BASE_PARAMS);

    expect(fromMock).toHaveBeenCalledWith("trial_onboarding_links");
    expect(updateEqMock).toHaveBeenCalledWith("id", "link-1");
  });

  it("학생 링크 생성이 실패해도 보호자 리다이렉트는 그대로 진행된다(실패 상태를 기록)", async () => {
    generateLinkMock.mockImplementation(async ({ email }: { email: string }) => {
      if (email === "student@example.com") return { data: null, error: { message: "boom" } };
      return { data: { properties: { hashed_token: "hash-guardian" } }, error: null };
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await createGuardianAndStudentThenRedirect(BASE_PARAMS);

    expect(res.status).toBe(307);
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(fromMock).toHaveBeenCalledWith("trial_onboarding_links");
    expect(updateEqMock).toHaveBeenCalledWith("id", "link-1");
    consoleErrorSpy.mockRestore();
  });

  it("이메일 발송 자체가 실패해도(SMTP 등) failed 상태를 기록한다", async () => {
    sendEmailMock.mockRejectedValueOnce(new Error("SMTP down"));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await createGuardianAndStudentThenRedirect(BASE_PARAMS);

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(fromMock).toHaveBeenCalledWith("trial_onboarding_links");
    expect(updateEqMock).toHaveBeenCalledWith("id", "link-1");
    consoleErrorSpy.mockRestore();
  });
});

describe("createGuardianAndStudentThenRedirect — 부분 실패 시 고아 Auth 계정 정리(2026-09-05 코드 점검 발견)", () => {
  it("학생 계정 생성이 실패하면 이미 만든 보호자 Auth 계정을 정리한다", async () => {
    createUserMock
      .mockReset()
      .mockResolvedValueOnce({ data: { user: { id: "guardian-id" } }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "duplicate email" } });

    await createGuardianAndStudentThenRedirect(BASE_PARAMS);

    expect(deleteUserMock).toHaveBeenCalledWith("guardian-id");
  });

  it("계정 연결(finalize) RPC가 실패하면 보호자·학생 Auth 계정을 모두 정리한다", async () => {
    rpcMock.mockImplementation((fnName: string) =>
      fnName === "find_auth_user_id_by_email"
        ? Promise.resolve({ data: null, error: null })
        : Promise.resolve({ error: { message: "finalize boom" } })
    );

    await createGuardianAndStudentThenRedirect(BASE_PARAMS);

    expect(deleteUserMock).toHaveBeenCalledWith("guardian-id");
    expect(deleteUserMock).toHaveBeenCalledWith("student-id");
  });
});
