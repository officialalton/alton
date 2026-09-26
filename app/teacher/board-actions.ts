"use server";

import { requireUser } from "@/lib/auth";
import { loadStudentHomeworkBatches } from "@/lib/homework-batch-data";
import { loadTeacherMockExamAttemptsForStudent } from "@/lib/mock-exam/attempt-data";
import { loadVocabQuizzes } from "../student/vocab-library-data";
import {
  loadBoardManualTasks,
  homeworkToBoardCard,
  mockExamToBoardCard,
  vocabQuizToBoardCard,
  manualTaskToBoardCard,
} from "@/lib/board/data";
import type { BoardCard } from "@/lib/board/types";

// Student Success Planner — 선생님 학습 플래너 "보드" 탭 연동(2026-09-24).
// 학부모 board-actions.ts와 같은 패턴 — 선생님도 읽기 전용이다(만들지도,
// 옮기지도, 지우지도 않는다). 각 원본 로더가 이미 담당 교사 접근을 RLS/RPC
// 게이트(teaches_student() 등)로 허용하므로, 추가 소유권 검증 없이 그대로
// 합친다 — 담당이 아닌 학생을 넘기면 각 로더가 빈 배열을 돌려준다.
export async function loadStudentBoardCardsForTeacherAction(studentId: string): Promise<BoardCard[]> {
  const { supabase } = await requireUser();
  const [homework, mockExams, vocabQuizzes, manualTasks] = await Promise.all([
    loadStudentHomeworkBatches(supabase, studentId),
    loadTeacherMockExamAttemptsForStudent(supabase, studentId),
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
