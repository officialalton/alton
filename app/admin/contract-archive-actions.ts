"use server";

import { requireAdmin } from "@/lib/admin-auth";
import {
  loadContractArchive,
  type ContractArchiveRow,
  type ContractArchiveFilters,
} from "./contract-archive-data";

// P4-3 2단계 — `문서 > 계약` 조회 액션.
//
// 권한은 **현행 관리자 권한을 그대로 유지**한다(2026-09-12 제품 오너 확정).
// 설계 §3.2가 남긴 열린 항목 — `contracts` select 정책에는
// `manage_consultations`가 없어서, role='admin'이 아닌 운영자는
// contract_versions는 보이는데 contracts는 안 보이는 비대칭이 있다 — 은
// 이번에 넓히지 않고 후속 항목으로 남긴다.
//
// 이 파일은 조회만 한다. 발송·재발송·무효화 액션을 import 하지 않는다.
export async function listContractArchiveAction(
  filters: ContractArchiveFilters = {}
): Promise<ContractArchiveRow[]> {
  const { supabase } = await requireAdmin();
  return loadContractArchive(supabase, filters);
}
