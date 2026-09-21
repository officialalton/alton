"use server";

import { requireUser } from "@/lib/auth";
import { loadStudentMockExamAttempts, type MockExamAttemptSummary } from "@/lib/mock-exam/attempt-data";

/** 학생 포털 "Mock Exams" 탭 — 본인 응시 목록(탭 전환 시 클라이언트에서 호출). */
export async function loadMyMockExamAttemptsAction(): Promise<MockExamAttemptSummary[]> {
  const { user, supabase } = await requireUser();
  return loadStudentMockExamAttempts(supabase, user.id);
}
