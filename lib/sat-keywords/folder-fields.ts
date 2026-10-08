// 키워드 로더 공용: subject_keywords 의 폴더 컬럼 select 조각과 행 → 필드 매핑.
export const KEYWORD_FOLDER_SELECT = "folder_id, sort_order, folder:subject_keyword_folders(name, position)";

type FolderRel = { name: string; position: number } | { name: string; position: number }[] | null;
export type KeywordFolderRow = { folder_id?: string | null; sort_order?: number | null; folder?: FolderRel };

export function keywordFolderFields(row: KeywordFolderRow) {
  const rel = Array.isArray(row.folder) ? row.folder[0] : row.folder;
  return {
    folderId: row.folder_id ?? null,
    folderName: rel?.name ?? null,
    folderPosition: rel?.position ?? null,
    sortOrder: row.sort_order ?? 0,
  };
}

export type KeywordFolderFields = Partial<ReturnType<typeof keywordFolderFields>>;
