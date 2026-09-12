"use server";

import { createClient } from "@/utils/supabase/server";
import {
  loadStudentCurriculum,
  loadEligibleLibrary,
  type OverlayUnit,
  type StudentCurriculum,
  type EligibleLibrary,
} from "./student-curriculum-data";

async function requireAssignedTeacherOrAdmin(subjectEnrollmentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  // 2026-09-11(응답 속도 개선) — profile 조회와 담당 배정 조회는 서로
  // 의존하지 않는다(둘 다 user.id만 있으면 됨) — 순차 왕복 대신 병렬로
  // 묶는다. admin/비교사인 경우 assignment 조회 결과는 그냥 버려진다(왕복
  // 자체는 병렬이라 추가 지연 없음). 실제 방어선은 여전히 RLS
  // (is_active_teacher_for_enrollment) — 여기는 읽기 쉬운 에러 메시지를
  // 주기 위한 앱 레벨 선인가일 뿐, 순서를 바꿔도 보안 성질은 동일하다.
  const [{ data: profile }, { data: assignment }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase
      .from("teacher_assignments")
      .select("id")
      .eq("subject_enrollment_id", subjectEnrollmentId)
      .eq("teacher_id", user.id)
      .in("status", ["planned", "active"])
      .maybeSingle(),
  ]);

  if (profile?.role === "admin") return { supabase, user };
  if (profile?.role !== "teacher") throw new Error("선생님만 사용할 수 있습니다.");
  if (!assignment) throw new Error("담당 학생의 커리큘럼만 조정할 수 있습니다.");

  return { supabase, user };
}

function mapUnitRow(row: {
  id: string;
  source_unit_id: string | null;
  position: number;
  unit_title: string;
  note: string | null;
  status: OverlayUnit["status"];
  status_changed_at: string | null;
}): OverlayUnit {
  return {
    id: row.id,
    sourceUnitId: row.source_unit_id,
    position: row.position,
    unitTitle: row.unit_title,
    note: row.note,
    status: row.status,
    statusChangedAt: row.status_changed_at,
    keywordIds: [],
    materialDocIds: [],
  };
}

// UI 진입점(선생님 포털 "배정" 탭 → "운영 커리큘럼 관리") 전용 로더. 인가는
// requireAssignedTeacherOrAdmin을 그대로 재사용한다 — 이 함수는 그 위에 새
// 권한 검사를 추가하지 않으며(중복/약화 방지), 담당이 아닌 선생님이 호출하면
// 여기서 바로 거부된다(RLS가 다시 한번 막아준다).
export async function loadStudentCurriculumPanelData(
  subjectEnrollmentId: string,
  subjectId: string
): Promise<{ initial: StudentCurriculum; library: EligibleLibrary }> {
  const { supabase } = await requireAssignedTeacherOrAdmin(subjectEnrollmentId);
  const [initial, library] = await Promise.all([
    loadStudentCurriculum(supabase, subjectEnrollmentId),
    loadEligibleLibrary(supabase, subjectId),
  ]);
  return { initial, library };
}

// R9 corrective 1: 오버레이 생성 + 최초 베이스라인 시딩(과목 기본 단원 +
// 단원별 기본 키워드 스냅샷)을 단일 DB 함수(=단일 트랜잭션)로 위임한다.
// 동시 호출(예: 두 번의 중복 요청, 타임아웃 후 재시도)에도 advisory lock +
// unique 부분 인덱스로 활성 오버레이 1개·베이스라인 시딩 1회만 보장된다
// (supabase/migrations/20261230000000_r9_corrective_overlay_baseline_seed.sql
// ensure_active_curriculum_overlay 참고). 이 함수 호출 전 인가 선검사는 여전히
// 여기서 하고, RLS가 실제 방어선인 것도 기존과 동일하다.
export async function ensureActiveOverlay(subjectEnrollmentId: string): Promise<string> {
  const { supabase } = await requireAssignedTeacherOrAdmin(subjectEnrollmentId);

  const { data, error } = await supabase.rpc("ensure_active_curriculum_overlay", {
    p_subject_enrollment_id: subjectEnrollmentId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

async function nextPosition(supabase: Awaited<ReturnType<typeof createClient>>, overlayId: string) {
  const { data } = await supabase
    .from("curriculum_overlay_units")
    .select("position")
    .eq("overlay_id", overlayId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.position ?? 0) + 1;
}

export async function addCanonicalUnit(
  subjectEnrollmentId: string,
  overlayId: string,
  sourceUnitId: string,
  unitTitle: string
): Promise<OverlayUnit> {
  const { supabase } = await requireAssignedTeacherOrAdmin(subjectEnrollmentId);
  const position = await nextPosition(supabase, overlayId);
  const { data, error } = await supabase
    .from("curriculum_overlay_units")
    .insert({
      overlay_id: overlayId,
      source_unit_id: sourceUnitId,
      position,
      unit_title: unitTitle,
    })
    .select("id, source_unit_id, position, unit_title, note, status, status_changed_at")
    .single();
  if (error) throw new Error(error.message);
  return mapUnitRow(data);
}

export async function createSupplementUnit(
  subjectEnrollmentId: string,
  overlayId: string,
  unitTitle: string,
  note?: string
): Promise<OverlayUnit> {
  const { supabase } = await requireAssignedTeacherOrAdmin(subjectEnrollmentId);
  const position = await nextPosition(supabase, overlayId);
  const { data, error } = await supabase
    .from("curriculum_overlay_units")
    .insert({
      overlay_id: overlayId,
      source_unit_id: null,
      position,
      unit_title: unitTitle,
      note: note ?? null,
    })
    .select("id, source_unit_id, position, unit_title, note, status, status_changed_at")
    .single();
  if (error) throw new Error(error.message);
  return mapUnitRow(data);
}

export async function excludeUnit(subjectEnrollmentId: string, overlayUnitId: string): Promise<void> {
  const { supabase } = await requireAssignedTeacherOrAdmin(subjectEnrollmentId);
  const { error } = await supabase
    .from("curriculum_overlay_units")
    .delete()
    .eq("id", overlayUnitId);
  if (error) throw new Error(error.message);
}

export async function moveUnit(
  subjectEnrollmentId: string,
  overlayId: string,
  currentOrderedIds: string[],
  unitId: string,
  direction: -1 | 1
): Promise<OverlayUnit[]> {
  const { supabase } = await requireAssignedTeacherOrAdmin(subjectEnrollmentId);
  const index = currentOrderedIds.indexOf(unitId);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= currentOrderedIds.length) {
    return [];
  }
  const next = [...currentOrderedIds];
  [next[index], next[target]] = [next[target], next[index]];

  // 단일 RPC 호출 = 단일 트랜잭션. 여러 행의 position을 클라이언트에서
  // 순차 UPDATE하던 기존 subject-actions.ts moveSubjectUnit 패턴은 여기서는
  // 쓰지 않는다(계획서 Task 3 "reordering is atomic" 요구사항).
  const { data, error } = await supabase.rpc("reorder_curriculum_overlay_units", {
    p_overlay_id: overlayId,
    p_ordered_unit_ids: next,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: Parameters<typeof mapUnitRow>[0]) => mapUnitRow(row));
}

export async function setUnitStatus(
  subjectEnrollmentId: string,
  overlayUnitId: string,
  status: OverlayUnit["status"]
): Promise<void> {
  const { supabase } = await requireAssignedTeacherOrAdmin(subjectEnrollmentId);
  const { error } = await supabase
    .from("curriculum_overlay_units")
    .update({ status })
    .eq("id", overlayUnitId);
  if (error) throw new Error(error.message);
}

export async function setActiveKeywords(
  subjectEnrollmentId: string,
  overlayUnitId: string,
  keywordIds: string[]
): Promise<void> {
  const { supabase } = await requireAssignedTeacherOrAdmin(subjectEnrollmentId);
  const { error: deleteError } = await supabase
    .from("curriculum_overlay_unit_keywords")
    .delete()
    .eq("overlay_unit_id", overlayUnitId);
  if (deleteError) throw new Error(deleteError.message);

  if (keywordIds.length === 0) return;
  const { error: insertError } = await supabase
    .from("curriculum_overlay_unit_keywords")
    .insert(keywordIds.map((keywordId) => ({ overlay_unit_id: overlayUnitId, keyword_id: keywordId })));
  if (insertError) throw new Error(insertError.message);
}

export async function addSupplementMaterial(
  subjectEnrollmentId: string,
  overlayUnitId: string,
  curriculumDocId: string
): Promise<void> {
  const { supabase } = await requireAssignedTeacherOrAdmin(subjectEnrollmentId);
  const { error } = await supabase
    .from("curriculum_overlay_unit_materials")
    .insert({ overlay_unit_id: overlayUnitId, curriculum_doc_id: curriculumDocId });
  if (error) {
    if (error.code === "23505") return; // 이미 연결됨 — 멱등 처리
    throw new Error(error.message);
  }
}

export async function removeSupplementMaterial(
  subjectEnrollmentId: string,
  overlayUnitId: string,
  curriculumDocId: string
): Promise<void> {
  const { supabase } = await requireAssignedTeacherOrAdmin(subjectEnrollmentId);
  const { error } = await supabase
    .from("curriculum_overlay_unit_materials")
    .delete()
    .eq("overlay_unit_id", overlayUnitId)
    .eq("curriculum_doc_id", curriculumDocId);
  if (error) throw new Error(error.message);
}
