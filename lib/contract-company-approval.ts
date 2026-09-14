import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompanyApprovalForTemplate } from "@/lib/contracts/family-contract-template";

// 회사 측 계약 처리 방식 확정(사용자 지시, 2026-09-05): DocuSign 전자서명이
// 아니라 "인증된 관리자의 전자승인 기록을 계약서에 삽입한 뒤 발송"한다.
// contract_company_approvals는 변경 불가능한 감사 이력이다(마이그레이션의
// reject_*_mutation 트리거로 UPDATE/DELETE를 DB 레벨에서 차단) — 발송되는
// 문서에 그대로 인쇄되는 값이 실제 저장된 값과 항상 일치해야 하기 때문이다.
export const COMPANY_ENTITY_NAME = "Alton Education Inc.";

type CompanyApprovalRow = {
  contract_version_id: string;
  approved_by: string;
  approver_name: string;
  approver_title: string | null;
  company_entity_name: string;
  document_identifier: string;
  approved_at: string;
};

/**
 * 이 계약 버전에 대한 회사 전자승인 감사 행을 가져오거나(이미 있으면 그대로
 * 재사용 — 중복 클릭·재시도 시 두 번 기록되지 않는다), 없으면 새로 만든다.
 * 반환값을 그대로 계약서 렌더링에 사용해야 문서와 DB 값이 항상 일치한다.
 */
export async function recordOrGetCompanyApproval(
  admin: SupabaseClient,
  params: {
    contractVersionId: string;
    approvedByUserId: string;
    approverName: string;
    approverTitle: string | null;
  }
): Promise<CompanyApprovalForTemplate> {
  const { data: existing, error: existingError } = await admin
    .from("contract_company_approvals")
    .select("*")
    .eq("contract_version_id", params.contractVersionId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  const row: CompanyApprovalRow | null = existing;
  if (row) return toTemplateFields(row);

  const { data: inserted, error: insertError } = await admin
    .from("contract_company_approvals")
    .insert({
      contract_version_id: params.contractVersionId,
      approved_by: params.approvedByUserId,
      approver_name: params.approverName,
      approver_title: params.approverTitle,
      company_entity_name: COMPANY_ENTITY_NAME,
      document_identifier: params.contractVersionId,
    })
    .select("*")
    .single();
  if (insertError) throw new Error(insertError.message);

  return toTemplateFields(inserted as CompanyApprovalRow);
}

function toTemplateFields(row: CompanyApprovalRow): CompanyApprovalForTemplate {
  return {
    companyEntityName: row.company_entity_name,
    approverName: row.approver_name,
    approverTitle: row.approver_title,
    approvedAtLabel: new Date(row.approved_at).toLocaleString("ko-KR", { timeZoneName: "short" }),
    documentIdentifier: row.document_identifier,
  };
}
