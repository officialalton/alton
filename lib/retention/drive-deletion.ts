// 보존 만료 Drive 파일 삭제 워커. 큐(retention_deletion_targets)에서 대상을 가져와 Drive 파일을 지우고
// 결과를 기록한다. 실패는 failed + 지수 백오프로 남아 재시도·관리자 확인이 가능하다.
// DB 행 정리는 삭제 성공 후 retention_finalize_deleted_smart_notes 가 맡는다(여기서 DB 행을 지우지 않는다).
import { DRIVE_API, driveFetch, getDriveTokenForCurrentEnv } from "@/lib/drive/fetch";

export type DeletionTarget = { id: string; drive_file_id: string; attempts: number };

export type DeletionQueueDeps = {
  claim: (limit: number) => Promise<DeletionTarget[]>;
  markResult: (id: string, ok: boolean, error?: string) => Promise<void>;
  deleteFile: (fileId: string) => Promise<void>;
};

export async function processDeletionQueue(deps: DeletionQueueDeps, limit = 50) {
  const targets = await deps.claim(limit);
  let deleted = 0;
  let failed = 0;
  for (const t of targets) {
    try {
      await deps.deleteFile(t.drive_file_id);
      await deps.markResult(t.id, true);
      deleted++;
    } catch (e) {
      failed++;
      await deps.markResult(t.id, false, e instanceof Error ? e.message : String(e));
    }
  }
  return { claimed: targets.length, deleted, failed };
}

/** 이미 없는 파일(404)은 삭제된 것으로 본다. */
export async function deleteDriveFile(fileId: string): Promise<void> {
  const token = await getDriveTokenForCurrentEnv();
  try {
    await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`, token, { method: "DELETE" });
  } catch (e) {
    if (e instanceof Error && /status 404/.test(e.message)) return;
    throw e;
  }
}
