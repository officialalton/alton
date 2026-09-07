"use server";

import { createClient } from "@/utils/supabase/server";
import type { OverlayUnit } from "./student-curriculum-data";

async function requireAssignedTeacherOrAdmin(subjectEnrollmentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") return { supabase, user };
  if (profile?.role !== "teacher") throw new Error("선생님만 사용할 수 있습니다.");

  // 앱 레벨 선인가 — 실제 방어선은 RLS(is_active_teacher_for_enrollment)다.
  // 여기서 먼저 걸러 "담당 학생이 아닙니다" 같은 읽기 쉬운 메시지를 준다.
  const { data: assignment } = await supabase
    .from("teacher_assignments")
    .select("id")
    .eq("subject_enrollment_id", subjectEnrollmentId)
    .eq("teacher_id", user.id)
    .in("status", ["planned", "active"])
    .maybeSingle();
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

export async function ensureActiveOverlay(subjectEnrollmentId: string): Promise<string> {
  const { supabase } = await requireAssignedTeacherOrAdmin(subjectEnrollmentId);

  const { data: existing } = await supabase
    .from("student_curriculum_overlays")
    .select("id")
    .eq("subject_enrollment_id", subjectEnrollmentId)
    .eq("status", "active")
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("student_curriculum_overlays")
    .insert({ subject_enrollment_id: subjectEnrollmentId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
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
