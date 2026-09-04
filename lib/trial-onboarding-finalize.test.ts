import { beforeEach, describe, expect, it, vi } from "vitest";

const createUserMock = vi.fn();
const generateLinkMock = vi.fn();
const rpcMock = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { createUser: createUserMock, generateLink: generateLinkMock } },
    rpc: rpcMock,
  }),
}));

const sendEmailMock = vi.fn();
vi.mock("@/lib/email", () => ({
  sendEmail: (params: unknown) => sendEmailMock(params),
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
  createUserMock
    .mockResolvedValueOnce({ data: { user: { id: "guardian-id" } }, error: null })
    .mockResolvedValueOnce({ data: { user: { id: "student-id" } }, error: null });
  rpcMock.mockResolvedValue({ error: null });
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

  it("학생 링크 생성이 실패해도 보호자 리다이렉트는 그대로 진행된다(로그만 남김)", async () => {
    generateLinkMock.mockImplementation(async ({ email }: { email: string }) => {
      if (email === "student@example.com") return { data: null, error: { message: "boom" } };
      return { data: { properties: { hashed_token: "hash-guardian" } }, error: null };
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await createGuardianAndStudentThenRedirect(BASE_PARAMS);

    expect(res.status).toBe(307);
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
