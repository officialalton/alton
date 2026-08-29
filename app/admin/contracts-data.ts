import type { SupabaseClient } from "@supabase/supabase-js";

export type PendingConsult = {
  id: string;
  personName: string;
  email: string;
  studentGrade: string | null;
  submittedAt: string;
};

export type FamilyContract = {
  id: string;
  parentName: string;
  studentName: string;
  status: "sent" | "signed";
  signedAt: string | null;
};

export async function loadPendingConsults(supabase: SupabaseClient): Promise<PendingConsult[]> {
  const { data } = await supabase
    .from("consult_requests")
    .select("id, person_name, email, student_grade, submitted_at")
    .is("converted_student_id", null)
    .order("submitted_at", { ascending: true });

  return (data ?? []).map((c) => ({
    id: c.id,
    personName: c.person_name,
    email: c.email,
    studentGrade: c.student_grade,
    submittedAt: c.submitted_at,
  }));
}

export async function loadFamilyContracts(supabase: SupabaseClient): Promise<FamilyContract[]> {
  const { data: contracts } = await supabase
    .from("contracts")
    .select("id, parent_id, student_id, status, signed_at, created_at")
    .order("created_at", { ascending: false });
  if (!contracts || contracts.length === 0) return [];

  const ids = Array.from(new Set(contracts.flatMap((c) => [c.parent_id, c.student_id])));
  const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", ids);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));

  return contracts.map((c) => ({
    id: c.id,
    parentName: nameById.get(c.parent_id) ?? "알 수 없음",
    studentName: nameById.get(c.student_id) ?? "알 수 없음",
    status: c.status,
    signedAt: c.signed_at,
  }));
}
