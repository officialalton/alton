import { beforeEach, describe, expect, it, vi } from "vitest";

// R4: queued 상태 Drive 업로드 워커(processQueuedDriveArtifacts) + 실제 DocuSign
// 다운로드 배선(processOneDriveArtifact) + uploadArtifactToDrive 멱등성 가드에
// 대한 테스트. Drive/DocuSign fetch는 전부 모킹하고, 실제 네트워크 호출은 없다.

const getDriveApiAccessTokenMock = vi.fn().mockResolvedValue("drive-token");
vi.mock("@/lib/google-workspace-auth", () => ({
  getDriveApiAccessToken: getDriveApiAccessTokenMock,
}));

const downloadCompletedDocumentMock = vi.fn();
const downloadCertificateOfCompletionMock = vi.fn();
vi.mock("@/lib/docusign", () => ({
  downloadCompletedDocument: downloadCompletedDocumentMock,
  downloadCertificateOfCompletion: downloadCertificateOfCompletionMock,
}));

// --- Supabase admin client mock -------------------------------------------
const driveArtifactsSelectEqMock = vi.fn();
const driveArtifactsClaimEqEqSelectMock = vi.fn();
const driveArtifactsUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
const contractVersionsSelectChainMock = vi.fn();

const fromMock = vi.fn((table: string) => {
  if (table === "drive_artifacts") {
    return {
      select: () => ({ eq: driveArtifactsSelectEqMock }),
      update: (payload: Record<string, unknown>) => {
        if (payload.sync_status === "processing") {
          // claim: conditional update .eq(id).eq(sync_status,'queued').select('id')
          return {
            eq: () => ({
              eq: () => ({ select: driveArtifactsClaimEqEqSelectMock }),
            }),
          };
        }
        return { eq: driveArtifactsUpdateEqMock };
      },
    };
  }
  if (table === "contract_versions") {
    return {
      select: () => ({
        eq: () => ({
          not: () => ({ order: contractVersionsSelectChainMock }),
        }),
      }),
    };
  }
  throw new Error(`unexpected table: ${table}`);
});

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  delete process.env.DRIVE_ARTIFACTS_ALLOW_REAL_WRITES;
  downloadCompletedDocumentMock.mockResolvedValue(Buffer.from("real-signed-doc-bytes"));
  downloadCertificateOfCompletionMock.mockResolvedValue(Buffer.from("real-cert-bytes"));
  contractVersionsSelectChainMock.mockResolvedValue({
    data: [{ docusign_envelope_id: "env-1", docusign_envelope_status: "completed", version_number: 1 }],
    error: null,
  });
  driveArtifactsUpdateEqMock.mockResolvedValue({ error: null });
});

describe("processQueuedDriveArtifacts", () => {
  it("claim에 성공한 queued 행을 processing → succeeded로 전이하고 실제 다운로드된 버퍼로 업로드한다", async () => {
    driveArtifactsSelectEqMock.mockResolvedValue({
      data: [{ id: "da1", contract_id: "ct1", artifact_type: "signed_document", drive_file_id: null, retry_count: 0 }],
      error: null,
    });
    driveArtifactsClaimEqEqSelectMock.mockResolvedValue({ data: [{ id: "da1" }], error: null });

    process.env.DRIVE_ARTIFACTS_ALLOW_REAL_WRITES = "true";
    const fetchMock = vi
      .fn()
      // getTestFolderId: drives list
      .mockResolvedValueOnce({ ok: true, json: async () => ({ drives: [{ id: "drive1", name: "ALTON Integration Sandbox" }] }) })
      // findOrCreateFolder: folder list (found)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [{ id: "folder1", name: "R3 Test" }] }) })
      // findExistingFileInFolder: not found
      .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [] }) })
      // upload
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "drivefile1" }) });
    vi.stubGlobal("fetch", fetchMock);

    const { processQueuedDriveArtifacts } = await import("./drive-artifacts");
    const result = await processQueuedDriveArtifacts();

    expect(result).toEqual({ attempted: 1, succeeded: 1, failed: 0, manualReview: 0, skippedRace: 0 });
    expect(downloadCompletedDocumentMock).toHaveBeenCalledWith("env-1");
    // 업로드에 전달된 실제 바디에 실 버퍼 내용이 들어있는지 확인 (Buffer.alloc(0) 아님).
    const uploadCallBody = fetchMock.mock.calls[3][1].body as Buffer;
    expect(uploadCallBody.toString("binary")).toContain("real-signed-doc-bytes");
    expect(driveArtifactsUpdateEqMock).toHaveBeenCalledWith("id", "da1");
  });

  it("certificate_of_completion 타입은 downloadCertificateOfCompletion을 호출한다", async () => {
    driveArtifactsSelectEqMock.mockResolvedValue({
      data: [{ id: "da2", contract_id: "ct1", artifact_type: "certificate_of_completion", drive_file_id: null, retry_count: 0 }],
      error: null,
    });
    driveArtifactsClaimEqEqSelectMock.mockResolvedValue({ data: [{ id: "da2" }], error: null });
    process.env.DRIVE_ARTIFACTS_ALLOW_REAL_WRITES = "true";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ drives: [{ id: "drive1", name: "ALTON Integration Sandbox" }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [{ id: "folder1", name: "R3 Test" }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "drivefile2" }) });
    vi.stubGlobal("fetch", fetchMock);

    const { processQueuedDriveArtifacts } = await import("./drive-artifacts");
    await processQueuedDriveArtifacts();

    expect(downloadCertificateOfCompletionMock).toHaveBeenCalledWith("env-1");
    expect(downloadCompletedDocumentMock).not.toHaveBeenCalled();
  });

  it("claim 경쟁: 다른 워커가 먼저 claim했으면(update 0행) 처리를 건너뛴다", async () => {
    driveArtifactsSelectEqMock.mockResolvedValue({
      data: [{ id: "da1", contract_id: "ct1", artifact_type: "signed_document", drive_file_id: null, retry_count: 0 }],
      error: null,
    });
    driveArtifactsClaimEqEqSelectMock.mockResolvedValue({ data: [], error: null });

    const { processQueuedDriveArtifacts } = await import("./drive-artifacts");
    const result = await processQueuedDriveArtifacts();

    expect(result).toEqual({ attempted: 1, succeeded: 0, failed: 0, manualReview: 0, skippedRace: 1 });
    expect(downloadCompletedDocumentMock).not.toHaveBeenCalled();
  });

  it("실패하면 retry_count를 증가시키고 retryable_failed로 전이한다", async () => {
    driveArtifactsSelectEqMock.mockResolvedValue({
      data: [{ id: "da1", contract_id: "ct1", artifact_type: "signed_document", drive_file_id: null, retry_count: 1 }],
      error: null,
    });
    driveArtifactsClaimEqEqSelectMock.mockResolvedValue({ data: [{ id: "da1" }], error: null });
    downloadCompletedDocumentMock.mockRejectedValue(new Error("DocuSign 다운로드 실패"));

    const { processQueuedDriveArtifacts } = await import("./drive-artifacts");
    const result = await processQueuedDriveArtifacts();

    expect(result).toEqual({ attempted: 1, succeeded: 0, failed: 1, manualReview: 0, skippedRace: 0 });
    expect(driveArtifactsUpdateEqMock).toHaveBeenCalledWith("id", "da1");
  });

  it("retry_count가 한도(5)를 넘으면 manual_review로 전이한다", async () => {
    driveArtifactsSelectEqMock.mockResolvedValue({
      data: [{ id: "da1", contract_id: "ct1", artifact_type: "signed_document", drive_file_id: null, retry_count: 5 }],
      error: null,
    });
    driveArtifactsClaimEqEqSelectMock.mockResolvedValue({ data: [{ id: "da1" }], error: null });
    downloadCompletedDocumentMock.mockRejectedValue(new Error("DocuSign 다운로드 실패"));

    const { processQueuedDriveArtifacts } = await import("./drive-artifacts");
    const result = await processQueuedDriveArtifacts();

    expect(result).toEqual({ attempted: 1, succeeded: 0, failed: 0, manualReview: 1, skippedRace: 0 });
  });
});

describe("uploadArtifactToDrive — 멱등성", () => {
  it("existingDriveFileId가 있으면 Drive를 호출하지 않고 그대로 반환한다", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { uploadArtifactToDrive } = await import("./drive-artifacts");
    const result = await uploadArtifactToDrive({
      contractId: "ct1",
      artifactType: "signed_document",
      fileBuffer: Buffer.from("x"),
      fileName: "signed_document.pdf",
      existingDriveFileId: "already-uploaded-id",
    });

    expect(result).toEqual({ driveFileId: "already-uploaded-id" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("DB에 기록이 없어도 대상 폴더에 같은 파일명이 이미 있으면 재사용하고 새로 만들지 않는다(부분 실패 복구)", async () => {
    process.env.DRIVE_ARTIFACTS_ALLOW_REAL_WRITES = "true";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ drives: [{ id: "drive1", name: "ALTON Integration Sandbox" }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [{ id: "folder1", name: "R3 Test" }] }) })
      // findExistingFileInFolder: found existing file by name
      .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [{ id: "existing-drive-file", name: "signed_document.pdf" }] }) });
    vi.stubGlobal("fetch", fetchMock);

    const { uploadArtifactToDrive } = await import("./drive-artifacts");
    const result = await uploadArtifactToDrive({
      contractId: "ct1",
      artifactType: "signed_document",
      fileBuffer: Buffer.from("x"),
      fileName: "signed_document.pdf",
    });

    expect(result).toEqual({ driveFileId: "existing-drive-file" });
    // list 호출만 3번, files.create(업로드)는 호출되지 않아야 한다.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("DRIVE_ARTIFACTS_ALLOW_REAL_WRITES가 아니면 여전히 throw한다(안전장치 유지)", async () => {
    const { uploadArtifactToDrive } = await import("./drive-artifacts");
    await expect(
      uploadArtifactToDrive({
        contractId: "ct1",
        artifactType: "signed_document",
        fileBuffer: Buffer.from("x"),
        fileName: "signed_document.pdf",
      })
    ).rejects.toThrow("not implemented");
  });
});
