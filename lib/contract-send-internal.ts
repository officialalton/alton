import type { SupabaseClient } from "@supabase/supabase-js";
import { createEnvelope, assertDocusignSandboxBaseUri } from "@/lib/docusign";
import {
  FAMILY_CONTRACT_TEMPLATE_VERSION,
  renderFamilyContractHtml,
  type CompanyApprovalForTemplate,
} from "@/lib/contracts/family-contract-template";
import { STUDENT_TERMS_VERSION } from "@/lib/legal";

// (2026-09-29 6단계: 호출부는 관리자 원클릭 발송과 계약 자동 발송 워커다.)
// companySignOffContractVersion
// / sendContractForSignature(app/admin/consultation-actions.ts)의 실제 DB
// 변경 로직만 이 파일로 옮긴다. 두 함수는 원래 requireAdmin()으로 게이트돼
// 있는데, "use server" 파일에서 그 게이트 통과 로직 없이 이 내부 함수를
// 직접 export하면(그리고 인자로 admin/service_role 클라이언트를 받으면)
// 클라이언트가 서버 액션으로 오인해 호출을 시도할 여지가 생긴다 — 이 파일은
// "use server"가 아닌 일반 서버 전용 모듈이라 클라이언트 번들에서 직접
// import/호출이 불가능하다. 관리자 원클릭 발송(요청자가 admin)과 계약 자동
// 발송 워커(service_role, 관리자 권한 게이트를 통과할 수 없음) 두 경로가 이
// 함수들을 공유한다 — 인가 판단은 항상 호출부
// (각각의 "use server" 액션)에서 먼저 끝내고, 이 파일은 이미 인가된 호출만
// 받는다는 전제로 순수 DB/외부 API 로직만 담당한다.

export async function companySignOffContractVersionInternal(
  admin: SupabaseClient,
  contractVersionId: string,
  actorUserId: string
): Promise<void> {
  const { error } = await admin
    .from("contract_versions")
    .update({ company_signed_at: new Date().toISOString(), company_signed_by: actorUserId })
    .eq("id", contractVersionId);
  if (error) throw new Error(error.message);
}

export async function sendContractForSignatureInternal(
  admin: SupabaseClient,
  params: {
    contractVersionId: string;
    recipientEmail: string;
    recipientName: string;
    childName: string;
    webhookUrl: string;
    companyApproval: CompanyApprovalForTemplate;
  }
): Promise<{ envelopeId: string }> {
  assertDocusignSandboxBaseUri();

  const { data: version, error: versionError } = await admin
    .from("contract_versions")
    .select("id, contract_id, company_signed_at, contracts:contract_id(child_id)")
    .eq("id", params.contractVersionId)
    .single();
  if (versionError) throw new Error(versionError.message);
  if (!version) throw new Error("존재하지 않는 계약 버전입니다.");
  if (!version.company_signed_at) {
    throw new Error("회사 승인이 완료되지 않은 계약 버전은 보호자에게 발송할 수 없습니다. companySignOffContractVersionInternal을 먼저 호출하세요.");
  }

  // 학생 생년월일은 계약서의 실제 기재 항목이다(프로필 원본). 없으면 렌더링 단계에서 막혀 발송되지 않는다.
  const contractRel = version.contracts as unknown as { child_id: string } | { child_id: string }[] | null;
  const childId = (Array.isArray(contractRel) ? contractRel[0] : contractRel)?.child_id;
  const { data: childProfile } = childId
    ? await admin.from("profiles").select("date_of_birth").eq("id", childId).maybeSingle()
    : { data: null };
  const studentDateOfBirth = (childProfile?.date_of_birth as string | null | undefined) ?? "";

  // 미완성(플레이스홀더·빈 칸·내부 검토 문구) 계약서는 여기서 throw되어 DocuSign 호출 전에 발송이 차단된다.
  const documentHtml = renderFamilyContractHtml({
    parentName: params.recipientName,
    signerEmail: params.recipientEmail,
    studentName: params.childName,
    studentDateOfBirth,
    contractId: params.contractVersionId,
    companyApproval: params.companyApproval,
  });

  const { envelopeId } = await createEnvelope({
    recipientEmail: params.recipientEmail,
    recipientName: params.recipientName,
    documentHtml,
    emailSubject: "Alton Education Services Agreement",
    webhookUrl: params.webhookUrl,
  });

  const { error } = await admin
    .from("contract_versions")
    .update({
      docusign_envelope_id: envelopeId,
      docusign_envelope_status: "sent",
      docusign_status_updated_at: new Date().toISOString(),
      // 서명 대상 문서의 실제 버전·당사자 스냅샷을 남긴다(완료본과 동일 문안을 사후 증명).
      template_version: FAMILY_CONTRACT_TEMPLATE_VERSION,
      privacy_policy_version: STUDENT_TERMS_VERSION,
      company_signing_entity: "registered_llc",
      guardian_snapshot: { name: params.recipientName, email: params.recipientEmail },
      student_snapshot: { name: params.childName, date_of_birth: studentDateOfBirth },
    })
    .eq("id", params.contractVersionId);
  if (error) throw new Error(error.message);

  const { error: contractStatusError } = await admin
    .from("contracts")
    .update({ status: "sent" })
    .eq("id", version.contract_id);
  if (contractStatusError) throw new Error(contractStatusError.message);

  const { error: supersedeError } = await admin
    .from("contract_versions")
    .update({ version_status: "superseded" })
    .eq("contract_id", version.contract_id)
    .eq("version_status", "active")
    .neq("id", params.contractVersionId);
  if (supersedeError) throw new Error(supersedeError.message);

  console.info(
    JSON.stringify({
      type: "docusign_envelope_sent",
      contractVersionId: params.contractVersionId,
      contractId: version.contract_id,
      envelopeId,
      at: new Date().toISOString(),
    })
  );

  return { envelopeId };
}
