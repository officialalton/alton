"use server";

import { requireAdminOrCapability } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";

const CAPABILITY = "manage_account_merges";

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
  const { supabase } = await requireAdminOrCapability(CAPABILITY);
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
  const { supabase } = await requireAdminOrCapability(CAPABILITY);
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

export type TeacherRateHistoryEntry = {
  sourceTeacherId: string;
  amountMinor: number;
  currency: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  createdBy: string | null;
  createdAt: string;
};

// (2026-08-31, 사용자 확정) teacher_rate_history.teacher_id는 병합 시
// 재배정하지 않는다(과거 사실 보존) — 그래서 생존 계정 기준으로 정산·감사
// 화면이 전체 이력을 보려면 account_merges를 따라간 결합 조회가 필요하다.
// DB 함수(teacher_rate_history_with_merged)가 관리자/본인만 조회 가능하도록
// 이미 내부에서 검사한다. 합치거나 덮어쓰지 않고 각 행의 원래 teacher_id를
// source_teacher_id로 그대로 보존해 반환한다.
export async function getTeacherRateHistoryWithMerged(
  teacherId: string
): Promise<TeacherRateHistoryEntry[]> {
  const { supabase } = await requireAdminOrCapability(CAPABILITY);
  const { data, error } = await supabase.rpc("teacher_rate_history_with_merged", {
    p_teacher_id: teacherId,
  });
  if (error) throw new Error(error.message);

  type RateHistoryRow = {
    source_teacher_id: string;
    amount_minor: number;
    currency: string;
    effective_from: string;
    effective_until: string | null;
    created_by: string | null;
    created_at: string;
  };

  return ((data ?? []) as RateHistoryRow[]).map((row) => ({
    sourceTeacherId: row.source_teacher_id,
    amountMinor: row.amount_minor,
    currency: row.currency,
    effectiveFrom: row.effective_from,
    effectiveUntil: row.effective_until,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }));
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
  const { supabase } = await requireAdminOrCapability(CAPABILITY);
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

export type PendingAnonymization = {
  mergedId: string;
  mergedName: string | null;
  survivorId: string;
  survivorName: string | null;
  mergedAt: string;
  reason: string | null;
  eligibleNow: boolean;
};

// Section 2(2026-09-24) — anonymize_merged_account()는 이미 구현돼 있었지만
// 관리자가 "누가 30일 유예를 지났는지" 확인할 화면이 없었다(서버 액션만
// 존재, page.tsx 어디서도 안 부름). account_merges를 직접 조회해 목록을
// 만든다 — 실제 익명화 실행 여부는 DB 함수가 재확인하므로 여기 eligibleNow는
// UI 안내용일 뿐 최종 검사가 아니다.
export async function listPendingAnonymizations(): Promise<PendingAnonymization[]> {
  const { supabase } = await requireAdminOrCapability(CAPABILITY);
  const { data, error } = await supabase
    .from("account_merges")
    .select(
      "merged_id, survivor_id, merged_at, reason, anonymized_at, merged:profiles!account_merges_merged_id_fkey(name), survivor:profiles!account_merges_survivor_id_fkey(name)"
    )
    .is("anonymized_at", null)
    .order("merged_at", { ascending: true });
  if (error) throw new Error(error.message);

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return (data ?? []).map((row) => {
    const mergedRel = row.merged as { name: string | null } | { name: string | null }[] | null;
    const survivorRel = row.survivor as { name: string | null } | { name: string | null }[] | null;
    const merged = Array.isArray(mergedRel) ? mergedRel[0] : mergedRel;
    const survivor = Array.isArray(survivorRel) ? survivorRel[0] : survivorRel;
    return {
      mergedId: row.merged_id,
      mergedName: merged?.name ?? null,
      survivorId: row.survivor_id,
      survivorName: survivor?.name ?? null,
      mergedAt: row.merged_at,
      reason: row.reason,
      eligibleNow: new Date(row.merged_at).getTime() <= thirtyDaysAgo,
    };
  });
}

export type MergeSearchResult = { id: string; name: string | null; role: string; email: string | null } | null;

// 병합 화면의 "계정 찾기" — 이메일 정확 일치로 검색한다(find_profile_id_by_email
// RPC, is_admin() 내부 검사 있음 — 1차 보안감사 확인 완료).
export async function findAccountForMergeByEmail(email: string): Promise<MergeSearchResult> {
  const { supabase } = await requireAdminOrCapability(CAPABILITY);
  const trimmed = email.trim();
  if (!trimmed) return null;
  const { data: profileId, error } = await supabase.rpc("find_profile_id_by_email", { p_email: trimmed });
  if (error) throw new Error(error.message);
  if (!profileId) return null;

  const { data: profile } = await supabase.from("profiles").select("id, name, role").eq("id", profileId).single();
  if (!profile) return null;

  return { id: profile.id, name: profile.name, role: profile.role, email: trimmed.toLowerCase() };
}
