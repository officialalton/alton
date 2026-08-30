import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn().mockResolvedValue({ data: { user: { id: "admin1" } } });
const profileSingleMock = vi.fn().mockResolvedValue({ data: { role: "admin" } });
const inviteUserByEmailMock = vi.fn();
const parentsInsertMock = vi.fn().mockResolvedValue({ error: null });
const profilesInsertMock = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => {
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ single: profileSingleMock }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
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
    inviteUserByEmailMock.mockResolvedValue({ data: { user: { id: "parent1" } }, error: null });
    parentsInsertMock.mockResolvedValue({ error: null });
    profilesInsertMock.mockResolvedValue({ error: null });
  });

  it("생성된 parentId를 반환한다", async () => {
    const { inviteParent } = await import("./users-actions");
    const parentId = await inviteParent({ name: "김민지", email: "minji@example.com" });
    expect(parentId).toBe("parent1");
    expect(parentsInsertMock).toHaveBeenCalledWith({ id: "parent1" });
  });
});

describe("inviteTeacher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "admin1" } } });
    profileSingleMock.mockResolvedValue({ data: { role: "admin" } });
    inviteUserByEmailMock.mockResolvedValue({ data: { user: { id: "teacher1" } }, error: null });
    profilesInsertMock.mockResolvedValue({ error: null });
  });

  it("teachers를 status=pending으로 만들고 set_teacher_rate RPC로 최초 시급 이력을 생성한다", async () => {
    const teachersInsertMock = vi.fn().mockResolvedValue({ error: null });
    const rpcMock = vi.fn().mockResolvedValue({ error: null });
    vi.doMock("@/lib/supabase-admin", () => ({
      createAdminClient: () => ({
        auth: { admin: { inviteUserByEmail: inviteUserByEmailMock } },
        from: (table: string) => {
          if (table === "profiles") return { insert: profilesInsertMock };
          if (table === "teachers") return { insert: teachersInsertMock };
          throw new Error(`unexpected table ${table}`);
        },
        rpc: rpcMock,
      }),
    }));
    vi.resetModules();
    const { inviteTeacher } = await import("./users-actions");

    const teacherId = await inviteTeacher({
      name: "박서연",
      email: "seoyeon@example.com",
      school: "서울대학교",
      hourlyRateKrw: 30000,
    });

    expect(teacherId).toBe("teacher1");
    expect(teachersInsertMock).toHaveBeenCalledWith({
      id: "teacher1",
      school: "서울대학교",
      status: "pending",
    });
    expect(rpcMock).toHaveBeenCalledWith("set_teacher_rate", {
      p_teacher_id: "teacher1",
      p_amount_minor: 30000,
      p_currency: "KRW",
    });
  });

  it("set_teacher_rate RPC가 실패하면 원인을 알리는 오류를 던진다", async () => {
    const teachersInsertMock = vi.fn().mockResolvedValue({ error: null });
    const rpcMock = vi.fn().mockResolvedValue({ error: { message: "권한 없음" } });
    vi.doMock("@/lib/supabase-admin", () => ({
      createAdminClient: () => ({
        auth: { admin: { inviteUserByEmail: inviteUserByEmailMock } },
        from: (table: string) => {
          if (table === "profiles") return { insert: profilesInsertMock };
          if (table === "teachers") return { insert: teachersInsertMock };
          throw new Error(`unexpected table ${table}`);
        },
        rpc: rpcMock,
      }),
    }));
    vi.resetModules();
    const { inviteTeacher } = await import("./users-actions");

    await expect(
      inviteTeacher({
        name: "박서연",
        email: "seoyeon@example.com",
        school: "서울대학교",
        hourlyRateKrw: 30000,
      })
    ).rejects.toThrow(/시급 이력 생성에 실패/);
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
