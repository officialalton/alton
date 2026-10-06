import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertDocusignSandboxBaseUri, createEnvelope } from "@/lib/docusign";
import { deriveAgreementStatus, type TeacherAgreementStatus } from "@/lib/teacher-agreements/status";
import {
  consultantChecklist,
  prepareConsultantAgreement,
  type ConsultantAgreementInputs,
  type PrepareConsultantArgs,
} from "./prepare";

export type ConsultantAgreementState = {
  status: TeacherAgreementStatus;
  sentAt: string | null;
  signedAt: string | null;
  archive: { status: string; lastError: string | null; retryCount: number } | null;
  inputs: (ConsultantAgreementInputs & { monthly_fee_amount: string }) | null;
  missing: string[];
  checklist: { key: string; label: string; ok: boolean }[];
  ready: boolean;
};

const INPUT_COLUMNS =
  "work_country, work_region, work_location_detail, mailing_address, start_date, monthly_fee_minor, monthly_fee_currency, monthly_scope, prior_materials";

export async function loadConsultantBasics(admin: SupabaseClient, consultantId: string): Promise<PrepareConsultantArgs> {
  const [{ data: profile }, { data: prov }, { data: inputs }, { data: payout }] = await Promise.all([
    admin.from("profiles").select("name").eq("id", consultantId).maybeSingle(),
    admin.from("consultant_workspace_provisioning").select("workspace_email").eq("linked_profile_id", consultantId).maybeSingle(),
    admin.from("teacher_agreement_inputs").select(INPUT_COLUMNS).eq("teacher_id", consultantId).maybeSingle(),
    // Only the non-sensitive summary fields are read; the full account number never leaves the payout-account tables.
    admin.from("consultant_payout_accounts").select("account_holder_name, bank_name, account_number_last4, currency").eq("consultant_id", consultantId).maybeSingle(),
  ]);
  const row = inputs as (Omit<ConsultantAgreementInputs, "monthly_fee_minor"> & { monthly_fee_minor: number | string | null }) | null;
  return {
    consultantName: (profile?.name as string | undefined) ?? "",
    workspaceEmail: (prov?.workspace_email as string | null | undefined) ?? null,
    inputs: row ? { ...row, monthly_fee_minor: row.monthly_fee_minor == null ? null : Number(row.monthly_fee_minor) } : null,
    payoutAccount: payout
      ? { holderName: payout.account_holder_name as string, bankName: payout.bank_name as string, last4: payout.account_number_last4 as string, currency: payout.currency as string }
      : null,
  };
}

const feeAmountText = (i: ConsultantAgreementInputs | null) =>
  !i?.monthly_fee_minor ? "" : i.monthly_fee_currency === "USD" ? (i.monthly_fee_minor / 100).toFixed(2) : String(i.monthly_fee_minor);

export async function loadConsultantAgreementState(admin: SupabaseClient, consultantId: string): Promise<ConsultantAgreementState> {
  const basics = await loadConsultantBasics(admin, consultantId);
  const { data: rows } = await admin
    .from("teacher_contracts")
    .select("status, docusign_envelope_status, sent_at, signed_at, drive_sync_status, drive_last_error, drive_retry_count")
    .eq("teacher_id", consultantId)
    .eq("agreement_form", "consultant_services")
    .order("sent_at", { ascending: false })
    .limit(1);
  const latest = rows?.[0];
  const status = deriveAgreementStatus(latest);
  const prepared = prepareConsultantAgreement(basics);
  const checklist = consultantChecklist(basics);
  return {
    status,
    sentAt: (latest?.sent_at as string | null | undefined) ?? null,
    signedAt: (latest?.signed_at as string | null | undefined) ?? null,
    archive: latest?.drive_sync_status
      ? { status: latest.drive_sync_status as string, lastError: (latest.drive_last_error as string | null) ?? null, retryCount: (latest.drive_retry_count as number | null) ?? 0 }
      : null,
    inputs: basics.inputs ? { ...basics.inputs, monthly_fee_amount: feeAmountText(basics.inputs) } : null,
    missing: prepared.ok ? [] : prepared.missing,
    checklist,
    ready: prepared.ok && checklist.every((c) => c.ok) && (status === "not_sent" || status === "declined" || status === "voided"),
  };
}

export class ConsultantAgreementNotReadyError extends Error {
  constructor(readonly missing: string[]) {
    super(`계약서를 발송할 수 없습니다. 누락: ${missing.join(", ")}`);
    this.name = "ConsultantAgreementNotReadyError";
  }
}

/** Sends the consultant agreement through DocuSign (admin server action authorizes). Never touches a signed record. */
export async function sendConsultantAgreementInternal(
  admin: SupabaseClient,
  params: { consultantId: string; actorUserId: string; webhookUrl: string }
): Promise<{ envelopeId: string; agreementId: string }> {
  assertDocusignSandboxBaseUri();
  const basics = await loadConsultantBasics(admin, params.consultantId);
  const { data: open } = await admin
    .from("teacher_contracts")
    .select("id, status, docusign_envelope_status")
    .eq("teacher_id", params.consultantId)
    .eq("agreement_form", "consultant_services");
  if ((open ?? []).some((r) => r.status === "signed")) throw new Error("이미 서명 완료된 컨설턴트 계약서가 있습니다.");
  if ((open ?? []).some((r) => r.status === "sent" && ["sent", "delivered"].includes(r.docusign_envelope_status as string))) {
    throw new Error("이미 발송되어 서명 대기 중인 계약서가 있습니다.");
  }
  const agreementId = randomUUID();
  const prepared = prepareConsultantAgreement({ ...basics, agreementId });
  if (!prepared.ok) throw new ConsultantAgreementNotReadyError(prepared.missing);

  const { envelopeId } = await createEnvelope({
    recipientEmail: prepared.recipientEmail,
    recipientName: basics.consultantName,
    documentHtml: prepared.html,
    emailSubject: "Alton Education Consultant Agreement",
    documentName: "Alton Education Consultant Agreement",
    webhookUrl: params.webhookUrl,
  });
  const nowIso = new Date().toISOString();
  const { error } = await admin.from("teacher_contracts").insert({
    id: agreementId,
    teacher_id: params.consultantId,
    doc_type: "consultant_services",
    agreement_form: "consultant_services",
    template_version: prepared.templateVersion,
    docusign_envelope_id: envelopeId,
    docusign_envelope_status: "sent",
    docusign_status_updated_at: nowIso,
    status: "sent",
    sent_at: nowIso,
    sent_by: params.actorUserId,
    recipient_email: prepared.recipientEmail,
    inputs_snapshot: { ...basics.inputs },
  });
  if (error) {
    console.error(JSON.stringify({ type: "consultant_agreement_record_failed", consultantId: params.consultantId, envelopeId, error: error.message }));
    throw new Error(error.message);
  }
  console.info(JSON.stringify({ type: "consultant_agreement_envelope_sent", consultantId: params.consultantId, agreementId, envelopeId }));
  return { envelopeId, agreementId };
}
