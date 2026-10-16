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
    // 권한 부족과 존재하지 않음을 밖에서 구분하지 않는다(존재 여부 자체가 정보다).
    return NextResponse.json({ reason: "not_found" }, { status: 404 });
  }

  // 내부 상태값(sync_status)이나 Drive 응답은 응답 본문에 담지 않는다 —
  // 화면은 reason 코드만 보고 자기 문구를 고른다. 상세 원인은 서버 로그로 간다.
  if (artifact.sync_status !== "succeeded" || !artifact.drive_file_id) {
    console.warn(
      JSON.stringify({
        event: "contract_artifact_download_blocked",
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
    actorId: adminUserId,
    targetKind: "contract_artifact" as const,
    targetId: artifactId,
    subjectId,
    detail: { artifactType: artifact.artifact_type, contractId: artifact.contract_id },
  };

  // 접근 시작을 먼저 남긴다 — 중간에 끊겨도 "열람을 시도했다"는 사실은 남는다.
  await recordDocumentAccess({ ...auditBase, action: "download_requested" });

  try {
    const token = await getDriveTokenForCurrentEnv();
    const res = await driveFetch(
      `${DRIVE_API}/files/${artifact.drive_file_id}?alt=media&supportsAllDrives=true`,
      token
    );
    const body = await res.arrayBuffer();

    // 여기까지가 서버가 보장할 수 있는 전부다 — 원본을 확보해 응답으로 넘겼다.
    // 브라우저가 실제로 저장했는지는 알 수 없으므로 "다운로드 완료"로 적지 않는다.
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
    // 상세 원인(Drive 응답·예외 메시지·파일 경로)은 서버 로그에만 남긴다.
    const message = e instanceof Error ? e.message : String(e);
    console.error(
      JSON.stringify({
        event: "contract_artifact_download_failed",
        artifactId,
        driveFileId: artifact.drive_file_id,
        message,
      })
    );
    // 감사 detail에도 원문을 복제하지 않는다 — 실패했다는 사실만 남긴다.
    await recordDocumentAccess({ ...auditBase, action: "download_failed" });
    return NextResponse.json({ reason: "fetch_failed" }, { status: 502 });
  }
}
