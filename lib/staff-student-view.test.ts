import { describe, expect, it } from "vitest";
import { assertCanViewStudent, assertCanWriteStudentTask, statsTierFor, StudentViewDeniedError } from "./staff-student-view";

function client(profile: Record<string, unknown> | null, rpcs: Record<string, boolean> = {}) {
  return {
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: profile }) }) }) }),
    rpc: async (name: string) => ({ data: rpcs[name] ?? false }),
  } as never;
}

describe("assertCanViewStudent — 역할 × 대상 학생 매트릭스", () => {
  it("관리자(master/full)는 전체 허용, 읽기 전용", async () => {
    const a = await assertCanViewStudent(client({ role: "admin", admin_tier: "full" }), "u", "s");
    expect(a).toMatchObject({ role: "admin", actions: [], audit: true });
    expect(a.tabs).toEqual(["overview", "board", "stats"]);
  });
  it("supervisor는 학생관리 capability가 있어야 한다", async () => {
    await expect(assertCanViewStudent(client({ role: "admin", admin_tier: "supervisor" }), "u", "s")).rejects.toBeInstanceOf(StudentViewDeniedError);
    await expect(
      assertCanViewStudent(client({ role: "admin", admin_tier: "supervisor" }, { current_user_has_capability: true }), "u", "s")
    ).resolves.toMatchObject({ role: "admin" });
  });
  it("담당 컨설턴트만 허용(추가·이동·삭제), 타 컨설턴트 거절", async () => {
    const a = await assertCanViewStudent(client({ role: "consultant" }, { is_assigned_consultant_of: true }), "u", "s");
    expect(a.actions).toEqual(["create", "move", "delete"]);
    expect(a.tabs).toContain("stats");
    await expect(assertCanViewStudent(client({ role: "consultant" }), "u", "s")).rejects.toThrow("students assigned to you");
  });
  it("선생님은 활성 배정 학생만(추가만, 통계 없음, 열람 기록), 종료·타 학생은 거절", async () => {
    const a = await assertCanViewStudent(client({ role: "teacher" }, { teaches_student: true }), "u", "s");
    expect(a).toMatchObject({ role: "teacher", actions: ["create"], audit: true });
    expect(a.tabs).toEqual(["overview", "board"]);
    await expect(assertCanViewStudent(client({ role: "teacher" }), "u", "s")).rejects.toThrow("students you currently teach");
  });
  it("학부모는 본인 자녀만(읽기 전용, 통계는 학생 본인과 동일 범위, 열람 기록 없음), 타 가족 거절", async () => {
    const a = await assertCanViewStudent(client({ role: "parent" }, { is_guardian_of: true }), "u", "s");
    expect(a).toMatchObject({ role: "parent", actions: [], audit: false });
    expect(a.tabs).toEqual(["overview", "board", "stats"]);
    await expect(assertCanViewStudent(client({ role: "parent" }), "u", "s")).rejects.toThrow("your own child");
  });
  it("학생(본인 포함)·프로필 없음은 거절", async () => {
    await expect(assertCanViewStudent(client({ role: "student" }, { teaches_student: true, is_guardian_of: true }), "u", "s")).rejects.toThrow("don't have permission");
    await expect(assertCanViewStudent(client(null), "u", "s")).rejects.toThrow("don't have permission");
    await expect(assertCanViewStudent(client({ role: "admin", admin_tier: "full" }), "u", "")).rejects.toThrow("select a student");
  });
});

describe("assertCanWriteStudentTask — 읽기 전용 강제", () => {
  it("관리자·학부모는 어떤 쓰기도 거절", async () => {
    for (const action of ["create", "move", "delete"] as const) {
      await expect(assertCanWriteStudentTask(client({ role: "admin", admin_tier: "full" }), "u", "s", action)).rejects.toThrow("can't make changes");
      await expect(assertCanWriteStudentTask(client({ role: "parent" }, { is_guardian_of: true }), "u", "s", action)).rejects.toThrow("can't make changes");
    }
  });
  it("선생님은 추가만, 이동·삭제는 거절", async () => {
    const c = client({ role: "teacher" }, { teaches_student: true });
    await expect(assertCanWriteStudentTask(c, "u", "s", "create")).resolves.toBeDefined();
    await expect(assertCanWriteStudentTask(c, "u", "s", "move")).rejects.toThrow("can't make changes");
    await expect(assertCanWriteStudentTask(c, "u", "s", "delete")).rejects.toThrow("can't make changes");
  });
  it("컨설턴트는 담당 학생에 한해 추가·이동·삭제 허용, 타 학생은 열람 단계에서 거절", async () => {
    const ok = client({ role: "consultant" }, { is_assigned_consultant_of: true });
    for (const action of ["create", "move", "delete"] as const) await expect(assertCanWriteStudentTask(ok, "u", "s", action)).resolves.toBeDefined();
    await expect(assertCanWriteStudentTask(client({ role: "consultant" }), "u", "s", "create")).rejects.toThrow("students assigned to you");
  });
  it("종료된 배정의 선생님은 추가도 거절", async () => {
    await expect(assertCanWriteStudentTask(client({ role: "teacher" }), "u", "s", "create")).rejects.toThrow("students you currently teach");
  });
});

describe("통계 노출 등급(statsTierFor) — 학생 본인 = 학부모", () => {
  it("학부모는 family(학생 본인과 동일), 컨설턴트 staff, 관리자 admin", () => {
    expect(statsTierFor("parent")).toBe("family");
    expect(statsTierFor("consultant")).toBe("staff");
    expect(statsTierFor("admin")).toBe("admin");
  });
});
