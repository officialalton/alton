import type { SupabaseClient } from "@supabase/supabase-js";

// R9(Task 3) — 담당 학생의 운영 커리큘럼(오버레이) + 조합 가능한 라이브러리 콘텐츠를
// 읽기 전용으로 로드한다. RLS(20261229000000_r9_student_curriculum_overlay.sql)가
// "담당 선생님/본인 학생·보호자/관리자"만 조회를 허용하므로, 이 함수는 그 이상의
// 권한 검사를 하지 않는다 — 담당이 아닌 선생님이 호출하면 그냥 빈 결과가 온다.
//
// v3 커리큘럼 열람 결함 수정(2026-09-11) — 오버레이 읽기(loadStudentCurriculum)는
// 학생/학부모 읽기 전용 화면(app/student/curriculum-overlay-actions.ts)에서도
// 그대로 재사용한다. 이 파일에서 재수출만 하고 실제 정의는 lib/curriculum-
// overlay-data.ts에 둔 이유: app/teacher가 편집 전용 서버 액션
// (student-curriculum-actions.ts, 담당 교사만)을 갖고 있어 app/student·
// app/parent가 그걸 직접 import하면 안 되는데, 읽기 로더 자체는 순수 조회라
// 공유해도 안전하다 — 공유 지점을 app/teacher 밖(lib/)에 둬서 방향을 명확히 한다.
export {
  loadStudentCurriculum,
  type OverlayUnit,
  type StudentCurriculum,
} from "@/lib/curriculum-overlay-data";

export type LibraryUnit = {
  id: string;
  position: number;
  unitTitle: string;
};

export type LibraryDoc = {
  id: string;
  title: string;
};

export type LibraryKeyword = {
  id: string;
  label: string;
};

export type EligibleLibrary = {
  units: LibraryUnit[];
  publishedDocs: LibraryDoc[];
  // 2026-09-09(UAT 지적, 제품 오너 승인) — "학생별 오버레이에서 키워드
  // 추가·제외·수정"을 실제로 하려면 고를 수 있는 키워드 사전이 필요하다.
  // 과목 공용 키워드 사전(subject_keywords, 관리자가 관리)을 그대로 재사용한다
  // — 오버레이 전용 키워드를 새로 만들지 않는다(원본은 관리자 기준본 하나).
  keywords: LibraryKeyword[];
};

// 선생님이 "라이브러리에서 불러오기"로 고를 수 있는 원본: 과목 템플릿 단원 전체
// (단원 자체는 draft/published 개념이 없다 — 실제 콘텐츠 게이트는 교재/문제 쪽)와
// 공개(published)된 교재만. 미공개 교재는 애초에 목록에 담지 않아, 선생님이
// 고르는 순간부터 "검수·공개된 콘텐츠만" 원칙을 지킨다(스펙 §4).
export async function loadEligibleLibrary(
  supabase: SupabaseClient,
  subjectId: string
): Promise<EligibleLibrary> {
  const [{ data: units }, { data: docs }, { data: keywords }] = await Promise.all([
    supabase
      .from("subject_template_units")
      .select("id, position, unit_title")
      .eq("subject_id", subjectId)
      .order("position", { ascending: true }),
    supabase
      .from("curriculum_docs")
      .select("id, title")
      .eq("subject_id", subjectId)
      .eq("status", "published")
      .order("title", { ascending: true }),
    supabase
      .from("subject_keywords")
      .select("id, label")
      .eq("subject_id", subjectId)
      .eq("status", "active")
      .order("label", { ascending: true }),
  ]);

  return {
    units: (units ?? []).map((u) => ({ id: u.id, position: u.position, unitTitle: u.unit_title })),
    publishedDocs: (docs ?? []).map((d) => ({ id: d.id, title: d.title })),
    keywords: (keywords ?? []).map((k) => ({ id: k.id, label: k.label })),
  };
}
