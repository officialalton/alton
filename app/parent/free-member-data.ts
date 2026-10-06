import type { SupabaseClient } from "@supabase/supabase-js";

// 2026-10-05 무료 회원 S4 — 보호자 포털용: 자녀 중 무료 학습 회원(배지)과 free_member 상담의 예약 상태(배너).
// 가족은 consultations를 직접 읽지 못하므로 상태는 family_free_member_consult_status() RPC로 받는다(2 쿼리).

export type FreeMemberConsult = {
  consultationId: string;
  childId: string | null;
  childName: string | null;
  status: "requested" | "scheduled";
  assigned: boolean;
  startsAt: string | null;
  hasValidLink: boolean;
};

export type FreeMemberFamilyStatus = {
  freeMemberChildIds: string[];
  consults: FreeMemberConsult[];
  /** 활성 학습 요약 공유(learning_summary_grants, 철회 안 됨)가 있는 자녀 — 보호자가 철회할 수 있다. */
  summarySharedChildren: { studentId: string; name: string | null }[];
};

export async function loadFreeMemberFamilyStatus(supabase: SupabaseClient, childIds: string[]): Promise<FreeMemberFamilyStatus> {
  if (childIds.length === 0) return { freeMemberChildIds: [], consults: [], summarySharedChildren: [] };
  const [{ data: students }, { data: consults, error }, { data: grants }] = await Promise.all([
    supabase.from("students").select("id, member_type").in("id", childIds).eq("member_type", "free"),
    supabase.rpc("family_free_member_consult_status"),
    supabase.from("learning_summary_grants").select("student_id").in("student_id", childIds).is("revoked_at", null),
  ]);
  const sharedIds = Array.from(new Set((grants ?? []).map((g) => g.student_id as string)));
  const { data: sharedProfiles } = sharedIds.length
    ? await supabase.from("profiles").select("id, name").in("id", sharedIds)
    : { data: [] as { id: string; name: string | null }[] };
  if (error) console.error(JSON.stringify({ type: "family_free_member_consult_status_failed", error: error.message }));
  return {
    summarySharedChildren: sharedIds.map((id) => ({ studentId: id, name: (sharedProfiles ?? []).find((p) => p.id === id)?.name ?? null })),
    freeMemberChildIds: (students ?? []).map((s) => s.id as string),
    consults: ((consults ?? []) as Array<Record<string, unknown>>).map((c) => ({
      consultationId: c.consultation_id as string,
      childId: (c.child_id as string | null) ?? null,
      childName: (c.child_name as string | null) ?? null,
      status: c.status as "requested" | "scheduled",
      assigned: !!c.assigned,
      startsAt: (c.starts_at as string | null) ?? null,
      hasValidLink: !!c.has_valid_link,
    })),
  };
}
