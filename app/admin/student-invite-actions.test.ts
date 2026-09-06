import { describe, expect, it, vi, beforeEach } from "vitest";

const { adminFromMock, getUserByIdMock, resendStudentSetPasswordEmailMock, rpcMock } = vi.hoisted(() => ({
  adminFromMock: vi.fn(),
  getUserByIdMock: vi.fn(),
  resendStudentSetPasswordEmailMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({
    from: adminFromMock,
    auth: { admin: { getUserById: getUserByIdMock } },
    rpc: rpcMock,
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
      }),
    }),
  };
}

describe("getStudentInviteStatusAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("학생별 초대 상태와 학생 계정의 email_confirmed_at 기준 완료 여부를 반환한다", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "consultations") return mockTable({ child_id: "student1", source_link_child_id: "ls1" });
      if (table === "trial_onboarding_link_students")
        return mockTable({
          id: "ls1",
          student_email: "student@example.com",
          invite_status: "sent",
          invite_sent_at: "2026-09-05T00:00:00Z",
          invite_error: null,
          invite_retry_count: 0,
        });
      throw new Error(`unexpected table ${table}`);
    });
    getUserByIdMock.mockResolvedValue({ data: { user: { email_confirmed_at: null } }, error: null });

    const result = await getStudentInviteStatusAction("c1");

    expect(result).toEqual({
      linkStudentId: "ls1",
      studentEmail: "student@example.com",
      inviteStatus: "sent",
      sentAt: "2026-09-05T00:00:00Z",
      error: null,
      retryCount: 0,
      completed: false,
    });
  });

  it("이미 email_confirmed_at이 있으면 completed=true를 반환한다", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "consultations") return mockTable({ child_id: "student1", source_link_child_id: "ls1" });
      if (table === "trial_onboarding_link_students")
        return mockTable({
          id: "ls1",
          student_email: "student@example.com",
          invite_status: "sent",
          invite_sent_at: "2026-09-05T00:00:00Z",
          invite_error: null,
          invite_retry_count: 0,
        });
      throw new Error(`unexpected table ${table}`);
    });
    getUserByIdMock.mockResolvedValue({ data: { user: { email_confirmed_at: "2026-09-05T01:00:00Z" } }, error: null });

    const result = await getStudentInviteStatusAction("c1");
    expect(result.completed).toBe(true);
  });

  it("학생별 카드가 아니면(source_link_child_id 없음) 전부 null을 반환한다", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "consultations") return mockTable({ child_id: null, source_link_child_id: null });
      throw new Error(`unexpected table ${table}`);
    });

    const result = await getStudentInviteStatusAction("c1");
    expect(result.linkStudentId).toBeNull();
    expect(result.inviteStatus).toBeNull();
  });
});

describe("resendStudentInviteAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("이미 완료된 학생 계정은 재발송을 차단한다", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "consultations") return mockTable({ child_id: "student1", source_link_child_id: "ls1" });
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
      if (table === "consultations") return mockTable({ child_id: "student1", source_link_child_id: "ls1" });
      if (table === "trial_onboarding_link_students") return mockTable({ id: "ls1", student_name: "학생", link_id: "link1" });
      throw new Error(`unexpected table ${table}`);
    });
    getUserByIdMock.mockResolvedValue({
      data: { user: { email: "student@example.com", email_confirmed_at: null } },
      error: null,
    });
    resendStudentSetPasswordEmailMock.mockResolvedValue(undefined);
    rpcMock.mockResolvedValue({ data: null, error: null });

    await resendStudentInviteAction("c1");

    expect(rpcMock).toHaveBeenCalledWith("retry_trial_onboarding_student", {
      p_link_id: "link1",
      p_link_student_id: "ls1",
      p_child_auth_user_id: "student1",
      p_stage: "invite",
    });
    expect(resendStudentSetPasswordEmailMock).toHaveBeenCalledWith({
      url: new URL("http://localhost:3010"),
      linkStudentId: "ls1",
      studentEmail: "student@example.com",
      studentName: "학생",
    });
  });

  it("학생 계정이 아직 없으면(child_id 없음) 재발송을 거부한다", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "consultations") return mockTable({ child_id: null, source_link_child_id: null });
      throw new Error(`unexpected table ${table}`);
    });

    await expect(resendStudentInviteAction("c1")).rejects.toThrow("아직 학생 계정이 연결되지 않았습니다");
    expect(getUserByIdMock).not.toHaveBeenCalled();
    expect(resendStudentSetPasswordEmailMock).not.toHaveBeenCalled();
  });
});
