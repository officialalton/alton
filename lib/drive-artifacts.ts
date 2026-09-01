import { createAdminClient } from "@/lib/supabase-admin";

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
 * 실제 Drive 업로드. TODO(R4+): lib/google-workspace-auth.ts의 인증 체인을 확장해
 * Drive API(v3 files.create, Shared Drive 대상)로 실제 업로드를 구현한다. 이 태스크
 * 범위에서는 Google Drive API/자격증명을 절대 건드리지 않기로 확정했으므로 의도적으로
 * 구현하지 않는다.
 */
export async function uploadArtifactToDrive(_params: {
  contractId: string;
  artifactType: "signed_document" | "certificate_of_completion";
  fileBuffer: Buffer;
  fileName: string;
}): Promise<{ driveFileId: string }> {
  throw new Error("not implemented: Google Drive 업로드는 이번 태스크 범위 밖(TODO R4+)");
}
