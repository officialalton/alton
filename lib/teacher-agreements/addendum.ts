import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertDocusignSandboxBaseUri, createEnvelope } from "@/lib/docusign";
import { RATE_ADDENDUM_TEMPLATE_VERSION, renderRateAddendumHtml, type TeacherRate } from "@/lib/contracts/teacher-agreement-template";
import { COMPANY_NAME } from "@/lib/legal";
import { UnfilledContractError } from "@/lib/legal/guard";
import { countryName, englishUtc, type PayoutAccountSummary } from "./prepare";
import { loadBasics } from "./send";
import { deriveAgreementStatus, MAIN_TEACHER_FORMS, type TeacherAgreementStatus } from "./status";
import { TEACHER_APPROVER } from "./schedule-defaults";

export type AddendumInput = { newAmountMinor: number; newCurrency: "KRW" | "USD"; effectiveDate: string };

export type RateAddendumState = {
  /** true when a signed agreement exists, no addendum is open, and the system is ready to send one */
  canCreate: boolean;
  blockers: string[];
  latest: { status: TeacherAgreementStatus; effectiveDate: string | null; newAmountMinor: number | null; newCurrency: string | null; sentAt: string | null } | null;
};

/** Today in the contract time zone (Pacific), YYYY-MM-DD. */
export function todayPacific(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function validateAddendumInput(i: AddendumInput, current: TeacherRate | null, now = new Date()): string[] {
  const problems: string[] = [];
  if (!Number.isFinite(i.newAmountMinor) || i.newAmountMinor <= 0 || !Number.isInteger(i.newAmountMinor)) problems.push("새 시급은 0보다 큰 금액이어야 합니다");
  if (i.newCurrency !== "KRW" && i.newCurrency !== "USD") problems.push("새 시급 통화는 KRW 또는 USD여야 합니다");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.effectiveDate) || Number.isNaN(new Date(`${i.effectiveDate}T00:00:00Z`).getTime())) problems.push("적용 시작일은 YYYY-MM-DD 형식이어야 합니다");
  else if (i.effectiveDate < todayPacific(now)) problems.push("적용 시작일은 오늘(Pacific Time) 이후여야 합니다 — 소급 적용은 할 수 없습니다");
  if (current && current.amountMinor === i.newAmountMinor && current.currency === i.newCurrency) problems.push("현재 시급과 같은 값입니다");
  return problems;
}

async function loadSignedMainAgreement(admin: SupabaseClient, teacherId: string) {
  const { data } = await admin
    .from("teacher_contracts")
    .select("id, signed_at, agreement_form, inputs_snapshot")
    .eq("teacher_id", teacherId)
    .eq("status", "signed")
    .in("agreement_form", [...MAIN_TEACHER_FORMS])
    .order("signed_at", { ascending: false })
    .limit(1);
  return (data?.[0] as { id: string; signed_at: string | null; agreement_form: string; inputs_snapshot: { rate?: TeacherRate } | null } | undefined) ?? null;
}

export async function loadRateAddendumState(admin: SupabaseClient, teacherId: string): Promise<RateAddendumState> {
  const signed = await loadSignedMainAgreement(admin, teacherId);
  const { data: rows } = await admin
    .from("teacher_contracts")
    .select("status, docusign_envelope_status, sent_at, inputs_snapshot")
    .eq("teacher_id", teacherId)
    .eq("agreement_form", "teacher_rate_addendum")
    .order("sent_at", { ascending: false })
    .limit(1);
  const row = rows?.[0] as { status: string; docusign_envelope_status: string | null; sent_at: string | null; inputs_snapshot: { addendum?: { effectiveDate?: string; newAmountMinor?: number; newCurrency?: string } } | null } | undefined;
  const latest = row
    ? {
        status: deriveAgreementStatus(row),
        effectiveDate: row.inputs_snapshot?.addendum?.effectiveDate ?? null,
        newAmountMinor: row.inputs_snapshot?.addendum?.newAmountMinor ?? null,
        newCurrency: row.inputs_snapshot?.addendum?.newCurrency ?? null,
        sentAt: row.sent_at,
      }
    : null;
  const blockers: string[] = [];
  if (!signed) blockers.push("서명 완료된 선생님 계약서가 없습니다");
  if (latest?.status === "sent") blockers.push("서명 대기 중인 시급 변경 합의서가 있습니다 — 무효 처리 후 다시 발송하세요");
  return { canCreate: blockers.length === 0, blockers, latest };
}

export type PrepareAddendumArgs = {
  teacherName: string;
  teacherEmail: string;
  teacherAddress: string | null;
  workCountry: string | null;
  workRegion: string | null;
  workLocationDetail: string | null;
  signed: { id: string; signedDate: string } | null;
  current: TeacherRate | null;
  payoutAccount: PayoutAccountSummary | null;
  input: AddendumInput;
  agreementId: string;
  now?: Date;
};

export type PrepareAddendumResult = { ok: true; html: string; templateVersion: string } | { ok: false; missing: string[] };

export function prepareRateAddendum(a: PrepareAddendumArgs): PrepareAddendumResult {
  const missing: string[] = [];
  if (!a.signed) missing.push("서명 완료된 선생님 계약서");
  if (!a.current) missing.push("현재 시급(이력)이 없습니다");
  missing.push(...validateAddendumInput(a.input, a.current, a.now));
  if (!a.teacherAddress?.trim()) missing.push("우편 주소(계약서 입력)");
  if (!a.workCountry?.trim() || !a.workLocationDetail?.trim()) missing.push("근무 국가·위치(계약서 입력)");
  if (!a.teacherEmail.toLowerCase().endsWith("@alton.education")) missing.push("Workspace 계정(@alton.education)");
  if (!a.payoutAccount) missing.push("수취 계좌 미등록");
  else if (a.payoutAccount.currency !== a.input.newCurrency) missing.push(`수취 계좌 통화(${a.payoutAccount.currency})가 새 시급 통화(${a.input.newCurrency})와 다릅니다`);
  if (missing.length > 0 || !a.signed || !a.current) return { ok: false, missing };

  const at = a.now ?? new Date();
  try {
    const html = renderRateAddendumHtml({
      teacherName: a.teacherName,
      teacherEmail: a.teacherEmail,
      teacherAddress: a.teacherAddress!,
      effectiveDate: a.input.effectiveDate,
      priorMaterials: "None",
      actualWorkCountryAndLocation: `${countryName(a.workCountry!)}${a.workRegion?.trim() ? `, ${a.workRegion}` : ""} — ${a.workLocationDetail}`,
      existingAgreementId: a.signed.id,
      existingAgreementSignedDate: a.signed.signedDate,
      previousRate: a.current,
      newRate: { amountMinor: a.input.newAmountMinor, currency: a.input.newCurrency },
      companyApproval: {
        companyEntityName: COMPANY_NAME,
        approverName: TEACHER_APPROVER.name,
        approverTitle: TEACHER_APPROVER.title,
        approvedAtLabel: englishUtc(at),
        documentIdentifier: a.agreementId,
      },
    });
    return { ok: true, html, templateVersion: RATE_ADDENDUM_TEMPLATE_VERSION };
  } catch (e) {
    if (e instanceof UnfilledContractError) return { ok: false, missing: e.problems };
    throw e;
  }
}

export class RateAddendumNotReadyError extends Error {
  constructor(readonly missing: string[]) {
    super(`시급 변경 합의서를 발송할 수 없습니다. 누락: ${missing.join(", ")}`);
    this.name = "RateAddendumNotReadyError";
  }
}

/**
 * Sends a rate change addendum for a teacher with a signed agreement. The teacher's rate in the system is NOT changed
 * here: it is applied by the signature-completion webhook (apply_teacher_rate_addendum), effective from the stated date.
 */
export async function sendRateAddendumInternal(
  admin: SupabaseClient,
  params: { teacherId: string; actorUserId: string; webhookUrl: string; input: AddendumInput; now?: Date }
): Promise<{ envelopeId: string; agreementId: string }> {
  assertDocusignSandboxBaseUri();
  const state = await loadRateAddendumState(admin, params.teacherId);
  if (!state.canCreate) throw new RateAddendumNotReadyError(state.blockers);
  const basics = await loadBasics(admin, params.teacherId);
  const signed = await loadSignedMainAgreement(admin, params.teacherId);
  const agreementId = randomUUID();
  const prepared = prepareRateAddendum({
    teacherName: basics.teacherName,
    teacherEmail: (basics.workspaceEmail ?? "").trim().toLowerCase(),
    teacherAddress: basics.inputs?.mailing_address ?? null,
    workCountry: basics.inputs?.work_country ?? null,
    workRegion: basics.inputs?.work_region ?? null,
    workLocationDetail: basics.inputs?.work_location_detail ?? null,
    signed: signed ? { id: signed.id, signedDate: todayPacific(new Date(signed.signed_at ?? Date.now())) } : null,
    current: basics.rate,
    payoutAccount: basics.payoutAccount ?? null,
    input: params.input,
    agreementId,
    now: params.now,
  });
  if (!prepared.ok) throw new RateAddendumNotReadyError(prepared.missing);

  const { envelopeId } = await createEnvelope({
    recipientEmail: (basics.workspaceEmail ?? "").trim().toLowerCase(),
    recipientName: basics.teacherName,
    documentHtml: prepared.html,
    emailSubject: "Alton Education Teacher Rate Change Addendum",
    documentName: "Alton Education Teacher Rate Change Addendum",
    webhookUrl: params.webhookUrl,
  });
  const nowIso = new Date().toISOString();
  const { error } = await admin.from("teacher_contracts").insert({
    id: agreementId,
    teacher_id: params.teacherId,
    doc_type: "teacher_rate_addendum",
    agreement_form: "teacher_rate_addendum",
    template_version: prepared.templateVersion,
    amends_contract_id: signed!.id,
    docusign_envelope_id: envelopeId,
    docusign_envelope_status: "sent",
    docusign_status_updated_at: nowIso,
    status: "sent",
    sent_at: nowIso,
    sent_by: params.actorUserId,
    recipient_email: (basics.workspaceEmail ?? "").trim().toLowerCase(),
    inputs_snapshot: {
      addendum: {
        previousAmountMinor: basics.rate!.amountMinor,
        previousCurrency: basics.rate!.currency,
        newAmountMinor: params.input.newAmountMinor,
        newCurrency: params.input.newCurrency,
        effectiveDate: params.input.effectiveDate,
      },
    },
  });
  if (error) {
    console.error(JSON.stringify({ type: "rate_addendum_record_failed", teacherId: params.teacherId, envelopeId, error: error.message }));
    throw new Error(error.message);
  }
  console.info(JSON.stringify({ type: "rate_addendum_envelope_sent", teacherId: params.teacherId, agreementId, envelopeId }));
  return { envelopeId, agreementId };
}
