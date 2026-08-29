"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { inviteParent, inviteStudent } from "./users-actions";
import { createEnvelope } from "@/lib/docusign";
import { renderFamilyContractHtml } from "@/lib/contracts/family-contract-template";

export async function sendFamilyContract(params: {
  consultRequestId: string;
  studentName: string;
  studentEmail: string;
}): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: consult, error: consultError } = await admin
    .from("consult_requests")
    .select("person_name, email, student_grade")
    .eq("id", params.consultRequestId)
    .single();
  if (consultError) throw new Error(consultError.message);
  if (!consult) throw new Error("존재하지 않는 상담 신청입니다.");

  const parentId = await inviteParent({ name: consult.person_name, email: consult.email });
  const studentId = await inviteStudent({
    name: params.studentName,
    email: params.studentEmail,
    parentId,
    grade: consult.student_grade ?? "",
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) throw new Error("NEXT_PUBLIC_SITE_URL 환경변수가 설정되지 않았습니다.");
  const webhookToken = process.env.DOCUSIGN_WEBHOOK_TOKEN ?? "";
  const { envelopeId } = await createEnvelope({
    recipientEmail: consult.email,
    recipientName: consult.person_name,
    documentHtml: renderFamilyContractHtml({
      parentName: consult.person_name,
      studentName: params.studentName,
    }),
    emailSubject: "Alton Education 서비스 이용 계약서",
    webhookUrl: `${siteUrl}/api/webhooks/docusign?token=${webhookToken}`,
  });

  const { error: contractError } = await admin.from("contracts").insert({
    parent_id: parentId,
    student_id: studentId,
    docusign_envelope_id: envelopeId,
    status: "sent",
  });
  if (contractError) throw new Error(contractError.message);

  const { error: updateError } = await admin
    .from("consult_requests")
    .update({
      converted_student_id: studentId,
      converted_parent_id: parentId,
      status: "completed",
    })
    .eq("id", params.consultRequestId);
  if (updateError) throw new Error(updateError.message);
}
