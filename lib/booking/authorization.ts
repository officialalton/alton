import { createAdminClient } from "@/lib/supabase-admin";
import type { requireUser } from "@/lib/auth";

// R6 6/N — 예약 서버 액션들이 공유하는 권한 검증 헬퍼. app/parent/purchase-actions.ts(R4)의
// "RLS-scoped 클라이언트로 관계 확인 → admin 클라이언트로 실제 쓰기" 계층 분리를 그대로 따른다.

type UserSupabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

export async function assertGuardianOfChild(
  supabase: UserSupabase,
  guardianId: string,
  childId: string
): Promise<void> {
  const { data: guardianLinks } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("profile_id", guardianId)
    .eq("role", "guardian");
  const householdIds = (guardianLinks ?? []).map((l) => l.household_id as string);
  if (householdIds.length === 0) {
    throw new Error("보호자 권한이 없습니다.");
  }
  const { data: childLink } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("profile_id", childId)
    .eq("role", "child")
    .in("household_id", householdIds)
    .maybeSingle();
  if (!childLink) {
    throw new Error("본인 가족 구성원이 아닌 자녀에 대해서는 예약할 수 없습니다.");
  }
}

/**
 * 취소 등 예약 하나를 대상으로 하는 액션에서, 그 예약이 정말 childId 소유(자기 자신 또는
 * 자기 가족)인지 확인한다. childId 자체의 가족관계 검증(assertGuardianOfChild)과는 별개로
 * 필요 — reservationId를 다른 사람 것으로 바꿔치기해서 childId만 자기 자녀로 넘기는 방식의
 * 우회를 막는다.
 */
export async function assertReservationBelongsToChild(
  admin: ReturnType<typeof createAdminClient>,
  reservationId: string,
  childId: string
): Promise<void> {
  const { data } = await admin
    .from("reservations")
    .select("subject_enrollment:subject_enrollments!reservations_subject_enrollment_id_fkey(child_id)")
    .eq("id", reservationId)
    .maybeSingle();
  const subjectEnrollment = data
    ? Array.isArray(data.subject_enrollment)
      ? data.subject_enrollment[0]
      : data.subject_enrollment
    : null;
  const actualChildId = (subjectEnrollment as { child_id?: string } | null)?.child_id;
  if (!actualChildId || actualChildId !== childId) {
    throw new Error("본인(또는 자녀) 예약만 취소할 수 있습니다.");
  }
}

export async function assertActiveTeacherAssignment(
  admin: ReturnType<typeof createAdminClient>,
  subjectEnrollmentId: string,
  teacherId: string
): Promise<void> {
  const { data } = await admin
    .from("teacher_assignments")
    .select("id")
    .eq("subject_enrollment_id", subjectEnrollmentId)
    .eq("teacher_id", teacherId)
    .eq("status", "active")
    .maybeSingle();
  if (!data) {
    throw new Error("이 과목 수강에 현재 배정된 선생님이 아닙니다.");
  }
}
