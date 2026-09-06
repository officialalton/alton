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
};

// 2026-09-06(복수 자녀 온보딩) — get_trial_onboarding_link_students는 이제
// createGuardianAndStudentThenRedirect 안에서 두 번 호출된다: (1) Auth 계정을
// 만들어야 할 학생 명단 조회, (2) finalize 이후 실제로 created 처리된 학생에게만
// 비밀번호 설정 초대를 보내기 위한 재조회. 테스트에서는 호출 횟수로 두 상태를
// 흉내낸다(첫 호출=pending, 이후 호출=created — finalize가 성공했다고 가정).
let getStudentsCallCount = 0;

beforeEach(() => {
  vi.clearAllMocks();
  getStudentsCallCount = 0;
  updateEqMock.mockResolvedValue({ error: null });
  createUserMock
    .mockResolvedValueOnce({ data: { user: { id: "guardian-id" } }, error: null })
    .mockResolvedValueOnce({ data: { user: { id: "student-id" } }, error: null });
  rpcMock.mockImplementation((fnName: string) => {
    if (fnName === "find_auth_user_id_by_email") {
      return Promise.resolve({ data: null, error: null });
    }
    if (fnName === "get_trial_onboarding_link_students") {
      getStudentsCallCount += 1;
      const created = getStudentsCallCount > 1;
      return Promise.resolve({
        data: [
          {
            id: "ls-1",
            student_name: "학생",
            student_email: "student@example.com",
            student_grade: null,
            student_subject: null,
            status: created ? "created" : "pending",
            child_auth_user_id: created ? "student-id" : null,
            error: null,
          },
        ],
        error: null,
      });
    }
    if (fnName === "finalize_trial_onboarding_students") {
      return Promise.resolve({
        data: [{ household_id: "household-1", guardian_id: "guardian-id", created_count: 1, failed_count: 0 }],
        error: null,
      });
    }
    return Promise.resolve({ error: null });
  });
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
  it("학생이 단 1명도 생성되지 못하면 이미 만든 보호자 Auth 계정을 정리한다", async () => {
    createUserMock
      .mockReset()
      .mockResolvedValueOnce({ data: { user: { id: "guardian-id" } }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "duplicate email" } });

    await createGuardianAndStudentThenRedirect(BASE_PARAMS);

    expect(deleteUserMock).toHaveBeenCalledWith("guardian-id");
  });

  it("계정 연결(finalize) RPC가 실패하면 보호자·학생 Auth 계정을 모두 정리한다", async () => {
    rpcMock.mockImplementation((fnName: string) => {
      if (fnName === "find_auth_user_id_by_email") return Promise.resolve({ data: null, error: null });
      if (fnName === "get_trial_onboarding_link_students") {
        return Promise.resolve({
          data: [
            {
              id: "ls-1",
              student_name: "학생",
              student_email: "student@example.com",
              student_grade: null,
              student_subject: null,
              status: "pending",
              child_auth_user_id: null,
              error: null,
            },
          ],
          error: null,
        });
      }
      if (fnName === "finalize_trial_onboarding_students") {
        return Promise.resolve({ error: { message: "finalize boom" } });
      }
      return Promise.resolve({ error: null });
    });

    await createGuardianAndStudentThenRedirect(BASE_PARAMS);

    expect(deleteUserMock).toHaveBeenCalledWith("guardian-id");
    expect(deleteUserMock).toHaveBeenCalledWith("student-id");
  });
});

describe("createGuardianAndStudentThenRedirect — 복수 자녀", () => {
  it("학생 2명을 처리하고 각각에게 비밀번호 설정 메일을 보낸다", async () => {
    createUserMock
      .mockReset()
      .mockResolvedValueOnce({ data: { user: { id: "student-a-id" } }, error: null })
      .mockResolvedValueOnce({ data: { user: { id: "student-b-id" } }, error: null });

    let call = 0;
    rpcMock.mockImplementation((fnName: string) => {
      if (fnName === "find_auth_user_id_by_email") {
        // 기존 보호자 경로로 흉내낸다 — guardian createUser 호출이 없어도 되게.
        return Promise.resolve({ data: "existing-guardian-id", error: null });
      }
      if (fnName === "get_trial_onboarding_link_students") {
        call += 1;
        const created = call > 1;
        return Promise.resolve({
          data: [
            {
              id: "ls-a",
              student_name: "학생A",
              student_email: "a@example.com",
              student_grade: null,
              student_subject: null,
              status: created ? "created" : "pending",
              child_auth_user_id: created ? "student-a-id" : null,
              error: null,
            },
            {
              id: "ls-b",
              student_name: "학생B",
              student_email: "b@example.com",
              student_grade: null,
              student_subject: null,
              status: created ? "created" : "pending",
              child_auth_user_id: created ? "student-b-id" : null,
              error: null,
            },
          ],
          error: null,
        });
      }
      if (fnName === "finalize_trial_onboarding_students") {
        return Promise.resolve({
          data: [{ household_id: "household-1", guardian_id: "existing-guardian-id", created_count: 2, failed_count: 0 }],
          error: null,
        });
      }
      return Promise.resolve({ error: null });
    });

    const res = await createGuardianAndStudentThenRedirect(BASE_PARAMS);

    expect(res.status).toBe(307);
    expect(createUserMock).toHaveBeenCalledTimes(2);
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    const recipients = sendEmailMock.mock.calls.map((c) => c[0].to);
    expect(recipients).toEqual(expect.arrayContaining(["a@example.com", "b@example.com"]));
  });
});
