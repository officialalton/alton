import type { SupabaseClient } from "@supabase/supabase-js";

// 2026-09-15 — 과목별 전체 교재 보기(docs/2026-09-15-subject-material-library.md).
//   과목 → 단원(순서) → 키워드 → 공개된 자료 트리를 만든다. 접근 가능한 subjectId 목록은
//   호출자(학생/교사/보호자 각자의 수강·담당 로더)가 정하고, 이 함수는 그 안에서 공개된 것만 편다.
//   키워드가 여러 단원에 붙어 있으면(N:M) 그 자료는 각 단원 아래에 그대로 반복해서 나온다.

export type LibraryTreeDoc = {
  id: string;
  title: string;
  kind: "html" | "pdf" | "video";
};

export type LibraryTreeKeywordGroup = {
  /** null = 이 단원에 키워드 없이 걸린 적 없음(안 씀) / "단원 미지정" 묶음 안에서 키워드조차 없는 자료용. */
  keywordId: string | null;
  label: string;
  docs: LibraryTreeDoc[];
};

export type LibraryTreeUnitGroup = {
  /** null = "단원 미지정" 묶음. */
  unitId: string | null;
  unitTitle: string;
  keywordGroups: LibraryTreeKeywordGroup[];
};

export type LibrarySubjectTree = {
  subjectId: string;
  subjectName: string;
  units: LibraryTreeUnitGroup[];
  /** 이 과목 안에서 이전/다음 이동에 쓰는 평평한 순서(단원 → 키워드 → 자료 순, 같은 자료가 여러 단원에 걸리면 처음 나온 자리만). */
  flatDocIds: string[];
};

const UNASSIGNED_UNIT_TITLE = "단원 미지정";
const NO_KEYWORD_LABEL = "키워드 미지정";

export async function buildSubjectMaterialTree(
  supabase: SupabaseClient,
  subjectIds: string[]
): Promise<LibrarySubjectTree[]> {
  if (subjectIds.length === 0) return [];

  const [{ data: subjects }, { data: units }, { data: unitKeywords }, { data: keywords }, { data: docs }] =
    await Promise.all([
      supabase.from("subjects").select("id, name").in("id", subjectIds).is("archived_at", null).order("name", { ascending: true }),
      supabase.from("subject_template_units").select("id, subject_id, position, unit_title").in("subject_id", subjectIds).order("position", { ascending: true }),
      supabase.from("subject_template_unit_keywords").select("unit_id, keyword_id"),
      supabase.from("subject_keywords").select("id, subject_id, label").in("subject_id", subjectIds).eq("status", "active"),
      supabase
        .from("curriculum_docs")
        .select("id, title, kind, subject_id, primary_keyword_id")
        .in("subject_id", subjectIds)
        .eq("status", "published")
        .is("archived_at", null)
        .order("title", { ascending: true }),
    ]);

  type UnitRow = { id: string; subject_id: string; position: number; unit_title: string };
  type KeywordRow = { id: string; subject_id: string; label: string };
  type DocRow = { id: string; title: string; kind: string | null; subject_id: string; primary_keyword_id: string | null };

  const unitsBySubject = new Map<string, UnitRow[]>();
  for (const u of (units ?? []) as UnitRow[]) {
    const list = unitsBySubject.get(u.subject_id) ?? [];
    list.push(u);
    unitsBySubject.set(u.subject_id, list);
  }

  const keywordById = new Map<string, KeywordRow>();
  for (const k of (keywords ?? []) as KeywordRow[]) keywordById.set(k.id, k);

  const unitIdsByKeyword = new Map<string, string[]>();
  for (const uk of (unitKeywords ?? []) as { unit_id: string; keyword_id: string }[]) {
    const list = unitIdsByKeyword.get(uk.keyword_id) ?? [];
    list.push(uk.unit_id);
    unitIdsByKeyword.set(uk.keyword_id, list);
  }

  const docsByKeyword = new Map<string, DocRow[]>();
  const docsWithNoKeyword: DocRow[] = [];
  for (const d of (docs ?? []) as DocRow[]) {
    if (d.primary_keyword_id && keywordById.has(d.primary_keyword_id)) {
      const list = docsByKeyword.get(d.primary_keyword_id) ?? [];
      list.push(d);
      docsByKeyword.set(d.primary_keyword_id, list);
    } else {
      docsWithNoKeyword.push(d);
    }
  }

  const toTreeDoc = (d: DocRow): LibraryTreeDoc => ({
    id: d.id,
    title: d.title,
    kind: d.kind === "pdf" || d.kind === "video" ? d.kind : "html",
  });

  const result: LibrarySubjectTree[] = [];
  for (const s of (subjects ?? []) as { id: string; name: string }[]) {
    const subjectUnits = unitsBySubject.get(s.id) ?? [];
    const unitGroups: LibraryTreeUnitGroup[] = [];
    const seenFlat = new Set<string>();
    const flatDocIds: string[] = [];
    const pushFlat = (docId: string) => {
      if (seenFlat.has(docId)) return;
      seenFlat.add(docId);
      flatDocIds.push(docId);
    };

    // 이 과목 키워드 중 최소 하나의 단원에 붙은 것 — 그 키워드는 단원 아래에서 다룬다.
    const keywordIdsInSubject = (keywords ?? [])
      .filter((k) => (k as KeywordRow).subject_id === s.id)
      .map((k) => (k as KeywordRow).id);
    const assignedKeywordIds = new Set(
      keywordIdsInSubject.filter((kId) => (unitIdsByKeyword.get(kId) ?? []).length > 0)
    );

    for (const u of subjectUnits) {
      const kwIds = keywordIdsInSubject.filter((kId) => (unitIdsByKeyword.get(kId) ?? []).includes(u.id));
      const keywordGroups: LibraryTreeKeywordGroup[] = [];
      for (const kId of kwIds.sort((a, b) => (keywordById.get(a)?.label ?? "").localeCompare(keywordById.get(b)?.label ?? "", "ko"))) {
        const kwDocs = docsByKeyword.get(kId) ?? [];
        if (kwDocs.length === 0) continue;
        kwDocs.forEach((d) => pushFlat(d.id));
        keywordGroups.push({ keywordId: kId, label: keywordById.get(kId)?.label ?? "", docs: kwDocs.map(toTreeDoc) });
      }
      if (keywordGroups.length > 0) unitGroups.push({ unitId: u.id, unitTitle: u.unit_title, keywordGroups });
    }

    // "단원 미지정": 어떤 단원에도 안 붙은 키워드의 자료 + 대표 키워드 자체가 없는 자료.
    const unassignedGroups: LibraryTreeKeywordGroup[] = [];
    for (const kId of keywordIdsInSubject) {
      if (assignedKeywordIds.has(kId)) continue;
      const kwDocs = docsByKeyword.get(kId) ?? [];
      if (kwDocs.length === 0) continue;
      kwDocs.forEach((d) => pushFlat(d.id));
      unassignedGroups.push({ keywordId: kId, label: keywordById.get(kId)?.label ?? "", docs: kwDocs.map(toTreeDoc) });
    }
    const noKeywordDocs = docsWithNoKeyword.filter((d) => d.subject_id === s.id);
    if (noKeywordDocs.length > 0) {
      noKeywordDocs.forEach((d) => pushFlat(d.id));
      unassignedGroups.push({ keywordId: null, label: NO_KEYWORD_LABEL, docs: noKeywordDocs.map(toTreeDoc) });
    }
    if (unassignedGroups.length > 0) unitGroups.push({ unitId: null, unitTitle: UNASSIGNED_UNIT_TITLE, keywordGroups: unassignedGroups });

    if (unitGroups.length > 0) result.push({ subjectId: s.id, subjectName: s.name, units: unitGroups, flatDocIds });
  }
  return result;
}

/** 과목 트리들 안에서 자료 하나의 이전/다음 자료를 찾는다(그 자료가 속한 과목의 평평한 순서 기준). */
export function findAdjacentDocs(
  trees: LibrarySubjectTree[],
  docId: string
): { prev: LibraryTreeDoc | null; next: LibraryTreeDoc | null; subject: LibrarySubjectTree | null } {
  for (const tree of trees) {
    const idx = tree.flatDocIds.indexOf(docId);
    if (idx === -1) continue;
    const allDocs = new Map<string, LibraryTreeDoc>();
    for (const u of tree.units) for (const kg of u.keywordGroups) for (const d of kg.docs) allDocs.set(d.id, d);
    const prevId = idx > 0 ? tree.flatDocIds[idx - 1] : null;
    const nextId = idx < tree.flatDocIds.length - 1 ? tree.flatDocIds[idx + 1] : null;
    return {
      prev: prevId ? allDocs.get(prevId) ?? null : null,
      next: nextId ? allDocs.get(nextId) ?? null : null,
      subject: tree,
    };
  }
  return { prev: null, next: null, subject: null };
}
