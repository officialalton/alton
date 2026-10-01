import { NextResponse } from "next/server";
import { requireConsultant } from "@/lib/admin-auth";
import { driveFetch, getDriveTokenForCurrentEnv, DRIVE_API } from "@/lib/drive/fetch";
import { recordDocumentAccess } from "@/lib/document-access-audit";

// Phase B(2, 2026-09-23) — 컨설턴트용 계약 서명본 다운로드.
// app/api/admin/contract-artifacts/[id]/route.ts와 동일한 서버 경유 원칙
// (Drive 바이트를 서버가 받아 흘려보낸다, 권한은 요청마다 재확인)을 그대로
// 따르되, 게이트를 requireConsultant()로 바꾼다. RLS(20261560000000 "담당
// 컨설턴트 조회")가 본인 담당 학생의 계약만 보이게 이미 막아 준다 — 여기서
// 다른 컨설턴트 담당 건 id를 넣어도 artifact 조회 자체가 빈 결과로 온다.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: artifactId } = await params;

  let consultantUserId: string;
  let supabase: Awaited<ReturnType<typeof requireConsultant>>["supabase"];
  try {
    const auth = await requireConsultant();
    consultantUserId = auth.user.id;
    supabase = auth.supabase;
  } catch {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { data: artifact } = await supabase
    .from("drive_artifacts")
    .select("id, contract_id, artifact_type, sync_status, drive_file_id")
    .eq("id", artifactId)
    .maybeSingle();

  if (!artifact) {
    return NextResponse.json({ reason: "not_found" }, { status: 404 });
  }

  if (artifact.sync_status !== "succeeded" || !artifact.drive_file_id) {
    console.warn(
      JSON.stringify({
        event: "consultant_contract_artifact_download_blocked",
        reason: "not_stored",
        artifactId,
        syncStatus: artifact.sync_status,
        hasFileId: Boolean(artifact.drive_file_id),
      })
    );
    return NextResponse.json({ reason: "not_stored" }, { status: 409 });
  }

  const { data: contract } = await supabase
    .from("contracts")
    .select("child_id")
    .eq("id", artifact.contract_id as string)
    .maybeSingle();
  const subjectId = (contract?.child_id as string | undefined) ?? null;

  const auditBase = {
    actorId: consultantUserId,
    targetKind: "contract_artifact" as const,
    targetId: artifactId,
    subjectId,
    detail: { artifactType: artifact.artifact_type, contractId: artifact.contract_id },
  };

  await recordDocumentAccess({ ...auditBase, action: "download_requested" });

  try {
    const token = await getDriveTokenForCurrentEnv();
    const res = await driveFetch(
      `${DRIVE_API}/files/${artifact.drive_file_id}?alt=media&supportsAllDrives=true`,
      token
    );
    const body = await res.arrayBuffer();

    await recordDocumentAccess({ ...auditBase, action: "file_retrieved" });

    const fileName = `contract-${artifact.contract_id}-${artifact.artifact_type}.pdf`;
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(
      JSON.stringify({
        event: "consultant_contract_artifact_download_failed",
        artifactId,
        driveFileId: artifact.drive_file_id,
        message,
      })
    );
    await recordDocumentAccess({ ...auditBase, action: "download_failed" });
    return NextResponse.json({ reason: "fetch_failed" }, { status: 502 });
  }
}
