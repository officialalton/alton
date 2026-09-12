import { createAdminClient } from "@/lib/supabase-admin";
import { getDriveApiAccessToken } from "@/lib/google-workspace-auth";
import { getR3PreviewDriveAccessToken } from "@/lib/drive-preview-verify-auth";
import { downloadCompletedDocument, downloadCertificateOfCompletion } from "@/lib/docusign";

const MAX_RETRY_COUNT = 5;

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
  // 이름 정확 일치(대소문자 포함) 대신 대소문자 무시 비교를 쓴다 — 실측 확인 결과
  // 실제 Shared Drive 이름은 "Alton Integration Sandbox"로, 문서·코드 전반에서
  // 관례적으로 쓰던 "ALTON..." 표기와 대소문자가 달랐다(2026-09-01).
  const drivesRes = await driveFetch(`${DRIVE_API}/drives`, token);
  const drivesData = (await drivesRes.json()) as { drives: Array<{ id: string; name: string }> };
  const sharedDrive = drivesData.drives.find(
    (d) => d.name.toLowerCase() === SHARED_DRIVE_NAME.toLowerCase()
  );
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
async function findExistingFileInFolder(
  token: string,
  fileName: string,
  folderId: string
): Promise<string | null> {
  const q = encodeURIComponent(`name='${fileName}' and trashed=false and '${folderId}' in parents`);
  const listUrl =
    `${DRIVE_API}/files?q=${q}&includeItemsFromAllDrives=true&supportsAllDrives=true&fields=files(id,name)`;
  const listRes = await driveFetch(listUrl, token);
  const listData = (await listRes.json()) as { files: Array<{ id: string; name: string }> };
  return listData.files.length > 0 ? listData.files[0].id : null;
}

/**
 * 멱등성: (a) DB에 이미 drive_file_id가 기록돼 있으면 그 값을 그대로 반환하고
 * Drive를 다시 호출하지 않는다(호출부에서 처리). (b) DB 기록이 없더라도 — 업로드는
 * 성공했으나 그 직후 DB write가 실패한 부분 실패(partial failure) 케이스를 대비해
 * — 대상 폴더에 같은 파일명이 이미 있는지 findOrCreateFolder와 동일한 "list 먼저,
 * 없을 때만 create" 패턴으로 확인한다.
 */
export async function uploadArtifactToDrive(params: {
  contractId: string;
  artifactType: "signed_document" | "certificate_of_completion";
  fileBuffer: Buffer;
  fileName: string;
  existingDriveFileId?: string | null;
}): Promise<{ driveFileId: string }> {
  if (params.existingDriveFileId) {
    return { driveFileId: params.existingDriveFileId };
  }

  if (process.env.DRIVE_ARTIFACTS_ALLOW_REAL_WRITES !== "true") {
    throw new Error("not implemented: DRIVE_ARTIFACTS_ALLOW_REAL_WRITES=true가 아니면 실제 Drive 업로드를 하지 않습니다.");
  }

  // R3 임시 조치(2026-09-01): Preview에서는 Production WIF 체인(assertNotPreview()로
  // 원천 차단됨, DWD 포함)을 절대 쓰지 않고, 별도 최소권한 서비스 계정(Directory API
  // 없음, Shared Drive Content Manager로만 접근)을 쓴다. Production/로컬은 기존 경로
  // 그대로 유지 — 이 분기는 검증 완료 후 별도 승인으로 제거 예정.
  const token =
    process.env.VERCEL_ENV === "preview"
      ? await getR3PreviewDriveAccessToken()
      : await getDriveApiAccessToken();
  const folderId = await getTestFolderId(token);

  const existingFileId = await findExistingFileInFolder(token, params.fileName, folderId);
  if (existingFileId) {
    return { driveFileId: existingFileId };
  }

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

// =========================================================================
// 실제 다운로드+업로드 배선 (task 2) + queued 상태 워커 (task 1)
// =========================================================================

/**
 * artifact_type에 맞는 DocuSign 다운로드 함수를 골라 호출한다. 발송된 계약
 * 버전 중 실제로 이 artifact와 연결된 envelope을 (contract_id로 join해)
 * 찾는다 — 한 계약(contract)에 여러 버전이 있을 수 있으므로, envelope이 실제로
 * completed된 버전을 우선하고 없으면 docusign_envelope_id가 있는 가장 최근
 * 버전을 쓴다.
 */
async function resolveEnvelopeIdForContract(
  admin: ReturnType<typeof createAdminClient>,
  contractId: string
): Promise<string> {
  const { data: versions, error } = await admin
    .from("contract_versions")
    .select("docusign_envelope_id, docusign_envelope_status, version_number")
    .eq("contract_id", contractId)
    .not("docusign_envelope_id", "is", null)
    .order("version_number", { ascending: false });
  if (error) throw new Error(error.message);
  if (!versions || versions.length === 0) {
    throw new Error(`계약 ${contractId}에 연결된 DocuSign envelope을 찾을 수 없습니다.`);
  }
  const completed = versions.find((v) => v.docusign_envelope_status === "completed");
  return (completed ?? versions[0]).docusign_envelope_id as string;
}

async function downloadArtifactBuffer(
  artifactType: "signed_document" | "certificate_of_completion",
  envelopeId: string
): Promise<Buffer> {
  return artifactType === "signed_document"
    ? downloadCompletedDocument(envelopeId)
    : downloadCertificateOfCompletion(envelopeId);
}

type DriveArtifactRow = {
  id: string;
  contract_id: string;
  artifact_type: "signed_document" | "certificate_of_completion";
  drive_file_id: string | null;
  retry_count: number;
};

/**
 * 한 drive_artifacts 행을 실제로 처리한다: DocuSign에서 실 문서를 다운로드하고
 * (스텁 Buffer.alloc(0) 대신), uploadArtifactToDrive로 업로드한다. 이미
 * drive_file_id가 있으면(성공했던 행의 재실행) Drive를 다시 부르지 않고 그 값을
 * 그대로 재확인 성공 처리한다(멱등성 보장 지점).
 */
async function processOneDriveArtifact(
  admin: ReturnType<typeof createAdminClient>,
  row: DriveArtifactRow
): Promise<{ driveFileId: string }> {
  if (row.drive_file_id) {
    return { driveFileId: row.drive_file_id };
  }
  const envelopeId = await resolveEnvelopeIdForContract(admin, row.contract_id);
  const fileBuffer = await downloadArtifactBuffer(row.artifact_type, envelopeId);
  return uploadArtifactToDrive({
    contractId: row.contract_id,
    artifactType: row.artifact_type,
    fileBuffer,
    fileName: `${row.artifact_type}.pdf`,
  });
}

/**
 * queued 상태 drive_artifacts를 처리하는 워커. 동시 워커가 같은 행을 중복
 * 처리하지 않도록, 새 lock 테이블 없이 sync_status 컬럼 자체를 낙관적 잠금으로
 * 쓴다: `UPDATE ... SET sync_status='processing' WHERE id=? AND
 * sync_status='queued'`를 실행하고, 그 update가 실제로 행에 영향을 줬는지
 * (data가 non-null인지) 확인해야만 그 행을 처리한다 — 영향받은 행이 없으면(이미
 * 다른 워커가 먼저 claim) 조용히 스킵한다. 이 저장소에 SKIP LOCKED/advisory lock
 * 선례가 없어(grep 결과 없음) 더 단순한 조건부 UPDATE 방식을 택했다.
 */
export async function processQueuedDriveArtifacts(): Promise<{
  attempted: number;
  succeeded: number;
  failed: number;
  manualReview: number;
  skippedRace: number;
}> {
  const admin = createAdminClient();

  const { data: candidates, error } = await admin
    .from("drive_artifacts")
    .select("id, contract_id, artifact_type, drive_file_id, retry_count")
    .eq("sync_status", "queued");
  if (error) throw new Error(error.message);

  let succeeded = 0;
  let failed = 0;
  let manualReview = 0;
  let skippedRace = 0;

  for (const row of (candidates ?? []) as DriveArtifactRow[]) {
    // 조건부 UPDATE로 claim 시도. .select()를 붙여 실제로 update된 행을 돌려받고,
    // 그 결과가 비어 있으면(이미 다른 워커가 채감) 스킵한다.
    const { data: claimed, error: claimError } = await admin
      .from("drive_artifacts")
      .update({ sync_status: "processing" })
      .eq("id", row.id)
      .eq("sync_status", "queued")
      .select("id");
    if (claimError) throw new Error(claimError.message);
    if (!claimed || claimed.length === 0) {
      skippedRace += 1;
      continue;
    }

    try {
      const { driveFileId } = await processOneDriveArtifact(admin, row);
      await admin
        .from("drive_artifacts")
        .update({ sync_status: "succeeded", drive_file_id: driveFileId, uploaded_at: new Date().toISOString() })
        .eq("id", row.id);
      succeeded += 1;
    } catch (uploadError) {
      const nextRetryCount = (row.retry_count ?? 0) + 1;
      const exceededLimit = nextRetryCount > MAX_RETRY_COUNT;
      await admin
        .from("drive_artifacts")
        .update({
          sync_status: exceededLimit ? "manual_review" : "retryable_failed",
          retry_count: nextRetryCount,
        })
        .eq("id", row.id);
      if (exceededLimit) manualReview += 1;
      else failed += 1;
      console.error(
        JSON.stringify({
          type: "drive_artifact_queue_process_failed",
          driveArtifactId: row.id,
          contractId: row.contract_id,
          retryCount: nextRetryCount,
          manualReview: exceededLimit,
          error: uploadError instanceof Error ? uploadError.message : String(uploadError),
        })
      );
    }
  }

  return {
    attempted: (candidates ?? []).length,
    succeeded,
    failed,
    manualReview,
    skippedRace,
  };
}

export { processOneDriveArtifact, MAX_RETRY_COUNT };
export type { DriveArtifactRow };
