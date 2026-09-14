import type { SupabaseClient } from "@supabase/supabase-js";

// R9(레슨 준비 Task 2) — session_content_manifest 리더. 이 파일은 절대
// 키워드/단원을 조인해 후보를 다시 계산하지 않는다(그건 pin 이전 스테이징
// 단계의 일이다) — 오직 session_content_manifest를 읽고,
// curriculum_doc_section_keywords_selectable/problem_keywords_selectable에
// LEFT JOIN해 "지금도 여전히 published/confirmed인가"만 표시 시점 가시성
// 게이트로 검사한다. 게이트를 통과하지 못한 행은 반환하지 않지만, 매니페스트
// 테이블 자체는 절대 건드리지 않는다(숨김 ≠ 삭제/변경). 선생님/학생 양쪽
// 세션-뷰 리더가 이 함수 하나를 공유한다(둘 다 같은 가시성 게이트를 받는다).

export type SessionManifestContentType = "material_doc" | "material_section" | "problem";

export type SessionManifestItem = {
  id: string;
  /**
   * material_doc = 교재 전체(현재 방식). material_section = 교재 조각(과거 기록).
   *
   * 과거 수업의 material_section 행은 그대로 읽는다. 그때 무엇을 보여줬는지는
   * 그 시점의 사실이고, 정책이 바뀌었다고 소급해 고칠 값이 아니다.
   */
  contentType: SessionManifestContentType;
  contentId: string;
  sourceOverlayUnitId: string | null;
  displayPosition: number;
  publishedDocVersionAtPin: string | null;
};

export async function loadSessionContentManifest(
  supabase: SupabaseClient,
  sessionId: string
): Promise<SessionManifestItem[]> {
  const { data: rows, error } = await supabase
    .from("session_content_manifest")
    .select(
      "id, content_type, content_id, source_overlay_unit_id, display_position, published_doc_version_at_pin"
    )
    .eq("session_id", sessionId)
    .order("display_position", { ascending: true });
  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) return [];

  const docIds = rows
    .filter((r) => r.content_type === "material_doc")
    .map((r) => r.content_id as string);
  const sectionIds = rows
    .filter((r) => r.content_type === "material_section")
    .map((r) => r.content_id as string);
  const problemIds = rows
    .filter((r) => r.content_type === "problem")
    .map((r) => r.content_id as string);

  // 표시 시점 가시성 게이트: 각 뷰에 "이 content_id에 대한 행이 하나라도
  // 존재하는가"만 확인한다 — 어떤 키워드로 매칭됐는지는 무관하다(뷰 자체가
  // 상위 교재/문제가 현재 published/confirmed인 행만 남기므로, 존재 자체가
  // "지금도 여전히 선택 가능"의 증거다).
  const visibleSectionIds = new Set<string>();
  if (sectionIds.length > 0) {
    const { data: visibleSections, error: sectionError } = await supabase
      .from("curriculum_doc_section_keywords_selectable")
      .select("section_id")
      .in("section_id", sectionIds);
    if (sectionError) throw new Error(sectionError.message);
    for (const row of visibleSections ?? []) visibleSectionIds.add(row.section_id as string);
  }

  // 교재 전체는 키워드를 거치지 않고 "지금도 보여도 되는가"만 본다. 키워드가
  // 떨어졌다고 이미 고정된 교재가 사라지면 안 된다.
  const visibleDocIds = new Set<string>();
  if (docIds.length > 0) {
    const { data: visibleDocs, error: docError } = await supabase
      .from("curriculum_docs_selectable")
      .select("curriculum_doc_id")
      .in("curriculum_doc_id", docIds);
    if (docError) throw new Error(docError.message);
    for (const row of visibleDocs ?? []) visibleDocIds.add(row.curriculum_doc_id as string);
  }

  const visibleProblemIds = new Set<string>();
  if (problemIds.length > 0) {
    const { data: visibleProblems, error: problemError } = await supabase
      .from("problem_keywords_selectable")
      .select("problem_id")
      .in("problem_id", problemIds);
    if (problemError) throw new Error(problemError.message);
    for (const row of visibleProblems ?? []) visibleProblemIds.add(row.problem_id as string);
  }

  return rows
    .filter((r) => {
      const id = r.content_id as string;
      if (r.content_type === "material_doc") return visibleDocIds.has(id);
      if (r.content_type === "material_section") return visibleSectionIds.has(id);
      return visibleProblemIds.has(id);
    })
    .map((r) => ({
      id: r.id as string,
      contentType: r.content_type as SessionManifestContentType,
      contentId: r.content_id as string,
      sourceOverlayUnitId: r.source_overlay_unit_id as string | null,
      displayPosition: r.display_position as number,
      publishedDocVersionAtPin: r.published_doc_version_at_pin as string | null,
    }));
}
