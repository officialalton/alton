"use server";

import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";

// (2026-08-31 R2 Task 5) 계정 병합 — 중복 계정 정리 전용. 일반적인 서비스
// 중단(inactive)·장기 복귀와는 무관하다. 실제 소유권 재배정·감사 이력 보존·
// 동시 병합 방지는 전부 merge_accounts() DB 함수(SECURITY DEFINER)가 한
// 트랜잭션에서 처리한다 — 이 파일은 관리자 권한 확인 후 RPC를 호출하는
// 얇은 래퍼다.
export async function mergeAccounts(params: {
  survivorId: string;
  mergedId: string;
  reason: string;
}): Promise<void> {
  const { supabase } = await requireAdmin();
  if (!params.reason.trim()) {
    throw new Error("병합 사유를 입력해주세요.");
  }
  const { error } = await supabase.rpc("merge_accounts", {
    p_survivor_id: params.survivorId,
    p_merged_id: params.mergedId,
    p_reason: params.reason.trim(),
  });
  if (error) throw new Error(error.message);
}

// 병합 후 30일이 지난 원본 계정의 PII를 비가역적으로 스크럽한다(DB 함수가
// 자체적으로 30일 경과·병합 원본 여부·inactive 여부를 재확인한다). ALTON DB
// 쪽 PII 스크럽이 끝난 뒤에만 실제 Auth 계정(세션·복구정보 포함)을 삭제한다
// — auth.users는 GoTrue가 관리하므로 admin API를 거쳐야 한다.
export async function anonymizeMergedAccount(profileId: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("anonymize_merged_account", { p_profile_id: profileId });
  if (error) throw new Error(error.message);

  const admin = createAdminClient();
  const { error: deleteError } = await admin.auth.admin.deleteUser(profileId);
  if (deleteError && !deleteError.message.includes("not found") && !deleteError.message.includes("not_found")) {
    throw new Error(
      `PII 스크럽은 완료됐지만 Auth 계정 삭제에 실패했습니다(${deleteError.message}). 다시 시도해주세요(재실행해도 안전합니다).`
    );
  }
}

export type MergeCandidate = {
  id: string;
  name: string;
  role: string;
  status: string;
};

// 병합 후보 목록 화면용 — 이미 병합된(closed, account_merges에 있는) 계정은
// 제외하고 보여준다.
export async function listMergeCandidates(role: "student" | "teacher" | "parent"): Promise<MergeCandidate[]> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, role")
    .eq("role", role);
  if (error) throw new Error(error.message);

  const ids = (data ?? []).map((p) => p.id);
  if (ids.length === 0) return [];

  const { data: merged } = await supabase.from("account_merges").select("merged_id").in("merged_id", ids);
  const mergedIds = new Set((merged ?? []).map((m) => m.merged_id));

  const statusTable = role === "student" ? "students" : role === "teacher" ? "teachers" : "parents";
  const { data: statusRows } = await supabase.from(statusTable).select("id, status").in("id", ids);
  const statusById = new Map((statusRows ?? []).map((r) => [r.id, r.status as string]));

  return (data ?? [])
    .filter((p) => !mergedIds.has(p.id))
    .map((p) => ({ id: p.id, name: p.name, role: p.role, status: statusById.get(p.id) ?? "unknown" }));
}
