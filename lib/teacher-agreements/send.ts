import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertDocusignSandboxBaseUri, createEnvelope } from "@/lib/docusign";
import { prepareTeacherAgreement, type PrepareResult, type TeacherAgreementInputs } from "./prepare";

export type TeacherAgreementStatus = "not_sent" | "sent" | "signed" | "declined" | "voided";

export type TeacherAgreementState = {
  status: TeacherAgreementStatus;
  sentAt: string | null;
  signedAt: string | null;
  form: string | null;
  /** signed-copy archiving: null until signed */
  archive: { status: string; lastError: string | null; retryCount: number } | null;
  inputs: TeacherAgreementInputs | null;
  /** empty = ready to send */
  missing: string[];
  ready: boolean;
};

const INPUT_COLUMNS =
  "work_country, work_region, work_location_detail, mailing_address, start_date, supervisor_name, prior_materials, non_lesson_terms, payment_details";

async function loadBasics(admin: SupabaseClient, teacherId: string) {
  const [{ data: teacher }, { data: profile }, { data: prov }, { data: inputs }] = await Promise.all([
    admin.from("teachers").select("workspace_email").eq("id", teacherId).maybeSingle(),
    admin.from("profiles").select("name").eq("id", teacherId).maybeSingle(),
    admin.from("teacher_workspace_provisioning").select("status").eq("linked_teacher_id", teacherId).maybeSingle(),
    admin.from("teacher_agreement_inputs").select(INPUT_COLUMNS).eq("teacher_id", teacherId).maybeSingle(),
  ]);
  return {
    teacherName: (profile?.name as string | undefined) ?? "",
    workspaceEmail: (teacher?.workspace_email as string | null | undefined) ?? null,
    workspaceProvisioned: prov?.status === "created",
    inputs: (inputs as TeacherAgreementInputs | null) ?? null,
  };
}

/** Admin-facing state: latest agreement status plus what is still missing before it can be sent. */
export async function loadTeacherAgreementState(admin: SupabaseClient, teacherId: string): Promise<TeacherAgreementState> {
  const basics = await loadBasics(admin, teacherId);
  const { data: rows } = await admin
    .from("teacher_contracts")
    .select("status, docusign_envelope_status, sent_at, signed_at, agreement_form, drive_sync_status, drive_last_error, drive_retry_count")
    .eq("teacher_id", teacherId)
    .not("agreement_form", "is", null)
    .order("sent_at", { ascending: false })
    .limit(1);
  const latest = rows?.[0];
  let status: TeacherAgreementStatus = "not_sent";
  if (latest) {
    if (latest.status === "signed") status = "signed";
    else if (latest.docusign_envelope_status === "declined") status = "declined";
    else if (latest.docusign_envelope_status === "voided") status = "voided";
    else status = "sent";
  }
  const prepared = prepareTeacherAgreement(basics);
  const missing = prepared.ok ? [] : prepared.missing;
  return {
    status,
    sentAt: (latest?.sent_at as string | null | undefined) ?? null,
    signedAt: (latest?.signed_at as string | null | undefined) ?? null,
    form: (latest?.agreement_form as string | null | undefined) ?? null,
    archive: latest?.drive_sync_status
      ? {
          status: latest.drive_sync_status as string,
          lastError: (latest.drive_last_error as string | null) ?? null,
          retryCount: (latest.drive_retry_count as number | null) ?? 0,
        }
      : null,
    inputs: basics.inputs,
    missing,
    ready: prepared.ok && (status === "not_sent" || status === "declined" || status === "voided"),
  };
}

export class TeacherAgreementNotReadyError extends Error {
  constructor(readonly missing: string[]) {
    super(`계약서를 발송할 수 없습니다. 누락: ${missing.join(", ")}`);
    this.name = "TeacherAgreementNotReadyError";
  }
}

/**
 * Sends the teacher agreement through DocuSign to the teacher's @alton.education address. Authorization is the
 * caller's job (admin server action). Blocks — before any DocuSign call — when a required input is missing or
 * when an unsigned agreement is already open; never touches an existing signed record.
 */
export async function sendTeacherAgreementInternal(
  admin: SupabaseClient,
  params: { teacherId: string; actorUserId: string; webhookUrl: string }
): Promise<{ envelopeId: string; agreementId: string }> {
  assertDocusignSandboxBaseUri();
  const basics = await loadBasics(admin, params.teacherId);

  const { data: open } = await admin
    .from("teacher_contracts")
    .select("id, status, docusign_envelope_status")
    .eq("teacher_id", params.teacherId)
    .not("agreement_form", "is", null);
  if ((open ?? []).some((r) => r.status === "signed")) throw new Error("이미 서명 완료된 선생님 계약서가 있습니다.");
  if ((open ?? []).some((r) => r.status === "sent" && ["sent", "delivered"].includes(r.docusign_envelope_status as string))) {
    throw new Error("이미 발송되어 서명 대기 중인 계약서가 있습니다.");
  }

  const agreementId = randomUUID();
  const prepared: PrepareResult = prepareTeacherAgreement({ ...basics, agreementId });
  if (!prepared.ok) throw new TeacherAgreementNotReadyError(prepared.missing);

  const { envelopeId } = await createEnvelope({
    recipientEmail: prepared.recipientEmail,
    recipientName: basics.teacherName,
    documentHtml: prepared.html,
    emailSubject: "Alton Education Teacher Agreement",
    documentName: "Alton Education Teacher Agreement",
    webhookUrl: params.webhookUrl,
  });

  const { error } = await admin.from("teacher_contracts").insert({
    id: agreementId,
    teacher_id: params.teacherId,
    doc_type: prepared.form,
    agreement_form: prepared.form,
    template_version: prepared.templateVersion,
    docusign_envelope_id: envelopeId,
    docusign_envelope_status: "sent",
    docusign_status_updated_at: new Date().toISOString(),
    status: "sent",
    sent_at: new Date().toISOString(),
    sent_by: params.actorUserId,
    recipient_email: prepared.recipientEmail,
    inputs_snapshot: basics.inputs,
  });
  if (error) {
    // The envelope exists but is not recorded — surface loudly so it can be voided by hand.
    console.error(JSON.stringify({ type: "teacher_agreement_record_failed", teacherId: params.teacherId, envelopeId, error: error.message }));
    throw new Error(error.message);
  }
  console.info(JSON.stringify({ type: "teacher_agreement_envelope_sent", teacherId: params.teacherId, agreementId, envelopeId, form: prepared.form }));
  return { envelopeId, agreementId };
}
