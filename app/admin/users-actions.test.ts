import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn().mockResolvedValue({ data: { user: { id: "admin1" } } });
const profileSingleMock = vi.fn().mockResolvedValue({ data: { role: "admin" } });
const inviteUserByEmailMock = vi.fn();
const parentsInsertMock = vi.fn().mockResolvedValue({ error: null });
const profilesInsertMock = vi.fn().mockResolvedValue({ error: null });
const serverRpcMock = vi.fn();
const sendInviteEmailMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => {
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ single: profileSingleMock }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
    rpc: serverRpcMock,
  }),
}));

vi.mock("@/lib/invite-email", () => ({
  sendInviteEmail: sendInviteEmailMock,
}));

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { inviteUserByEmail: inviteUserByEmailMock } },
    from: (table: string) => {
      if (table === "profiles") return { insert: profilesInsertMock };
      if (table === "parents") return { insert: parentsInsertMock };
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

describe("inviteParent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "admin1" } } });
    profileSingleMock.mockResolvedValue({ data: { role: "admin" } });
    serverRpcMock.mockResolvedValue({
      data: [{ invite_id: "invite1", raw_token: "rawtoken123" }],
      error: null,
    });
    sendInviteEmailMock.mockResolvedValue(undefined);
  });

  it("account_invites에 초대를 생성하고 메일을 보낸 뒤 invite_id를 반환한다(계정은 아직 만들지 않음)", async () => {
    const { inviteParent } = await import("./users-actions");
    const inviteId = await inviteParent({ name: "김민지", email: "minji@example.com" });

    expect(inviteId).toBe("invite1");
    expect(serverRpcMock).toHaveBeenCalledWith("create_account_invite", {
      p_email: "minji@example.com",
      p_name: "김민지",
      p_role: "parent",
      p_household_id: null,
    });
    expect(sendInviteEmailMock).toHaveBeenCalledWith({
      to: "minji@example.com",
      name: "김민지",
      token: "rawtoken123",
      role: "parent",
    });
    expect(inviteUserByEmailMock).not.toHaveBeenCalled();
    expect(parentsInsertMock).not.toHaveBeenCalled();
  });
});

describe("inviteTeacher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "admin1" } } });
    profileSingleMock.mockResolvedValue({ data: { role: "admin" } });
  });

  // (2026-08-30 R2 Task 4) 개인 이메일 기반 선생님 초대는 Task 7(Workspace
  // 프로비저닝) 전까지 비활성화됐다 — 관리자 권한 확인은 통과시키되 항상
  // 명확한 오류로 막는다.
  it("관리자 권한을 확인한 뒤 항상 비활성화 오류를 던진다", async () => {
    const { inviteTeacher } = await import("./users-actions");

    await expect(
      inviteTeacher({
        name: "박서연",
        email: "seoyeon@example.com",
        school: "서울대학교",
        hourlyRateKrw: 30000,
      })
    ).rejects.toThrow(/비활성화되어 있습니다/);
    expect(getUserMock).toHaveBeenCalled();
  });

  it("관리자가 아니면 비활성화 오류보다 먼저 권한 오류를 던진다", async () => {
    profileSingleMock.mockResolvedValue({ data: { role: "teacher" } });
    const { inviteTeacher } = await import("./users-actions");

    await expect(
      inviteTeacher({
        name: "박서연",
        email: "seoyeon@example.com",
        school: "서울대학교",
        hourlyRateKrw: 30000,
      })
    ).rejects.toThrow(/관리자만 사용할 수 있습니다/);
  });
});

describe("inviteStudent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "admin1" } } });
    profileSingleMock.mockResolvedValue({ data: { role: "admin" } });
    profilesInsertMock.mockResolvedValue({ error: null });
    serverRpcMock.mockResolvedValue({
      data: [{ invite_id: "invite2", raw_token: "rawtoken456" }],
      error: null,
    });
    sendInviteEmailMock.mockResolvedValue(undefined);
  });

  // (2026-08-30 R2 Task 4) 계정·역할·household 연결은 초대 수락 시로 미뤄졌다 —
  // inviteStudent()는 이제 (1) 부모의 household를 찾거나 만들고 (2) 그
  // household_id로 account_invites를 만들어 메일을 보낼 뿐, students/
  // household_members(child) 행을 직접 만들지 않는다(finalize_account_invite가
  // 수락 시점에 만든다).
  it("부모가 이미 속한 household가 있으면 재사용하고 그 household_id로 초대를 생성한다", async () => {
    const householdMembersSelectMaybeSingleMock = vi
      .fn()
      .mockResolvedValue({ data: { household_id: "household1" } });
    const householdsInsertMock = vi.fn();

    vi.doMock("@/lib/supabase-admin", () => ({
      createAdminClient: () => ({
        from: (table: string) => {
          if (table === "households") return { insert: householdsInsertMock };
          if (table === "household_members") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({ limit: () => ({ maybeSingle: householdMembersSelectMaybeSingleMock }) }),
                }),
              }),
            };
          }
          if (table === "guardian_students") {
            throw new Error("guardian_students는 동결됐습니다 — 이 경로에서 쓰면 안 됨");
          }
          throw new Error(`unexpected table ${table}`);
        },
      }),
    }));
    vi.resetModules();
    const { inviteStudent } = await import("./users-actions");

    const inviteId = await inviteStudent({
      name: "지훈",
      email: "jihoon@example.com",
      parentId: "parent1",
      grade: "10학년",
    });

    expect(inviteId).toBe("invite2");
    expect(householdsInsertMock).not.toHaveBeenCalled();
    expect(serverRpcMock).toHaveBeenCalledWith("create_account_invite", {
      p_email: "jihoon@example.com",
      p_name: "지훈",
      p_role: "student",
      p_household_id: "household1",
      p_grade: "10학년",
    });
    expect(sendInviteEmailMock).toHaveBeenCalledWith({
      to: "jihoon@example.com",
      name: "지훈",
      token: "rawtoken456",
      role: "student",
    });
  });

  it("부모에게 household가 없으면 새로 만들고 그 부모를 주 보호자로 지정한 뒤 그 household_id로 초대를 생성한다", async () => {
    const householdMembersSelectMaybeSingleMock = vi.fn().mockResolvedValue({ data: null });
    const householdsInsertSingleMock = vi.fn().mockResolvedValue({ data: { id: "household2" }, error: null });
    const householdsInsertMock = vi.fn(() => ({ select: () => ({ single: householdsInsertSingleMock }) }));
    const householdMembersInsertMock = vi.fn().mockResolvedValue({ error: null });

    vi.doMock("@/lib/supabase-admin", () => ({
      createAdminClient: () => ({
        from: (table: string) => {
          if (table === "households") return { insert: householdsInsertMock };
          if (table === "household_members") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({ limit: () => ({ maybeSingle: householdMembersSelectMaybeSingleMock }) }),
                }),
              }),
              insert: householdMembersInsertMock,
            };
          }
          throw new Error(`unexpected table ${table}`);
        },
      }),
    }));
    vi.resetModules();
    const { inviteStudent } = await import("./users-actions");

    await inviteStudent({
      name: "이서아",
      email: "seoah@example.com",
      parentId: "parent2",
      grade: "11학년",
    });

    expect(householdsInsertMock).toHaveBeenCalledWith({ primary_guardian_id: "parent2" });
    expect(householdMembersInsertMock).toHaveBeenCalledWith({
      household_id: "household2",
      profile_id: "parent2",
      role: "guardian",
      is_primary: true,
    });
    expect(serverRpcMock).toHaveBeenCalledWith("create_account_invite", {
      p_email: "seoah@example.com",
      p_name: "이서아",
      p_role: "student",
      p_household_id: "household2",
      p_grade: "11학년",
    });
  });
});

describe("setTeacherHourlyRate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "admin1" } } });
    profileSingleMock.mockResolvedValue({ data: { role: "admin" } });
  });

  it("set_teacher_rate RPC를 호출하고 teachers 테이블을 직접 update하지 않는다", async () => {
    const rpcMock = vi.fn().mockResolvedValue({ error: null });
    const teachersUpdateMock = vi.fn();
    vi.doMock("@/lib/supabase-admin", () => ({
      createAdminClient: () => ({
        from: (table: string) => {
          if (table === "teachers") return { update: teachersUpdateMock };
          throw new Error(`unexpected table ${table}`);
        },
        rpc: rpcMock,
      }),
    }));
    vi.resetModules();
    const { setTeacherHourlyRate } = await import("./users-actions");

    await setTeacherHourlyRate("teacher1", 45000);

    expect(rpcMock).toHaveBeenCalledWith("set_teacher_rate", {
      p_teacher_id: "teacher1",
      p_amount_minor: 45000,
      p_currency: "KRW",
    });
    expect(teachersUpdateMock).not.toHaveBeenCalled();
  });

  it("0 이하의 시급은 RPC 호출 전에 거부한다", async () => {
    const rpcMock = vi.fn();
    vi.doMock("@/lib/supabase-admin", () => ({
      createAdminClient: () => ({ rpc: rpcMock }),
    }));
    vi.resetModules();
    const { setTeacherHourlyRate } = await import("./users-actions");

    await expect(setTeacherHourlyRate("teacher1", 0)).rejects.toThrow(/1원 이상/);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("setParentStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "admin1" } } });
    profileSingleMock.mockResolvedValue({ data: { role: "admin" } });
  });

  it("transition_account_status RPC로 상태를 전환한다", async () => {
    const rpcMock = vi.fn().mockResolvedValue({ error: null });
    vi.doMock("@/utils/supabase/server", () => ({
      createClient: async () => ({
        auth: { getUser: getUserMock },
        from: (table: string) => {
          if (table === "profiles") {
            return { select: () => ({ eq: () => ({ single: profileSingleMock }) }) };
          }
          throw new Error(`unexpected table ${table}`);
        },
        rpc: rpcMock,
      }),
    }));
    vi.resetModules();
    const { setParentStatus } = await import("./users-actions");

    await setParentStatus("parent1", "suspended");

    expect(rpcMock).toHaveBeenCalledWith("transition_account_status", {
      p_profile_id: "parent1",
      p_new_status: "suspended",
      p_reason: null,
    });
  });
});

describe("setTeacherStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "admin1" } } });
    profileSingleMock.mockResolvedValue({ data: { role: "admin" } });
  });

  it("active 전환 시 유효한 시급 이력이 있으면 정상 진행한다", async () => {
    const serverRpcMock = vi.fn().mockResolvedValue({ error: null });
    const adminRpcMock = vi.fn().mockResolvedValue({ data: true, error: null });
    vi.doMock("@/utils/supabase/server", () => ({
      createClient: async () => ({
        auth: { getUser: getUserMock },
        from: (table: string) => {
          if (table === "profiles") {
            return { select: () => ({ eq: () => ({ single: profileSingleMock }) }) };
          }
          throw new Error(`unexpected table ${table}`);
        },
        rpc: serverRpcMock,
      }),
    }));
    vi.doMock("@/lib/supabase-admin", () => ({
      createAdminClient: () => ({ rpc: adminRpcMock }),
    }));
    vi.resetModules();
    const { setTeacherStatus } = await import("./users-actions");

    await setTeacherStatus("teacher1", "active");

    expect(adminRpcMock).toHaveBeenCalledWith("has_valid_current_teacher_rate", {
      p_teacher_id: "teacher1",
    });
    expect(serverRpcMock).toHaveBeenCalledWith("transition_account_status", {
      p_profile_id: "teacher1",
      p_new_status: "active",
      p_reason: null,
    });
  });

  it("active 전환 시 유효한 시급 이력이 없으면 친화적 오류를 던지고 update하지 않는다", async () => {
    const teachersUpdateEqMock = vi.fn();
    const rpcMock = vi.fn().mockResolvedValue({ data: false, error: null });
    vi.doMock("@/utils/supabase/server", () => ({
      createClient: async () => ({
        auth: { getUser: getUserMock },
        from: (table: string) => {
          if (table === "profiles") {
            return { select: () => ({ eq: () => ({ single: profileSingleMock }) }) };
          }
          if (table === "teachers") {
            return { update: () => ({ eq: teachersUpdateEqMock }) };
          }
          throw new Error(`unexpected table ${table}`);
        },
      }),
    }));
    vi.doMock("@/lib/supabase-admin", () => ({
      createAdminClient: () => ({ rpc: rpcMock }),
    }));
    vi.resetModules();
    const { setTeacherStatus } = await import("./users-actions");

    await expect(setTeacherStatus("teacher1", "active")).rejects.toThrow(/시급이 설정되지 않아/);
    expect(teachersUpdateEqMock).not.toHaveBeenCalled();
  });

  it("pending 전환 시에는 시급 이력을 확인하지 않는다", async () => {
    const serverRpcMock = vi.fn().mockResolvedValue({ error: null });
    const adminRpcMock = vi.fn();
    vi.doMock("@/utils/supabase/server", () => ({
      createClient: async () => ({
        auth: { getUser: getUserMock },
        from: (table: string) => {
          if (table === "profiles") {
            return { select: () => ({ eq: () => ({ single: profileSingleMock }) }) };
          }
          throw new Error(`unexpected table ${table}`);
        },
        rpc: serverRpcMock,
      }),
    }));
    vi.doMock("@/lib/supabase-admin", () => ({
      createAdminClient: () => ({ rpc: adminRpcMock }),
    }));
    vi.resetModules();
    const { setTeacherStatus } = await import("./users-actions");

    await setTeacherStatus("teacher1", "pending");

    expect(adminRpcMock).not.toHaveBeenCalled();
    expect(serverRpcMock).toHaveBeenCalledWith("transition_account_status", {
      p_profile_id: "teacher1",
      p_new_status: "pending",
      p_reason: null,
    });
  });
});
