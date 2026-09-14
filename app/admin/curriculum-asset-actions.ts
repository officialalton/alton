"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { driveFetch, getDriveTokenForCurrentEnv, DRIVE_API } from "@/lib/drive/fetch";
import { curriculumDriveConfig } from "@/lib/curriculum-drive/config";
import {
  driveFolderApi,
  executeFolderOps,
  planFolderOps,
  reconcileRecordedFolders,
  type FolderRow,
  type SyncOutcome,
} from "@/lib/curriculum-drive/folder-sync";
import { extensionForKind, kindForMime, probePdf, sha256Hex } from "@/lib/curriculum-assets/pdf";

// Drive 기반 PDF·영상 자료 — 관리자 서버 액션.
//
// 2026-09-14 제품 오너: 관리자는 Drive 에 파일을 올리고, ALTON 은 그 파일을 자료로
// 가져와 분류·순서·공개 버전을 관리한다. 업로드만으로 공개되지 않는다 — 관리자가
// 파일·제목·순서를 확인하고 공개한다. 공개할 때는 그 시점의 내용을 **고정 사본**으로
// 확보한다(파일 id·수정 시각 기록으로 대신하지 않는다). 사본 확보에 실패하면 공개
// 성공으로 처리하지 않는다.
//
// 실제 Drive 쓰기(폴더 생성·이름 변경)는 CURRICULUM_DRIVE_ALLOW_REAL_WRITES 가 켜졌을
// 때만 한다. 읽기(목록·내려받기)는 CURRICULUM_DRIVE_ENABLED 만으로 된다.

const ASSET_BUCKET = "curriculum-assets";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("관리자만 사용할 수 있습니다.");
  return { supabase, user };
}

// ---------------------------------------------------------------- 목록

export type DriveMaterialCandidate = {
  fileId: string;
  name: string;
  mimeType: string;
  kind: "pdf" | "video" | null;
  sizeBytes: number | null;
  modifiedAt: string | null;
  /** 이미 자료로 등록돼 있으면 그 교재 id — 두 번 등록하지 않는다. */
  registeredDocId: string | null;
};

export type DriveMaterialListResult =
  | { state: "not_configured" }
  | { state: "folder_not_linked"; reason: string }
  | { state: "fetch_failed"; reason: string }
  | { state: "ok"; folderId: string; files: DriveMaterialCandidate[] };

/**
 * 키워드 폴더의 파일을 자료 후보로 가져온다(읽기만).
 *
 * 폴더는 이름이 아니라 id(curriculum_drive_folders.drive_folder_id)로 찾는다. 폴더가 아직
 * 만들어지지 않았거나 연결되지 않았으면 그 사실을 돌려준다 — 이름으로 찾아 헤매지 않는다.
 */
export async function listKeywordDriveFilesAction(keywordId: string): Promise<DriveMaterialListResult> {
  const { supabase } = await requireAdmin();
  const config = curriculumDriveConfig();
  if (!config) return { state: "not_configured" };

  const { data: folder } = await supabase
    .from("curriculum_drive_folders")
    .select("drive_folder_id, sync_status, last_error")
    .eq("scope", "keyword")
    .eq("ref_id", keywordId)
    .maybeSingle();
  if (!folder?.drive_folder_id) {
    return {
      state: "folder_not_linked",
      reason:
        (folder?.sync_status as string | undefined) === "failed"
          ? `키워드 폴더를 만들지 못했습니다: ${folder?.last_error ?? "사유 없음"}`
          : "키워드 폴더가 아직 Drive 에 만들어지지 않았습니다. 폴더 동기화를 먼저 실행하세요.",
    };
  }
  const folderId = folder.drive_folder_id as string;

  try {
    const token = await getDriveTokenForCurrentEnv();
    const q = encodeURIComponent(
      `'${folderId}' in parents and trashed=false and mimeType != 'application/vnd.google-apps.folder'`
    );
    const url =
      `${DRIVE_API}/files?q=${q}&corpora=drive&driveId=${config.driveId}` +
      `&includeItemsFromAllDrives=true&supportsAllDrives=true` +
      `&fields=files(id,name,mimeType,size,modifiedTime)&orderBy=name`;
    const res = await driveFetch(url, token);
    const data = (await res.json()) as {
      files?: { id: string; name: string; mimeType: string; size?: string; modifiedTime?: string }[];
    };
    const files = data.files ?? [];

    const { data: registered } = files.length
      ? await supabase
          .from("curriculum_docs")
          .select("id, source_drive_file_id")
          .in(
            "source_drive_file_id",
            files.map((f) => f.id)
          )
      : { data: [] as { id: string; source_drive_file_id: string }[] };
    const docByFile = new Map((registered ?? []).map((r) => [r.source_drive_file_id as string, r.id as string]));

    return {
      state: "ok",
      folderId,
      files: files.map((f) => ({
        fileId: f.id,
        name: f.name,
        mimeType: f.mimeType,
        kind: kindForMime(f.mimeType),
        sizeBytes: f.size ? Number(f.size) : null,
        modifiedAt: f.modifiedTime ?? null,
        registeredDocId: docByFile.get(f.id) ?? null,
      })),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(JSON.stringify({ event: "curriculum_drive_list_failed", keywordId, message }));
    return { state: "fetch_failed", reason: message };
  }
}

// ---------------------------------------------------------------- 등록

export type ImportResult = { ok: true; docId: string } | { ok: false; error: string };

/**
 * Drive 파일 하나를 자료 한 건(초안)으로 등록한다. 공개하지 않는다.
 * 대표 키워드는 그 폴더의 키워드이고, 단원·과목은 키워드에서 온다.
 */
export async function importDriveFileAction(keywordId: string, fileId: string): Promise<ImportResult> {
  const { supabase } = await requireAdmin();
  const config = curriculumDriveConfig();
  if (!config) return { ok: false, error: "교재 Drive 연결이 설정되지 않았습니다." };

  const { data: keyword } = await supabase
    .from("subject_keywords")
    .select("id, subject_id, label")
    .eq("id", keywordId)
    .maybeSingle();
  if (!keyword) return { ok: false, error: "존재하지 않는 키워드입니다." };

  let meta: { id: string; name: string; mimeType: string; modifiedTime?: string; driveId?: string };
  try {
    const token = await getDriveTokenForCurrentEnv();
    const res = await driveFetch(
      `${DRIVE_API}/files/${fileId}?supportsAllDrives=true&fields=id,name,mimeType,modifiedTime,driveId`,
      token
    );
    meta = (await res.json()) as typeof meta;
  } catch (e) {
    return { ok: false, error: `Drive 파일 정보를 읽지 못했습니다: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (meta.driveId && meta.driveId !== config.driveId) {
    return { ok: false, error: "교재 전용 Drive 밖의 파일은 등록하지 않습니다." };
  }
  const kind = kindForMime(meta.mimeType);
  if (!kind) return { ok: false, error: `PDF·영상만 자료로 등록합니다 (${meta.mimeType}).` };

  const { data: last } = await supabase
    .from("curriculum_docs")
    .select("primary_keyword_position")
    .eq("primary_keyword_id", keywordId)
    .order("primary_keyword_position", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = ((last?.primary_keyword_position as number | null) ?? 0) + 1;

  const { data, error } = await supabase
    .from("curriculum_docs")
    .insert({
      title: meta.name.replace(/\.[^.]+$/, ""),
      subject_id: keyword.subject_id,
      // 자료는 키워드에 속한다. 단원·회차 배치는 커리큘럼(회차 구성)이 한다 — 여기서 단원을 정하지 않는다.
      unit_id: null,
      owner_type: "admin",
      owner_teacher_id: null,
      status: "draft",
      kind,
      source_drive_file_id: meta.id,
      source_drive_name: meta.name,
      source_mime_type: meta.mimeType,
      source_drive_modified_time: meta.modifiedTime ?? null,
      primary_keyword_id: keywordId,
      primary_keyword_position: nextPosition,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, error: "이미 등록된 파일입니다." };
    return { ok: false, error: error.message };
  }
  return { ok: true, docId: data.id as string };
}

// ---------------------------------------------------------------- 공개

export type PublishAssetResult =
  | { ok: true; versionId: string; pageCount: number | null; bytes: number }
  | { ok: false; error: string };

type AssetRef = {
  bucket: string;
  path: string;
  bytes: number;
  sha256: string;
  mimeType: string;
  pageCount?: number;
  sourceDriveFileId: string | null;
  sourceDriveName: string | null;
  sourceModifiedTime: string | null;
};

/**
 * 바이트를 고정 사본으로 올리고 공개 RPC 를 부른다. RPC 가 거절하면 올린 사본을 지운다 —
 * 참조 없는 사본을 남기지 않는다. 사본 업로드가 실패하면 RPC 를 부르지 않는다.
 */
async function publishBytes(
  docId: string,
  kind: "pdf" | "video",
  mimeType: string,
  bytes: Uint8Array,
  source: { fileId: string | null; name: string | null; modifiedTime: string | null }
): Promise<PublishAssetResult> {
  let pageCount: number | null = null;
  if (kind === "pdf") {
    try {
      pageCount = (await probePdf(bytes)).pageCount;
    } catch (e) {
      return { ok: false, error: `PDF 를 읽지 못해 공개하지 않았습니다: ${e instanceof Error ? e.message : String(e)}` };
    }
  }
  const sha256 = sha256Hex(bytes);
  const path = `${docId}/${sha256.slice(0, 16)}.${extensionForKind(kind, mimeType)}`;

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from(ASSET_BUCKET)
    .upload(path, Buffer.from(bytes), { contentType: mimeType, upsert: true });
  if (uploadError) {
    console.error(JSON.stringify({ event: "curriculum_asset_upload_failed", docId, message: uploadError.message }));
    return { ok: false, error: "고정 사본을 저장하지 못해 공개하지 않았습니다." };
  }

  const asset: AssetRef = {
    bucket: ASSET_BUCKET,
    path,
    bytes: bytes.byteLength,
    sha256,
    mimeType,
    ...(pageCount !== null ? { pageCount } : {}),
    sourceDriveFileId: source.fileId,
    sourceDriveName: source.name,
    sourceModifiedTime: source.modifiedTime,
  };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_curriculum_asset_doc", {
    p_doc_id: docId,
    p_asset: asset,
  });
  if (error) {
    // 같은 내용의 재공개는 경로가 같아 기존 버전의 사본과 겹친다(upsert). 그때는 지우지
    // 않는다 — 기존 버전이 그 경로를 쓰고 있을 수 있다.
    const { data: existing } = await admin
      .from("curriculum_doc_versions")
      .select("id")
      .eq("curriculum_doc_id", docId)
      .filter("snapshot->asset->>path", "eq", path)
      .limit(1);
    if (!existing?.length) await admin.storage.from(ASSET_BUCKET).remove([path]);
    console.error(JSON.stringify({ event: "curriculum_asset_publish_failed", docId, message: error.message }));
    return { ok: false, error: error.message.replace(/^.*?:\s*/, "") };
  }
  return { ok: true, versionId: data as string, pageCount, bytes: bytes.byteLength };
}

/** Drive 원본을 지금 내려받아 고정 사본으로 공개한다. */
export async function publishAssetDocAction(docId: string): Promise<PublishAssetResult> {
  const { supabase } = await requireAdmin();
  const config = curriculumDriveConfig();

  const { data: doc } = await supabase
    .from("curriculum_docs")
    .select("id, kind, source_drive_file_id, source_mime_type, source_drive_name, primary_keyword_id")
    .eq("id", docId)
    .maybeSingle();
  if (!doc) return { ok: false, error: "존재하지 않는 교재입니다." };
  const kind = doc.kind as string;
  if (kind !== "pdf" && kind !== "video") return { ok: false, error: "HTML 교재는 교재 편집 화면에서 공개합니다." };
  if (!doc.primary_keyword_id) return { ok: false, error: "대표 키워드를 먼저 정하세요 — 자료 하나에 대표 키워드 하나입니다." };
  if (!doc.source_drive_file_id) return { ok: false, error: "Drive 원본이 없는 자료입니다." };
  if (!config) return { ok: false, error: "교재 Drive 연결이 설정되지 않았습니다." };

  let bytes: Uint8Array;
  let meta: { name: string; mimeType: string; modifiedTime?: string; driveId?: string };
  try {
    const token = await getDriveTokenForCurrentEnv();
    const metaRes = await driveFetch(
      `${DRIVE_API}/files/${doc.source_drive_file_id}?supportsAllDrives=true&fields=id,name,mimeType,modifiedTime,driveId`,
      token
    );
    meta = (await metaRes.json()) as typeof meta;
    if (meta.driveId && meta.driveId !== config.driveId) {
      return { ok: false, error: "원본이 교재 전용 Drive 밖으로 옮겨졌습니다. 공개하지 않았습니다." };
    }
    const res = await driveFetch(
      `${DRIVE_API}/files/${doc.source_drive_file_id}?alt=media&supportsAllDrives=true`,
      token
    );
    bytes = new Uint8Array(await res.arrayBuffer());
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(JSON.stringify({ event: "curriculum_asset_fetch_failed", docId, message }));
    return { ok: false, error: `원본을 내려받지 못해 공개하지 않았습니다: ${message}` };
  }

  const mimeType = meta.mimeType || (doc.source_mime_type as string) || (kind === "pdf" ? "application/pdf" : "video/mp4");
  if (kindForMime(mimeType) !== kind) {
    return { ok: false, error: "원본 파일 종류가 등록 때와 다릅니다. 공개하지 않았습니다." };
  }
  const result = await publishBytes(docId, kind, mimeType, bytes, {
    fileId: doc.source_drive_file_id as string,
    name: meta.name ?? (doc.source_drive_name as string | null),
    modifiedTime: meta.modifiedTime ?? null,
  });
  if (result.ok) {
    await supabase
      .from("curriculum_docs")
      .update({
        source_drive_name: meta.name ?? doc.source_drive_name,
        source_mime_type: mimeType,
        source_drive_modified_time: meta.modifiedTime ?? null,
      })
      .eq("id", docId);
  }
  return result;
}

/**
 * 로컬 파일로 자료를 등록하고 곧바로 고정 사본으로 공개한다 — **검증용 경로**.
 *
 * 실제 Drive 접근이 없을 때 뷰어·필기·저장을 계속 검증하기 위한 것이다(2026-09-14
 * 지시). Drive 원본이 없으므로 source_drive_file_id 는 비어 있고, 화면은 이를 "로컬 표본"
 * 으로 표시한다. 관리자만.
 */
export async function registerLocalSampleAssetAction(
  formData: FormData
): Promise<{ ok: true; docId: string; versionId: string; pageCount: number | null } | { ok: false; error: string }> {
  const { supabase } = await requireAdmin();
  const file = formData.get("file");
  const subjectId = String(formData.get("subjectId") ?? "");
  const keywordId = String(formData.get("keywordId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!(file instanceof File)) return { ok: false, error: "파일을 고르세요." };
  if (!subjectId) return { ok: false, error: "과목을 고르세요." };
  const kind = kindForMime(file.type);
  if (!kind) return { ok: false, error: "PDF·영상만 등록합니다." };
  if (file.size > 100 * 1024 * 1024) return { ok: false, error: "100MB 를 넘는 파일은 이 경로로 올리지 않습니다." };

  let unitId: string | null = null;
  if (keywordId) {
    const { data: keyword } = await supabase
      .from("subject_keywords")
      .select("subject_id, unit_id")
      .eq("id", keywordId)
      .maybeSingle();
    if (!keyword) return { ok: false, error: "존재하지 않는 키워드입니다." };
    if (keyword.subject_id !== subjectId) return { ok: false, error: "키워드가 이 과목의 것이 아닙니다." };
    unitId = (keyword.unit_id as string | null) ?? null;
  }

  const { data: created, error } = await supabase
    .from("curriculum_docs")
    .insert({
      title: title || file.name.replace(/\.[^.]+$/, ""),
      subject_id: subjectId,
      unit_id: unitId,
      owner_type: "admin",
      owner_teacher_id: null,
      status: "draft",
      kind,
      source_mime_type: file.type,
      source_drive_name: file.name,
      primary_keyword_id: keywordId || null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  const docId = created.id as string;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await publishBytes(docId, kind, file.type, bytes, { fileId: null, name: file.name, modifiedTime: null });
  if (!result.ok) {
    // 공개되지 않은 초안을 남기지 않는다 — 다시 시도하면 새로 만든다.
    await supabase.from("curriculum_docs").delete().eq("id", docId);
    return result;
  }
  return { ok: true, docId, versionId: result.versionId, pageCount: result.pageCount };
}

// ---------------------------------------------------------------- 폴더 동기화

export type FolderSyncResult =
  | { state: "not_configured" }
  | { state: "drive_unreachable"; reason: string }
  | { state: "ok"; driveName: string; outcome: SyncOutcome & { missingRecreated: number }; pendingAfter: number };

/**
 * 큐에 쌓인 폴더 생성·이름 변경을 처리한다. 실제 쓰기 플래그가 꺼져 있으면 계획만
 * 돌려준다(dry run) — 무엇을 만들 것인지 사람이 먼저 본다.
 */
export async function runCurriculumDriveFolderSyncAction(): Promise<FolderSyncResult> {
  const { supabase } = await requireAdmin();
  const config = curriculumDriveConfig();
  if (!config) return { state: "not_configured" };

  const [{ data: rows }, { data: keywords }] = await Promise.all([
    supabase.from("curriculum_drive_folders").select("*").order("created_at", { ascending: true }),
    supabase.from("subject_keywords").select("id, subject_id").eq("status", "active"),
  ]);
  const links = {
    keywordSubject: new Map((keywords ?? []).map((k) => [k.id as string, k.subject_id as string])),
  };

  // 계획만 보는 경우에도 드라이브에 **읽기 한 번**은 한다 — 환경변수가 맞고 서비스 계정이
  // 그 드라이브에 들어갈 수 있는지를 실제 쓰기 전에 확인하기 위해서다. 쓰지는 않는다.
  let token: string;
  let driveName: string;
  try {
    token = await getDriveTokenForCurrentEnv();
    const res = await driveFetch(`${DRIVE_API}/drives/${config.driveId}?fields=id,name`, token);
    const meta = (await res.json()) as { id?: string; name?: string };
    driveName = meta.name ?? config.driveId;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(JSON.stringify({ event: "curriculum_drive_unreachable", message }));
    return { state: "drive_unreachable", reason: message };
  }
  const api = driveFolderApi(fetch, token, config.driveId);
  const admin = createAdminClient();
  const store = {
    async markMissing(rowId: string) {
      await admin
        .from("curriculum_drive_folders")
        .update({ drive_folder_id: null, applied_name: null, sync_status: "pending", last_error: "Drive 에서 폴더가 사라져 다시 만들 대상으로 되돌렸습니다.", updated_at: new Date().toISOString() })
        .eq("id", rowId);
    },
    async markCreated(rowId: string, driveFolderId: string, appliedName: string) {
      await admin
        .from("curriculum_drive_folders")
        .update({ drive_folder_id: driveFolderId, applied_name: appliedName, sync_status: "created", last_error: null, updated_at: new Date().toISOString() })
        .eq("id", rowId);
    },
    async markRenamed(rowId: string, appliedName: string) {
      await admin
        .from("curriculum_drive_folders")
        .update({ applied_name: appliedName, sync_status: "created", last_error: null, updated_at: new Date().toISOString() })
        .eq("id", rowId);
    },
    async markFailed(rowId: string, error: string) {
      const { data: cur } = await admin.from("curriculum_drive_folders").select("attempts").eq("id", rowId).maybeSingle();
      await admin
        .from("curriculum_drive_folders")
        .update({ sync_status: "failed", last_error: error.slice(0, 500), attempts: ((cur?.attempts as number) ?? 0) + 1, updated_at: new Date().toISOString() })
        .eq("id", rowId);
    },
  };

  // 기록된 폴더가 Drive 에 아직 있는지 먼저 확인한다(읽기). 사람이 지운 폴더는 다시 만들 대상이 된다.
  const reconciled = await reconcileRecordedFolders((rows ?? []) as FolderRow[], api, store);
  const ops = planFolderOps(reconciled.rows, links, config.rootFolderId);

  const outcome = await executeFolderOps(ops, api, store, config.allowRealWrites);
  const { count } = await supabase
    .from("curriculum_drive_folders")
    .select("*", { count: "exact", head: true })
    .in("sync_status", ["pending", "rename_pending", "failed"]);
  return { state: "ok", driveName, outcome: { ...outcome, missingRecreated: reconciled.missing.length }, pendingAfter: count ?? 0 };
}

// ---------------------------------------------------------------- 키워드 목록

export type SubjectKeywordRow = { keywordId: string; label: string };

/** 이 과목의 활성 키워드. 키워드는 과목 안에서 관리되고 여러 단원·회차에 연결된다(2026-09-14 정정). */
export async function listSubjectKeywordsAction(subjectId: string): Promise<SubjectKeywordRow[]> {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("subject_keywords")
    .select("id, label")
    .eq("subject_id", subjectId)
    .eq("status", "active")
    .order("label", { ascending: true });
  return (data ?? []).map((k) => ({ keywordId: k.id as string, label: k.label as string }));
}
