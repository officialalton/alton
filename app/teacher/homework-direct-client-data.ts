"use server";

import { requireUser } from "@/lib/auth";
import {
  loadStudentSubjectKeywords, loadTeacherSessionsForStudent, loadTeacherHomeworkSets,
  type HomeworkKeywordOption, type TeacherSessionOption, type StudentHomeworkSet,
} from "./homework-direct-data";

/** 학생 하나를 고른 뒤에만 그 학생의 키워드·발급 가능한 수업을 불러온다(교사 포털 "과제 생성"). */
export async function loadStudentHomeworkCreatePanelAction(studentId: string): Promise<{ keywords: HomeworkKeywordOption[]; sessions: TeacherSessionOption[] }> {
  const { user, supabase } = await requireUser();
  const [keywords, sessions] = await Promise.all([
    loadStudentSubjectKeywords(supabase, studentId),
    loadTeacherSessionsForStudent(supabase, user.id, studentId),
  ]);
  return { keywords, sessions };
}

/** "과제 내역" — 이 학생에게 이 교사가 낸 회차별 과제 묶음. */
export async function loadStudentHomeworkHistoryAction(studentId: string): Promise<StudentHomeworkSet[]> {
  const { supabase } = await requireUser();
  return loadTeacherHomeworkSets(supabase, studentId);
}
