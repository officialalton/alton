import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ role: "parent" as string, guardian: true }));
const loader = vi.hoisted(() => vi.fn(async () => ({ attendanceRate: null, bySubject: [] })));
vi.mock("@/lib/auth", () => ({
  requireUser: async () => ({
    user: { id: "p1" },
    profile: { role: state.role },
    supabase: {
      from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role: state.role, admin_tier: null } }) }) }) }),
      rpc: async (name: string) => ({ data: name === "is_guardian_of" ? state.guardian : false }),
    },
  }),
}));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/app/student/stats-data", () => ({ loadStudentStats: loader }));
import { getParentChildStats } from "./home-stats-actions";

beforeEach(() => { loader.mockClear(); state.role = "parent"; state.guardian = true; });
describe("getParentChildStats — 학부모 = 학생 본인과 같은 범위", () => {
  it("본인 자녀면 family 등급(학생 본인과 동일)으로 조회", async () => {
    await getParentChildStats("kid");
    expect(loader).toHaveBeenCalledWith(expect.anything(), "kid", "family");
  });
  it("자녀가 아니면 거절하고 조회하지 않는다", async () => {
    state.guardian = false;
    await expect(getParentChildStats("other")).rejects.toThrow("자녀만");
    expect(loader).not.toHaveBeenCalled();
  });
  it("학부모가 아닌 역할은 거절", async () => {
    for (const role of ["student", "teacher", "admin", "consultant"]) {
      state.role = role;
      await expect(getParentChildStats("kid")).rejects.toThrow();
    }
    expect(loader).not.toHaveBeenCalled();
  });
});
