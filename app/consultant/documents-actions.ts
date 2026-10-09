"use server";

// Phase B(2, 2026-09-23) — Documents 탭. app/admin/contract-archive-data.ts의
// loadContractArchive()를 그대로 재사용한다(게이트 없는 순수 조회 함수 —
// 오늘 세션에서 두 번 발견한 "공유 함수에 다른 역할 게이트가 박혀 있는" 버그
// 클래스를 피하려고, 여기서는 본인 세션 클라이언트로 호출해 RLS(담당 컨설턴트
// 조회 정책, 마이그레이션 20261560000000)가 범위를 막게 한다 — 서비스 롤 우회
// 없음, 다른 컨설턴트 담당 건은 자동으로 안 보인다).
import { requireConsultant } from "@/lib/admin-auth";
import { loadContractArchive, type ContractArchiveRow, type ContractArchiveFilters } from "@/app/admin/contract-archive-data";

export async function listMyContractDocumentsAction(
  filters: ContractArchiveFilters = {}
): Promise<ContractArchiveRow[]> {
  const { supabase } = await requireConsultant();
  return loadContractArchive(supabase, filters);
}
