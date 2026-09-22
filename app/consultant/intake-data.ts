import type { SupabaseClient } from "@supabase/supabase-js";

// 컨설턴트 Phase 1(2026-09-22 스펙) — 상담 요청(consultations) 레벨의
// intake_owner_id/admissions_consultant_id를 다루는 조회 함수. RLS
// (20261450000000 마이그레이션의 확장 정책)가 본인 배정·인테이크 담당자·
// 관리자만 보이게 이미 막아 준다 — 여기서는 추가 권한 검사를 하지 않는다.
export type IntakeConsultation = {
  id: string;
  contactName: string;
  contactEmail: string;
  studentGrade: string | null;
  concerns: string | null;
  status: string;
  requestedAt: string;
  contactedAt: string | null;
  intakeOwnerId: string | null;
  admissionsConsultantId: string | null;
};

const SELECT_COLUMNS =
  "id, contact_name, contact_email, student_grade, concerns, status, requested_at, contacted_at, intake_owner_id, admissions_consultant_id";

function mapRow(row: Record<string, unknown>): IntakeConsultation {
  return {
    id: row.id as string,
    contactName: row.contact_name as string,
    contactEmail: row.contact_email as string,
    studentGrade: (row.student_grade as string | null) ?? null,
    concerns: (row.concerns as string | null) ?? null,
    status: row.status as string,
    requestedAt: row.requested_at as string,
    contactedAt: (row.contacted_at as string | null) ?? null,
    intakeOwnerId: (row.intake_owner_id as string | null) ?? null,
    admissionsConsultantId: (row.admissions_consultant_id as string | null) ?? null,
  };
}

/** 스펙 §Screen Scope "New request queue" — 아직 어드미션 컨설턴트가 배정되지 않은 요청. */
export async function loadUnassignedConsultations(supabase: SupabaseClient): Promise<IntakeConsultation[]> {
  const { data, error } = await supabase
    .from("consultations")
    .select(SELECT_COLUMNS)
    .is("admissions_consultant_id", null)
    .order("requested_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

/** 스펙 §Screen Scope "New assignments"/"Home" — 나에게 배정된 요청(연락 전/후 모두 포함). */
export async function loadMyAssignedConsultations(supabase: SupabaseClient, consultantId: string): Promise<IntakeConsultation[]> {
  const { data, error } = await supabase
    .from("consultations")
    .select(SELECT_COLUMNS)
    .eq("admissions_consultant_id", consultantId)
    .order("requested_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}
