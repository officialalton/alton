import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ role: "student" as string }));
const loader = vi.hoisted(() => vi.fn(async () => ({ attendanceRate: null, bySubject: [] })));
vi.mock("@/lib/auth", () => ({ requireUser: async () => ({ user: { id: "me" }, profile: { role: state.role }, supabase: {} }) }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("./stats-data", () => ({ loadStudentStats: loader }));
import { loadMyStatsAction } from "./stats-actions";

beforeEach(() => loader.mockClear());
describe("loadMyStatsAction", () => {
  it("학생 본인 id(세션)·family 등급으로만 조회한다", async () => {
    await loadMyStatsAction();
    expect(loader).toHaveBeenCalledWith(expect.anything(), "me", "family");
  });
  it("학생이 아니면 거절", async () => {
    for (const role of ["parent", "teacher", "admin", "consultant"]) {
      state.role = role;
      await expect(loadMyStatsAction()).rejects.toThrow("학생만");
    }
    expect(loader).not.toHaveBeenCalled();
    state.role = "student";
  });
});
