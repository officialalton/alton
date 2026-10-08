// 키워드 로더 공용: subject_keywords 의 폴더 컬럼 select 조각과 행 → 필드 매핑.
export const KEYWORD_FOLDER_SELECT = "folder_id, sort_order, content_code, level, parent_keyword_id, est_lessons, folder:subject_keyword_folders(name, position)";

type FolderRel = { name: string; position: number } | { name: string; position: number }[] | null;
export type KeywordFolderRow = { folder_id?: string | null; sort_order?: number | null; content_code?: string | null; level?: number | null; parent_keyword_id?: string | null; est_lessons?: number | null; folder?: FolderRel };

export function keywordFolderFields(row: KeywordFolderRow) {
  const rel = Array.isArray(row.folder) ? row.folder[0] : row.folder;
  return {
    folderId: row.folder_id ?? null,
    folderName: rel?.name ?? null,
    folderPosition: rel?.position ?? null,
    sortOrder: row.sort_order ?? 0,
    // AP 커리큘럼(2026-10-08): 공식 코드(토픽 "5.3", 세부 "5.3#2"), 레벨(0 기존 · 1 토픽 · 2 세부), 부모 토픽 id.
    officialCode: row.content_code ?? null,
    level: row.level ?? 0,
    parentKeywordId: row.parent_keyword_id ?? null,
    estLessons: row.est_lessons ?? null,
  };
}

export type KeywordFolderFields = Partial<ReturnType<typeof keywordFolderFields>>;
