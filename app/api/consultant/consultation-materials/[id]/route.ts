import { NextResponse } from "next/server";
import { requireConsultant } from "@/lib/admin-auth";
import { driveFetch, getDriveTokenForCurrentEnv, DRIVE_API } from "@/lib/drive/fetch";
import { recordDocumentAccess } from "@/lib/document-access-audit";

// Phase C(2026-09-23) — 상담 자료(Drive 원본) 열람. 계약 서명본 다운로드
// 라우트(app/api/admin/contract-artifacts/[id])와 같은 원칙: 서명 URL을
// 브라우저에 넘기지 않고 서버가 바이트를 받아 흘려보낸다. 컨설턴트가
// "허용된 자료"만 열 수 있다는 건 RLS(공개·비보관 자료만 select 가능)로
// 강제된다 — 여기서도 같은 조건으로 다시 조회해 재확인한다.
//
// 정직한 한계: 서버가 바이트를 브라우저로 넘기고 나면, 그 뒤 화면 캡처·
// 다운로드한 파일 재공유까지는 이 경로가 막을 수 없다. "원본 다운로드
// 경로 자체를 제한한다"까지만 보장한다.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: materialId } = await params;

  let consultantUserId: string;
  let supabase: Awaited<ReturnType<typeof requireConsultant>>["supabase"];
  try {
    const auth = await requireConsultant();
    consultantUserId = auth.user.id;
    supabase = auth.supabase;
  } catch {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { data: material } = await supabase
    .from("consultation_materials")
    .select("id, title, drive_file_id")
    .eq("id", materialId)
    .is("archived_at", null)
    .maybeSingle();

  if (!material || !material.drive_file_id) {
    return NextResponse.json({ reason: "not_found" }, { status: 404 });
  }

  const auditBase = {
    actorId: consultantUserId,
    targetKind: "consultation_material" as const,
    targetId: materialId,
    detail: { title: material.title },
  };
  await recordDocumentAccess({ ...auditBase, action: "download_requested" });

  try {
    const token = await getDriveTokenForCurrentEnv();
    const res = await driveFetch(`${DRIVE_API}/files/${material.drive_file_id}?alt=media&supportsAllDrives=true`, token);
    const body = await res.arrayBuffer();
    await recordDocumentAccess({ ...auditBase, action: "file_retrieved" });
    return new NextResponse(body, {
      headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store", "Content-Disposition": `inline; filename="${material.title}.pdf"` },
    });
  } catch (e) {
    console.error(JSON.stringify({ event: "consultation_material_download_failed", materialId, message: e instanceof Error ? e.message : String(e) }));
    await recordDocumentAccess({ ...auditBase, action: "download_failed" });
    return NextResponse.json({ reason: "fetch_failed" }, { status: 502 });
  }
}
