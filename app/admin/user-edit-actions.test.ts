import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ supabase: {}, adminUserId: "admin1" }),
}));

const profileMaybeSingleMock = vi.fn();
const profileUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
const studentUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
const getUserByIdMock = vi.fn();
const updateUserByIdMock = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        getUserById: getUserByIdMock,
        updateUserById: updateUserByIdMock,
      },
    },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: profileMaybeSingleMock }) }),
          update: () => ({ eq: profileUpdateEqMock }),
        };
      }
      if (table === "students") {
        return { update: () => ({ eq: studentUpdateEqMock }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

describe("updateUserBasicInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileMaybeSingleMock.mockResolvedValue({ data: { id: "p1", role: "parent" }, error: null });
    getUserByIdMock.mockResolvedValue({ data: { user: { id: "p1", email: "old@example.com" } }, error: null });
    updateUserByIdMock.mockResolvedValue({ error: null });
    profileUpdateEqMock.mockResolvedValue({ error: null });
  });

  it("이메일이 바뀌면 auth.users와 profiles.name을 모두 갱신하고 admin_edited_by/at을 남긴다", async () => {
    const { updateUserBasicInfo } = await import("./user-edit-actions");
    const result = await updateUserBasicInfo({
      profileId: "p1",
      role: "parent",
      name: "새이름",
      email: "new@example.com",
    });

    expect(result).toEqual({ name: "새이름", email: "new@example.com", grade: undefined });
    expect(updateUserByIdMock).toHaveBeenCalledWith("p1", { email: "new@example.com" });
    expect(profileUpdateEqMock).toHaveBeenCalledWith("id", "p1");
  });

  it("이메일이 그대로면 auth.users는 건드리지 않는다", async () => {
    const { updateUserBasicInfo } = await import("./user-edit-actions");
    await updateUserBasicInfo({
      profileId: "p1",
      role: "parent",
      name: "이름만변경",
      email: "old@example.com",
    });

    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it("이메일 형식이 잘못되면 거부한다(auth.users를 건드리기 전에)", async () => {
    const { updateUserBasicInfo } = await import("./user-edit-actions");
    await expect(
      updateUserBasicInfo({ profileId: "p1", role: "parent", name: "이름", email: "not-an-email" })
    ).rejects.toThrow(/이메일 형식이 올바르지 않습니다/);
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it("학생 role이면 grade가 주어질 때 students.grade도 갱신한다", async () => {
    profileMaybeSingleMock.mockResolvedValue({ data: { id: "s1", role: "student" }, error: null });
    getUserByIdMock.mockResolvedValue({ data: { user: { id: "s1", email: "kid@example.com" } }, error: null });
    const { updateUserBasicInfo } = await import("./user-edit-actions");
    const result = await updateUserBasicInfo({
      profileId: "s1",
      role: "student",
      name: "학생이름",
      email: "kid@example.com",
      grade: "11학년",
    });

    expect(studentUpdateEqMock).toHaveBeenCalledWith("id", "s1");
    expect(result.grade).toBe("11학년");
  });

  it("역할이 일치하지 않으면 거부한다", async () => {
    profileMaybeSingleMock.mockResolvedValue({ data: { id: "p1", role: "student" }, error: null });
    const { updateUserBasicInfo } = await import("./user-edit-actions");
    await expect(
      updateUserBasicInfo({ profileId: "p1", role: "parent", name: "이름", email: "old@example.com" })
    ).rejects.toThrow(/역할이 일치하지 않습니다/);
  });
});
