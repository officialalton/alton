import { beforeEach, describe, expect, it, vi } from "vitest";

type Role = "admin" | "consultant" | "teacher" | "parent";
const state = vi.hoisted(() => ({ role: "teacher" as string, rpcs: {} as Record<string, boolean>, taskStudent: "s1" as string | null }));
const data = vi.hoisted(() => ({
  homework: vi.fn(async () => [] as unknown[]),
  create: vi.fn(async () => ({ id: "t" })),
  update: vi.fn(async () => undefined),
  remove: vi.fn(async () => undefined),
}));

vi.mock("@/lib/auth", () => ({
  requireUser: async () => ({
    user: { id: "u1" },
    supabase: {
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: { role: state.role, admin_tier: "full" } }),
            maybeSingle: async () => ({ data: table === "board_manual_tasks" && state.taskStudent ? { student_id: state.taskStudent } : null }),
          }),
        }),
      }),
      rpc: async (name: string) => ({ data: state.rpcs[name] ?? false, error: null }),
    },
  }),
}));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/homework-batch-data", () => ({ loadStudentHomeworkBatches: data.homework }));
vi.mock("@/lib/mock-exam/attempt-data", () => ({ loadStudentMockExamAttempts: async () => [] }));
vi.mock("@/app/student/vocab-library-data", () => ({ loadVocabQuizzes: async () => [] }));
const statsCall = vi.hoisted(() => vi.fn());
vi.mock("@/app/student/stats-data", () => ({ loadStudentStats: async (...a: unknown[]) => { statsCall(...a); return { attendanceRate: null, bySubject: [] }; } }));
vi.mock("@/lib/board/data", () => ({
  loadBoardManualTasks: async () => [],
  createBoardManualTask: data.create,
  updateBoardManualTaskStatus: data.update,
  deleteBoardManualTask: data.remove,
  homeworkToBoardCard: (x: unknown) => x,
  mockExamsToBoardCards: (xs: unknown[]) => xs,
  vocabQuizToBoardCard: (x: unknown) => x,
  manualTaskToBoardCard: (x: unknown) => x,
}));

import {
  loadStaffViewBoardCardsAction,
  loadStaffViewStatsAction,
  createStudentViewTaskAction,
  updateStudentViewTaskStatusAction,
  deleteStudentViewTaskAction,
} from "./staff-student-view-actions";

function as(role: Role, rpcs: Record<string, boolean> = {}) {
  state.role = role;
  state.rpcs = rpcs;
}

describe("학생 열람 공통 서버 액션", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.taskStudent = "s1";
  });

  it("담당 선생님: 카드와 access(추가만)를 돌려준다", async () => {
    as("teacher", { teaches_student: true });
    data.homework.mockResolvedValueOnce([{ id: "h1" }]);
    const r = await loadStaffViewBoardCardsAction("s1");
    expect(r).toMatchObject({ ok: true, cards: [{ id: "h1" }], access: { role: "teacher", actions: ["create"] } });
  });

  it("권한 거부는 throw 대신 ok:false(종료 배정 선생님·타 가족 학부모·타 컨설턴트)", async () => {
    for (const role of ["teacher", "parent", "consultant"] as const) {
      as(role);
      const r = await loadStaffViewBoardCardsAction("s1");
      expect(r.ok).toBe(false);
    }
    expect(data.homework).not.toHaveBeenCalled();
  });

  it("그 밖의 오류는 삼키지 않고 throw", async () => {
    as("consultant", { is_assigned_consultant_of: true });
    data.homework.mockRejectedValueOnce(new Error("db exploded"));
    await expect(loadStaffViewBoardCardsAction("s1")).rejects.toThrow("db exploded");
  });

  it("통계는 관리자·컨설턴트·학부모(본인 자녀) — 선생님은 거절, 등급은 역할로 서버가 정한다", async () => {
    as("admin");
    await expect(loadStaffViewStatsAction("s1")).resolves.toBeDefined();
    expect(statsCall).toHaveBeenLastCalledWith(expect.anything(), "s1", "admin");
    as("consultant", { is_assigned_consultant_of: true });
    await expect(loadStaffViewStatsAction("s1")).resolves.toBeDefined();
    expect(statsCall).toHaveBeenLastCalledWith(expect.anything(), "s1", "staff");
    as("parent", { is_guardian_of: true });
    await expect(loadStaffViewStatsAction("s1")).resolves.toBeDefined();
    expect(statsCall).toHaveBeenLastCalledWith(expect.anything(), "s1", "family");
    as("teacher", { teaches_student: true });
    await expect(loadStaffViewStatsAction("s1")).rejects.toThrow("통계");
    as("parent");
    await expect(loadStaffViewStatsAction("s1")).rejects.toThrow("your own child");
    as("consultant");
    await expect(loadStaffViewStatsAction("s1")).rejects.toThrow("students assigned to you");
  });

  it("할 일 추가: 선생님·컨설턴트 허용, 관리자·학부모 거절, 빈 제목 거절", async () => {
    as("teacher", { teaches_student: true });
    await createStudentViewTaskAction("s1", " 과제 정리 ");
    expect(data.create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ studentId: "s1", title: "과제 정리", createdByRole: "teacher" }));
    as("consultant", { is_assigned_consultant_of: true });
    await createStudentViewTaskAction("s1", "x");
    expect(data.create).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ createdByRole: "consultant" }));
    await expect(createStudentViewTaskAction("s1", "  ")).rejects.toThrow("제목");
    data.create.mockClear();
    as("admin");
    await expect(createStudentViewTaskAction("s1", "x")).rejects.toThrow("can't make changes");
    as("parent", { is_guardian_of: true });
    await expect(createStudentViewTaskAction("s1", "x")).rejects.toThrow("can't make changes");
    as("teacher");
    await expect(createStudentViewTaskAction("s1", "x")).rejects.toThrow("students you currently teach");
    expect(data.create).not.toHaveBeenCalled();
  });

  it("이동·삭제: 컨설턴트만(담당 학생), 선생님·학부모·관리자·타 컨설턴트 거절, 없는 할 일 거절", async () => {
    as("consultant", { is_assigned_consultant_of: true });
    await updateStudentViewTaskStatusAction("t1", "done");
    await deleteStudentViewTaskAction("t1");
    expect(data.update).toHaveBeenCalledTimes(1);
    expect(data.remove).toHaveBeenCalledTimes(1);
    data.update.mockClear();
    data.remove.mockClear();
    for (const [role, rpcs] of [["teacher", { teaches_student: true }], ["parent", { is_guardian_of: true }], ["admin", {}], ["consultant", {}]] as const) {
      as(role, rpcs);
      await expect(updateStudentViewTaskStatusAction("t1", "done")).rejects.toThrow();
      await expect(deleteStudentViewTaskAction("t1")).rejects.toThrow();
    }
    expect(data.update).not.toHaveBeenCalled();
    expect(data.remove).not.toHaveBeenCalled();
    as("consultant", { is_assigned_consultant_of: true });
    state.taskStudent = null;
    await expect(deleteStudentViewTaskAction("nope")).rejects.toThrow("찾을 수 없습니다");
  });
});
