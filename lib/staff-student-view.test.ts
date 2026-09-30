import { describe, expect, it } from "vitest";
import { assertCanViewStudent } from "./staff-student-view";

function client(profile: Record<string, unknown> | null, rpcs: Record<string, boolean> = {}) {
  return {
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: profile }) }) }) }),
    rpc: async (name: string) => ({ data: rpcs[name] ?? false }),
  } as never;
}

describe("assertCanViewStudent", () => {
  it("관리자(master/full)는 허용", async () => {
    await expect(assertCanViewStudent(client({ role: "admin", admin_tier: "full" }), "u", "s")).resolves.toBeUndefined();
  });
  it("supervisor는 학생관리 capability가 있어야 한다", async () => {
    await expect(assertCanViewStudent(client({ role: "admin", admin_tier: "supervisor" }), "u", "s")).rejects.toThrow();
    await expect(
      assertCanViewStudent(client({ role: "admin", admin_tier: "supervisor" }, { current_user_has_capability: true }), "u", "s")
    ).resolves.toBeUndefined();
  });
  it("담당 컨설턴트만 허용, 타 컨설턴트 거절", async () => {
    await expect(assertCanViewStudent(client({ role: "consultant" }, { is_assigned_consultant_of: true }), "u", "s")).resolves.toBeUndefined();
    await expect(assertCanViewStudent(client({ role: "consultant" }), "u", "s")).rejects.toThrow("담당 학생만");
  });
  it("학부모·학생·선생님은 거절", async () => {
    for (const role of ["parent", "student", "teacher"]) {
      await expect(assertCanViewStudent(client({ role }), "u", "s")).rejects.toThrow("권한이 없습니다");
    }
  });
});
