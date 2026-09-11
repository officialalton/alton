import type { SupabaseClient } from "@supabase/supabase-js";
import { loadArchivedHouseholdIds } from "./users-data";

export type MatchingTeacherCandidate = {
  id: string;
  name: string;
};

// 2026-09-10(P1 — 관리자 "매칭" 탭 최초 진입 15초 개선) — 매칭 탭(MatchingTab.tsx)은
// students 중 id·name·grade·parentNames·status만 쓰고, 안에서 함께 렌더되는
// SubjectEnrollmentPanel.tsx는 id·name만 쓴다(둘 다 email·수강 과목·수업권·
// AP·비교과 등은 전혀 안 씀 — 사용자 탭용 loadStudents()의 무거운 상세는
// 매칭에 불필요). page.tsx가 매칭 탭에서 loadStudents() 전체를 재사용하던
// 것을 이 전용 경량 로더로 바꾼다 — 가구/보호자 조인만 하고 수강 과목·이메일·
// AP·비교과 조회는 하지 않는다.
export type MatchingStudentItem = {
  id: string;
  name: string;
  grade: string | null;
  status: string;
  parentNames: string[];
};

function extractOne<T>(rel: unknown): T | null {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as T | undefined) ?? null;
}

function extractName(rel: unknown): string {
  return (extractOne<{ name?: string }>(rel))?.name ?? "";
}

export async function loadStudentsForMatching(supabase: SupabaseClient): Promise<MatchingStudentItem[]> {
  const { data: students } = await supabase
    .from("students")
    .select("id, grade, status, profile:profiles(name)")
    .order("joined_at", { ascending: false });
  if (!students || students.length === 0) return [];

  const studentIds = students.map((s) => s.id);
  const { data: childLinks } = await supabase
    .from("household_members")
    .select("profile_id, household_id")
    .eq("role", "child")
    .in("profile_id", studentIds);

  const householdIdByStudent = new Map<string, string>();
  for (const l of childLinks ?? []) householdIdByStudent.set(l.profile_id, l.household_id);

  const householdIds = Array.from(new Set(Array.from(householdIdByStudent.values())));
  const { data: guardianLinks } = await supabase
    .from("household_members")
    .select("household_id, guardian:profiles(name)")
    .eq("role", "guardian")
    .in("household_id", householdIds.length > 0 ? householdIds : [""]);

  const guardianNamesByHousehold = new Map<string, string[]>();
  for (const l of guardianLinks ?? []) {
    const list = guardianNamesByHousehold.get(l.household_id) ?? [];
    list.push(extractName(l.guardian));
    guardianNamesByHousehold.set(l.household_id, list);
  }

  // P4-1(B) — 아카이브된 가구의 자녀는 매칭 대기 목록에서도 제외한다.
  const archivedHouseholdIds = await loadArchivedHouseholdIds(supabase);

  return students
    .filter((s) => {
      const householdId = householdIdByStudent.get(s.id);
      return !householdId || !archivedHouseholdIds.has(householdId);
    })
    .map((s) => {
    const householdId = householdIdByStudent.get(s.id);
    return {
      id: s.id,
      name: extractName(s.profile),
      grade: s.grade,
      status: s.status,
      parentNames: householdId ? guardianNamesByHousehold.get(householdId) ?? [] : [],
    };
  });
}

export async function loadTeacherCandidatesBySubject(
  supabase: SupabaseClient
): Promise<Record<string, MatchingTeacherCandidate[]>> {
  const { data: links } = await supabase
    .from("teacher_curriculum_templates")
    .select("id, subject_id, teacher:teachers(id, status, profile:profiles(name))");
  if (!links || links.length === 0) return {};

  // C-1(2026-09-10) — 단원이 0개인 빈 운영본은 후보에서 제외한다. 서버측
  // confirm_student_teacher_subject_match()도 동일하게 "단원 1개 이상"을
  // 요구하므로, 여기서 걸러두지 않으면 UI에서 고를 수 있는데 실제 배정
  // 시점에는 거부되는 불일치가 생긴다.
  const templateIds = links.map((l) => l.id as string);
  const { data: unitRows } = await supabase
    .from("teacher_curriculum_template_units")
    .select("template_id")
    .in("template_id", templateIds);
  const templateIdsWithUnits = new Set((unitRows ?? []).map((u) => u.template_id as string));

  const bySubject: Record<string, MatchingTeacherCandidate[]> = {};
  for (const l of links as {
    id: string;
    subject_id: string;
    teacher: unknown;
  }[]) {
    if (!templateIdsWithUnits.has(l.id)) continue;
    const teacher = extractOne<{
      id: string;
      status: string;
      profile: unknown;
    }>(l.teacher);
    if (!teacher || teacher.status !== "active") continue;
    const profile = extractOne<{ name?: string }>(teacher.profile);

    const list = bySubject[l.subject_id] ?? [];
    if (!list.some((c) => c.id === teacher.id)) {
      list.push({ id: teacher.id, name: profile?.name ?? "" });
    }
    bySubject[l.subject_id] = list;
  }
  return bySubject;
}
