import type { SupabaseClient } from "@supabase/supabase-js";
import type { TeacherRate } from "@/lib/contracts/teacher-agreement-template";

/** Current accepted hourly rate (teacher_rate_history is the source of truth; no currency conversion anywhere). */
export async function loadCurrentTeacherRate(admin: SupabaseClient, teacherId: string): Promise<(TeacherRate & { id: string }) | null> {
  const { data } = await admin
    .from("teacher_rate_history")
    .select("id, amount_minor, currency")
    .eq("teacher_id", teacherId)
    .is("effective_until", null)
    .maybeSingle();
  if (!data || (data.currency !== "KRW" && data.currency !== "USD")) return null;
  return { id: data.id as string, amountMinor: Number(data.amount_minor), currency: data.currency as "KRW" | "USD" };
}

export type TeacherRateLock = "open_agreement" | "signed_agreement" | null;

export const RATE_LOCK_MESSAGE: Record<Exclude<TeacherRateLock, null>, string> = {
  open_agreement: "계약서가 발송되어 서명 대기 중이라 시급을 바꿀 수 없습니다. 계약서를 무효 처리한 뒤 다시 발송해야 시급을 변경할 수 있습니다.",
  signed_agreement: "서명이 완료된 계약서가 있어 시급을 바꿀 수 없습니다. 시급 변경 합의서(addendum)가 필요합니다.",
};

export async function loadTeacherRateLock(admin: SupabaseClient, teacherId: string): Promise<TeacherRateLock> {
  const { data } = await admin
    .from("teacher_contracts")
    .select("status, docusign_envelope_status")
    .eq("teacher_id", teacherId)
    .not("agreement_form", "is", null);
  const rows = data ?? [];
  if (rows.some((r) => r.status === "signed")) return "signed_agreement";
  if (rows.some((r) => r.status === "sent" && ["sent", "delivered"].includes(r.docusign_envelope_status as string))) return "open_agreement";
  return null;
}

/**
 * Signature completed: link the accepted rate to the contract. The rate sent is the one in inputs_snapshot.rate; it is
 * normally still current (the rate is locked while the agreement is open). If it is, the current history row is only
 * linked (no duplicate row); otherwise a new history row with the snapshot value is created through set_teacher_rate().
 */
export async function recordAcceptedRate(
  admin: SupabaseClient,
  contract: { id: string; teacher_id: string; inputs_snapshot: unknown }
): Promise<void> {
  const rate = (contract.inputs_snapshot as { rate?: { amountMinor?: number; currency?: string } } | null)?.rate;
  if (!rate?.amountMinor || !rate.currency) return;
  let current = await loadCurrentTeacherRate(admin, contract.teacher_id);
  if (!current || current.amountMinor !== rate.amountMinor || current.currency !== rate.currency) {
    const { error } = await admin.rpc("set_teacher_rate", {
      p_teacher_id: contract.teacher_id,
      p_amount_minor: rate.amountMinor,
      p_currency: rate.currency,
    });
    if (error) throw new Error(error.message);
    current = await loadCurrentTeacherRate(admin, contract.teacher_id);
  }
  if (!current) return;
  const { error } = await admin
    .from("teacher_rate_history")
    .update({ agreement_contract_id: contract.id })
    .eq("id", current.id)
    .is("agreement_contract_id", null);
  if (error) throw new Error(error.message);
}
