"use server";

import { createClient } from "@/utils/supabase/server";
import {
  loadHeldSelections,
  loadSessionSelection,
  loadEligibleContentForSelection,
  type PreparedSelection,
  type PreparedContentType,
  type EligibleSelectionContent,
} from "./session-prep-data";

// R9(레슨 준비 Task 1) — 준비된 선택 스테이징 액션. 인가는 student-curriculum-
// actions.ts의 requireAssignedTeacherOrAdmin과 동일한 패턴(새 메커니즘 없음):
// 앱 레벨 선인가로 읽기 쉬운 에러를 주고, 실제 방어선은 RLS다. Task 2의
// pinSessionSelection()만 예외적으로 SECURITY DEFINER라 이 패턴을 따르지 않는다
// (별도 파일에서 구현).
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

  const { data: assignment } = await supabase
    .from("teacher_assignments")
    .select("id")
    .eq("subject_enrollment_id", subjectEnrollmentId)
    .eq("teacher_id", user.id)
    .in("status", ["planned", "active"])
    .maybeSingle();
  if (!assignment) throw new Error("담당 학생의 세션 준비만 조정할 수 있습니다.");

  return { supabase, user };
}

// prepared_selection_id로부터 subject_enrollment_id를 역조회해 인가 검사에
// 재사용한다 — 모든 하위 테이블 액션(단원/키워드/콘텐츠 조작)이 여기를 거친다.
async function requireOwningTeacherOrAdmin(preparedSelectionId: string) {
  const bootstrap = await createClient();
  const { data: selection, error } = await bootstrap
    .from("session_prepared_selections")
    .select("subject_enrollment_id")
    .eq("id", preparedSelectionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!selection) throw new Error("존재하지 않는 준비된 선택입니다.");
  return requireAssignedTeacherOrAdmin(selection.subject_enrollment_id);
}

function translateError(error: { code?: string; message: string }): never {
  if (error.code === "23505") {
    throw new Error("이미 존재하거나 중복된 항목입니다.");
  }
  throw new Error(error.message);
}

export async function loadHeldSelectionsForEnrollment(
  subjectEnrollmentId: string
): Promise<PreparedSelection[]> {
  const { supabase } = await requireAssignedTeacherOrAdmin(subjectEnrollmentId);
  return loadHeldSelections(supabase, subjectEnrollmentId);
}

export async function loadSessionSelectionForSession(
  subjectEnrollmentId: string,
  sessionId: string
): Promise<PreparedSelection | null> {
  const { supabase } = await requireAssignedTeacherOrAdmin(subjectEnrollmentId);
  return loadSessionSelection(supabase, sessionId);
}

export async function loadEligibleContent(
  preparedSelectionId: string
): Promise<EligibleSelectionContent> {
  const { supabase } = await requireOwningTeacherOrAdmin(preparedSelectionId);
  return loadEligibleContentForSelection(supabase, preparedSelectionId);
}

export async function createPreparedSelection(subjectEnrollmentId: string): Promise<string> {
  const { supabase } = await requireAssignedTeacherOrAdmin(subjectEnrollmentId);
  const { data, error } = await supabase
    .from("session_prepared_selections")
    .insert({ subject_enrollment_id: subjectEnrollmentId })
    .select("id")
    .single();
  if (error) translateError(error);
  return data.id as string;
}

async function nextUnitPosition(
  supabase: Awaited<ReturnType<typeof createClient>>,
  preparedSelectionId: string
) {
  const { data } = await supabase
    .from("session_prepared_selection_units")
    .select("position")
    .eq("prepared_selection_id", preparedSelectionId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.position ?? 0) + 1;
}

export async function addUnitToSelection(
  preparedSelectionId: string,
  overlayUnitId: string
): Promise<string> {
  const { supabase } = await requireOwningTeacherOrAdmin(preparedSelectionId);
  const position = await nextUnitPosition(supabase, preparedSelectionId);
  const { data, error } = await supabase
    .from("session_prepared_selection_units")
    .insert({ prepared_selection_id: preparedSelectionId, overlay_unit_id: overlayUnitId, position })
    .select("id")
    .single();
  if (error) translateError(error);
  return data.id as string;
}

export async function removeUnitFromSelection(
  preparedSelectionId: string,
  preparedSelectionUnitId: string
): Promise<void> {
  const { supabase } = await requireOwningTeacherOrAdmin(preparedSelectionId);
  const { error } = await supabase
    .from("session_prepared_selection_units")
    .delete()
    .eq("id", preparedSelectionUnitId)
    .eq("prepared_selection_id", preparedSelectionId);
  if (error) translateError(error);
}

// 활성 키워드 부분집합 재설정 — delete-then-insert(student-curriculum-actions.ts
// setActiveKeywords와 동일 패턴). 부분집합 검증(오버레이 단원의 키워드인지)은
// INSERT 트리거가 한다.
export async function setSelectionActiveKeywords(
  preparedSelectionId: string,
  preparedSelectionUnitId: string,
  keywordIds: string[]
): Promise<void> {
  const { supabase } = await requireOwningTeacherOrAdmin(preparedSelectionId);
  const { error: deleteError } = await supabase
    .from("session_prepared_selection_unit_keywords")
    .delete()
    .eq("prepared_selection_unit_id", preparedSelectionUnitId);
  if (deleteError) translateError(deleteError);

  if (keywordIds.length === 0) return;
  const { error: insertError } = await supabase
    .from("session_prepared_selection_unit_keywords")
    .insert(
      keywordIds.map((keywordId) => ({
        prepared_selection_unit_id: preparedSelectionUnitId,
        keyword_id: keywordId,
      }))
    );
  if (insertError) translateError(insertError);
}

async function nextContentItemPosition(
  supabase: Awaited<ReturnType<typeof createClient>>,
  preparedSelectionId: string
) {
  const { data } = await supabase
    .from("session_prepared_selection_content_items")
    .select("position")
    .eq("prepared_selection_id", preparedSelectionId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.position ?? 0) + 1;
}

// 선택 가능(published/confirmed)+범위 내 검사는 INSERT 트리거
// (check_prepared_content_item_selectable)가 한다 — 여기서 다시 검사하지 않는다
// (RLS/트리거가 진짜 방어선, 이 함수는 편의 계층일 뿐).
export async function pickContentItem(
  preparedSelectionId: string,
  contentType: PreparedContentType,
  contentId: string
): Promise<string> {
  const { supabase } = await requireOwningTeacherOrAdmin(preparedSelectionId);
  const position = await nextContentItemPosition(supabase, preparedSelectionId);
  const { data, error } = await supabase
    .from("session_prepared_selection_content_items")
    .insert({
      prepared_selection_id: preparedSelectionId,
      content_type: contentType,
      content_id: contentId,
      position,
    })
    .select("id")
    .single();
  if (error) translateError(error);
  return data.id as string;
}

export async function excludeContentItem(
  preparedSelectionId: string,
  contentItemId: string
): Promise<void> {
  const { supabase } = await requireOwningTeacherOrAdmin(preparedSelectionId);
  const { error } = await supabase
    .from("session_prepared_selection_content_items")
    .update({ included: false })
    .eq("id", contentItemId)
    .eq("prepared_selection_id", preparedSelectionId);
  if (error) translateError(error);
}

// 소프트 제외를 되돌리는 재포함 — Produces에서 이름은 붙이지 않았지만 "제외를
// 잃지 않고 되돌릴 수 있다"는 요구사항(Task 1 체크리스트)을 위해 excludeContentItem의
// 자연스러운 반대짝으로 둔다. 새 권한 검사를 추가하지 않는다(동일 경로).
export async function includeContentItem(
  preparedSelectionId: string,
  contentItemId: string
): Promise<void> {
  const { supabase } = await requireOwningTeacherOrAdmin(preparedSelectionId);
  const { error } = await supabase
    .from("session_prepared_selection_content_items")
    .update({ included: true })
    .eq("id", contentItemId)
    .eq("prepared_selection_id", preparedSelectionId);
  if (error) translateError(error);
}

// 단일 RPC 호출 = 단일 트랜잭션(reorder_curriculum_overlay_units와 동일 패턴).
export async function reorderContentItems(
  preparedSelectionId: string,
  orderedContentItemIds: string[]
): Promise<void> {
  const { supabase } = await requireOwningTeacherOrAdmin(preparedSelectionId);
  const { error } = await supabase.rpc("reorder_prepared_selection_content_items", {
    p_prepared_selection_id: preparedSelectionId,
    p_ordered_content_item_ids: orderedContentItemIds,
  });
  if (error) throw new Error(error.message);
}

export async function attachSelectionToSession(
  preparedSelectionId: string,
  sessionId: string
): Promise<void> {
  const { supabase } = await requireOwningTeacherOrAdmin(preparedSelectionId);
  const { error } = await supabase
    .from("session_prepared_selections")
    .update({ session_id: sessionId })
    .eq("id", preparedSelectionId);
  if (error) {
    if (error.code === "23505") {
      throw new Error("이 세션에는 이미 다른 준비된 선택이 붙어 있습니다.");
    }
    throw new Error(error.message);
  }
}

// detach는 status='staged'일 때만 허용(pin-lock 트리거가 pinned 상태에서는
// 이 UPDATE 자체를 거부한다 — 여기서 추가 검사를 하지 않는다).
export async function detachSelectionFromSession(preparedSelectionId: string): Promise<void> {
  const { supabase } = await requireOwningTeacherOrAdmin(preparedSelectionId);
  const { error } = await supabase
    .from("session_prepared_selections")
    .update({ session_id: null })
    .eq("id", preparedSelectionId);
  if (error) throw new Error(error.message);
}
