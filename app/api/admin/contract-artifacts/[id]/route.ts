import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { driveFetch, getDriveTokenForCurrentEnv, DRIVE_API } from "@/lib/drive/fetch";
import { recordDocumentAccess } from "@/lib/document-access-audit";

// P4-3 2단계 — 계약 서명본 다운로드.
//
// 서명 URL을 브라우저에 넘기지 않고 **서버가 바이트를 받아 흘려보낸다**.
// Drive의 webContentLink는 호출자가 아니라 열람자 자신의 Google 계정 권한으로
// 평가되므로 회사 Drive에 초대되지 않은 관리자 브라우저에서는 403이 되고,
// files.get의 리다이렉트 URL을 그대로 넘기는 것은 서비스 계정 토큰을 URL에
// 실어 보내는 것과 같다. 서버 경유여야 ALTON 세션 권한으로 판정할 수 있다.
//
// 권한은 **요청마다** 확인한다. 목록에서 버튼이 보였다는 사실은 근거가 아니다.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: artifactId } = await params;

  let adminUserId: string;
  let supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"];
  try {
    const auth = await requireAdmin();
    adminUserId = auth.adminUserId;
    supabase = auth.supabase;
  } catch {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  // RLS가 걸린 사용자 클라이언트로 읽는다 — 보이지 않으면 그대로 권한 없음이다.
  const { data: artifact } = await supabase
    .from("drive_artifacts")
    .select("id, contract_id, artifact_type, sync_status, drive_file_id")
    .eq("id", artifactId)
    .maybeSingle();

  if (!artifact) {
    return NextResponse.json({ error: "문서를 찾을 수 없습니다." }, { status: 404 });
  }

  // "파일 없음"과 "다운로드 실패"를 구분해 돌려준다.
  if (artifact.sync_status !== "succeeded" || !artifact.drive_file_id) {
    return NextResponse.json(
      {
        error: "아직 보관되지 않은 문서입니다.",
        reason: "not_stored",
        syncStatus: artifact.sync_status,
      },
      { status: 409 }
    );
  }

  const { data: contract } = await supabase
    .from("contracts")
    .select("child_id")
    .eq("id", artifact.contract_id as string)
    .maybeSingle();
  const subjectId = (contract?.child_id as string | undefined) ?? null;

  const auditBase = {
    actorId: adminUserId,
    targetKind: "contract_artifact" as const,
    targetId: artifactId,
    subjectId,
    detail: { artifactType: artifact.artifact_type, contractId: artifact.contract_id },
  };

  // 시작을 먼저 남긴다 — 중간에 끊겨도 "열람을 시도했다"는 사실은 남는다.
  await recordDocumentAccess({ ...auditBase, action: "download_started" });

  try {
    const token = await getDriveTokenForCurrentEnv();
    const res = await driveFetch(
      `${DRIVE_API}/files/${artifact.drive_file_id}?alt=media&supportsAllDrives=true`,
      token
    );
    const body = await res.arrayBuffer();

    // 바이트를 확보한 뒤에야 완료로 기록한다.
    await recordDocumentAccess({ ...auditBase, action: "download_completed" });

    const fileName = `contract-${artifact.contract_id}-${artifact.artifact_type}.pdf`;
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    await recordDocumentAccess({
      ...auditBase,
      action: "download_failed",
      detail: { ...auditBase.detail, message: e instanceof Error ? e.message : String(e) },
    });
    return NextResponse.json(
      { error: "문서를 내려받지 못했습니다.", reason: "fetch_failed" },
      { status: 502 }
    );
  }
}
