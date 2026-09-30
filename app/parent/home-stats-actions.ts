"use server";

// 학부모 홈 "통계" 서브탭 — 본인 자녀의 통계를 학생 본인 화면과 같은 범위(family 등급)로 보여준다.
// 권한은 assertCanViewStudent(is_guardian_of)가 판정하고, 채점 컬럼 권한이 회수돼 있어 정의자 집계 RPC를
// 서비스 클라이언트로 읽는다(쓰기 없음). 열람 기록은 남기지 않는다(학부모 정책). 만족도·선생님 평가성
// 지표·모의고사 경로·난이도는 이 경로에서 계산되지도 않는다.

import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { assertCanViewStudent, statsTierFor } from "@/lib/staff-student-view";
import { loadStudentStats, type StatsData } from "@/app/student/stats-data";

export async function getParentChildStats(studentId: string): Promise<StatsData> {
  const { supabase, user, profile } = await requireUser();
  if (profile?.role !== "parent") throw new Error("보호자만 접근할 수 있습니다.");
  const access = await assertCanViewStudent(supabase, user.id, studentId);
  if (access.role !== "parent") throw new Error("보호자만 접근할 수 있습니다.");
  return loadStudentStats(createAdminClient(), studentId, statsTierFor(access.role));
}
