// R12 Drive 링크 실제 클릭 검증 전용 임시 라우트(2026-09-23).
// 검증 완료 후 이 파일 전체를 삭제할 것 — docs/CURRENT.md R12 blocker 참고.
// R3(lib/drive-artifacts.ts)와 동일한 preview 전용 최소권한 경로(getR3PreviewDriveAccessToken)를
// 재사용해, "ALTON Integration Sandbox/R3 Test" 폴더에 테스트 문서를 만들고
// session_drive_tasks에 smart_notes_reader_grant 태스크를 큐잉 후 즉시 처리한다.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { getR3PreviewDriveAccessToken } from "@/lib/drive-preview-verify-auth";
import { processQueuedSessionDriveTasks } from "@/lib/drive-session-tasks";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
// R3 SA의 현재 Shared Drive 멤버십을 실측 확인한 결과("Alton Integration Sandbox"는
// 더 이상 보이지 않음, 2026-09-23) — 실제 접근 가능한 드라이브로 대체.
const SHARED_DRIVE_NAME = "ALTON Company Tutoring Resources";
const TEST_FOLDER_NAME = "R12 Drive Verify Test";

async function driveFetch(url: string, token: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Drive API ${res.status}: ${await res.text()}`);
  return res;
}

export async function GET(req: Request) {
  await requireAdmin();
  const { searchParams } = new URL(req.url);
  const fileId = searchParams.get("fileId");
  if (!fileId) return NextResponse.json({ error: "fileId required" }, { status: 400 });
  const token = await getR3PreviewDriveAccessToken();
  const permsRes = await driveFetch(
    `${DRIVE_API}/files/${fileId}/permissions?supportsAllDrives=true&fields=permissions(id,type,role,emailAddress)`,
    token
  );
  return NextResponse.json(await permsRes.json());
}

export async function POST(req: Request) {
  await requireAdmin();
  const { studentEmail, sessionId } = (await req.json()) as { studentEmail: string; sessionId: string };
  if (!studentEmail || !sessionId) {
    return NextResponse.json({ error: "studentEmail, sessionId required" }, { status: 400 });
  }

  const token = await getR3PreviewDriveAccessToken();

  const drivesRes = await driveFetch(`${DRIVE_API}/drives?pageSize=100`, token);
  const drivesData = (await drivesRes.json()) as { drives: Array<{ id: string; name: string }> };
  const sharedDrive = drivesData.drives.find((d) => d.name.toLowerCase() === SHARED_DRIVE_NAME.toLowerCase());
  if (!sharedDrive) {
    return NextResponse.json(
      { error: `Shared Drive "${SHARED_DRIVE_NAME}" not found`, visibleDrives: drivesData.drives },
      { status: 500 }
    );
  }

  const folderQ = encodeURIComponent(
    `name='${TEST_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false and '${sharedDrive.id}' in parents`
  );
  const folderListRes = await driveFetch(
    `${DRIVE_API}/files?q=${folderQ}&includeItemsFromAllDrives=true&supportsAllDrives=true&fields=files(id,name)&driveId=${sharedDrive.id}&corpora=drive`,
    token
  );
  const folderListData = (await folderListRes.json()) as { files: Array<{ id: string }> };
  let folderId = folderListData.files[0]?.id;
  if (!folderId) {
    const createFolderRes = await driveFetch(`${DRIVE_API}/files?supportsAllDrives=true&fields=id`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: TEST_FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
        parents: [sharedDrive.id],
      }),
    });
    const createdFolder = (await createFolderRes.json()) as { id: string };
    folderId = createdFolder.id;
  }

  const fileName = `r12-drive-verify-${Date.now()}.txt`;
  const metadata = { name: fileName, parents: [folderId], mimeType: "text/plain" };
  const boundary = "r12driveverify";
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: text/plain\r\n\r\n` +
    "R12 Drive click-through verification test file. Safe to delete." +
    `\r\n--${boundary}--`;
  const createRes = await driveFetch(
    `${DRIVE_UPLOAD_API}/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink`,
    token,
    { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body: Buffer.from(body, "binary") }
  );
  const created = (await createRes.json()) as { id: string; webViewLink: string };

  const admin = createAdminClient();
  const { data: task, error: taskErr } = await admin
    .from("session_drive_tasks")
    .insert({
      session_id: sessionId,
      task_type: "smart_notes_reader_grant",
      payload: { fileId: created.id, studentEmail },
      status: "queued",
      retry_count: 0,
    })
    .select("id")
    .single();
  if (taskErr) return NextResponse.json({ error: taskErr.message }, { status: 500 });

  const result = await processQueuedSessionDriveTasks();

  const { data: taskRow } = await admin.from("session_drive_tasks").select("status, last_error").eq("id", task.id).single();

  return NextResponse.json({ fileId: created.id, webViewLink: created.webViewLink, taskId: task.id, taskStatus: taskRow, batchResult: result });
}
