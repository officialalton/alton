"use server";

import { requireUser } from "@/lib/auth";
import {
  loadStudentMockExamAttempts,
  loadMockExamAttemptDetail,
  type MockExamAttemptSummary,
  type MockExamAttemptDetail,
} from "@/lib/mock-exam/attempt-data";

/** 학생 포털 "Mock Exams" 탭 — 본인 응시 목록(탭 전환 시 클라이언트에서 호출). */
export async function loadMyMockExamAttemptsAction(): Promise<MockExamAttemptSummary[]> {
  const { user, supabase } = await requireUser();
  return loadStudentMockExamAttempts(supabase, user.id);
}

/** 2026-09-21(UAT 지적) — 채점 완료된 결과는 별도 페이지로 나가지 않고 탭(왼쪽 네비게이션 유지)
 * 안에서 그대로 봐야 한다. 응시 중인 시험(집중이 필요한 실제 시험 화면)만 독립 라우트로 남긴다. */
export async function loadMockExamAttemptDetailAction(attemptId: string): Promise<MockExamAttemptDetail | null> {
  const { supabase } = await requireUser();
  return loadMockExamAttemptDetail(supabase, attemptId);
}
