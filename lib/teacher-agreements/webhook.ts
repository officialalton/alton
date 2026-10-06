import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAcceptedRate } from "./rate";

const TERMINAL = new Set(["completed", "declined", "voided"]);

/**
 * Applies a DocuSign envelope event to a teacher agreement. Returns false when the envelope does not belong to a
 * teacher agreement (caller continues with the family-contract path). A signed record is never changed again.
 */
export async function applyTeacherAgreementEnvelopeEvent(
  admin: SupabaseClient,
  envelopeId: string,
  envelopeStatus: string,
  nowIso: string
): Promise<boolean> {
  const { data: row } = await admin
    .from("teacher_contracts")
    .select("id, teacher_id, inputs_snapshot, agreement_form, status, docusign_envelope_status, document_url")
    .eq("docusign_envelope_id", envelopeId)
    .maybeSingle();
  if (!row) return false;
  if (row.status === "signed") {
    // A repeated completion event retries the (idempotent) rate application in case the first attempt failed after signing.
    if (envelopeStatus === "completed" && row.agreement_form === "teacher_rate_addendum") {
      const { error: applyError } = await admin.rpc("apply_teacher_rate_addendum", { p_contract_id: row.id });
      if (applyError) throw new Error(applyError.message);
    }
    return true;
  }
  const current = row.docusign_envelope_status as string | null;
  if (current && TERMINAL.has(current) && !TERMINAL.has(envelopeStatus)) return true;

  const patch: Record<string, unknown> = { docusign_envelope_status: envelopeStatus, docusign_status_updated_at: nowIso };
  if (envelopeStatus === "completed") {
    patch.status = "signed";
    patch.signed_at = nowIso;
    patch.drive_sync_status = "queued";
    if (!row.document_url) patch.document_url = `docusign-envelope:${envelopeId}`;
  }
  const { error } = await admin.from("teacher_contracts").update(patch).eq("id", row.id).neq("status", "signed");
  if (error) throw new Error(error.message);
  if (envelopeStatus === "completed") {
    if (row.agreement_form === "teacher_rate_addendum") {
      // Both acceptances exist once the envelope is completed (Company approval is recorded in the executed document).
      const { error: applyError } = await admin.rpc("apply_teacher_rate_addendum", { p_contract_id: row.id });
      if (applyError) throw new Error(applyError.message);
    } else if (row.agreement_form !== "consultant_services") {
      await recordAcceptedRate(admin, row as { id: string; teacher_id: string; inputs_snapshot: unknown });
    }
  }
  return true;
}
