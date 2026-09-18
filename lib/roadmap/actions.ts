"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { loadRoadmapData } from "./data";
import type {
  RoadmapData,
  TestType,
  TestRecordKind,
  PrepItemType,
  PrepStatus,
  MilestoneStatus,
} from "./types";

// 학부모 홈 "통계" 서브탭(home-stats-actions.ts)과 같은 지연 로딩 패턴 —
// 자녀 전환 시에만 그 자녀의 로드맵을 불러온다(전체 자녀분을 한 번에 불러오지
// 않음). RLS(_roadmap_can_read)가 접근 범위를 최종 결정한다.
export async function getRoadmapForStudent(studentId: string): Promise<RoadmapData> {
  const supabase = await requireLoggedIn();
  return loadRoadmapData(supabase, studentId);
}

// P9 로드맵 V1 서버 액션 — 학생/학부모/관리자 화면이 공유한다. studentId를
// 명시적으로 받는 이유: 학부모·관리자는 본인이 아닌 학생 데이터를 쓴다.
// 소유권 검증은 여기서 하지 않는다 — _roadmap_can_write(student_id) RLS가
// 학생 본인/보호자/관리자가 아니면 insert/update/delete를 전부 막는다
// (교사가 이 액션을 호출해도 RLS가 거부, 화면에서도 노출하지 않음).
// revalidatePath는 studentId 무관하게 4개 진입 경로 전부를 갱신한다.
function revalidateRoadmapPaths(studentId: string) {
  revalidatePath("/student");
  revalidatePath("/parent");
  revalidatePath(`/teacher/student/${studentId}/roadmap`);
  revalidatePath(`/admin/students/${studentId}/roadmap`);
}

async function requireLoggedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");
  return supabase;
}

export async function saveAcademicProfile(input: {
  studentId: string;
  graduationYear: number | null;
  curriculumType: string | null;
  currentSubjects: string[];
}) {
  const supabase = await requireLoggedIn();
  const { error } = await supabase.from("student_academic_profile").upsert({
    student_id: input.studentId,
    graduation_year: input.graduationYear,
    curriculum_type: input.curriculumType,
    current_subjects: input.currentSubjects,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  revalidateRoadmapPaths(input.studentId);
}

export async function addTestRecord(input: {
  studentId: string;
  testType: TestType;
  recordKind: TestRecordKind;
  testDate: string | null;
  score: number | null;
  notes: string | null;
}) {
  if (input.score !== null && (input.score < 0 || input.score > 1600)) {
    throw new Error("점수는 0~1600 사이여야 합니다.");
  }
  const supabase = await requireLoggedIn();
  const { error } = await supabase.from("student_test_records").insert({
    student_id: input.studentId,
    test_type: input.testType,
    record_kind: input.recordKind,
    test_date: input.testDate,
    score: input.score,
    notes: input.notes,
  });
  if (error) throw new Error(error.message);
  revalidateRoadmapPaths(input.studentId);
}

export async function removeTestRecord(studentId: string, id: string) {
  const supabase = await requireLoggedIn();
  const { error } = await supabase.from("student_test_records").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateRoadmapPaths(studentId);
}

export async function saveCollegeInterests(input: {
  studentId: string;
  intendedMajors: string[];
  careerInterests: string[];
  targetCountries: string[];
  targetCollegeTypes: string[];
  targetColleges: string[];
  targetApplicationTiming: string | null;
}) {
  const supabase = await requireLoggedIn();
  const { error } = await supabase.from("student_college_interests").upsert({
    student_id: input.studentId,
    intended_majors: input.intendedMajors,
    career_interests: input.careerInterests,
    target_countries: input.targetCountries,
    target_college_types: input.targetCollegeTypes,
    target_colleges: input.targetColleges,
    target_application_timing: input.targetApplicationTiming,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  revalidateRoadmapPaths(input.studentId);
}

export async function addActivity(input: {
  studentId: string;
  activityName: string;
  description: string | null;
  field: string | null;
  role: string | null;
  startDate: string | null;
  endDate: string | null;
  isOngoing: boolean;
  totalHours: number | null;
  leadershipSummary: string | null;
  achievementSummary: string | null;
}) {
  const supabase = await requireLoggedIn();
  const { error } = await supabase.from("student_extracurricular_activities").insert({
    student_id: input.studentId,
    activity_name: input.activityName,
    description: input.description,
    field: input.field,
    role: input.role,
    start_date: input.startDate,
    end_date: input.endDate,
    is_ongoing: input.isOngoing,
    total_hours: input.totalHours,
    leadership_summary: input.leadershipSummary,
    achievement_summary: input.achievementSummary,
  });
  if (error) throw new Error(error.message);
  revalidateRoadmapPaths(input.studentId);
}

export async function removeActivity(studentId: string, id: string) {
  const supabase = await requireLoggedIn();
  const { error } = await supabase
    .from("student_extracurricular_activities")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateRoadmapPaths(studentId);
}

export async function addAward(input: {
  studentId: string;
  awardName: string;
  awardLevel: string | null;
  awardedDate: string | null;
  relatedActivityId: string | null;
  notes: string | null;
}) {
  const supabase = await requireLoggedIn();
  const { error } = await supabase.from("student_awards").insert({
    student_id: input.studentId,
    award_name: input.awardName,
    award_level: input.awardLevel,
    awarded_date: input.awardedDate,
    related_activity_id: input.relatedActivityId,
    notes: input.notes,
  });
  if (error) throw new Error(error.message);
  revalidateRoadmapPaths(input.studentId);
}

export async function removeAward(studentId: string, id: string) {
  const supabase = await requireLoggedIn();
  const { error } = await supabase.from("student_awards").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateRoadmapPaths(studentId);
}

export async function savePrepItem(input: {
  studentId: string;
  id: string | null;
  itemType: PrepItemType;
  customLabel: string | null;
  status: PrepStatus;
  notes: string | null;
}) {
  if (input.itemType === "other" && !input.customLabel?.trim()) {
    throw new Error("기타 항목은 이름을 입력해야 합니다.");
  }
  const supabase = await requireLoggedIn();
  const { error } = await supabase.from("student_prep_items").upsert({
    id: input.id ?? undefined,
    student_id: input.studentId,
    item_type: input.itemType,
    custom_label: input.customLabel,
    status: input.status,
    notes: input.notes,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  revalidateRoadmapPaths(input.studentId);
}

export async function removePrepItem(studentId: string, id: string) {
  const supabase = await requireLoggedIn();
  const { error } = await supabase.from("student_prep_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateRoadmapPaths(studentId);
}

export async function saveMilestone(input: {
  studentId: string;
  id: string | null;
  title: string;
  description: string | null;
  targetPeriod: string | null;
  targetDate: string | null;
  status: MilestoneStatus;
  notes: string | null;
  relatedLinks: string[];
}) {
  if (!input.title.trim()) throw new Error("마일스톤 제목은 필수입니다.");
  const supabase = await requireLoggedIn();
  if (input.id) {
    const { error } = await supabase
      .from("student_roadmap_milestones")
      .update({
        title: input.title.trim(),
        description: input.description,
        target_period: input.targetPeriod,
        target_date: input.targetDate,
        status: input.status,
        notes: input.notes,
        related_links: input.relatedLinks,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id);
    if (error) throw new Error(error.message);
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("student_roadmap_milestones").insert({
      student_id: input.studentId,
      title: input.title.trim(),
      description: input.description,
      target_period: input.targetPeriod,
      target_date: input.targetDate,
      status: input.status,
      notes: input.notes,
      related_links: input.relatedLinks,
      created_by: user!.id,
    });
    if (error) throw new Error(error.message);
  }
  revalidateRoadmapPaths(input.studentId);
}

export async function removeMilestone(studentId: string, id: string) {
  const supabase = await requireLoggedIn();
  const { error } = await supabase.from("student_roadmap_milestones").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateRoadmapPaths(studentId);
}
