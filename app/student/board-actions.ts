"use server";

import { requireUser } from "@/lib/auth";
import { loadStudentHomeworkBatches } from "@/lib/homework-batch-data";
import { loadStudentMockExamAttempts } from "@/lib/mock-exam/attempt-data";
import { loadVocabQuizzes } from "./vocab-library-data";
import {
  loadBoardManualTasks,
  createBoardManualTask,
  updateBoardManualTaskStatus,
  deleteBoardManualTask,
  homeworkToBoardCard,
  mockExamToBoardCard,
  vocabQuizToBoardCard,
  manualTaskToBoardCard,
} from "@/lib/board/data";
import type { BoardCard, BoardCardStatus } from "@/lib/board/types";

// Student Success Planner — Board MVP(2026-09-21 승인). 학생 본인 보드를 읽고,
// 수동 할 일을 만들고/상태를 바꾸고/지운다. 과제·모의고사·단어시험 카드는 읽기
// 전용(그 화면 자체에서 진행 상태가 바뀐다 — 여기서 직접 상태를 바꾸지 않는다).
export async function loadMyBoardCardsAction(): Promise<BoardCard[]> {
  const { supabase, user } = await requireUser();
  const [homework, mockExams, vocabQuizzes, manualTasks] = await Promise.all([
    loadStudentHomeworkBatches(supabase, user.id),
    loadStudentMockExamAttempts(supabase, user.id),
    loadVocabQuizzes(supabase, user.id),
    loadBoardManualTasks(supabase, user.id),
  ]);
  return [
    ...homework.map(homeworkToBoardCard),
    ...mockExams.map(mockExamToBoardCard),
    ...vocabQuizzes.map(vocabQuizToBoardCard),
    ...manualTasks.map(manualTaskToBoardCard),
  ];
}

export async function createMyManualTaskAction(title: string, dueAt?: string | null): Promise<BoardCard> {
  const { supabase, user } = await requireUser();
  const trimmed = title.trim();
  if (!trimmed) throw new Error("할 일 제목을 입력하세요.");
  const task = await createBoardManualTask(supabase, {
    studentId: user.id,
    title: trimmed,
    createdBy: user.id,
    createdByRole: "student",
    dueAt: dueAt ?? null,
  });
  return manualTaskToBoardCard(task);
}

export async function updateMyManualTaskStatusAction(taskId: string, status: BoardCardStatus): Promise<void> {
  const { supabase } = await requireUser();
  await updateBoardManualTaskStatus(supabase, taskId, status);
}

export async function deleteMyManualTaskAction(taskId: string): Promise<void> {
  const { supabase } = await requireUser();
  await deleteBoardManualTask(supabase, taskId);
}
