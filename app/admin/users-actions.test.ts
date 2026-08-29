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

  it("hourlyRateKrw를 teachers.hourly_rate_krw로 저장하고 teacherId를 반환한다", async () => {
    const teachersInsertMock = vi.fn().mockResolvedValue({ error: null });
    vi.doMock("@/lib/supabase-admin", () => ({
      createAdminClient: () => ({
        auth: { admin: { inviteUserByEmail: inviteUserByEmailMock } },
        from: (table: string) => {
          if (table === "profiles") return { insert: profilesInsertMock };
          if (table === "teachers") return { insert: teachersInsertMock };
          throw new Error(`unexpected table ${table}`);
        },
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
      hourly_rate_krw: 30000,
    });
  });
});
