"use server";

import { requireStudentFeature } from "@/lib/feature-access";
import {
  loadMockExamOverview,
  type MockExamOverview,
  loadMockExamAttemptDetail,
  type MockExamAttemptDetail,
} from "@/lib/mock-exam/attempt-data";

/** 학생 포털 "Practice Tests" 탭 — 공개 세트 목록 + 본인 응시(탭 전환 시 클라이언트에서 호출). */
export async function loadMyMockExamOverviewAction(): Promise<MockExamOverview> {
  const { user, supabase } = await requireStudentFeature("mock_exam");
  return loadMockExamOverview(supabase, user.id);
}

/** 2026-09-21(UAT 지적) — 채점 완료된 결과는 별도 페이지로 나가지 않고 탭(왼쪽 네비게이션 유지)
 * 안에서 그대로 봐야 한다. 응시 중인 시험(집중이 필요한 실제 시험 화면)만 독립 라우트로 남긴다. */
export async function loadMockExamAttemptDetailAction(attemptId: string): Promise<MockExamAttemptDetail | null> {
  const { supabase } = await requireStudentFeature("mock_exam");
  return loadMockExamAttemptDetail(supabase, attemptId);
}
