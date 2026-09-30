"use server";

import { requireAdmin, requireAdminOrCapability } from "@/lib/admin-auth";
import { friendlyDbMessage } from "@/lib/booking/overlap-errors";

// 2026-09-29 온보딩 정책 라운드 — 관리자 "주의 필요" 큐(B2·B7·E4)와 체험권 수동 재지급(E1/E2).
// 큐는 DB 함수 한 번(admin_onboarding_attention_queue)으로 읽는다(쿼리 1회, 클라이언트 추가 요청 없음).

export type OnboardingAttentionQueue = {
  onboarding_send_pending: {
    consultation_id: string;
    contact_name: string;
    confirmed_at: string;
    confirmed_by_name: string | null;
    confirmed_by_consultant: boolean | null;
  }[];
  unassigned_inactive_consultant: {
    consultation_id: string;
    contact_name: string;
    from_consultant_id: string | null;
    from_consultant_name: string | null;
    unassigned_at: string | null;
    reason: string | null;
  }[];
  scheduled_inactive_consultant: {
    consultation_id: string;
    contact_name: string;
    consultant_id: string;
    consultant_name: string | null;
    starts_at: string | null;
  }[];
  trial_entitlement_unavailable: {
    consultation_id: string;
    contact_name: string;
    child_id: string;
    state: "exhausted" | "expired";
  }[];
};

export async function listOnboardingAttentionAction(): Promise<OnboardingAttentionQueue> {
  const { supabase } = await requireAdminOrCapability("manage_consultations");
  const { data, error } = await supabase.rpc("admin_onboarding_attention_queue");
  if (error) throw new Error(friendlyDbMessage(error));
  return data as OnboardingAttentionQueue;
}

/** E1/E2 — 소진·만료된 체험권을 관리자가 사유를 남기고 수동으로 재지급(자녀당 소진 1회·만료 1회). */
export async function regrantTrialEntitlementAction(childId: string, reason: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_regrant_trial_entitlement", { p_child_id: childId, p_reason: reason });
  if (error) throw new Error(friendlyDbMessage(error));
}
