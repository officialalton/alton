import type { KeywordFolder, SubjectKeyword } from "./subject-data";

// 과목 키워드 사전 관리 화면용 순수 헬퍼(UI와 분리해 테스트한다).

export type KeywordSection = {
  /** null = 폴더 없음("기타") */
  folderId: string | null;
  name: string;
  /** 검색 필터를 적용하기 전 이 폴더의 키워드 수 */
  total: number;
  keywords: SubjectKeyword[];
};

export const OTHER_FOLDER_NAME = "기타";

const keywordOrder = (a: SubjectKeyword, b: SubjectKeyword) =>
  (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.label.localeCompare(b.label);

/** 폴더 순서대로 섹션을 만들고, 폴더 없는 키워드는 마지막 "기타" 섹션에 둔다(비어 있으면 생략). 검색어는 키워드 이름만 거른다. */
export function buildKeywordSections(folders: KeywordFolder[], keywords: SubjectKeyword[], query = ""): KeywordSection[] {
  const q = query.trim().toLowerCase();
  const byFolder = new Map<string | null, SubjectKeyword[]>();
  const known = new Set(folders.map((f) => f.id));
  for (const k of keywords) {
    const key = k.folderId && known.has(k.folderId) ? k.folderId : null;
    const list = byFolder.get(key) ?? [];
    list.push(k);
    byFolder.set(key, list);
  }
  const sections: KeywordSection[] = [...folders]
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
    .map((f) => ({ folderId: f.id, name: f.name, all: (byFolder.get(f.id) ?? []).sort(keywordOrder) }))
    .map(({ all, ...f }) => ({ ...f, total: all.length, keywords: q ? all.filter((k) => k.label.toLowerCase().includes(q)) : all }));
  const others = (byFolder.get(null) ?? []).sort(keywordOrder);
  if (others.length > 0) {
    sections.push({
      folderId: null,
      name: OTHER_FOLDER_NAME,
      total: others.length,
      keywords: q ? others.filter((k) => k.label.toLowerCase().includes(q)) : others,
    });
  }
  // 검색 중에는 일치하는 키워드가 없는 섹션을 숨긴다.
  return q ? sections.filter((s) => s.keywords.length > 0) : sections;
}

/** 배열에서 index 항목을 delta(-1/+1)만큼 옮긴 새 배열. 범위를 벗어나면 그대로. */
export function moveItem<T>(list: readonly T[], index: number, delta: -1 | 1): T[] {
  const to = index + delta;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return [...list];
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}
