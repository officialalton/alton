import { createAdminClient } from "@/lib/supabase-admin";

// P4-3 2단계 — 문서 접근 감사 기록.
//
// **확인할 수 없는 것을 확인한 것처럼 적지 않는다.**
//
// 서버가 Drive에서 바이트를 확보한 시점은 사용자의 다운로드 완료가 아니다 —
// 브라우저가 실제로 저장했는지는 이 앱이 알 수 없다. 그래서 "사용자가 받아
// 갔다"를 뜻하는 값은 두지 않고, 서버가 보장할 수 있는 것만 남긴다.
// 교사 서류는 서명 URL 방식이라 발급까지만 보장된다.
export type DocumentAccessAction =
  /** 인가를 통과해 접근을 시작했다. */
  | "download_requested"
  /** 서버가 원본 바이트를 확보해 응답으로 넘겼다 — 브라우저 저장 여부는 보장하지 않는다. */
  | "file_retrieved"
  /** 서명 URL을 내줬다 — 실제 내려받았는지는 알 수 없다. */
  | "download_url_issued"
  /** 인가 통과 뒤 확보·전달에 실패했다. */
  | "download_failed";

export async function recordDocumentAccess(params: {
  actorId: string;
  targetKind: "contract_artifact" | "teacher_document" | "company_document";
  targetId: string;
  subjectId?: string | null;
  action: DocumentAccessAction;
  /** 파일명·문서 종류·버전 같은 비민감 식별 정보만. 본문은 절대 담지 않는다. */
  detail?: Record<string, unknown>;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("document_access_events").insert({
    actor_id: params.actorId,
    target_kind: params.targetKind,
    target_id: params.targetId,
    subject_id: params.subjectId ?? null,
    action: params.action,
    detail: params.detail ?? {},
  });
  // 감사 기록 실패를 조용히 삼키지 않는다 — 남기지 못했다면 그 사실이 드러나야 한다.
  if (error) throw new Error(`문서 접근 기록 실패: ${error.message}`);
}
