import type { SupabaseClient } from "@supabase/supabase-js";

// M4 — 보호자 홈 배너용: 체험 리뷰가 확정됐는데(final) 아직 "정규 진행 희망"
// 선택을 안 한 과목 목록. app/parent/TrialConversionPanel.tsx(수강 과목 탭에
// 묻혀 있던 실제 액션)와 같은 조건을 홈 화면에서 미리 보여주기 위한 것 — 실제
// 선택 액션은 여전히 그 패널에서만 한다(여기서는 조회만).

export type PendingRegularIntentChoice = {
  subjectEnrollmentId: string;
  childName: string;
  subjectName: string;
};

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}

export async function loadPendingRegularIntentChoices(
  supabase: SupabaseClient,
  guardianId: string
): Promise<PendingRegularIntentChoice[]> {
  const { data: guardianLinks } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("profile_id", guardianId)
    .eq("role", "guardian");
  const householdIds = (guardianLinks ?? []).map((l) => l.household_id);
  if (householdIds.length === 0) return [];

  const { data: childLinks } = await supabase
    .from("household_members")
    .select("profile_id, profile:profiles(name)")
    .in("household_id", householdIds)
    .eq("role", "child");
  const childNameById = new Map(
    (childLinks ?? []).map((c) => [c.profile_id as string, extractName(c.profile)])
  );
  const childIds = Array.from(childNameById.keys());
  if (childIds.length === 0) return [];

  const { data: enrollments } = await supabase
    .from("subject_enrollments")
    .select("id, child_id, subject:subjects(name)")
    .in("child_id", childIds);
  if (!enrollments || enrollments.length === 0) return [];
  const enrollmentIds = enrollments.map((e) => e.id);

  const { data: finalReviews } = await supabase
    .from("trial_lesson_reviews")
    .select("subject_enrollment_id")
    .in("subject_enrollment_id", enrollmentIds)
    .eq("status", "final");
  const reviewedIds = new Set((finalReviews ?? []).map((r) => r.subject_enrollment_id as string));
  if (reviewedIds.size === 0) return [];

  const { data: selections } = await supabase
    .from("trial_regular_progress_selections")
    .select("subject_enrollment_id")
    .in("subject_enrollment_id", enrollmentIds);
  const selectedIds = new Set((selections ?? []).map((s) => s.subject_enrollment_id as string));

  return enrollments
    .filter((e) => reviewedIds.has(e.id) && !selectedIds.has(e.id))
    .map((e) => ({
      subjectEnrollmentId: e.id,
      childName: childNameById.get(e.child_id) ?? "",
      subjectName: extractName(e.subject),
    }));
}
