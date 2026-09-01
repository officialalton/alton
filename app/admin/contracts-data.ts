import type { SupabaseClient } from "@supabase/supabase-js";

export type PendingConsult = {
  id: string;
  personName: string;
  email: string;
  studentGrade: string | null;
  submittedAt: string;
};

export type ContractVersionItem = {
  id: string;
  versionNumber: number;
  versionStatus: string | null;
  companySignedAt: string | null;
  docusignEnvelopeId: string | null;
  docusignEnvelopeStatus: string | null;
  docusignStatusUpdatedAt: string | null;
  proposalId: string | null;
  createdAt: string;
};

export type DriveArtifactItem = {
  id: string;
  artifactType: string;
  syncStatus: string;
  driveFileId: string | null;
  uploadedAt: string | null;
};

export type FamilyContract = {
  id: string;
  householdId: string;
  childId: string;
  parentName: string;
  studentName: string;
  // R3 cutover: `contracts`는 이제 v3_contract_status enum(draft/ready/sent/
  // awaiting_signature/signed/active/termination_pending/terminated/void/superseded/
  // expired)을 쓴다 — 레거시 스키마의 "sent"|"signed" 두 값보다 범위가 넓어져 string으로
  // 완화했다. UI는 당분간 signed 계열만 "서명완료"로, 나머지는 "발송됨"으로 단순 표시한다.
  status: string;
  voidReason: string | null;
  voidedAt: string | null;
  signedAt: string | null;
  versions: ContractVersionItem[];
  driveArtifacts: DriveArtifactItem[];
};

export type AcceptedProposalForContract = {
  proposalId: string;
  consultationId: string;
  householdId: string | null;
  childId: string | null;
  contactName: string;
};

export async function loadPendingConsults(supabase: SupabaseClient): Promise<PendingConsult[]> {
  const { data } = await supabase
    .from("consult_requests")
    .select("id, person_name, email, student_grade, submitted_at")
    .is("converted_student_id", null)
    .order("submitted_at", { ascending: true });

  return (data ?? []).map((c) => ({
    id: c.id,
    personName: c.person_name,
    email: c.email,
    studentGrade: c.student_grade,
    submittedAt: c.submitted_at,
  }));
}

// R3 cutover: 레거시 contracts(parent_id/student_id 직접 참조)는 legacy_contracts로
// 이름이 바뀌었다. 새 `contracts`(구 contracts_v3)는 household_id/child_id 기반이라
// 학부모 이름은 household_members를 거쳐 조회해야 한다.
export async function loadFamilyContracts(supabase: SupabaseClient): Promise<FamilyContract[]> {
  const { data: contracts } = await supabase
    .from("contracts")
    .select("id, household_id, child_id, status, void_reason, voided_at, created_at")
    .order("created_at", { ascending: false });
  if (!contracts || contracts.length === 0) return [];

  const householdIds = Array.from(new Set(contracts.map((c) => c.household_id)));
  const childIds = Array.from(new Set(contracts.map((c) => c.child_id)));
  const contractIds = contracts.map((c) => c.id);

  const [{ data: guardianMembers }, { data: versions }, { data: driveArtifacts }] = await Promise.all([
    supabase
      .from("household_members")
      .select("household_id, profile_id, is_primary")
      .in("household_id", householdIds)
      .eq("role", "guardian"),
    supabase
      .from("contract_versions")
      .select(
        "id, contract_id, version_number, version_status, company_signed_at, docusign_envelope_id, docusign_envelope_status, docusign_status_updated_at, proposal_id, created_at"
      )
      .in("contract_id", contractIds)
      .order("version_number", { ascending: true }),
    supabase
      .from("drive_artifacts")
      .select("id, contract_id, artifact_type, sync_status, drive_file_id, uploaded_at")
      .in("contract_id", contractIds),
  ]);

  const profileIds = Array.from(
    new Set([...(guardianMembers ?? []).map((m) => m.profile_id), ...childIds])
  );
  const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", profileIds);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));

  // household당 대표 보호자 1명(is_primary 우선, 없으면 첫 guardian)만 부모 이름으로 쓴다.
  const primaryGuardianByHousehold = new Map<string, string>();
  for (const m of guardianMembers ?? []) {
    const existing = primaryGuardianByHousehold.get(m.household_id);
    if (!existing || m.is_primary) {
      primaryGuardianByHousehold.set(m.household_id, m.profile_id);
    }
  }

  const versionsByContract = new Map<string, ContractVersionItem[]>();
  for (const v of versions ?? []) {
    const list = versionsByContract.get(v.contract_id) ?? [];
    list.push({
      id: v.id,
      versionNumber: v.version_number,
      versionStatus: v.version_status ?? null,
      companySignedAt: v.company_signed_at,
      docusignEnvelopeId: v.docusign_envelope_id,
      docusignEnvelopeStatus: v.docusign_envelope_status,
      docusignStatusUpdatedAt: v.docusign_status_updated_at,
      proposalId: v.proposal_id,
      createdAt: v.created_at,
    });
    versionsByContract.set(v.contract_id, list);
  }

  const artifactsByContract = new Map<string, DriveArtifactItem[]>();
  for (const a of driveArtifacts ?? []) {
    const list = artifactsByContract.get(a.contract_id) ?? [];
    list.push({
      id: a.id,
      artifactType: a.artifact_type,
      syncStatus: a.sync_status,
      driveFileId: a.drive_file_id,
      uploadedAt: a.uploaded_at,
    });
    artifactsByContract.set(a.contract_id, list);
  }

  return contracts.map((c) => {
    const versionsForContract = versionsByContract.get(c.id) ?? [];
    const signedVersion = versionsForContract.find((v) => v.docusignEnvelopeStatus === "completed");
    return {
      id: c.id,
      householdId: c.household_id,
      childId: c.child_id,
      parentName: nameById.get(primaryGuardianByHousehold.get(c.household_id) ?? "") ?? "알 수 없음",
      studentName: nameById.get(c.child_id) ?? "알 수 없음",
      status: c.status,
      voidReason: c.void_reason ?? null,
      voidedAt: c.voided_at ?? null,
      signedAt: signedVersion?.docusignStatusUpdatedAt ?? null,
      versions: versionsForContract,
      driveArtifacts: artifactsByContract.get(c.id) ?? [],
    };
  });
}

/** 계약이 아직 없는, 수락(accepted)된 제안서 — 새 계약 생성 후보. */
export async function loadAcceptedProposalsForContract(
  supabase: SupabaseClient
): Promise<AcceptedProposalForContract[]> {
  const { data: proposals } = await supabase
    .from("proposals")
    .select("id, consultation_id, status")
    .eq("status", "accepted");
  if (!proposals || proposals.length === 0) return [];

  const { data: contractVersions } = await supabase
    .from("contract_versions")
    .select("proposal_id")
    .in(
      "proposal_id",
      proposals.map((p) => p.id)
    );
  const alreadyContracted = new Set((contractVersions ?? []).map((v) => v.proposal_id));

  const remaining = proposals.filter((p) => !alreadyContracted.has(p.id));
  if (remaining.length === 0) return [];

  const { data: consultations } = await supabase
    .from("consultations")
    .select("id, household_id, child_id, contact_name")
    .in(
      "id",
      remaining.map((p) => p.consultation_id)
    );
  const consultationById = new Map((consultations ?? []).map((c) => [c.id, c]));

  return remaining.map((p) => {
    const consultation = consultationById.get(p.consultation_id);
    return {
      proposalId: p.id,
      consultationId: p.consultation_id,
      householdId: consultation?.household_id ?? null,
      childId: consultation?.child_id ?? null,
      contactName: consultation?.contact_name ?? "알 수 없음",
    };
  });
}
