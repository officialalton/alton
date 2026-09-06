import { describe, expect, it, vi, beforeEach } from "vitest";

const { adminFromMock, getUserByIdMock, resendStudentSetPasswordEmailMock } = vi.hoisted(() => ({
  adminFromMock: vi.fn(),
  getUserByIdMock: vi.fn(),
  resendStudentSetPasswordEmailMock: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({
    from: adminFromMock,
    auth: { admin: { getUserById: getUserByIdMock } },
  }),
}));
vi.mock("@/lib/admin-auth", () => ({
  requireAdminOrCapability: vi.fn().mockResolvedValue({ actorUserId: "admin1" }),
}));
vi.mock("@/lib/request-origin", () => ({ currentRequestOrigin: () => Promise.resolve("http://localhost:3010") }));
vi.mock("@/lib/trial-onboarding-finalize", () => ({
  resendStudentSetPasswordEmail: resendStudentSetPasswordEmailMock,
}));

import { getStudentInviteStatusAction, resendStudentInviteAction } from "./student-invite-actions";

function mockTable(rows: Record<string, unknown>) {
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: rows, error: null }),
        order: () => ({
          limit: () => ({
            maybeSingle: () => Promise.resolve({ data: rows, error: null }),
          }),
        }),
      }),
    }),
  };
}

describe("getStudentInviteStatusAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("링크 상태와 학생 계정의 email_confirmed_at 기준 완료 여부를 반환한다", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "consultations") return mockTable({ child_id: "student1" });
      if (table === "trial_onboarding_links")
        return mockTable({
          id: "link1",
          student_email: "student@example.com",
          student_invite_status: "sent",
          student_invite_sent_at: "2026-09-05T00:00:00Z",
          student_invite_error: null,
        });
      throw new Error(`unexpected table ${table}`);
    });
    getUserByIdMock.mockResolvedValue({ data: { user: { email_confirmed_at: null } }, error: null });

    const result = await getStudentInviteStatusAction("c1");

    expect(result).toEqual({
      linkId: "link1",
      studentEmail: "student@example.com",
      inviteStatus: "sent",
      sentAt: "2026-09-05T00:00:00Z",
      error: null,
      completed: false,
    });
  });

  it("이미 email_confirmed_at이 있으면 completed=true를 반환한다", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "consultations") return mockTable({ child_id: "student1" });
      if (table === "trial_onboarding_links")
        return mockTable({
          id: "link1",
          student_email: "student@example.com",
          student_invite_status: "sent",
          student_invite_sent_at: "2026-09-05T00:00:00Z",
          student_invite_error: null,
        });
      throw new Error(`unexpected table ${table}`);
    });
    getUserByIdMock.mockResolvedValue({ data: { user: { email_confirmed_at: "2026-09-05T01:00:00Z" } }, error: null });

    const result = await getStudentInviteStatusAction("c1");
    expect(result.completed).toBe(true);
  });
});

describe("resendStudentInviteAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("이미 완료된 학생 계정은 재발송을 차단한다", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "consultations") return mockTable({ child_id: "student1" });
      throw new Error(`unexpected table ${table}`);
    });
    getUserByIdMock.mockResolvedValue({
      data: { user: { email: "student@example.com", email_confirmed_at: "2026-09-05T01:00:00Z" } },
      error: null,
    });

    await expect(resendStudentInviteAction("c1")).rejects.toThrow("이미 비밀번호 설정과 이메일 확인을 완료");
    expect(resendStudentSetPasswordEmailMock).not.toHaveBeenCalled();
  });

  it("미완료 학생 계정은 같은 계정으로 재발송하고 새 계정을 만들지 않는다", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "consultations") return mockTable({ child_id: "student1" });
      if (table === "trial_onboarding_links") return mockTable({ id: "link1", student_name: "학생" });
      throw new Error(`unexpected table ${table}`);
    });
    getUserByIdMock.mockResolvedValue({
      data: { user: { email: "student@example.com", email_confirmed_at: null } },
      error: null,
    });
    resendStudentSetPasswordEmailMock.mockResolvedValue(undefined);

    await resendStudentInviteAction("c1");

    expect(resendStudentSetPasswordEmailMock).toHaveBeenCalledWith({
      url: new URL("http://localhost:3010"),
      linkId: "link1",
      studentEmail: "student@example.com",
      studentName: "학생",
    });
  });

  it("학생 계정이 아직 없으면(child_id 없음) 재발송을 거부한다", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "consultations") return mockTable({ child_id: null });
      throw new Error(`unexpected table ${table}`);
    });

    await expect(resendStudentInviteAction("c1")).rejects.toThrow("아직 학생 계정이 연결되지 않았습니다");
    expect(getUserByIdMock).not.toHaveBeenCalled();
    expect(resendStudentSetPasswordEmailMock).not.toHaveBeenCalled();
  });
});
