import type { SupabaseClient } from "@supabase/supabase-js";
import { companySignOffContractVersionInternal, sendContractForSignatureInternal } from "@/lib/contract-send-internal";
import { recordOrGetCompanyApproval } from "@/lib/contract-company-approval";
import { currentRequestOrigin } from "@/lib/request-origin";
import { appendVercelProtectionBypass } from "@/lib/vercel-protection-bypass";

// 2026-09-06(제품 오너 정책 변경 — 정규 진행 희망 확인 시 자동 계약 발송)
// app/admin/trial-onboarding-actions.ts의 sendRegularContractOneClickAction(9번)
// 핵심 로직을 이 파일로 옮긴다. 승인자 직함이 "CEO, Do Kyung Kim" 하나로
// 고정된 뒤로는 관리자가 매번 수동으로 버튼을 누를 필요가 없어졌다 — 보호자가
// "정규 진행 희망"을 확인하는 서버 액션(app/parent/trial-conversion-actions.ts)
// 안에서도 이 함수를 그대로 재사용해 자동으로 계약을 발송한다. 관리자 원클릭
// 발송(요청자가 admin, requireAdminOrCapability 통과)과 보호자 확인 시 자동
// 발송(요청자가 guardian, 관리자 권한 자체가 없음) 두 경로 모두 여기로 들어올
// 때는 이미 각자의 "use server" 액션에서 인가를 끝낸 뒤다 — 이 함수는 인가를
// 다시 검사하지 않고, 전달받은 admin(service_role) 클라이언트로 계약 발송
// DB/외부 API 로직만 수행한다.
export type SendRegularContractResult =
  | { status: "already_sent"; contractVersionId: string; envelopeId: string }
  | { status: "sent"; contractVersionId: string; envelopeId: string }
  | { status: "failed"; contractVersionId: string; error: string };

export async function sendRegularContractForSubjectEnrollment(
  admin: SupabaseClient,
  params: {
    childId: string;
    subjectEnrollmentId: string;
    guardianEmail: string;
    guardianName: string;
    childName: string;
    // 회사 승인 감사 행(contract_company_approvals)에 남는 승인자 표시 —
    // 두 경로 모두 현재는 "CEO, Do Kyung Kim" 고정값을 넘긴다.
    approverName: string;
    approverTitle: string;
    // 승인 행의 approved_by(auth.users FK)에 남길 행위자. 관리자 원클릭
    // 경로는 실제 클릭한 관리자 id, 자동 발송 경로는 확인한 보호자 id를
    // 넘긴다 — 감사 로그상 "누가 이 발송을 트리거했는지"를 남기기 위함이며
    // approverName/approverTitle에 적힌 승인자 이름/직함 자체와는 별개다.
    triggeredByUserId: string;
  }
): Promise<SendRegularContractResult> {
  const { data: contractId, error: contractError } = await admin.rpc("get_or_create_draft_contract_for_child", {
    p_child_id: params.childId,
  });
  if (contractError) throw new Error(contractError.message);

  // ① 기존 계약/진행중 envelope 대조.
  const { data: existingVersions, error: versionsError } = await admin
    .from("contract_versions")
    .select("id, docusign_envelope_id, docusign_envelope_status, company_signed_at")
    .eq("contract_id", contractId as string)
    .eq("version_status", "active")
    .order("version_number", { ascending: false })
    .limit(1);
  if (versionsError) throw new Error(versionsError.message);
  const existing = existingVersions?.[0];

  if (existing?.docusign_envelope_id) {
    // 이미 발송된 상태 — 중복 클릭/재시도(자동 발송 이후 관리자가 수동 버튼을
    // 눌러도 포함)로 새 envelope를 만들지 않는다. 멱등성의 핵심.
    return { status: "already_sent", contractVersionId: existing.id, envelopeId: existing.docusign_envelope_id };
  }

  // ② 필요한 계약 버전 생성(없으면). proposal_id 없이 만든다(정상 흐름에서
  // proposals 불필요).
  let contractVersionId: string;
  if (existing) {
    contractVersionId = existing.id;
  } else {
    const { data: created, error: createError } = await admin
      .from("contract_versions")
      .insert({ contract_id: contractId as string, version_number: 1, price_policy_snapshot: {} })
      .select("id")
      .single();
    if (createError) throw new Error(createError.message);
    contractVersionId = created.id;
  }

  // ③ 회사 전자승인(이미 승인됐으면 재승인하지 않는다 — 재처리 시 멱등).
  if (!existing?.company_signed_at) {
    await companySignOffContractVersionInternal(admin, contractVersionId, params.triggeredByUserId);
  }
  const companyApproval = await recordOrGetCompanyApproval(admin, {
    contractVersionId,
    approvedByUserId: params.triggeredByUserId,
    approverName: params.approverName,
    approverTitle: params.approverTitle,
  });

  // ④·⑤ 회사 전자승인이 삽입된 문서로 DocuSign 발송 + 상태·외부 ID 저장.
  const siteUrl = await currentRequestOrigin();
  try {
    const { envelopeId } = await sendContractForSignatureInternal(admin, {
      contractVersionId,
      recipientEmail: params.guardianEmail,
      recipientName: params.guardianName,
      childName: params.childName,
      webhookUrl: appendVercelProtectionBypass(`${siteUrl}/api/webhooks/docusign`),
      companyApproval,
    });
    return { status: "sent", contractVersionId, envelopeId };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { status: "failed", contractVersionId, error: message };
  }
}
