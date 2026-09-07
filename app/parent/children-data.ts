import type { SupabaseClient } from "@supabase/supabase-js";

export type Child = {
  studentId: string;
  name: string;
  isPrimary: boolean;
};

// (2026-09-06 제품 오너 지시) 상담이 "체험 없이 종료"/"체험 후 종료(정규 미전환)"로
// 중도 종료된 자녀는 보호자 포털 상단 탭에서 숨긴다 — 더 이상 진행 중인 게 없는
// 자녀를 계속 노출하는 게 혼란스럽다는 지적. 단, 이미 정규 전환돼 active
// subject_enrollments가 있는 자녀는 절대 숨기지 않는다(중도 종료된 상담이
// 이력으로 남아있어도 실제 진행 중인 수강이 있으면 무시).
const CLOSED_WITHOUT_PROGRESS = new Set(["no_trial", "trial_no_convert"]);

async function isHiddenForClosedConsultation(
  supabase: SupabaseClient,
  childId: string
): Promise<boolean> {
  const { data: activeEnrollments } = await supabase
    .from("subject_enrollments")
    .select("id")
    .eq("child_id", childId)
    .eq("status", "active")
    .limit(1);
  if (activeEnrollments && activeEnrollments.length > 0) return false;

  const { data: consultations } = await supabase
    .from("consultations")
    .select("closure_type")
    .eq("child_id", childId)
    .order("closed_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1);
  const latest = (consultations ?? [])[0];
  if (!latest || !latest.closure_type) return false;
  return CLOSED_WITHOUT_PROGRESS.has(latest.closure_type as string);
}

export async function loadChildren(
  supabase: SupabaseClient,
  parentId: string
): Promise<Child[]> {
  // (2026-08-30 R2 Task 3) 가족 관계 원본은 households/household_members다
  // (guardian_students는 동결). `is_primary`는 household_members에서 guardian
  // 행은 "이 household의 주 보호자"를, child 행은 (기존 guardian_students와
  // 동일하게) "이 부모의 기본/첫 자녀" 표시 용도로 각자 독립적으로 쓴다 — 여기서는
  // 자녀 자신의 is_primary만 본다(보호자의 is_primary와 무관).
  const { data: guardianLinks } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("profile_id", parentId)
    .eq("role", "guardian");
  const householdIds = (guardianLinks ?? []).map((l) => l.household_id);
  if (householdIds.length === 0) return [];

  const { data: childLinks } = await supabase
    .from("household_members")
    .select("profile_id, is_primary, profile:profiles(name)")
    .in("household_id", householdIds)
    .eq("role", "child")
    .order("is_primary", { ascending: false });

  const children = (childLinks ?? []).map((c) => ({
    studentId: c.profile_id as string,
    name: extractName(c.profile),
    isPrimary: c.is_primary as boolean,
  }));
  if (children.length === 0) return [];

  const hiddenFlags = await Promise.all(
    children.map((c) => isHiddenForClosedConsultation(supabase, c.studentId))
  );
  return children.filter((_, i) => !hiddenFlags[i]);
}

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}
