"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { currentRequestOrigin } from "@/lib/request-origin";
import { appendVercelProtectionBypass } from "@/lib/vercel-protection-bypass";
import {
  loadTeacherAgreementState,
  sendTeacherAgreementInternal,
  TeacherAgreementNotReadyError,
  type TeacherAgreementState,
} from "@/lib/teacher-agreements/send";
import { validateTeacherAgreementInputs } from "@/lib/teacher-agreements/validate-inputs";
import type { TeacherAgreementInputs } from "@/lib/teacher-agreements/prepare";

export type TeacherAgreementActionResult<T = undefined> = ({ ok: true } & (T extends undefined ? object : { data: T })) | { ok: false; error: string };

export async function getTeacherAgreementStateAction(teacherId: string): Promise<TeacherAgreementActionResult<TeacherAgreementState>> {
  try {
    await requireAdmin();
    return { ok: true, data: await loadTeacherAgreementState(createAdminClient(), teacherId) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "계약 상태를 불러오지 못했습니다." };
  }
}

export async function saveTeacherAgreementInputsAction(
  teacherId: string,
  raw: Partial<Record<keyof TeacherAgreementInputs, string | null>>
): Promise<TeacherAgreementActionResult<TeacherAgreementState>> {
  try {
    const { adminUserId } = await requireAdmin();
    const validated = validateTeacherAgreementInputs(raw);
    if (!validated.ok) return { ok: false, error: validated.error };
    const admin = createAdminClient();
    const { error } = await admin
      .from("teacher_agreement_inputs")
      .upsert({ teacher_id: teacherId, ...validated.value, updated_by: adminUserId, updated_at: new Date().toISOString() });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: await loadTeacherAgreementState(admin, teacherId) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "저장에 실패했습니다." };
  }
}

/** 관리자가 직접 누르는 발송이다 — 자동 발송 토글과 무관하며, 누락 입력이 있으면 DocuSign 호출 전에 막힌다. */
export async function sendTeacherAgreementAction(teacherId: string): Promise<TeacherAgreementActionResult<TeacherAgreementState>> {
  try {
    const { adminUserId } = await requireAdmin();
    const admin = createAdminClient();
    const siteUrl = await currentRequestOrigin();
    await sendTeacherAgreementInternal(admin, {
      teacherId,
      actorUserId: adminUserId,
      webhookUrl: appendVercelProtectionBypass(`${siteUrl}/api/webhooks/docusign`),
    });
    revalidatePath("/admin");
    return { ok: true, data: await loadTeacherAgreementState(admin, teacherId) };
  } catch (e) {
    if (e instanceof TeacherAgreementNotReadyError) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "발송에 실패했습니다." };
  }
}
