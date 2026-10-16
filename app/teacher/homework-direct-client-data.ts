"use server";

import { requireUser } from "@/lib/auth";
import { loadStudentSubjectKeywords, type HomeworkKeywordOption } from "./homework-direct-data";
import { loadTeacherHomeworkBatchesForStudent } from "@/lib/homework-batch-data";
import type { HomeworkBatch } from "@/lib/homework-batch-data";

/** 학생 하나를 고른 뒤에만 그 학생의 키워드를 불러온다(교사 포털 "과제 생성"). */
export async function loadStudentHomeworkCreatePanelAction(studentId: string): Promise<{ keywords: HomeworkKeywordOption[] }> {
  const { supabase } = await requireUser();
  const keywords = await loadStudentSubjectKeywords(supabase, studentId);
  return { keywords };
}

/** "과제 내역" — 이 교사가 이 학생에게 낸 배치만(다른 교사가 낸 것은 RLS가 안 보여준다). */
export async function loadStudentHomeworkBatchesAction(studentId: string): Promise<HomeworkBatch[]> {
  const { user, supabase } = await requireUser();
  return loadTeacherHomeworkBatchesForStudent(supabase, user.id, studentId);
}
