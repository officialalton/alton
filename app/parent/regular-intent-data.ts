import type { SupabaseClient } from "@supabase/supabase-js";

// M4 — 보호자 홈 배너용: 체험 수업이 진행됐는데(단순 예약만 된 'scheduled' 상태
// 제외) 아직 "정규 진행 희망" 선택을 안 한 과목 목록.
//
// (2026-09-06 제품 오너 지적 후속) 예전에는 여기서 "체험 리뷰가 lesson_reviews.
// status='final'로 확정된 과목만" 대상으로 잡았는데, 제품 오너 지시로 그 요건을
// 없앴다 — "리뷰랑은 상관없이 그냥 떠야 한다". 리뷰 확정 여부는 여전히
// TrialConversionRow(app/parent/TrialConversionPanel.tsx)에서 실제 "정규 진행
// 희망" 버튼을 보여줄지/대기 안내를 보여줄지 판단할 때만 쓴다(그 액션 자체는
// confirm_regular_progress_intent RPC가 서버에서 확정 리뷰 존재를 다시 검증하므로
// 여기서 미리 걸러도 실익이 없다).
//
// 대신 "체험 세션이 진행 중이거나 끝난" 최소 기준은 유지한다(getProgressedTrial
// EnrollmentIds) — 체험을 막 시작해 예약만 잡힌 상태에서까지 배너가 뜨는 건
// 과도하다. 같은 기준을 app/parent/EnrollmentTab.tsx(수강 과목 탭)도 그대로
// 재사용해 "정규 진행 희망 선택이 필요한 과목" 판정을 두 화면에서 통일한다
// (예전엔 홈 배너만 lesson_type='trial' + 리뷰 final을 요구하고, 수강 과목 탭은
// 아예 다른 조건 — 리뷰 lesson_type 필터도 없이 아무 최종 리뷰나 fetch —을 써서
// 같은 과목이 탭엔 뜨는데 홈엔 안 뜨는 불일치가 있었다).

export type PendingRegularIntentChoice = {
  subjectEnrollmentId: string;
  childName: string;
  subjectName: string;
};

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}

function extractLessonTypeCode(rel: unknown): string | undefined {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { code?: string } | null)?.code;
}

/** 이 subject_enrollment 중 체험 세션이 진행 중이거나("live") 끝난("scheduled"/
 * "live"가 아닌 final_status) 것들의 subject_enrollment_id 집합. 리뷰 확정 여부와
 * 무관 — "정규 진행 희망을 물어봐도 되는 시점"의 최소 기준일 뿐이다. 홈 배너와
 * 수강 과목 탭이 공통으로 쓰는 기준 함수(이 파일이 유일한 출처).
 */
export async function getProgressedTrialEnrollmentIds(
  supabase: SupabaseClient,
  enrollmentIds: string[]
): Promise<Set<string>> {
  if (enrollmentIds.length === 0) return new Set();

  const { data: sessions } = await supabase
    .from("sessions")
    .select("subject_enrollment_id, final_status, lesson_type:lesson_types(code)")
    .in("subject_enrollment_id", enrollmentIds)
    .neq("final_status", "scheduled");

  return new Set(
    (sessions ?? [])
      .filter((s) => extractLessonTypeCode(s.lesson_type) === "trial")
      .map((s) => s.subject_enrollment_id as string)
  );
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

  const progressedIds = await getProgressedTrialEnrollmentIds(supabase, enrollmentIds);
  if (progressedIds.size === 0) return [];

  const { data: selections } = await supabase
    .from("trial_regular_progress_selections")
    .select("subject_enrollment_id")
    .in("subject_enrollment_id", Array.from(progressedIds));
  const selectedIds = new Set((selections ?? []).map((s) => s.subject_enrollment_id as string));

  return enrollments
    .filter((e) => progressedIds.has(e.id) && !selectedIds.has(e.id))
    .map((e) => ({
      subjectEnrollmentId: e.id,
      childName: childNameById.get(e.child_id) ?? "",
      subjectName: extractName(e.subject),
    }));
}
