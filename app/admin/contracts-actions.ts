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
  // envelopeId는 아직 v3 contracts 테이블에 기록할 곳이 없다(위 TODO 참고) — 발송 자체는
  // 그대로 수행하고 반환값은 현재 사용하지 않는다.
  await createEnvelope({
    recipientEmail: consult.email,
    recipientName: consult.person_name,
    documentHtml: renderFamilyContractHtml({
      parentName: consult.person_name,
      studentName: params.studentName,
    }),
    emailSubject: "Alton Education 서비스 이용 계약서",
    webhookUrl: `${siteUrl}/api/webhooks/docusign?token=${webhookToken}`,
  });

  // TODO(R3 후속): R3 cutover로 `contracts`는 이제 v3 스키마(household_id/child_id/
  // status/created_at/updated_at)를 쓴다. docusign_envelope_id 컬럼은 아직 이 테이블에
  // 없다(다음 R3 스키마 마이그레이션에서 DocuSign/컨설팅 관련 컬럼을 추가할 예정 —
  // master-roadmap-v3.md R3 참고). 또한 R2 Task 4부터 inviteParent/inviteStudent는
  // 즉시 profile을 만들지 않고 account_invites만 생성하므로(household도 초대 수락
  // 시에야 확정), 여기서 반환되는 parentId/studentId는 실제 profiles(id)/households(id)가
  // 아니라 invite_id다 — 지금 이 시점에는 v3 contracts 행이 참조할 실제
  // household_id/child_id를 알 수 없다. 잘못된 값으로 FK 제약을 위반하는 행을 만드는
  // 대신, 초대 수락 플로우와 통합해 v3 contracts 행을 만드는 작업은 별도 R3 후속
  // 작업으로 남겨둔다 — 지금은 DocuSign 발송/상담 전환만 수행하고 contracts insert는
  // 생략한다.

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
