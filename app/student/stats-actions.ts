"use server";

import { requireStudentFeature } from "@/lib/feature-access";
import { createAdminClient } from "@/lib/supabase-admin";
import { loadStudentStats, type StatsData } from "./stats-data";

// 학생 본인 통계(홈 > 통계). 본인 id 는 세션에서만 가져오고 인자로 받지 않는다. 등급은 family —
// 만족도·직원 전용 지표·모의고사 강약 없음(학부모가 보는 통계와 같은 범위). 채점 컬럼 권한이 회수돼 있어
// 정의자 집계 RPC(서비스 클라이언트)로 읽는다(쓰기 없음).
export async function loadMyStatsAction(): Promise<StatsData> {
  const { user, profile } = await requireStudentFeature("class");
  if (profile?.role !== "student") throw new Error("학생만 접근할 수 있습니다.");
  return loadStudentStats(createAdminClient(), user.id, "family");
}
