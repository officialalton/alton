"use server";

// 관리자·담당 컨설턴트용 학생 오버뷰/보드/통계 "읽기 전용" 로더. 학생 본인 로더
// (app/student/board-actions.ts 등)는 건드리지 않고, 대상 학생 ID를 받아 서버에서
// 권한을 검사한 뒤 같은 데이터 함수를 재사용한다. 쓰기 액션은 이 파일에 없다.
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { assertCanViewStudent } from "@/lib/staff-student-view";
import { loadStudentHomeworkBatches } from "@/lib/homework-batch-data";
import { loadStudentMockExamAttempts } from "@/lib/mock-exam/attempt-data";
import { loadVocabQuizzes } from "@/app/student/vocab-library-data";
import { loadStats, type StatsData } from "@/app/student/stats-data";
import {
  loadBoardManualTasks,
  homeworkToBoardCard,
  mockExamToBoardCard,
  vocabQuizToBoardCard,
  manualTaskToBoardCard,
} from "@/lib/board/data";
import type { BoardCard } from "@/lib/board/types";

export async function loadStaffViewBoardCardsAction(studentId: string): Promise<BoardCard[]> {
  const { supabase, user } = await requireUser();
  await assertCanViewStudent(supabase, user.id, studentId);
  // 4개 조회를 병렬로 — 오버뷰·보드가 이 결과를 공유한다(화면당 1회).
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

export async function loadStaffViewStatsAction(studentId: string): Promise<StatsData> {
  const { supabase, user } = await requireUser();
  await assertCanViewStudent(supabase, user.id, studentId);
  // 권한 검사를 통과한 뒤의 읽기 전용 집계 — 수업·피드백 테이블의 RLS가 컨설턴트를
  // 열어주지 않으므로 서비스 클라이언트로 읽는다(쓰기 없음).
  return loadStats(createAdminClient(), studentId);
}

export type StaffViewKind = "overview" | "board" | "stats";

// 열람 감사 기록 — DB RPC가 권한을 다시 검사하고 같은 조합은 10분 안에 1건으로 묶는다.
export async function recordStaffStudentViewAction(studentId: string, view: StaffViewKind): Promise<void> {
  const { supabase, user } = await requireUser();
  await assertCanViewStudent(supabase, user.id, studentId);
  const { error } = await supabase.rpc("record_staff_student_view", { p_student_id: studentId, p_view_kind: view });
  if (error) throw new Error(error.message);
}
