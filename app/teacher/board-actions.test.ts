import { beforeEach, describe, expect, it, vi } from "vitest";

const homeworkMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ requireUser: async () => ({ supabase: {} }) }));
vi.mock("@/lib/homework-batch-data", () => ({ loadStudentHomeworkBatches: homeworkMock }));
vi.mock("@/lib/mock-exam/attempt-data", () => ({ loadTeacherMockExamAttemptsForStudent: async () => [] }));
vi.mock("../student/vocab-library-data", () => ({ loadVocabQuizzes: async () => [] }));
vi.mock("@/lib/board/data", () => ({
  loadBoardManualTasks: async () => [],
  homeworkToBoardCard: (x: unknown) => x,
  mockExamToBoardCard: (x: unknown) => x,
  vocabQuizToBoardCard: (x: unknown) => x,
  manualTaskToBoardCard: (x: unknown) => x,
}));

import { loadStudentBoardCardsForTeacherAction } from "./board-actions";

describe("loadStudentBoardCardsForTeacherAction", () => {
  beforeEach(() => {
    homeworkMock.mockReset();
  });

  it("담당 학생: 카드를 ok 로 돌려준다", async () => {
    homeworkMock.mockResolvedValue([{ id: "h1" }]);
    expect(await loadStudentBoardCardsForTeacherAction("s1")).toEqual({ ok: true, cards: [{ id: "h1" }] });
  });

  it("권한 거부는 throw 대신 결과값(거부 자체는 RPC 가 그대로 수행)", async () => {
    homeworkMock.mockImplementation(async () => { throw new Error("이 학생의 과제를 볼 권한이 없습니다."); });
    expect(await loadStudentBoardCardsForTeacherAction("s1")).toEqual({ ok: false, error: "이 학생의 학습 보드를 볼 권한이 없습니다." });
  });

  it("그 밖의 오류는 삼키지 않고 throw", async () => {
    homeworkMock.mockImplementation(async () => { throw new Error("db exploded"); });
    await expect(loadStudentBoardCardsForTeacherAction("s1")).rejects.toThrow("db exploded");
  });
});
