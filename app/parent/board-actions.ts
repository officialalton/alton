"use server";

import { requireUser } from "@/lib/auth";
import { loadStudentHomeworkBatches } from "@/lib/homework-batch-data";
import { loadGuardianMockExamAttempts } from "@/lib/mock-exam/attempt-data";
import { loadVocabQuizzes } from "../student/vocab-library-data";
import {
  loadBoardManualTasks,
  homeworkToBoardCard,
  mockExamToBoardCard,
  vocabQuizToBoardCard,
  manualTaskToBoardCard,
} from "@/lib/board/data";
import type { BoardCard } from "@/lib/board/types";

// Student Success Planner — 학부모 홈 연동(2026-09-21 승인 계획, 2026-09-22
// 마무리). 부모는 읽기 전용이다 — 만들지도, 옮기지도, 지우지도 않는다(그래서
// 수동 할 일용 mutation 액션은 여기 없다). 각 원본 로더가 이미 담당 교사·보호자·
// 관리자 접근을 허용하므로(RLS), 추가 소유권 검증 없이 그대로 합친다.
export async function loadChildBoardCardsAction(studentId: string): Promise<BoardCard[]> {
  const { supabase } = await requireUser();
  const [homework, mockExams, vocabQuizzes, manualTasks] = await Promise.all([
    loadStudentHomeworkBatches(supabase, studentId),
    loadGuardianMockExamAttempts(supabase, studentId),
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
