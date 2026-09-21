"use server";

import { requireUser } from "@/lib/auth";
import { loadTeacherMockExamStudents, type TeacherMockExamStudent } from "./mock-exam-assign-data";
import {
  loadPublishedMockExamSetsForAssignment,
  loadTeacherMockExamAttemptsForStudent,
  type MockExamAttemptSummary,
} from "@/lib/mock-exam/attempt-data";

export type TeacherMockExamTabData = {
  students: TeacherMockExamStudent[];
  examSets: { id: string; name: string; difficultyTier: string }[];
  attemptsByStudent: Record<string, MockExamAttemptSummary[]>;
};

/** 교사 포털 "Mock Exams" 탭 — 담당 학생·공개 세트·학생별 배정 현황(탭 전환/변경 후 클라이언트에서 호출). */
export async function loadTeacherMockExamTabDataAction(): Promise<TeacherMockExamTabData> {
  const { user, supabase } = await requireUser();
  const [students, examSets] = await Promise.all([
    loadTeacherMockExamStudents(supabase, user.id),
    loadPublishedMockExamSetsForAssignment(supabase),
  ]);
  const attemptLists = await Promise.all(students.map((s) => loadTeacherMockExamAttemptsForStudent(supabase, s.studentId)));
  const attemptsByStudent: Record<string, MockExamAttemptSummary[]> = {};
  students.forEach((s, i) => {
    attemptsByStudent[s.studentId] = attemptLists[i];
  });
  return { students, examSets: examSets.map((s) => ({ id: s.id, name: s.name, difficultyTier: s.difficultyTier })), attemptsByStudent };
}
