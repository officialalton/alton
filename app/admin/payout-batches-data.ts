import type { SupabaseClient } from "@supabase/supabase-js";

// R10 Task C — v3 payout_batches 관리자 화면 데이터 계층.
// 레거시 teacher_payouts(payouts-data.ts)와 달리 batch/item/audit-log
// 3단 구조를 그대로 노출한다. 상태 전이는 payout-batches-actions.ts의
// 서버 액션(SECURITY DEFINER RPC 호출)만 담당하고, 이 파일은 읽기 전용.

export type PayoutBatchStatus =
  | "draft"
  | "calculated"
  | "reviewing"
  | "reviewed"
  | "approved"
  | "dispatch_requested"
  | "provider_pending"
  | "processing"
  | "paid"
  | "failed";

export type PayoutBatchItem = {
  id: string;
  itemType: string;
  amountMinor: number;
  currency: string;
  payableMinutes: number;
  status: string;
};

export type PayoutBatchAuditEntry = {
  id: string;
  action: string;
  actorName: string | null;
  note: string | null;
  createdAt: string;
};

export type PayoutBatchListItem = {
  id: string;
  teacherId: string;
  teacherName: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
  status: PayoutBatchStatus;
  totalAmountMinor: number;
  itemCount: number;
  createdAt: string;
  approvedAt: string | null;
  paidAt: string | null;
  failureReason: string | null;
  // P4-2: 지급 예정일은 저장값이다(화면에서 계산하지 않는다).
  scheduledPayoutDate: string | null;
  autoDispatchEnabled: boolean;
  externalTransferRecordedAt: string | null;
  items: PayoutBatchItem[];
  auditLog: PayoutBatchAuditEntry[];
};

export async function loadPayoutBatches(supabase: SupabaseClient): Promise<PayoutBatchListItem[]> {
  const { data: batches } = await supabase
    .from("payout_batches")
    .select(
      "id, teacher_id, period_start, period_end, currency, status, created_at, approved_at, paid_at, failure_reason, scheduled_payout_date, auto_dispatch_enabled, external_transfer_recorded_at"
    )
    .order("created_at", { ascending: false });
  if (!batches || batches.length === 0) return [];

  const batchIds = batches.map((b) => b.id);
  const teacherIds = Array.from(new Set(batches.map((b) => b.teacher_id)));

  const [{ data: profiles }, { data: items }, { data: auditRows }] = await Promise.all([
    supabase.from("profiles").select("id, name").in("id", teacherIds),
    supabase
      .from("payout_items")
      .select("id, batch_id, item_type, amount_minor, currency, payable_minutes, status")
      .in("batch_id", batchIds),
    supabase
      .from("payout_batch_audit_log")
      .select("id, batch_id, action, actor_id, note, created_at")
      .in("batch_id", batchIds)
      .order("created_at", { ascending: true }),
  ]);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name as string]));
  const itemsByBatch = new Map<string, PayoutBatchItem[]>();
  for (const it of items ?? []) {
    const list = itemsByBatch.get(it.batch_id) ?? [];
    list.push({
      id: it.id,
      itemType: it.item_type,
      amountMinor: it.amount_minor,
      currency: it.currency,
      payableMinutes: it.payable_minutes,
      status: it.status,
    });
    itemsByBatch.set(it.batch_id, list);
  }
  const actorNameById = nameById; // audit actor는 profiles.id를 참조(관리자/시스템)
  const auditByBatch = new Map<string, PayoutBatchAuditEntry[]>();
  for (const a of auditRows ?? []) {
    const list = auditByBatch.get(a.batch_id) ?? [];
    list.push({
      id: a.id,
      action: a.action,
      actorName: a.actor_id ? actorNameById.get(a.actor_id) ?? "알 수 없음" : null,
      note: a.note,
      createdAt: a.created_at,
    });
    auditByBatch.set(a.batch_id, list);
  }

  return batches.map((b) => {
    const batchItems = itemsByBatch.get(b.id) ?? [];
    return {
      id: b.id,
      teacherId: b.teacher_id,
      teacherName: nameById.get(b.teacher_id) ?? "알 수 없음",
      periodStart: b.period_start,
      periodEnd: b.period_end,
      currency: b.currency,
      status: b.status as PayoutBatchStatus,
      totalAmountMinor: batchItems.reduce((sum, it) => sum + it.amountMinor, 0),
      itemCount: batchItems.length,
      createdAt: b.created_at,
      approvedAt: b.approved_at,
      paidAt: b.paid_at,
      failureReason: b.failure_reason ?? null,
      scheduledPayoutDate: (b.scheduled_payout_date as string | null) ?? null,
      autoDispatchEnabled: b.auto_dispatch_enabled !== false,
      externalTransferRecordedAt: (b.external_transfer_recorded_at as string | null) ?? null,
      items: batchItems,
      auditLog: auditByBatch.get(b.id) ?? [],
    };
  });
}
