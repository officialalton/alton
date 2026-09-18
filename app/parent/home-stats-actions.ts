"use server";

// 2026-09-18 — 학부모 홈 "통계" 서브탭 데이터 레이어. 학생 포털의
// stats-data.ts(loadStats)를 그대로 재사용한다 — 보호자 접근은 기존
// household guardian RLS(is_guardian_of/is_household_guardian_of)가 그대로
// 적용된다(다른 보호자 읽기 전용 화면과 동일 패턴).

import { requireUser } from "@/lib/auth";
import { loadStats, type StatsData } from "@/app/student/stats-data";

export async function getParentChildStats(studentId: string): Promise<StatsData> {
  const { supabase, profile } = await requireUser();
  if (profile?.role !== "parent") throw new Error("보호자만 접근할 수 있습니다.");
  return loadStats(supabase, studentId);
}
