import { createAdminClient } from "@/lib/supabase-admin";
import { getDriveApiAccessToken } from "@/lib/google-workspace-auth";

// R8 6/N — 학생→과목→연도→세션 Shared Drive 폴더 자동 생성 + 선생님 배정 권한
// 자동 부여/회수, 그리고 실패 재처리 큐(Gate C GW-12 인수 기준).
//
// lib/drive-artifacts.ts(R3, 계약서 Drive 업로드)와 동일한 하드 세이프티 룰:
// DRIVE_ARTIFACTS_ALLOW_REAL_WRITES=true가 아니면 실제 Drive API를 절대 호출하지
// 않는다(기본값 false, docs/CURRENT.md 플래그 표에 이미 기록된 것과 동일 플래그를
// 재사용 — 별도 플래그를 새로 만들지 않는다).

const MAX_RETRY_COUNT = 5;
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const SHARED_DRIVE_NAME = "ALTON Integration Sandbox";

/** 재시도해도 성공할 수 없는 오류(잘못된 fileId 등) — 즉시 reconciliation_needed로 보낸다. */
export class DriveReconciliationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DriveReconciliationError";
  }
}

async function driveFetch(url: string, token: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    // Drive API가 404(파일/폴더 없음)나 400(잘못된 파라미터)을 주는 경우는 재시도로
    // 해결되지 않는 "잘못된 fileId 등"에 해당한다 — GW-12가 명시한 케이스.
    if (res.status === 404 || res.status === 400) {
      throw new DriveReconciliationError(
        `Drive API 복구 불가능한 오류 (status ${res.status}): ${text.slice(0, 300)}`
      );
    }
    throw new Error(`Drive API 요청 실패 (status ${res.status}): ${text.slice(0, 300)}`);
  }
  return res;
}

async function findOrCreateFolder(
  token: string,
  name: string,
  parentId: string,
  driveId: string
): Promise<string> {
  const q = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false and '${parentId}' in parents`
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
      parents: [parentId],
    }),
  });
  const created = (await createRes.json()) as { id: string };
  return created.id;
}

async function getSharedDriveId(token: string): Promise<string> {
  const drivesRes = await driveFetch(`${DRIVE_API}/drives`, token);
  const drivesData = (await drivesRes.json()) as { drives: Array<{ id: string; name: string }> };
  const sharedDrive = drivesData.drives.find(
    (d) => d.name.toLowerCase() === SHARED_DRIVE_NAME.toLowerCase()
  );
  if (!sharedDrive) throw new Error(`Shared Drive "${SHARED_DRIVE_NAME}"를 찾을 수 없습니다.`);
  return sharedDrive.id;
}

/**
 * 학생→과목→연도→세션 4단계 폴더 경로를 만들고(이미 있으면 재사용), 최종 세션
 * 폴더 id를 반환한다.
 */
export async function ensureSessionFolderPath(
  token: string,
  params: { studentName: string; subjectName: string; year: string; sessionId: string }
): Promise<string> {
  const driveId = await getSharedDriveId(token);
  const studentFolder = await findOrCreateFolder(token, params.studentName, driveId, driveId);
  const subjectFolder = await findOrCreateFolder(token, params.subjectName, studentFolder, driveId);
  const yearFolder = await findOrCreateFolder(token, params.year, subjectFolder, driveId);
  return findOrCreateFolder(token, `session-${params.sessionId}`, yearFolder, driveId);
}

/** 선생님 배정 이벤트에 따른 폴더 권한 부여. */
export async function grantSessionFolderPermission(
  token: string,
  folderId: string,
  teacherEmail: string
): Promise<void> {
  await driveFetch(
    `${DRIVE_API}/files/${folderId}/permissions?supportsAllDrives=true&sendNotificationEmail=false`,
    token,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "writer", type: "user", emailAddress: teacherEmail }),
    }
  );
}

/** 선생님 배정 종료 이벤트에 따른 폴더 권한 회수. */
export async function revokeSessionFolderPermission(
  token: string,
  folderId: string,
  permissionId: string
): Promise<void> {
  await driveFetch(
    `${DRIVE_API}/files/${folderId}/permissions/${permissionId}?supportsAllDrives=true`,
    token,
    { method: "DELETE" }
  );
}

export type SessionDriveTaskType = "folder_provision" | "permission_grant" | "permission_revoke";
export type SessionDriveTaskRow = {
  id: string;
  session_id: string;
  task_type: SessionDriveTaskType;
  payload: Record<string, unknown>;
  retry_count: number;
};

export async function queueSessionDriveTask(params: {
  sessionId: string;
  taskType: SessionDriveTaskType;
  payload: Record<string, unknown>;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("session_drive_tasks").insert({
    session_id: params.sessionId,
    task_type: params.taskType,
    payload: params.payload,
    status: "queued",
  });
  if (error) {
    // 큐잉 실패는 호출부(배정 이벤트 처리)를 막지 않는다 — 정기 대조가 누락을 잡는다.
    console.error(
      JSON.stringify({
        type: "session_drive_task_queue_failed",
        sessionId: params.sessionId,
        taskType: params.taskType,
        error: error.message,
      })
    );
  }
}

async function performSessionDriveTask(token: string, row: SessionDriveTaskRow): Promise<void> {
  if (row.task_type === "folder_provision") {
    const p = row.payload as { studentName: string; subjectName: string; year: string };
    await ensureSessionFolderPath(token, {
      studentName: p.studentName,
      subjectName: p.subjectName,
      year: p.year,
      sessionId: row.session_id,
    });
    return;
  }
  if (row.task_type === "permission_grant") {
    const p = row.payload as { folderId: string; teacherEmail: string };
    await grantSessionFolderPermission(token, p.folderId, p.teacherEmail);
    return;
  }
  const p = row.payload as { folderId: string; permissionId: string };
  await revokeSessionFolderPermission(token, p.folderId, p.permissionId);
}

async function processOneSessionDriveTask(
  admin: ReturnType<typeof createAdminClient>,
  row: SessionDriveTaskRow
): Promise<void> {
  if (process.env.DRIVE_ARTIFACTS_ALLOW_REAL_WRITES !== "true") {
    throw new Error(
      "not implemented: DRIVE_ARTIFACTS_ALLOW_REAL_WRITES=true가 아니면 실제 Drive 호출을 하지 않습니다."
    );
  }
  const token = await getDriveApiAccessToken();
  await performSessionDriveTask(token, row);
}

/**
 * queued 상태 session_drive_tasks를 처리하는 워커(lib/drive-artifacts.ts의
 * processQueuedDriveArtifacts와 동일한 조건부 UPDATE claim 패턴). 재처리 배치도
 * 이 함수를 그대로 재사용한다 — manual_review/reconciliation_needed 행을
 * requeueSessionDriveTasks로 'queued'로 되돌린 뒤 이 함수를 다시 호출하면 된다.
 */
export async function processQueuedSessionDriveTasks(): Promise<{
  attempted: number;
  succeeded: number;
  retryableFailed: number;
  manualReview: number;
  reconciliationNeeded: number;
  skippedRace: number;
}> {
  const admin = createAdminClient();

  const { data: candidates, error } = await admin
    .from("session_drive_tasks")
    .select("id, session_id, task_type, payload, retry_count")
    .eq("status", "queued");
  if (error) throw new Error(error.message);

  let succeeded = 0;
  let retryableFailed = 0;
  let manualReview = 0;
  let reconciliationNeeded = 0;
  let skippedRace = 0;

  for (const row of (candidates ?? []) as SessionDriveTaskRow[]) {
    const { data: claimed, error: claimError } = await admin
      .from("session_drive_tasks")
      .update({ status: "processing" })
      .eq("id", row.id)
      .eq("status", "queued")
      .select("id");
    if (claimError) throw new Error(claimError.message);
    if (!claimed || claimed.length === 0) {
      skippedRace += 1;
      continue;
    }

    try {
      await processOneSessionDriveTask(admin, row);
      await admin
        .from("session_drive_tasks")
        .update({ status: "succeeded", last_error: null, processed_at: new Date().toISOString() })
        .eq("id", row.id);
      succeeded += 1;
    } catch (taskError) {
      const message = taskError instanceof Error ? taskError.message : String(taskError);
      if (taskError instanceof DriveReconciliationError) {
        // 잘못된 fileId 등 복구 불가능한 오류 — 재시도하지 않고 즉시 관리자 대조 큐로.
        await admin
          .from("session_drive_tasks")
          .update({ status: "reconciliation_needed", last_error: message })
          .eq("id", row.id);
        reconciliationNeeded += 1;
      } else {
        const nextRetryCount = row.retry_count + 1;
        const exceededLimit = nextRetryCount > MAX_RETRY_COUNT;
        await admin
          .from("session_drive_tasks")
          .update({
            status: exceededLimit ? "manual_review" : "retryable_failed",
            retry_count: nextRetryCount,
            last_error: message,
          })
          .eq("id", row.id);
        if (exceededLimit) manualReview += 1;
        else retryableFailed += 1;
      }
      console.error(
        JSON.stringify({
          type: "session_drive_task_process_failed",
          taskId: row.id,
          sessionId: row.session_id,
          taskType: row.task_type,
          error: message,
        })
      );
    }
  }

  return {
    attempted: (candidates ?? []).length,
    succeeded,
    retryableFailed,
    manualReview,
    reconciliationNeeded,
    skippedRace,
  };
}

/**
 * 재처리 배치: manual_review/reconciliation_needed 상태의 작업을 관리자가 원인
 * 해소 후(예: 잘못된 fileId를 payload에서 고쳐 재입력) 다시 'queued'로 되돌린다.
 * retry_count는 유지한다(누적 재시도 이력 보존) — 다음 processQueuedSessionDriveTasks
 * 호출에서 실제 재처리가 일어난다.
 */
export async function requeueSessionDriveTasks(taskIds: string[]): Promise<number> {
  if (taskIds.length === 0) return 0;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("session_drive_tasks")
    .update({ status: "queued", last_error: null })
    .in("id", taskIds)
    .in("status", ["manual_review", "reconciliation_needed"])
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}

export { MAX_RETRY_COUNT };
