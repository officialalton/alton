"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

const VALID_GPA_SCALES = new Set(["4.0", "4.3", "4.5", "5.0"]);

/**
 * 2026-09-05 무결성 보강: SAT/GPA↔척도 검증을 서버 액션에서도 먼저 수행한다
 * (DB CHECK 제약·complete_student_profile() 내부 검증이 최종 방어선이지만,
 * 여기서 먼저 걸러 왕복 없이 명확한 한국어 에러를 반환한다). 클라이언트
 * 검증(CompleteProfileForm)만으로 끝내지 않기 위한 서버 레이어.
 */
function assertGpaSatIntegrity(input: {
  satScore: number | null;
  gpa: number | null;
  gpaScale: string | null;
}) {
  if (input.satScore !== null && (input.satScore < 400 || input.satScore > 1600)) {
    throw new Error("SAT 점수는 400~1600 사이여야 합니다.");
  }
  if (input.gpa !== null && input.gpaScale === null) {
    throw new Error("GPA를 입력하려면 GPA 척도를 함께 선택해야 합니다.");
  }
  if (input.gpa === null && input.gpaScale !== null) {
    throw new Error("GPA 척도만 선택하고 GPA 값이 없는 상태는 허용되지 않습니다.");
  }
  if (input.gpaScale !== null && !VALID_GPA_SCALES.has(input.gpaScale)) {
    throw new Error("GPA 척도는 4.0/4.3/4.5/5.0 중 하나여야 합니다.");
  }
  if (input.gpa !== null && input.gpaScale !== null && input.gpa > Number(input.gpaScale)) {
    throw new Error(`GPA 값(${input.gpa})이 선택한 척도(${input.gpaScale})를 초과할 수 없습니다.`);
  }
}

/**
 * M4 UAT #2 프로필 완성 — 핵심 필드(생년월일/학교명/학년/SAT/GPA/목표 대학/
 * 관심 전공) 원자적 저장 + 완료 처리는 전부 complete_student_profile()
 * SECURITY DEFINER 함수가 담당한다(필수 항목 검증, 생년월일 최초 1회
 * 자가입력 허용 포함). 여기서는 SAT/GPA↔척도 정합성을 먼저 검증한 뒤 요청을
 * 그대로 전달하고 에러만 표면화한다.
 */
export async function submitCompleteProfile(input: {
  dateOfBirth: string | null;
  schoolName: string;
  grade: string;
  satScore: number | null;
  gpa: number | null;
  gpaScale: string | null;
  targetColleges: string[];
  intendedMajors: string[];
}) {
  assertGpaSatIntegrity(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_student_profile", {
    p_date_of_birth: input.dateOfBirth,
    p_school_name: input.schoolName,
    p_grade: input.grade,
    p_sat_score: input.satScore,
    p_gpa: input.gpa,
    p_target_colleges: input.targetColleges,
    p_intended_majors: input.intendedMajors,
    p_gpa_scale: input.gpaScale,
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
