import { createAdminClient } from "@/lib/supabase-admin";
import { getDriveApiAccessToken } from "@/lib/google-workspace-auth";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const SHARED_DRIVE_NAME = "ALTON Integration Sandbox";
const TEST_FOLDER_NAME = "R3 Test";

async function driveFetch(url: string, token: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive API 요청 실패 (status ${res.status}): ${text.slice(0, 300)}`);
  }
  return res;
}

async function findOrCreateFolder(
  token: string,
  name: string,
  parentId: string | null,
  driveId: string
): Promise<string> {
  const q = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false` +
      (parentId ? ` and '${parentId}' in parents` : "")
  );
  const listUrl =
    `${DRIVE_API}/files?q=${q}&corpora=drive&driveId=${driveId}` +
    `&includeItemsFromAllDrives=true&supportsAllDrives=true&fields=files(id,name)`;
  const listRes = await driveFetch(listUrl, token);
  const listData = (await listRes.json()) as { files: Array<{ id: string; name: string }> };
  if (listData.files.length > 0) return listData.files[0].id;

  const createRes = await driveFetch(`${DRIVE_API}/files?supportsAllDrives=true`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId ?? driveId],
    }),
  });
  const created = (await createRes.json()) as { id: string };
  return created.id;
}

async function getTestFolderId(token: string): Promise<string> {
  const drivesRes = await driveFetch(
    `${DRIVE_API}/drives?q=${encodeURIComponent(`name='${SHARED_DRIVE_NAME}'`)}`,
    token
  );
  const drivesData = (await drivesRes.json()) as { drives: Array<{ id: string; name: string }> };
  const sharedDrive = drivesData.drives.find((d) => d.name === SHARED_DRIVE_NAME);
  if (!sharedDrive) {
    throw new Error(`Shared Drive "${SHARED_DRIVE_NAME}"를 찾을 수 없습니다.`);
  }
  return findOrCreateFolder(token, TEST_FOLDER_NAME, null, sharedDrive.id);
}

// R3: 서명 완료된 계약 문서/Certificate of Completion을 회사 Google Shared Drive에
// 올리는 파이프라인. 이번 태스크 범위에서는 Google Drive API를 절대 호출하지 않는다
// (하드 세이프티 룰) — 실제 업로드는 인터페이스만 정의하고 throw로 명시적으로
// "구현 안 됨"을 남긴다. R2에서 이미 검증된 Google 인증 체인(lib/google-workspace-auth.ts,
// Vercel OIDC → GCP WIF → 서비스 계정 impersonation)을 나중에 그대로 재사용할 수 있을
// 것으로 보이나, Drive API(v3 files.create) 스코프 추가·실제 호출 배선은 이 태스크의
// 범위 밖이라 지금은 손대지 않는다.

/**
 * 웹훅에서 envelope-completed를 받았을 때 호출한다. 실제 Drive 업로드는 스텁이므로
 * drive_artifacts에 sync_status='queued' 행만 남기고 즉시 리턴한다 — 웹훅 응답을
 * 블로킹하지 않기 위함(비동기 재시도 파이프라인이 나중에 이 큐를 소비한다).
 */
export async function queueDriveArtifactSync(params: {
  contractId: string;
  envelopeId: string;
}): Promise<void> {
  const admin = createAdminClient();
  const rows = [
    { contract_id: params.contractId, artifact_type: "signed_document", sync_status: "queued" as const },
    {
      contract_id: params.contractId,
      artifact_type: "certificate_of_completion",
      sync_status: "queued" as const,
    },
  ];
  const { error } = await admin.from("drive_artifacts").insert(rows);
  if (error) {
    // 큐잉 실패는 웹훅 자체를 실패시키지 않는다 — 로그만 남기고 넘어간다. 정기
    // 대조(reconciliation) 작업이 이런 누락을 나중에 잡아내는 것이 설계 의도다
    // (master-roadmap R3, "웹훅 누락·다운로드 실패·Drive 저장 실패 재처리 및 정기 대조").
    console.error(
      JSON.stringify({
        type: "drive_artifact_queue_failed",
        contractId: params.contractId,
        envelopeId: params.envelopeId,
        error: error.message,
      })
    );
  }
}

/**
 * 실제 Drive 업로드. R2 인증 체인(Vercel OIDC → GCP WIF → 서비스 계정 impersonation
 * → signJwt DWD, lib/google-workspace-auth.ts)을 Drive 스코프로 재사용한다.
 * `DRIVE_ARTIFACTS_ALLOW_REAL_WRITES=true`가 아니면 항상 실패한다(기본값 false,
 * WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS와 동일한 안전 패턴). `ALTON Integration
 * Sandbox/R3 Test` 폴더에만 업로드한다. 같은 (contractId, artifactType) 조합의
 * drive_artifacts 행에 이미 drive_file_id가 있으면 중복 업로드하지 않는다(호출부에서
 * 그 값을 그대로 반환).
 */
export async function uploadArtifactToDrive(params: {
  contractId: string;
  artifactType: "signed_document" | "certificate_of_completion";
  fileBuffer: Buffer;
  fileName: string;
}): Promise<{ driveFileId: string }> {
  if (process.env.DRIVE_ARTIFACTS_ALLOW_REAL_WRITES !== "true") {
    throw new Error("not implemented: DRIVE_ARTIFACTS_ALLOW_REAL_WRITES=true가 아니면 실제 Drive 업로드를 하지 않습니다.");
  }

  const token = await getDriveApiAccessToken();
  const folderId = await getTestFolderId(token);

  const metadata = { name: params.fileName, parents: [folderId] };
  const boundary = "r3driveupload";
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/pdf\r\n\r\n` +
    params.fileBuffer.toString("binary") +
    `\r\n--${boundary}--`;

  const uploadRes = await driveFetch(
    `${DRIVE_UPLOAD_API}/files?uploadType=multipart&supportsAllDrives=true&fields=id`,
    token,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body: Buffer.from(body, "binary"),
    }
  );
  const data = (await uploadRes.json()) as { id: string };
  return { driveFileId: data.id };
}
