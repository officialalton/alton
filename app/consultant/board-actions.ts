"use server";

import { requireUser } from "@/lib/auth";
import { loadStudentHomeworkBatches } from "@/lib/homework-batch-data";
import { loadStudentMockExamAttempts } from "@/lib/mock-exam/attempt-data";
import { loadVocabQuizzes } from "@/app/student/vocab-library-data";
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

// 컨설턴트 Round A(2026-09-22 사용자 지시) — 담당 학생의 보드를 읽고 수동
// 할 일을 관리한다. RLS(20261461000000)가 담당 컨설턴트(consultant_assignments)만
// 허용하므로 여기서 추가 권한 검사를 하지 않는다 — app/student/board-actions.ts와
// 동일한 패턴, 대상만 auth.uid() 대신 studentId 파라미터.
export async function loadStudentBoardCardsAction(studentId: string): Promise<BoardCard[]> {
  const { supabase } = await requireUser();
  const [homework, mockExams, vocabQuizzes, manualTasks] = await Promise.all([
    loadStudentHomeworkBatches(supabase, studentId),
    loadStudentMockExamAttempts(supabase, studentId),
    loadVocabQuizzes(supabase, studentId),
    loadBoardManualTasks(supabase, studentId),
  ]);
  return [
    ...homework.map(homeworkToBoardCard),
    ...mockExams.map(mockExamToBoardCard),
    ...vocabQuizzes.map(vocabQuizToBoardCard),
    ...manualTasks.map(manualTaskToBoardCard),
  ];
}

export async function createStudentManualTaskAction(
  studentId: string,
  title: string,
  dueAt?: string | null,
  dueStartAt?: string | null
): Promise<BoardCard> {
  const { supabase, user } = await requireUser();
  const trimmed = title.trim();
  if (!trimmed) throw new Error("할 일 제목을 입력하세요.");
  const task = await createBoardManualTask(supabase, {
    studentId,
    title: trimmed,
    createdBy: user.id,
    createdByRole: "consultant",
    dueAt: dueAt ?? null,
    dueStartAt: dueStartAt ?? null,
  });
  return manualTaskToBoardCard(task);
}

export async function updateStudentManualTaskStatusAction(taskId: string, status: BoardCardStatus): Promise<void> {
  const { supabase } = await requireUser();
  await updateBoardManualTaskStatus(supabase, taskId, status);
}

export async function deleteStudentManualTaskAction(taskId: string): Promise<void> {
  const { supabase } = await requireUser();
  await deleteBoardManualTask(supabase, taskId);
}
