"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

/**
 * M4 UAT #2 프로필 완성 — 핵심 필드(생년월일/학교명/학년/SAT/GPA/목표 대학/
 * 관심 전공) 원자적 저장 + 완료 처리는 전부 complete_student_profile()
 * SECURITY DEFINER 함수가 담당한다(필수 항목 검증, 생년월일 최초 1회
 * 자가입력 허용 포함). 여기서는 요청을 그대로 전달하고 에러만 표면화한다.
 */
export async function submitCompleteProfile(input: {
  dateOfBirth: string | null;
  schoolName: string;
  grade: string;
  satScore: number;
  gpa: number | null;
  targetColleges: string[];
  intendedMajors: string[];
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_student_profile", {
    p_date_of_birth: input.dateOfBirth,
    p_school_name: input.schoolName,
    p_grade: input.grade,
    p_sat_score: input.satScore,
    p_gpa: input.gpa,
    p_target_colleges: input.targetColleges,
    p_intended_majors: input.intendedMajors,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/complete-profile");
}

/**
 * AP 이수 상황 — 구조화 리스트(student_ap_courses)에 한 행 추가. RLS가
 * student_id = auth.uid()만 허용하므로 본인 것만 추가 가능하다.
 */
export async function addApCourse(input: {
  courseName: string;
  status: "planned" | "taking" | "completed";
  examYear: number | null;
  score: number | null;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const { error } = await supabase.from("student_ap_courses").insert({
    student_id: user.id,
    course_name: input.courseName,
    status: input.status,
    exam_year: input.examYear,
    score: input.score,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/complete-profile");
}

export async function removeApCourse(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("student_ap_courses").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/complete-profile");
}

/**
 * 비교과 활동 — 구조화 리스트(student_extracurricular_activities)에 한 행 추가.
 */
export async function addExtracurricularActivity(input: {
  activityName: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  isOngoing: boolean;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const { error } = await supabase.from("student_extracurricular_activities").insert({
    student_id: user.id,
    activity_name: input.activityName,
    description: input.description,
    start_date: input.startDate,
    end_date: input.endDate,
    is_ongoing: input.isOngoing,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/complete-profile");
}

export async function removeExtracurricularActivity(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("student_extracurricular_activities").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/complete-profile");
}
