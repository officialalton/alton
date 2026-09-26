"use server";

import { requireUser } from "@/lib/auth";
import { loadGuardianMockExamAttempts, type MockExamAttemptSummary } from "@/lib/mock-exam/attempt-data";

/** 학부모 홈 "모의고사" 서브탭 — 자녀 응시 목록(RPC 가 본인 자녀만 허용). */
export async function loadChildMockExamAttemptsAction(studentId: string): Promise<MockExamAttemptSummary[]> {
  const { supabase } = await requireUser();
  return loadGuardianMockExamAttempts(supabase, studentId);
}
