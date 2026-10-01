"use server";

import { requireUser } from "@/lib/auth";
import { loadRoadmapData } from "@/lib/roadmap/data";
import type { RoadmapData } from "@/lib/roadmap/types";

// 2026-09-22(사용자 지시) — My Students의 "오버뷰/로드맵/일정" 버튼이 별도
// 페이지로 나가버려 좌측 네비게이션이 사라졌다. AssignmentsTab 안에서 그대로
// 보여줄 수 있게 로드맵 데이터만 서버 액션으로 뽑아낸다(원래
// /teacher/student/[studentId]/roadmap 페이지가 하던 것과 동일한 권한 검사 —
// RLS(_roadmap_can_read)가 담당 교사가 아니면 조회 자체를 막는다).
export async function loadTeacherStudentRoadmapAction(studentId: string): Promise<RoadmapData> {
  const { supabase, profile } = await requireUser();
  if (profile?.role !== "teacher" && profile?.role !== "admin") {
    throw new Error("접근 권한이 없습니다.");
  }
  return loadRoadmapData(supabase, studentId);
}
