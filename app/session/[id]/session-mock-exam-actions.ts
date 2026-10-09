"use server";

// 고정형 SAT 모의고사 V1 — 세션뷰 "모의고사" 탭(2026-09-21 UAT 지적: "단어장 스펙처럼
// 그대로 수업 세션뷰에서 진입하게"). 학생·교사 모두 이 탭에서 바로 목록·응시·결과를
// 본다(별도 라우트로 나가지 않음). 권한은 mock_exam_attempt_summaries/detail RPC의
// _mock_exam_can_view(본인/담당 교사/관리자/보호자)가 이미 처리하므로, 여기서는
// requireUser()의 세션 클라이언트로 그대로 호출한다.

import { requireUser } from "@/lib/auth";
import {
  loadStudentMockExamAttempts,
  loadMockExamAttemptDetail,
  type MockExamAttemptSummary,
  type MockExamAttemptDetail,
} from "@/lib/mock-exam/attempt-data";

export async function loadSessionMockExamAttemptsAction(studentId: string): Promise<MockExamAttemptSummary[]> {
  const { supabase } = await requireUser();
  return loadStudentMockExamAttempts(supabase, studentId);
}

export async function loadSessionMockExamAttemptDetailAction(attemptId: string): Promise<MockExamAttemptDetail | null> {
  const { supabase } = await requireUser();
  return loadMockExamAttemptDetail(supabase, attemptId);
}
