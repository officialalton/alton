"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { currentRequestOrigin } from "@/lib/request-origin";
import { appendVercelProtectionBypass } from "@/lib/vercel-protection-bypass";
import {
  ConsultantAgreementNotReadyError,
  loadConsultantAgreementState,
  sendConsultantAgreementInternal,
  type ConsultantAgreementState,
} from "@/lib/consultant-agreements/send";
import { validateConsultantAgreementInputs, type RawConsultantInputs } from "@/lib/consultant-agreements/validate-inputs";
import { retryTeacherAgreementArchive } from "@/lib/teacher-agreements/archive";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function getConsultantAgreementStateAction(consultantId: string): Promise<Result<ConsultantAgreementState>> {
  try {
    await requireAdmin();
    return { ok: true, data: await loadConsultantAgreementState(createAdminClient(), consultantId) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "계약 상태를 불러오지 못했습니다." };
  }
}

export async function saveConsultantAgreementInputsAction(consultantId: string, raw: RawConsultantInputs): Promise<Result<ConsultantAgreementState>> {
  try {
    const { adminUserId } = await requireAdmin();
    const validated = validateConsultantAgreementInputs(raw);
    if (!validated.ok) return { ok: false, error: validated.error };
    const admin = createAdminClient();
    const { error } = await admin
      .from("teacher_agreement_inputs")
      .upsert({ teacher_id: consultantId, engagement_type: "contractor", ...validated.value, updated_by: adminUserId, updated_at: new Date().toISOString() });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: await loadConsultantAgreementState(admin, consultantId) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "저장에 실패했습니다." };
  }
}

/** 관리자가 직접 누르는 발송이다 — 자동 발송이 아니며, 누락 입력이 있으면 DocuSign 호출 전에 막힌다. */
export async function sendConsultantAgreementAction(consultantId: string): Promise<Result<ConsultantAgreementState>> {
  try {
    const { adminUserId } = await requireAdmin();
    const admin = createAdminClient();
    const siteUrl = await currentRequestOrigin();
    await sendConsultantAgreementInternal(admin, {
      consultantId,
      actorUserId: adminUserId,
      webhookUrl: appendVercelProtectionBypass(`${siteUrl}/api/webhooks/docusign`),
    });
    revalidatePath("/admin");
    return { ok: true, data: await loadConsultantAgreementState(admin, consultantId) };
  } catch (e) {
    if (e instanceof ConsultantAgreementNotReadyError) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "발송에 실패했습니다." };
  }
}

export async function retryConsultantAgreementArchiveAction(consultantId: string): Promise<Result<ConsultantAgreementState>> {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    await retryTeacherAgreementArchive(admin, consultantId);
    return { ok: true, data: await loadConsultantAgreementState(admin, consultantId) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "보관 재시도에 실패했습니다." };
  }
}
