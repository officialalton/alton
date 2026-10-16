// R5 — 문서 권한 부여/회수 재처리 큐 워커 STUB.
//
// change_teacher_assignment() DB 함수가 document_permission_retries에
// grant/revoke work-item을 큐잉한다(20260925000000_r5_...sql). 실제 Google
// Drive ACL 호출(추가/제거 권한)은 R8 범위 — 이 워커는 그 경계를 명확히
// stub으로 표시해 테스트 가능하게 하되, 실제 Drive API를 호출하지 않는다.
//
// processQueuedDriveArtifacts()(lib/drive-artifacts.ts, R3)와 동일한 claim →
// 처리 → 상태 갱신 패턴을 따른다 — R8에서 applyDrivePermissionChange의 내부만
// 실제 Drive Admin SDK 호출로 교체하면 된다(claim/retry/상태 전이 로직은 그대로).

import type { SupabaseClient } from "@supabase/supabase-js";

export type DocumentPermissionAction = "grant" | "revoke";

export type DocumentPermissionRetryRow = {
  id: string;
  subject_enrollment_id: string;
  teacher_id: string;
  action: DocumentPermissionAction;
  status: "queued" | "succeeded" | "failed" | "manual_review";
  attempt_count: number;
};

export const MAX_PERMISSION_RETRY_COUNT = 5;

/**
 * R8 경계 — 실제 Drive 호출을 이 함수 하나로 좁혀둔다. R5에서는 항상
 * "미구현" 실패를 리턴해 실제 ACL 변경 없이 큐 재처리 로직만 검증할 수 있게
 * 한다. R8에서 실제 Drive Admin SDK 호출로 이 함수 본문만 교체하면 워커의
 * 나머지 로직(claim, 재시도 횟수, manual_review 전이)은 변경할 필요가 없다.
 */
export async function applyDrivePermissionChange(
  _row: Pick<DocumentPermissionRetryRow, "subject_enrollment_id" | "teacher_id" | "action">
): Promise<{ ok: boolean; error?: string }> {
  return { ok: false, error: "실제 Drive 권한 변경은 R8 범위 — 아직 구현되지 않았습니다(stub)." };
}

/**
 * 큐에 쌓인 queued/failed(재시도 한도 이하) 항목을 하나씩 처리한다. 성공 시
 * succeeded로, 실패 시 attempt_count를 올리고 한도 초과면 manual_review로
 * 전이한다(processQueuedDriveArtifacts와 동일한 패턴).
 */
export async function processQueuedDocumentPermissionRetries(
  supabase: SupabaseClient
): Promise<{ processed: number; succeeded: number; movedToManualReview: number }> {
  const { data, error } = await supabase
    .from("document_permission_retries")
    .select("id, subject_enrollment_id, teacher_id, action, status, attempt_count")
    .in("status", ["queued", "failed"])
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  let succeeded = 0;
  let movedToManualReview = 0;

  for (const row of (data ?? []) as DocumentPermissionRetryRow[]) {
    const result = await applyDrivePermissionChange(row);
    if (result.ok) {
      await supabase
        .from("document_permission_retries")
        .update({ status: "succeeded", resolved_at: new Date().toISOString() })
        .eq("id", row.id);
      succeeded += 1;
      continue;
    }

    const nextAttempt = row.attempt_count + 1;
    if (nextAttempt >= MAX_PERMISSION_RETRY_COUNT) {
      await supabase
        .from("document_permission_retries")
        .update({ status: "manual_review", attempt_count: nextAttempt, last_error: result.error })
        .eq("id", row.id);
      movedToManualReview += 1;
    } else {
      await supabase
        .from("document_permission_retries")
        .update({ status: "failed", attempt_count: nextAttempt, last_error: result.error })
        .eq("id", row.id);
    }
  }

  return { processed: (data ?? []).length, succeeded, movedToManualReview };
}
