import { describe, expect, it, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
const updateUserByIdMock = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: getUserMock } }),
}));
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ auth: { admin: { updateUserById: updateUserByIdMock } } }),
}));

import { confirmOwnEmailAfterPasswordSet } from "./actions";

describe("confirmOwnEmailAfterPasswordSet", () => {
  beforeEach(() => vi.clearAllMocks());

  it("현재 세션 사용자 본인의 email_confirm만 올린다(스푸핑 방지 — 파라미터로 다른 사용자 id를 받지 않음)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "student-1" } } });

    await confirmOwnEmailAfterPasswordSet();

    expect(updateUserByIdMock).toHaveBeenCalledWith("student-1", { email_confirm: true });
  });

  it("세션이 없으면 아무 것도 하지 않는다", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    await confirmOwnEmailAfterPasswordSet();

    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });
});
