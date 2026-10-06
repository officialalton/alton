"use server";

import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  dispatchOneContractJob,
  isContractAutoDispatchEnabled,
  processContractDispatchQueue,
  type ContractDispatchJobRow,
  type DispatchOneResult,
} from "@/lib/contract-dispatch/dispatcher";
import { selectInChunks } from "@/lib/select-in-chunks";

// 2026-09-28 — 초기 고객 절차 단순화 4단계: 관리자 화면용 outbox 조회·실행 액션.
// 실제 DocuSign 발송은 관리자 설정(contract_dispatch_settings, 기본 ON)이 켜져 있고
// 환경변수 CONTRACT_AUTO_DISPATCH_ENABLED가 "false"(비상 정지)가 아닐 때만 일어난다.

export type ContractDispatchJobListItem = ContractDispatchJobRow & {
  childName: string | null;
};

export type ContractDispatchSettingInfo = {
  enabled: boolean;
  updatedAt: string | null;
  updatedByName: string | null;
};

export async function listContractDispatchJobs(): Promise<{
  autoDispatchEnabled: boolean;
  envHardStop: boolean;
  setting: ContractDispatchSettingInfo;
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

  const { data: st } = await admin
    .from("contract_dispatch_settings")
    .select("auto_dispatch_enabled, updated_at, updated_by")
    .eq("id", true)
    .maybeSingle();
  let updatedByName: string | null = null;
  if (st?.updated_by) {
    const { data: who } = await admin.from("profiles").select("name").eq("id", st.updated_by).maybeSingle();
    updatedByName = who?.name ?? null;
  }
  const setting: ContractDispatchSettingInfo = {
    enabled: st?.auto_dispatch_enabled === true,
    updatedAt: st?.updated_by ? st.updated_at : null,
    updatedByName,
  };

  return {
    autoDispatchEnabled: await isContractAutoDispatchEnabled(admin),
    envHardStop: process.env.CONTRACT_AUTO_DISPATCH_ENABLED === "false",
    setting,
    jobs: rows.map((r) => ({ ...r, childName: childNameById.get(r.child_id) ?? null })),
  };
}

/** 자동 발송 켜기/끄기 — 관리자만(RPC가 is_admin 검사 + 감사 기록). */
export async function setContractAutoDispatchEnabledAction(enabled: boolean): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("set_contract_auto_dispatch_enabled", { p_enabled: enabled });
  if (error) throw new Error(error.message);
}

/** 큐에 쌓인 작업을 일괄 처리한다(비활성 상태면 아무것도 안 하고 그 사실만 반환). */
export async function runContractDispatchQueueAction(): Promise<{ enabled: boolean; processed: number; sent: number; failed: number }> {
  await requireAdmin();
  const admin = createAdminClient();
  return processContractDispatchQueue(admin);
}

/** 실패한 작업 하나를 다시 시도한다. */
// 2026-09-29(D7) — 결과를 돌려줘 화면이 "무엇이 일어났는지"(특히 게이트 OFF 로 아무 것도 안 한 경우)를 알린다.
export async function retryContractDispatchJobAction(jobId: string): Promise<DispatchOneResult> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: job, error } = await admin
    .from("contract_dispatch_jobs")
    .select("id, child_id, subject_enrollment_id")
    .eq("id", jobId)
    .single();
  if (error) throw new Error(error.message);
  return dispatchOneContractJob(admin, job);
}
