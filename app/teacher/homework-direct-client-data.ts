"use server";

import { requireUser } from "@/lib/auth";
import { loadStudentSubjectKeywords, loadHomeworkDraftBatches, type HomeworkKeywordOption, type HomeworkDraftBatch } from "./homework-direct-data";

/** 학생 하나를 고른 뒤에만 그 학생의 키워드·최근 배치를 불러온다(교사 포털 과제 탭). */
export async function loadStudentHomeworkPanelAction(studentId: string): Promise<{ keywords: HomeworkKeywordOption[]; batches: HomeworkDraftBatch[] }> {
  const { supabase } = await requireUser();
  const [keywords, batches] = await Promise.all([
    loadStudentSubjectKeywords(supabase, studentId),
    loadHomeworkDraftBatches(supabase, studentId),
  ]);
  return { keywords, batches };
}
