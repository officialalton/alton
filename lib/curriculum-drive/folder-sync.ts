import { DRIVE_API } from "@/lib/drive/fetch";

// ALTON 분류 → Drive 폴더 반영(단방향). 구조는 **과목 → 키워드**(2026-09-14 정정).
//
// DB 큐(curriculum_drive_folders)에 pending / rename_pending 으로 쌓인 것을 순서대로
// 처리한다. 과목 → 키워드 순이어야 상위 폴더 id 가 먼저 생긴다. 단원·회차는 Drive 폴더를
// 만들지 않는다(예전 구조의 unit 행은 retired). 실제 Drive 쓰기는 allowRealWrites 가
// 켜졌을 때만 하고, 꺼져 있으면 **무엇을 할지 계획만** 돌려준다(dry run). 실패는 행에
// 사유를 남기고 다음에 다시 시도한다. 삭제는 없다 — 보관은 Drive 삭제로 이어지지 않는다.
//
// 이 파일은 네트워크·DB 를 인자로 받는다(주입). 그래서 실제 Drive 없이 테스트한다.

export type FolderRow = {
  id: string;
  scope: "subject" | "unit" | "keyword";
  ref_id: string;
  desired_name: string;
  applied_name: string | null;
  drive_folder_id: string | null;
  sync_status: "pending" | "created" | "rename_pending" | "failed" | "retired";
  attempts: number;
};

/** 상위를 찾기 위한 분류 관계. 키워드는 과목 하나에 속한다(단원과는 N:M — 폴더와 무관). */
export type ClassificationLinks = {
  keywordSubject: Map<string, string>; // keyword_id → subject_id
};

export type PlannedOp =
  | { kind: "create"; row: FolderRow; parentDriveFolderId: string }
  | { kind: "rename"; row: FolderRow; driveFolderId: string; name: string }
  | { kind: "skip"; row: FolderRow; reason: string };

const SCOPE_ORDER: Record<FolderRow["scope"], number> = { subject: 0, unit: 1, keyword: 2 };

/**
 * 큐를 읽어 할 일을 정한다. 상위(과목) 폴더가 아직 없으면 그 키워드는 이번에 건너뛴다(사유 기록) —
 * 다음 실행에서 과목 폴더가 생긴 뒤 다시 잡힌다. retired(예전 단원 폴더) 행은 건드리지 않는다.
 */
export function planFolderOps(
  rows: FolderRow[],
  links: ClassificationLinks,
  rootFolderId: string
): PlannedOp[] {
  const byRef = new Map<string, FolderRow>();
  for (const r of rows) byRef.set(`${r.scope}:${r.ref_id}`, r);
  const driveIdOf = (scope: FolderRow["scope"], refId: string): string | null =>
    byRef.get(`${scope}:${refId}`)?.drive_folder_id ?? null;

  const ops: PlannedOp[] = [];
  const sorted = [...rows].sort((a, b) => SCOPE_ORDER[a.scope] - SCOPE_ORDER[b.scope]);

  for (const row of sorted) {
    if (row.sync_status === "created" || row.sync_status === "retired") continue;
    if (row.scope === "unit") continue; // 단원 폴더는 만들지 않는다

    if (row.sync_status === "rename_pending") {
      if (!row.drive_folder_id) {
        ops.push({ kind: "skip", row, reason: "폴더 id 가 없어 이름을 바꿀 수 없습니다." });
      } else {
        ops.push({ kind: "rename", row, driveFolderId: row.drive_folder_id, name: row.desired_name });
      }
      continue;
    }

    // pending / failed → 만든다. 상위가 있어야 한다.
    let parent: string | null = null;
    if (row.scope === "subject") {
      parent = rootFolderId;
    } else {
      const subjectId = links.keywordSubject.get(row.ref_id);
      parent = subjectId ? driveIdOf("subject", subjectId) : null;
      if (!parent) {
        ops.push({ kind: "skip", row, reason: "과목 폴더가 아직 없습니다." });
        continue;
      }
    }
    // 이번 실행에서 만들어질 상위는 아직 id 가 없다 — 그 자식은 다음 실행에서.
    ops.push({ kind: "create", row, parentDriveFolderId: parent });
  }
  return ops;
}

export type DriveFolderApi = {
  /** 기록된 폴더가 아직 있는가(휴지통도 없음으로 본다). 사람이 Drive 에서 지웠으면 다시 만든다. */
  folderExists(folderId: string): Promise<boolean>;
  /** 같은 상위 아래 같은 이름의 폴더가 이미 있으면 그 id — 중복 생성을 막는다. */
  findChildFolder(parentId: string, name: string): Promise<string | null>;
  createFolder(parentId: string, name: string): Promise<string>;
  renameFolder(folderId: string, name: string): Promise<void>;
};

export function driveFolderApi(fetchImpl: typeof fetch, token: string, driveId: string): DriveFolderApi {
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const fail = async (res: Response, what: string) => {
    const text = await res.text();
    throw new Error(`${what} 실패 (status ${res.status}): ${text.slice(0, 200)}`);
  };
  return {
    async folderExists(folderId) {
      const res = await fetchImpl(`${DRIVE_API}/files/${folderId}?supportsAllDrives=true&fields=id,trashed`, { headers });
      if (res.status === 404) return false;
      if (!res.ok) await fail(res, "폴더 확인");
      const data = (await res.json()) as { id?: string; trashed?: boolean };
      return Boolean(data.id) && !data.trashed;
    },
    async findChildFolder(parentId, name) {
      const escaped = name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      const q = encodeURIComponent(
        `'${parentId}' in parents and name = '${escaped}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
      );
      const res = await fetchImpl(
        `${DRIVE_API}/files?q=${q}&corpora=drive&driveId=${driveId}&includeItemsFromAllDrives=true&supportsAllDrives=true&fields=files(id)`,
        { headers }
      );
      if (!res.ok) await fail(res, "폴더 조회");
      const data = (await res.json()) as { files?: { id: string }[] };
      return data.files?.[0]?.id ?? null;
    },
    async createFolder(parentId, name) {
      const res = await fetchImpl(`${DRIVE_API}/files?supportsAllDrives=true&fields=id`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
      });
      if (!res.ok) await fail(res, "폴더 생성");
      const data = (await res.json()) as { id: string };
      return data.id;
    },
    async renameFolder(folderId, name) {
      const res = await fetchImpl(`${DRIVE_API}/files/${folderId}?supportsAllDrives=true&fields=id`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ name }),
      });
      if (!res.ok) await fail(res, "폴더 이름 변경");
    },
  };
}

export type FolderStore = {
  /** 기록된 폴더가 Drive 에서 사라졌다 — id 를 잊고 다시 만들 대상으로 되돌린다. */
  markMissing(rowId: string): Promise<void>;
  markCreated(rowId: string, driveFolderId: string, appliedName: string): Promise<void>;
  markRenamed(rowId: string, appliedName: string): Promise<void>;
  markFailed(rowId: string, error: string): Promise<void>;
};

export type SyncOutcome = {
  created: number;
  renamed: number;
  skipped: { rowId: string; reason: string }[];
  failed: { rowId: string; error: string }[];
  dryRun: boolean;
};

/** 계획을 실행한다. allowRealWrites 가 꺼져 있으면 아무것도 쓰지 않고 계획만 요약한다. */
export async function executeFolderOps(
  ops: PlannedOp[],
  api: DriveFolderApi,
  store: FolderStore,
  allowRealWrites: boolean
): Promise<SyncOutcome> {
  const out: SyncOutcome = { created: 0, renamed: 0, skipped: [], failed: [], dryRun: !allowRealWrites };
  for (const op of ops) {
    if (op.kind === "skip") {
      out.skipped.push({ rowId: op.row.id, reason: op.reason });
      continue;
    }
    if (!allowRealWrites) {
      // 계획만. 무엇을 만들고 바꿀지는 세지만 Drive 도 DB 도 건드리지 않는다.
      if (op.kind === "create") out.created += 1;
      else out.renamed += 1;
      continue;
    }
    try {
      if (op.kind === "create") {
        const existing = await api.findChildFolder(op.parentDriveFolderId, op.row.desired_name);
        const id = existing ?? (await api.createFolder(op.parentDriveFolderId, op.row.desired_name));
        await store.markCreated(op.row.id, id, op.row.desired_name);
        out.created += 1;
      } else {
        await api.renameFolder(op.driveFolderId, op.name);
        await store.markRenamed(op.row.id, op.name);
        out.renamed += 1;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await store.markFailed(op.row.id, message);
      out.failed.push({ rowId: op.row.id, error: message });
    }
  }
  return out;
}

/**
 * 기록된 폴더 id 가 아직 살아 있는지 확인한다(읽기만). 사라졌으면 행을 pending 으로 되돌린 목록을
 * 돌려준다 — 그 자식(키워드 폴더)은 이번 계획에서 "과목 폴더가 아직 없습니다"로 건너뛰고 다음
 * 실행에서 새 폴더 아래 만들어진다. 사람이 Drive 에서 폴더를 정리해도 연결이 스스로 회복된다.
 */
export async function reconcileRecordedFolders(
  rows: FolderRow[],
  api: DriveFolderApi,
  store: FolderStore
): Promise<{ checked: number; missing: string[]; rows: FolderRow[] }> {
  const missing: string[] = [];
  const next: FolderRow[] = [];
  let checked = 0;
  for (const row of rows) {
    if (!row.drive_folder_id || row.sync_status === "retired") {
      next.push(row);
      continue;
    }
    checked += 1;
    let exists = true;
    try {
      exists = await api.folderExists(row.drive_folder_id);
    } catch {
      exists = true; // 확인 실패는 "있다"로 둔다 — 잘못 다시 만드는 것보다 낫다.
    }
    if (exists) {
      next.push(row);
    } else {
      missing.push(row.id);
      await store.markMissing(row.id);
      next.push({ ...row, drive_folder_id: null, applied_name: null, sync_status: "pending" });
    }
  }
  return { checked, missing, rows: next };
}
