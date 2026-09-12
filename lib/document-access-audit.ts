import { createAdminClient } from "@/lib/supabase-admin";

// P4-3 2단계 — 문서 접근 감사 기록.
//
// **링크 발급과 실제 다운로드를 구분한다.** 발급만 해 놓고 완료로 기록하면
// "누가 실제로 받아 갔는가"를 되짚을 수 없다. 계약은 서버가 바이트를 흘려보내
// 시작·완료·실패를 각각 남길 수 있고, 교사 서류는 서명 URL 방식이라 발급까지만
// 보장된다 — 그 차이를 action 값으로 남긴다.
export type DocumentAccessAction =
  | "download_url_issued"
  | "download_started"
  | "download_completed"
  | "download_failed";

export async function recordDocumentAccess(params: {
  actorId: string;
  targetKind: "contract_artifact" | "teacher_document";
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
