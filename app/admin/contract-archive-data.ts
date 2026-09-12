import type { SupabaseClient } from "@supabase/supabase-js";

// P4-3 2단계 — `문서 > 계약` 아카이브 리더.
//
// 이 파일은 **읽기만 한다**. 계약 발송·재발송·무효화는 `신규 > 정규 계약 발송`이
// 유일한 진입점이고, 여기서는 그 액션을 부르지도 import 하지도 않는다.
//
// 쿼리 예산: 목록은 2회 이하로 고정한다(행마다 조회하는 N+1 금지).
//   (1) contracts + 학생·보호자 임베디드 조인
//   (2) 이 페이지 계약 id 배열에 대한 contract_versions + drive_artifacts 배치

export type ContractArchiveRow = {
  contractId: string;
  studentName: string;
  guardianName: string;
  status: string;
  createdAt: string;
  /** 최신(active) 버전. 없으면 null — 아직 버전이 만들어지지 않은 계약이다. */
  latestVersionId: string | null;
  latestVersionNumber: number | null;
  envelopeStatus: string | null;
  envelopeStatusUpdatedAt: string | null;
  companySignedAt: string | null;
  /** 서명본 산출물. 목록·상세·다운로드가 모두 이 id를 가리킨다. */
  signedArtifactId: string | null;
  signedArtifactSyncStatus: string | null;
  /** 실제로 내려받을 수 있는 상태인지 — 보관 완료 + 파일 id 존재. */
  signedArtifactDownloadable: boolean;
};

export type ContractArchiveFilters = {
  status?: string;
  envelopeStatus?: string;
  artifactSyncStatus?: string;
  search?: string;
  limit?: number;
};

const DEFAULT_LIMIT = 50;

export async function loadContractArchive(
  supabase: SupabaseClient,
  filters: ContractArchiveFilters = {}
): Promise<ContractArchiveRow[]> {
  let query = supabase
    .from("contracts")
    .select(
      "id, status, created_at, child_id, household_id, " +
        "child:profiles!contracts_child_id_fkey(name), " +
        "household:households!contracts_household_id_fkey(primary_guardian:profiles!households_primary_guardian_id_fkey(name))"
    )
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? DEFAULT_LIMIT);

  if (filters.status) query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  // 임베디드 조인이 두 개라 Supabase 타입 추론이 행 모양을 잡지 못한다
  // (다른 로더들과 같은 처리 — 필요한 필드만 아래에서 하나씩 꺼내 쓴다).
  const contracts = (data ?? []) as unknown as Record<string, unknown>[];
  if (contracts.length === 0) return [];

  const contractIds = contracts.map((c) => c.id as string);

  // 최신 버전과 서명본을 한 번씩 배치로 읽는다.
  const [{ data: versions }, { data: artifacts }] = await Promise.all([
    supabase
      .from("contract_versions")
      .select(
        "id, contract_id, version_number, version_status, docusign_envelope_status, docusign_status_updated_at, company_signed_at"
      )
      .in("contract_id", contractIds)
      .order("version_number", { ascending: false }),
    supabase
      .from("drive_artifacts")
      .select("id, contract_id, artifact_type, sync_status, drive_file_id")
      .in("contract_id", contractIds)
      .eq("artifact_type", "signed_document"),
  ]);

  // version_number 내림차순으로 읽었으므로 계약별 첫 행이 최신이다. active 버전이
  // 있으면 그것을 우선한다(재발송으로 superseded가 섞일 수 있다).
  const latestByContract = new Map<string, Record<string, unknown>>();
  for (const v of versions ?? []) {
    const key = v.contract_id as string;
    const existing = latestByContract.get(key);
    if (!existing) {
      latestByContract.set(key, v);
      continue;
    }
    if (existing.version_status !== "active" && v.version_status === "active") {
      latestByContract.set(key, v);
    }
  }

  const artifactByContract = new Map<string, Record<string, unknown>>();
  for (const a of artifacts ?? []) {
    const key = a.contract_id as string;
    // 같은 계약에 서명본이 여러 개면 보관 완료된 것을 우선한다.
    const existing = artifactByContract.get(key);
    if (!existing || (existing.sync_status !== "succeeded" && a.sync_status === "succeeded")) {
      artifactByContract.set(key, a);
    }
  }

  function one<T>(rel: T | T[] | null | undefined): T | null {
    return Array.isArray(rel) ? (rel[0] ?? null) : (rel ?? null);
  }

  const rows = contracts.map((c): ContractArchiveRow => {
    const child = one(c.child as unknown) as { name?: string } | null;
    const household = one(c.household as unknown) as { primary_guardian?: unknown } | null;
    const guardian = one(household?.primary_guardian as unknown) as { name?: string } | null;
    const version = latestByContract.get(c.id as string);
    const artifact = artifactByContract.get(c.id as string);
    const syncStatus = (artifact?.sync_status as string | undefined) ?? null;

    return {
      contractId: c.id as string,
      studentName: child?.name ?? "",
      guardianName: guardian?.name ?? "",
      status: c.status as string,
      createdAt: c.created_at as string,
      latestVersionId: (version?.id as string | undefined) ?? null,
      latestVersionNumber: (version?.version_number as number | undefined) ?? null,
      envelopeStatus: (version?.docusign_envelope_status as string | undefined) ?? null,
      envelopeStatusUpdatedAt: (version?.docusign_status_updated_at as string | undefined) ?? null,
      companySignedAt: (version?.company_signed_at as string | undefined) ?? null,
      signedArtifactId: (artifact?.id as string | undefined) ?? null,
      signedArtifactSyncStatus: syncStatus,
      signedArtifactDownloadable: syncStatus === "succeeded" && Boolean(artifact?.drive_file_id),
    };
  });

  // 나머지 필터는 배치로 읽은 결과에 적용한다 — 별도 쿼리를 더하지 않는다.
  return rows.filter((row) => {
    if (filters.envelopeStatus && row.envelopeStatus !== filters.envelopeStatus) return false;
    if (filters.artifactSyncStatus && row.signedArtifactSyncStatus !== filters.artifactSyncStatus) {
      return false;
    }
    if (filters.search) {
      const needle = filters.search.trim().toLowerCase();
      if (!needle) return true;
      const hay = `${row.studentName} ${row.guardianName} ${row.contractId}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}
