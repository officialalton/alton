import type { SupabaseClient } from "@supabase/supabase-js";

// R9(Task 3) — 학생별 운영 커리큘럼(오버레이) 읽기 전용 로더. RLS
// (20261229000000_r9_student_curriculum_overlay.sql,
// 20261275000000_v3_curriculum_overlay_guardian_read.sql)가 "담당 선생님/본인
// 학생·보호자/관리자"만 조회를 허용하므로, 이 함수는 그 이상의 권한 검사를
// 하지 않는다 — 호출자가 그 범위 밖이면 그냥 빈 결과가 온다. 교사용(편집
// 가능) 화면과 학생·학부모용(읽기 전용) 화면이 이 로더 하나를 공유한다 —
// 편집 권한 검사는 각 호출부의 서버 액션에서만 한다(app/teacher/
// student-curriculum-actions.ts는 담당 교사만, app/student/
// curriculum-overlay-actions.ts는 로그인 여부만 — 실제 범위는 RLS).

export type OverlayUnit = {
  id: string;
  sourceUnitId: string | null;
  position: number;
  unitTitle: string;
  note: string | null;
  status: "not_started" | "in_progress" | "completed" | "reinforcement_needed" | "skipped";
  statusChangedAt: string | null;
  keywordIds: string[];
  materialDocIds: string[];
};

export type StudentCurriculum = {
  overlayId: string | null;
  units: OverlayUnit[];
};

export async function loadStudentCurriculum(
  supabase: SupabaseClient,
  subjectEnrollmentId: string
): Promise<StudentCurriculum> {
  const { data: overlay } = await supabase
    .from("student_curriculum_overlays")
    .select("id")
    .eq("subject_enrollment_id", subjectEnrollmentId)
    .eq("status", "active")
    .maybeSingle();

  if (!overlay) return { overlayId: null, units: [] };

  const { data: units } = await supabase
    .from("curriculum_overlay_units")
    .select(
      "id, source_unit_id, position, unit_title, note, status, status_changed_at"
    )
    .eq("overlay_id", overlay.id)
    .order("position", { ascending: true });

  const unitIds = (units ?? []).map((u) => u.id);

  // N+1 방지: 단원마다 따로 조회하지 않고 이 오버레이의 전체 단원 id 집합에
  // 대해 키워드/자료 관계를 각각 한 번씩만 조회한다.
  const [{ data: keywordRows }, { data: materialRows }] = await Promise.all([
    unitIds.length
      ? supabase
          .from("curriculum_overlay_unit_keywords")
          .select("overlay_unit_id, keyword_id")
          .in("overlay_unit_id", unitIds)
      : Promise.resolve({ data: [] as { overlay_unit_id: string; keyword_id: string }[] }),
    unitIds.length
      ? supabase
          .from("curriculum_overlay_unit_materials")
          .select("overlay_unit_id, curriculum_doc_id")
          .in("overlay_unit_id", unitIds)
      : Promise.resolve({ data: [] as { overlay_unit_id: string; curriculum_doc_id: string }[] }),
  ]);

  const keywordIdsByUnit = new Map<string, string[]>();
  for (const row of keywordRows ?? []) {
    const list = keywordIdsByUnit.get(row.overlay_unit_id) ?? [];
    list.push(row.keyword_id);
    keywordIdsByUnit.set(row.overlay_unit_id, list);
  }
  const materialIdsByUnit = new Map<string, string[]>();
  for (const row of materialRows ?? []) {
    const list = materialIdsByUnit.get(row.overlay_unit_id) ?? [];
    list.push(row.curriculum_doc_id);
    materialIdsByUnit.set(row.overlay_unit_id, list);
  }

  return {
    overlayId: overlay.id,
    units: (units ?? []).map((u) => ({
      id: u.id,
      sourceUnitId: u.source_unit_id,
      position: u.position,
      unitTitle: u.unit_title,
      note: u.note,
      status: u.status,
      statusChangedAt: u.status_changed_at,
      keywordIds: keywordIdsByUnit.get(u.id) ?? [],
      materialDocIds: materialIdsByUnit.get(u.id) ?? [],
    })),
  };
}
