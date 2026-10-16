"use server";

import { requireUser } from "@/lib/auth";
import { loadMockExamOverview, type MockExamOverview } from "@/lib/mock-exam/attempt-data";

/** 학부모 홈 "모의고사" 서브탭 — 공개 세트 목록 + 자녀 응시(RPC 가 본인 자녀만 허용). */
export async function loadChildMockExamOverviewAction(studentId: string): Promise<MockExamOverview> {
  const { supabase } = await requireUser();
  return loadMockExamOverview(supabase, studentId);
}
