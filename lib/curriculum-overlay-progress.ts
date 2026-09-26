import type { SupabaseClient } from "@supabase/supabase-js";

// C-1(2026-09-10, 제품 오너 승인) — 교사 "담당 학생", 학생 포털, 관리자 상세
// 세 화면의 진도 표시를 curriculum_overlay_units 하나로 통일한다. 그동안
// 화면마다 legacy_sessions 실적, v3 sessions 실적, teacher_curriculum_
// template_units 개수 등 서로 다른 기준을 썼던 것을 여기 하나로 모은다.
//
// "진행 N" 정의: 이미 지나간(더 이상 진행 대상이 아닌) 단원 수 — completed·
// skipped를 진행분으로 센다. reinforcement_needed는 "다시 봐야 하는" 상태라
// 아직 끝난 것으로 세지 않는다. in_progress/not_started는 미진행.

const PROGRESSED_STATUSES = new Set(["completed", "skipped"]);

export type CurriculumOverlayProgress = {
  totalUnits: number;
  doneUnits: number;
  /** 이 오버레이 단원들의 다수 출처 — teacher_template이 하나라도 있으면 교사
   * 운영 커리큘럼 기준, 없으면(전부 subject_template/student_added) 공통
   * 커리큘럼 기준으로 본다. 단원이 하나도 없으면(=아직 시딩 안 됨) null. */
  sourceLabel: "교사 운영 커리큘럼 기준" | "공통 커리큘럼 기준" | null;
};

const EMPTY_PROGRESS: CurriculumOverlayProgress = { totalUnits: 0, doneUnits: 0, sourceLabel: null };

/** 진도를 화면 문구로 변환한다 — 세 화면(교사/학생/관리자)이 전부 이 함수 하나만 쓴다. */
export function formatCurriculumProgressLabel(p: CurriculumOverlayProgress): string {
  if (p.totalUnits === 0) return "진도 미시작 · 회차 0개";
  if (p.doneUnits === 0) return `진도 미시작 · 회차 ${p.totalUnits}개`;
  return `진행 ${p.doneUnits} / 전체 ${p.totalUnits}회차`;
}

export async function loadCurriculumOverlayProgressByEnrollment(
  supabase: SupabaseClient,
  subjectEnrollmentIds: string[]
): Promise<Map<string, CurriculumOverlayProgress>> {
  const result = new Map<string, CurriculumOverlayProgress>();
  if (subjectEnrollmentIds.length === 0) return result;

  const { data: overlays } = await supabase
    .from("student_curriculum_overlays")
    .select("id, subject_enrollment_id")
    .in("subject_enrollment_id", subjectEnrollmentIds)
    .eq("status", "active");
  if (!overlays || overlays.length === 0) return result;

  const enrollmentIdByOverlay = new Map(overlays.map((o) => [o.id as string, o.subject_enrollment_id as string]));
  const overlayIds = overlays.map((o) => o.id as string);

  const { data: units } = await supabase
    .from("curriculum_overlay_units")
    .select("overlay_id, status, source_kind")
    .in("overlay_id", overlayIds);

  const totalByOverlay = new Map<string, number>();
  const doneByOverlay = new Map<string, number>();
  const hasTeacherTemplateByOverlay = new Map<string, boolean>();

  for (const u of (units ?? []) as { overlay_id: string; status: string; source_kind: string }[]) {
    totalByOverlay.set(u.overlay_id, (totalByOverlay.get(u.overlay_id) ?? 0) + 1);
    if (PROGRESSED_STATUSES.has(u.status)) {
      doneByOverlay.set(u.overlay_id, (doneByOverlay.get(u.overlay_id) ?? 0) + 1);
    }
    if (u.source_kind === "teacher_template") {
      hasTeacherTemplateByOverlay.set(u.overlay_id, true);
    }
  }

  for (const overlayId of overlayIds) {
    const enrollmentId = enrollmentIdByOverlay.get(overlayId);
    if (!enrollmentId) continue;
    const totalUnits = totalByOverlay.get(overlayId) ?? 0;
    result.set(enrollmentId, {
      totalUnits,
      doneUnits: doneByOverlay.get(overlayId) ?? 0,
      sourceLabel:
        totalUnits === 0 ? null : hasTeacherTemplateByOverlay.get(overlayId) ? "교사 운영 커리큘럼 기준" : "공통 커리큘럼 기준",
    });
  }

  return result;
}

export function getCurriculumOverlayProgress(
  map: Map<string, CurriculumOverlayProgress>,
  subjectEnrollmentId: string
): CurriculumOverlayProgress {
  return map.get(subjectEnrollmentId) ?? EMPTY_PROGRESS;
}
