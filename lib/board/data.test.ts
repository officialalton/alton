import { describe, expect, it } from "vitest";
import { homeworkToBoardCard, mockExamToBoardCard, vocabQuizToBoardCard, manualTaskToBoardCard } from "./data";
import { boardColumnOf } from "./types";
import type { HomeworkBatch } from "../homework-batch-data";
import type { MockExamAttemptSummary } from "../mock-exam/attempt-data";
import type { VocabQuiz } from "@/app/student/vocab-library-data";

function homeworkBatch(overrides: Partial<HomeworkBatch> = {}): HomeworkBatch {
  return {
    id: "b1", teacherId: "t1", teacherName: "김선생", studentId: "s1",
    label: "9월 22일 과제", subjectId: null, subjectName: "SAT Math",
    createdAt: "2026-09-20T00:00:00Z", dueAt: null,
    items: [],
    ...overrides,
  };
}

describe("board card 상태 계산 — 소스별 status 매핑", () => {
  it("과제: 문항이 없으면 백로그", () => {
    const card = homeworkToBoardCard(homeworkBatch({ items: [] }));
    expect(card.status).toBe("backlog");
  });

  it("과제: 일부만 제출됐으면 진행중", () => {
    const card = homeworkToBoardCard(
      homeworkBatch({
        items: [
          { problemId: "p1", position: 1, format: "mc", passage: null, question: null, options: null, correctIndex: null, answers: null, explanation: null, statements: null, figure: null, response: "0", submittedAt: "2026-09-21T00:00:00Z", autoCorrect: null, graded: false, gradedAt: null, grade: null, gradeComment: null },
          { problemId: "p2", position: 2, format: "mc", passage: null, question: null, options: null, correctIndex: null, answers: null, explanation: null, statements: null, figure: null, response: null, submittedAt: null, autoCorrect: null, graded: false, gradedAt: null, grade: null, gradeComment: null },
        ],
      })
    );
    expect(card.status).toBe("in_progress");
  });

  it("과제: 전부 제출됐으면 완료", () => {
    const item = { problemId: "p1", position: 1, format: "mc" as const, passage: null, question: null, options: null, correctIndex: null, answers: null, explanation: null, statements: null, figure: null, response: "0", submittedAt: "2026-09-21T00:00:00Z", autoCorrect: null, graded: false, gradedAt: null, grade: null, gradeComment: null };
    const card = homeworkToBoardCard(homeworkBatch({ items: [item] }));
    expect(card.status).toBe("done");
  });

  it("모의고사: assigned→백로그, in_progress→진행중, submitted/graded→완료", () => {
    const base: MockExamAttemptSummary = {
      id: "a1", examSetId: "e1", examSetName: "Set 1", difficultyTier: "medium",
      studentId: "s1", studentName: null, status: "assigned", dueAt: null,
      startBy: null, startedAt: null, submittedAt: null, gradedAt: null,
      totalCount: 10, correctCount: null, entryCount: 0,
    };
    expect(mockExamToBoardCard(base).status).toBe("backlog");
    expect(mockExamToBoardCard({ ...base, status: "in_progress" }).status).toBe("in_progress");
    expect(mockExamToBoardCard({ ...base, status: "submitted" }).status).toBe("done");
    expect(mockExamToBoardCard({ ...base, status: "graded" }).status).toBe("done");
  });

  it("단어시험: pending→백로그, in_progress→진행중, completed→완료", () => {
    const base: VocabQuiz = {
      id: "q1", status: "pending", wordCount: 5, items: [], score: null, total: null,
      answers: null, source: { customWords: false, bookIds: [], folderIds: [] },
      createdAt: "2026-09-20T00:00:00Z", dueAt: null, sessionId: null, assignedByTeacher: false,
    };
    expect(vocabQuizToBoardCard(base).status).toBe("backlog");
    expect(vocabQuizToBoardCard({ ...base, status: "in_progress" }).status).toBe("in_progress");
    expect(vocabQuizToBoardCard({ ...base, status: "completed" }).status).toBe("done");
  });

  it("수동 할 일: 저장된 status를 그대로 쓴다", () => {
    const card = manualTaskToBoardCard({
      id: "m1", studentId: "s1", title: "SAT 신청서 작성", status: "in_progress",
      dueAt: null, createdBy: "s1", createdByRole: "student", createdAt: "2026-09-20T00:00:00Z",
    });
    expect(card.status).toBe("in_progress");
    expect(card.sourceType).toBe("manual");
  });
});

describe("boardColumnOf — 기한 경과 파생 칼럼", () => {
  it("완료 전 카드가 마감일이 지났으면 기한 경과로 분류된다", () => {
    const card = homeworkToBoardCard(homeworkBatch({ dueAt: "2026-09-01T00:00:00Z", items: [] }));
    expect(boardColumnOf(card, "2026-09-22T00:00:00Z")).toBe("overdue");
  });

  it("완료된 카드는 마감일이 지나도 기한 경과가 아니라 완료로 남는다", () => {
    const item = { problemId: "p1", position: 1, format: "mc" as const, passage: null, question: null, options: null, correctIndex: null, answers: null, explanation: null, statements: null, figure: null, response: "0", submittedAt: "2026-09-01T00:00:00Z", autoCorrect: null, graded: false, gradedAt: null, grade: null, gradeComment: null };
    const card = homeworkToBoardCard(homeworkBatch({ dueAt: "2026-09-01T00:00:00Z", items: [item] }));
    expect(boardColumnOf(card, "2026-09-22T00:00:00Z")).toBe("done");
  });

  it("마감일이 없거나 아직 지나지 않았으면 status 그대로다", () => {
    const card = homeworkToBoardCard(homeworkBatch({ dueAt: null, items: [] }));
    expect(boardColumnOf(card, "2026-09-22T00:00:00Z")).toBe("backlog");
  });
});
