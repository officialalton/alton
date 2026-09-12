import type { SupabaseClient } from "@supabase/supabase-js";

export type SubjectKeyword = {
  id: string;
  label: string;
  status: string;
};

export type SubjectUnit = {
  id: string;
  position: number;
  unitTitle: string;
  note: string | null;
  keywordIds?: string[];
};

export type AdminSubject = {
  subjectId: string;
  subjectName: string;
  units: SubjectUnit[];
  // R9(Task 2): 이 과목의 공용 키워드 사전 전체(단원/교재조각/문제 태깅 picker용).
  keywords?: SubjectKeyword[];
  // 2026-09-09: 실사용 참조가 있어 하드 삭제 대신 보관 처리된 과목. null이면 활성.
  archivedAt?: string | null;
  archivedReason?: string | null;
};

// 2026-09-09(UAT 지적): 보관된 과목은 신규 배정·템플릿 선택·교재 연결 후보에서
// 제외한다 — 기존 계약·수강·교재·세션 이력 조회 화면에서는 그대로 이름이
// 보여야 하므로 목록 자체(loadSubjectCatalog)에서는 걸러내지 않고, 각 "신규
// 선택" picker가 이 헬퍼로 걸러 쓴다.
export function selectableSubjects(subjects: AdminSubject[]): AdminSubject[] {
  return subjects.filter((s) => !s.archivedAt);
}

export async function loadSubjectCatalog(
  supabase: SupabaseClient
): Promise<AdminSubject[]> {
  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name, archived_at, archived_reason")
    .order("name", { ascending: true });
  if (!subjects || subjects.length === 0) return [];

  const subjectIds = subjects.map((s) => s.id);

  // N+1 방지: 단원/키워드/단원-키워드 관계를 과목 목록 전체에 대해 각각 한 번씩만 조회한다.
  const [{ data: units }, { data: keywords }] = await Promise.all([
    supabase
      .from("subject_template_units")
      .select("id, subject_id, position, unit_title, note")
      .in("subject_id", subjectIds)
      .order("position", { ascending: true }),
    supabase
      .from("subject_keywords")
      .select("id, subject_id, label, status")
      .in("subject_id", subjectIds)
      .order("label", { ascending: true }),
  ]);

  const unitIds = (units ?? []).map((u) => u.id);
  const { data: unitKeywordRows } = unitIds.length
    ? await supabase
        .from("subject_template_unit_keywords")
        .select("unit_id, keyword_id")
        .in("unit_id", unitIds)
    : { data: [] as { unit_id: string; keyword_id: string }[] };

  const keywordIdsByUnit = new Map<string, string[]>();
  for (const row of unitKeywordRows ?? []) {
    const list = keywordIdsByUnit.get(row.unit_id) ?? [];
    list.push(row.keyword_id);
    keywordIdsByUnit.set(row.unit_id, list);
  }

  const keywordsBySubject = new Map<string, SubjectKeyword[]>();
  for (const k of keywords ?? []) {
    const list = keywordsBySubject.get(k.subject_id) ?? [];
    list.push({ id: k.id, label: k.label, status: k.status });
    keywordsBySubject.set(k.subject_id, list);
  }

  const unitsBySubject = new Map<string, SubjectUnit[]>();
  for (const u of units ?? []) {
    const list = unitsBySubject.get(u.subject_id) ?? [];
    list.push({
      id: u.id,
      position: u.position,
      unitTitle: u.unit_title,
      note: u.note,
      keywordIds: keywordIdsByUnit.get(u.id) ?? [],
    });
    unitsBySubject.set(u.subject_id, list);
  }

  return subjects.map((s) => ({
    subjectId: s.id,
    subjectName: s.name,
    units: unitsBySubject.get(s.id) ?? [],
    keywords: keywordsBySubject.get(s.id) ?? [],
    archivedAt: s.archived_at,
    archivedReason: s.archived_reason,
  }));
}
