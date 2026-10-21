"use server";

import { requireAdminOrCapability } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { loadPaymentRefundBoard } from "./payment-refund-data";

// Stripe 환불 기록·웹훅 이상 대장 관리자 액션. entitlement-actions.ts 와 같은 capability(manage_payments).
const PAYMENTS_CAPABILITY = "manage_payments";

export async function listPaymentRefundBoard() {
  await requireAdminOrCapability(PAYMENTS_CAPABILITY);
  return loadPaymentRefundBoard(createAdminClient());
}

/**
 * 환불 기록 수동 처리. revoke = 기존 refund_entitlement()(그 구매의 수업권만, 미래 예약이 있으면 중단) 재사용,
 * dismiss = 수업권 변경 없이 확인 완료. 사유 필수, 이미 처리된 행은 DB 가 거부한다. 과거 기록은 삭제하지 않는다.
 */
export async function resolvePaymentRefund(params: {
  refundId: string;
  action: "revoke" | "dismiss";
  note: string;
}): Promise<void> {
  const { actorUserId } = await requireAdminOrCapability(PAYMENTS_CAPABILITY);
  const note = params.note?.trim();
  if (!note) throw new Error("처리 사유를 입력해주세요.");
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("resolve_payment_refund", {
    p_refund_id: params.refundId,
    p_admin: actorUserId,
    p_action: params.action,
    p_note: note,
  });
  if (error) throw new Error(error.message);
  const result = data as { ok?: boolean; reason?: string } | null;
  if (!result?.ok) {
    const messages: Record<string, string> = {
      already_handled: "이미 처리된 환불 기록입니다.",
      no_purchase: "구매에 연결되지 않은 환불은 수업권을 회수할 수 없습니다. '확인 완료'로 처리하세요.",
      note_required: "처리 사유를 입력해주세요.",
      not_found: "존재하지 않는 환불 기록입니다.",
    };
    throw new Error(messages[result?.reason ?? ""] ?? "환불 기록을 처리하지 못했습니다.");
  }
}

export async function resolvePaymentWebhookIssue(params: { issueId: string; note: string }): Promise<void> {
  const { actorUserId } = await requireAdminOrCapability(PAYMENTS_CAPABILITY);
  const note = params.note?.trim();
  if (!note) throw new Error("확인 사유를 입력해주세요.");
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("resolve_payment_webhook_issue", {
    p_issue_id: params.issueId,
    p_admin: actorUserId,
    p_note: note,
  });
  if (error) throw new Error(error.message);
  if (!(data as { ok?: boolean } | null)?.ok) throw new Error("이미 해결됐거나 존재하지 않는 항목입니다.");
}
