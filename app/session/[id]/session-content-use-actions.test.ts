import { beforeEach, describe, expect, it, vi } from "vitest";

// R9(레슨 준비 Task 3) — session-content-use-actions.ts의 mocked 단위 테스트.
// RLS/복합 FK 검증은 session-content-use-events.integration.test.ts(실제 DB)가
// 담당한다. 여기서는 이 액션이 (1) content_type을 정확히 고정해 넘기고, (2)
// recorded_by를 클라이언트가 아니라 requireUser()의 user.id로 고정하며, (3) DB
// 에러를 그대로 throw하는지만 mocked 클라이언트로 검증한다.

const { insertMock, fromMock } = vi.hoisted(() => {
  const insertMock = vi.fn();
  const fromMock = vi.fn(() => ({ insert: insertMock }));
  return { insertMock, fromMock };
});

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn().mockResolvedValue({
    supabase: { from: fromMock },
    user: { id: "teacher1" },
    profile: { role: "teacher", name: "선생님" },
  }),
}));

describe("session-content-use-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertMock.mockResolvedValue({ error: null });
  });

  describe("markMaterialUsedInLesson", () => {
    it("content_type='material_section'으로, 현재 사용자를 recorded_by로 고정해 기록한다", async () => {
      const { markMaterialUsedInLesson } = await import("./session-content-use-actions");
      await markMaterialUsedInLesson("session1", "section1");

      expect(fromMock).toHaveBeenCalledWith("session_content_use_events");
      expect(insertMock).toHaveBeenCalledWith({
        session_id: "session1",
        content_type: "material_section",
        content_id: "section1",
        recorded_by: "teacher1",
      });
    });
  });

  describe("markProblemUsedInLesson", () => {
    it("content_type='problem'으로, 현재 사용자를 recorded_by로 고정해 기록한다", async () => {
      const { markProblemUsedInLesson } = await import("./session-content-use-actions");
      await markProblemUsedInLesson("session1", "problem1");

      expect(insertMock).toHaveBeenCalledWith({
        session_id: "session1",
        content_type: "problem",
        content_id: "problem1",
        recorded_by: "teacher1",
      });
    });
  });

  it("DB 에러(예: 매니페스트에 없는 콘텐츠 — FK 위반)는 그대로 throw한다", async () => {
    insertMock.mockResolvedValue({ error: { message: "foreign key violation" } });
    const { markProblemUsedInLesson } = await import("./session-content-use-actions");
    await expect(markProblemUsedInLesson("session1", "not-in-manifest")).rejects.toThrow(
      "foreign key violation"
    );
  });
});
