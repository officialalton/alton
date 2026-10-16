"use server";

import { requireMasterAdmin } from "@/lib/admin-auth";
import { loadAdminAccounts, type AdminAccount } from "./admin-accounts-data";
import { ADMIN_CAPABILITIES } from "@/lib/admin-capabilities";

// 2026-09-22(관리자 계정 구조) — 마스터(official@alton.education)가 다른
// 관리자의 등급(전체/중간)·capability를 셋업하는 서버 액션. 전부
// requireMasterAdmin()으로 막고, DB 쪽도 set_admin_tier()/supervisor_capabilities
// RLS가 마스터만 허용하도록 이미 막혀 있다(이중 방어).
export async function listAdminAccountsAction(): Promise<AdminAccount[]> {
  const { supabase } = await requireMasterAdmin();
  return loadAdminAccounts(supabase);
}

export async function setAdminTierAction(profileId: string, tier: "full" | "supervisor"): Promise<void> {
  const { supabase } = await requireMasterAdmin();
  const { error } = await supabase.rpc("set_admin_tier", { p_profile_id: profileId, p_tier: tier });
  if (error) throw new Error(error.message);
}

/** capability 전체 집합을 통째로 교체한다(선택된 것만 남기고 나머지는 회수). */
export async function setAdminCapabilitiesAction(profileId: string, capabilities: string[]): Promise<void> {
  const { supabase, adminUserId } = await requireMasterAdmin();
  const validKeys = new Set<string>(ADMIN_CAPABILITIES.map((c) => c.key));
  const clean = [...new Set(capabilities)].filter((c) => validKeys.has(c));

  const { error: deleteError } = await supabase
    .from("supervisor_capabilities")
    .delete()
    .eq("profile_id", profileId);
  if (deleteError) throw new Error(deleteError.message);

  if (clean.length === 0) return;
  const { error: insertError } = await supabase.from("supervisor_capabilities").insert(
    clean.map((capability: string) => ({ profile_id: profileId, capability, granted_by: adminUserId }))
  );
  if (insertError) throw new Error(insertError.message);
}
