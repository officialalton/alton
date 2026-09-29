"use server";

import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  dispatchOneContractJob,
  isContractAutoDispatchEnabled,
  processContractDispatchQueue,
  type ContractDispatchJobRow,
} from "@/lib/contract-dispatch/dispatcher";
import { selectInChunks } from "@/lib/select-in-chunks";

// 2026-09-28 — 초기 고객 절차 단순화 4단계: 관리자 화면용 outbox 조회·실행 액션.
// 실제 DocuSign 발송은 CONTRACT_AUTO_DISPATCH_ENABLED=true일 때만 일어난다
// (기본 비활성 — 사용자 지시: 실제 고객 발송 활성화는 별도 승인 필요).

export type ContractDispatchJobListItem = ContractDispatchJobRow & {
  childName: string | null;
};

export async function listContractDispatchJobs(): Promise<{
  autoDispatchEnabled: boolean;
  jobs: ContractDispatchJobListItem[];
}> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("contract_dispatch_jobs")
    .select("id, child_id, subject_enrollment_id, trigger_type, status, attempt_count, last_error, sent_at, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as ContractDispatchJobRow[];
  const childIds = Array.from(new Set(rows.map((r) => r.child_id)));
  const childNameById = new Map<string, string>();
  if (childIds.length > 0) {
    const { data: profiles } = await selectInChunks(childIds, (chunk) => admin.from("profiles").select("id, name").in("id", chunk));
    for (const p of profiles ?? []) childNameById.set(p.id, p.name);
  }

  return {
    autoDispatchEnabled: isContractAutoDispatchEnabled(),
    jobs: rows.map((r) => ({ ...r, childName: childNameById.get(r.child_id) ?? null })),
  };
}

/** 큐에 쌓인 작업을 일괄 처리한다(비활성 상태면 아무것도 안 하고 그 사실만 반환). */
export async function runContractDispatchQueueAction(): Promise<{ enabled: boolean; processed: number; sent: number; failed: number }> {
  await requireAdmin();
  const admin = createAdminClient();
  return processContractDispatchQueue(admin);
}

/** 실패한 작업 하나를 다시 시도한다. */
export async function retryContractDispatchJobAction(jobId: string): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: job, error } = await admin
    .from("contract_dispatch_jobs")
    .select("id, child_id, subject_enrollment_id")
    .eq("id", jobId)
    .single();
  if (error) throw new Error(error.message);
  await dispatchOneContractJob(admin, job);
}
