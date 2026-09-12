"use server";

import { requireAdminOrCapability } from "@/lib/admin-auth";
import { driveFetch, getDriveTokenForCurrentEnv, DRIVE_API } from "@/lib/drive/fetch";
import { recordDocumentAccess } from "@/lib/document-access-audit";

// P4-3 4단계 — `문서 > 회사 문서`. Drive 전용 폴더를 **읽기 전용**으로 연결한다.
//
// 권한(2026-09-12 확정): 현재는 기존 관리자 계정으로 조회·다운로드한다.
// 계정 id를 코드에 박지 않고 공통 권한 검사 함수를 쓴다. 향후 마스터/중간
// 관리자 체계가 들어오면 업무별로 다시 좁힌다.
//
// 외부 준비(전용 Shared Drive 생성·서비스 계정 초대·환경변수 설정)와 코드는
// 분리한다. 플래그가 꺼져 있으면 Drive를 호출하지 않고 "아직 연결되지 않음"을
// 돌려주므로, 준비 전에도 화면 흐름 전체를 확인할 수 있다.
const CAPABILITY = "manage_company_documents";

export type CompanyDocumentEntry = {
  id: string;
  name: string;
  /** 폴더인지 파일인지. 화면이 아이콘·동작을 가른다. */
  isFolder: boolean;
  sizeBytes: number | null;
  modifiedAt: string | null;
};

export type CompanyDocumentsResult =
  | { state: "ok"; entries: CompanyDocumentEntry[] }
  /** 전용 Drive가 아직 연결되지 않았다(환경변수 미설정 또는 플래그 꺼짐). */
  | { state: "not_configured" }
  /** Drive 호출이 실패했다. 원인은 서버 로그에만 남긴다. */
  | { state: "fetch_failed" };

function driveConfig(): { driveId: string; rootFolderId: string } | null {
  if (process.env.COMPANY_DOCUMENTS_ENABLED !== "true") return null;
  const driveId = process.env.COMPANY_DOCUMENTS_DRIVE_ID;
  if (!driveId) return null;
  return { driveId, rootFolderId: process.env.COMPANY_DOCUMENTS_ROOT_FOLDER_ID || driveId };
}

/**
 * 폴더 하나의 내용을 나열한다. `folderId`를 주지 않으면 루트를 본다.
 *
 * 빈 폴더와 "연결되지 않음"을 같은 값으로 뭉개지 않는다 — 운영자가 설정
 * 문제인지 자료가 없는 건지 구분할 수 있어야 한다.
 */
export async function listCompanyDocumentsAction(
  folderId?: string
): Promise<CompanyDocumentsResult> {
  await requireAdminOrCapability(CAPABILITY);

  const config = driveConfig();
  if (!config) return { state: "not_configured" };

  const parent = folderId ?? config.rootFolderId;
  try {
    const token = await getDriveTokenForCurrentEnv();
    const q = encodeURIComponent(`'${parent}' in parents and trashed=false`);
    const url =
      `${DRIVE_API}/files?q=${q}&corpora=drive&driveId=${config.driveId}` +
      `&includeItemsFromAllDrives=true&supportsAllDrives=true` +
      `&fields=files(id,name,mimeType,size,modifiedTime)&orderBy=folder,name`;
    const res = await driveFetch(url, token);
    const data = (await res.json()) as {
      files?: Array<{
        id: string;
        name: string;
        mimeType: string;
        size?: string;
        modifiedTime?: string;
      }>;
    };

    return {
      state: "ok",
      entries: (data.files ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        isFolder: f.mimeType === "application/vnd.google-apps.folder",
        sizeBytes: f.size ? Number(f.size) : null,
        modifiedAt: f.modifiedTime ?? null,
      })),
    };
  } catch (e) {
    // Drive 오류 원문에는 파일 경로가 섞여 나올 수 있다 — 화면에 넘기지 않는다.
    console.error(
      JSON.stringify({
        event: "company_documents_list_failed",
        parent,
        message: e instanceof Error ? e.message : String(e),
      })
    );
    return { state: "fetch_failed" };
  }
}

export type CompanyDocumentOpenResult =
  | { ok: true; name: string; contentBase64: string; contentType: string }
  | { ok: false; reason: "not_configured" | "not_found" | "fetch_failed" };

/**
 * 파일 하나를 읽어 돌려준다. 계약 서명본과 같은 이유로 서명 URL을 브라우저에
 * 넘기지 않고 서버가 바이트를 받아 전달한다.
 *
 * 파일이 정말 그 Drive 소속인지 먼저 확인한다 — 임의의 fileId로 다른 Drive의
 * 파일을 읽어 오는 경로를 만들지 않는다.
 */
export async function openCompanyDocumentAction(
  fileId: string
): Promise<CompanyDocumentOpenResult> {
  const { actorUserId } = await requireAdminOrCapability(CAPABILITY);

  const config = driveConfig();
  if (!config) return { ok: false, reason: "not_configured" };

  try {
    const token = await getDriveTokenForCurrentEnv();
    const metaRes = await driveFetch(
      `${DRIVE_API}/files/${fileId}?supportsAllDrives=true&fields=id,name,mimeType,driveId`,
      token
    );
    const meta = (await metaRes.json()) as {
      id: string;
      name: string;
      mimeType: string;
      driveId?: string;
    };
    if (meta.driveId && meta.driveId !== config.driveId) {
      console.warn(
        JSON.stringify({ event: "company_document_wrong_drive", fileId, driveId: meta.driveId })
      );
      return { ok: false, reason: "not_found" };
    }

    const res = await driveFetch(
      `${DRIVE_API}/files/${fileId}?alt=media&supportsAllDrives=true`,
      token
    );
    const buffer = Buffer.from(await res.arrayBuffer());

    // 서버가 원본을 확보해 응답으로 넘긴 것까지 기록한다 — 브라우저 저장
    // 여부는 여기서도 알 수 없다.
    await recordDocumentAccess({
      actorId: actorUserId,
      targetKind: "company_document",
      targetId: fileId,
      action: "file_retrieved",
      detail: { fileName: meta.name },
    });

    return {
      ok: true,
      name: meta.name,
      contentBase64: buffer.toString("base64"),
      contentType: meta.mimeType || "application/octet-stream",
    };
  } catch (e) {
    console.error(
      JSON.stringify({
        event: "company_document_open_failed",
        fileId,
        message: e instanceof Error ? e.message : String(e),
      })
    );
    return { ok: false, reason: "fetch_failed" };
  }
}
