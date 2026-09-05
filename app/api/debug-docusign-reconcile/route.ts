import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { getEnvelopeStatus } from "@/lib/docusign";
import { queueDriveArtifactSync } from "@/lib/drive-artifacts";

// 임시 진단·복구 라우트 — 이 envelope는 DocuSign 완료 웹훅 등록 URL이 (수정 전)
// Vercel Deployment Protection에 막혀 한 번도 우리 웹훅에 도달하지 못한 채
// 실제로는 완료됐다. DocuSign에 직접 진짜 상태를 물어(getEnvelopeStatus) 그
// 결과로만 웹훅과 동일한 완료 처리를 1회 재현한다 — 상태를 임의로 지어내지
// 않는다. 사용 후 즉시 삭제한다.
export async function POST(request: Request) {
  const { envelopeId } = (await request.json()) as { envelopeId: string };
  if (!envelopeId) return NextResponse.json({ error: "envelopeId required" }, { status: 400 });

  const real = await getEnvelopeStatus(envelopeId);
  if (real.status !== "completed") {
    return NextResponse.json({ skipped: `real status is ${real.status}, not completed` });
  }

  const admin = createAdminClient();
  const { data: contractVersion, error: cvError } = await admin
    .from("contract_versions")
    .select("id, contract_id, docusign_envelope_status")
    .eq("docusign_envelope_id", envelopeId)
    .maybeSingle();
  if (cvError) return NextResponse.json({ error: cvError.message }, { status: 500 });
  if (!contractVersion) return NextResponse.json({ error: "no contract_version for envelopeId" }, { status: 404 });

  if (contractVersion.docusign_envelope_status === "completed") {
    return NextResponse.json({ skipped: "already completed in DB" });
  }

  const nowIso = new Date().toISOString();
  const { error: updateError } = await admin
    .from("contract_versions")
    .update({ docusign_envelope_status: "completed", docusign_status_updated_at: nowIso })
    .eq("id", contractVersion.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const { error: activateError } = await admin
    .from("contracts")
    .update({ status: "active" })
    .eq("id", contractVersion.contract_id);

  await queueDriveArtifactSync({ contractId: contractVersion.contract_id, envelopeId });

  return NextResponse.json({
    ok: true,
    contractId: contractVersion.contract_id,
    activateError: activateError?.message ?? null,
  });
}
