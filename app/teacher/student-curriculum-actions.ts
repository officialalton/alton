"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/supabase-admin";
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
  source_teacher_template_unit_id?: string | null;
  position: number;
  unit_title: string;
  note: string | null;
  status: OverlayUnit["status"];
  status_changed_at: string | null;
}): OverlayUnit {
  return {
    id: row.id,
    sourceUnitId: row.source_unit_id,
    sourceTeacherTemplateUnitId: row.source_teacher_template_unit_id ?? null,
    position: row.position,
    unitTitle: row.unit_title,
    note: row.note,
    status: row.status,
    statusChangedAt: row.status_changed_at,
    keywordIds: [],
    keywordLabels: [],
    materialDocIds: [],
    needsBaseUpdate: false,
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
export type EnsureOverlayResult = { ok: true; overlayId: string } | { ok: false; error: string };

// 2026-09-14: 던지지 않는다 — Production 은 서버 액션 예외 메시지를 통째로 가린다(React #441).
// 인가 실패·DB 사유를 값으로 돌려 화면이 보여준다.
export async function ensureActiveOverlay(subjectEnrollmentId: string): Promise<EnsureOverlayResult> {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    ({ supabase } = await requireAssignedTeacherOrAdmin(subjectEnrollmentId));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "이 학생의 커리큘럼을 열 권한이 없습니다." };
  }

  const { data, error } = await supabase.rpc("ensure_active_curriculum_overlay", {
    p_subject_enrollment_id: subjectEnrollmentId,
  });
  if (error) {
    console.error(JSON.stringify({ event: "ensure_overlay_failed", subjectEnrollmentId, message: error.message }));
    return { ok: false, error: readableDbError(error.message, "학생 커리큘럼을 준비하지 못했습니다.") };
  }
  return { ok: true, overlayId: data as string };
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

export type AddUnitResult = { ok: true; unit: OverlayUnit } | { ok: false; error: string };

export async function addCanonicalUnit(
  subjectEnrollmentId: string,
  overlayId: string,
  sourceUnitId: string,
  unitTitle: string
): Promise<AddUnitResult> {
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
  // 2026-09-14: 던지지 않는다 — Production 에서 던진 예외는 "Minified React error #441" 로 가려져
  // 사유(RLS·트리거 메시지)가 사라진다. 사유를 값으로 돌려주고 화면이 보여준다.
  if (error) {
    console.error(JSON.stringify({ event: "overlay_unit_add_failed", sourceUnitId, message: error.message }));
    return { ok: false, error: readableDbError(error.message, "단원을 불러오지 못했습니다.") };
  }
  return { ok: true, unit: mapUnitRow(data) };
}

/**
 * DB 가 올려준 사유를 사람이 읽을 수 있게 다듬는다. 한국어 메시지(트리거·RPC 의 raise)는 그대로,
 * RLS 거절은 권한 문구로, 그 밖은 원문 앞에 짧은 설명을 붙인다.
 */
function readableDbError(message: string, fallback: string): string {
  if (/row-level security/i.test(message)) return "이 학생의 커리큘럼을 고칠 권한이 없습니다(담당 선생님·관리자만).";
  if (/[가-힣]/.test(message)) return message.replace(/^.*?:\s*/, "");
  return `${fallback} (${message.slice(0, 160)})`;
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

export type BaseUpdateDiff = {
  addedKeywordLabels: string[];
  addedMaterialTitles: string[];
  removedKeywordLabels: string[];
  removedMaterialTitles: string[];
};

/** 2026-09-17(커리큘럼 2단 구조) — 적용 전에 "무엇이 추가되고 무엇이 빠지는지"를
 * 미리 보여준다. 학생이 직접 조정한 값(inherited=false)은 이 계산에 아예
 * 들어오지 않는다 — apply 쪽과 동일한 inherited 기준을 그대로 재사용한다. */
export async function previewBaseCurriculumUpdate(
  subjectEnrollmentId: string,
  overlayUnitId: string
): Promise<BaseUpdateDiff> {
  const { supabase } = await requireAssignedTeacherOrAdmin(subjectEnrollmentId);

  const { data: unit } = await supabase
    .from("curriculum_overlay_units")
    .select("source_unit_id")
    .eq("id", overlayUnitId)
    .maybeSingle();
  const sourceUnitId = unit?.source_unit_id as string | null | undefined;
  if (!sourceUnitId) return { addedKeywordLabels: [], addedMaterialTitles: [], removedKeywordLabels: [], removedMaterialTitles: [] };

  const [
    { data: currentKeywords },
    { data: sourceKeywords },
    { data: currentMaterials },
    { data: sourceMaterials },
  ] = await Promise.all([
    supabase.from("curriculum_overlay_unit_keywords").select("keyword_id, inherited").eq("overlay_unit_id", overlayUnitId),
    supabase.from("subject_template_unit_keywords").select("keyword_id").eq("unit_id", sourceUnitId),
    supabase.from("curriculum_overlay_unit_materials").select("curriculum_doc_id, inherited").eq("overlay_unit_id", overlayUnitId),
    supabase.from("subject_template_unit_materials").select("curriculum_doc_id").eq("unit_id", sourceUnitId),
  ]);

  const currentKwIds = new Set((currentKeywords ?? []).map((k) => k.keyword_id as string));
  const inheritedKwIds = new Set((currentKeywords ?? []).filter((k) => k.inherited).map((k) => k.keyword_id as string));
  const sourceKwIds = new Set((sourceKeywords ?? []).map((k) => k.keyword_id as string));
  const addedKwIds = [...sourceKwIds].filter((id) => !currentKwIds.has(id));
  const removedKwIds = [...inheritedKwIds].filter((id) => !sourceKwIds.has(id));

  const currentMatIds = new Set((currentMaterials ?? []).map((m) => m.curriculum_doc_id as string));
  const inheritedMatIds = new Set((currentMaterials ?? []).filter((m) => m.inherited).map((m) => m.curriculum_doc_id as string));
  const sourceMatIds = new Set((sourceMaterials ?? []).map((m) => m.curriculum_doc_id as string));
  const addedMatIds = [...sourceMatIds].filter((id) => !currentMatIds.has(id));
  const removedMatIds = [...inheritedMatIds].filter((id) => !sourceMatIds.has(id));

  const allKwIds = [...new Set([...addedKwIds, ...removedKwIds])];
  const allDocIds = [...new Set([...addedMatIds, ...removedMatIds])];
  const [{ data: kwLabels }, { data: docTitles }] = await Promise.all([
    allKwIds.length ? supabase.from("subject_keywords").select("id, label").in("id", allKwIds) : Promise.resolve({ data: [] as { id: string; label: string }[] }),
    allDocIds.length ? supabase.from("curriculum_docs").select("id, title").in("id", allDocIds) : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);
  const kwLabelById = new Map((kwLabels ?? []).map((k) => [k.id as string, k.label as string]));
  const docTitleById = new Map((docTitles ?? []).map((d) => [d.id as string, d.title as string]));

  return {
    addedKeywordLabels: addedKwIds.map((id) => kwLabelById.get(id) ?? id),
    removedKeywordLabels: removedKwIds.map((id) => kwLabelById.get(id) ?? id),
    addedMaterialTitles: addedMatIds.map((id) => docTitleById.get(id) ?? id),
    removedMaterialTitles: removedMatIds.map((id) => docTitleById.get(id) ?? id),
  };
}

/** 기준본 업데이트를 이 회차에 적용한다(RPC apply_base_update_to_overlay_unit —
 * 학생이 직접 조정한 값은 건드리지 않고, 상위에서 빠진 inherited 항목만 빼고
 * 새로 추가된 항목만 받는다. 이미 수업에 쓰인 회차는 RPC가 거부한다). */
export async function applyBaseCurriculumUpdate(
  subjectEnrollmentId: string,
  overlayUnitId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, user } = await requireAssignedTeacherOrAdmin(subjectEnrollmentId);
  const { error } = await supabase.rpc("apply_base_update_to_overlay_unit", {
    p_overlay_unit_id: overlayUnitId,
    p_actor_id: user.id,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}


// =========================================================================
// 2026-09-18 — "다음 수업에 추가 학습 회차 넣기"(운영 커리큘럼 회차 카드).
//
// insert_additional_study_unit()/preview_additional_study_unit_insert()는
// service_role 전용으로 만들었다(linkUnitPrepToLesson과 같은 이유 — 두 함수
// 다 자기 안에서 p_actor_id 기준으로 관리자·담당 교사 여부를 다시 검사하므로,
// 클라이언트가 넘긴 값을 곧이곧대로 믿는 게 아니다). 여기 앱 레벨 선검사
// (requireAssignedTeacherOrAdmin)는 읽기 쉬운 오류만 앞당겨 주는 것이고, 실제
// 방어선은 DB 함수 안의 재검사다 — actor_id는 항상 이 서버 액션이 인증
// 세션에서 직접 얻은 user.id이지, 클라이언트가 보낸 값이 아니다.
export type AdditionalStudyUnitPreview = {
  newUnitTitle: string;
  /** 예약 시각 순. resultingUnitTitle은 삽입이 확정되면 이 세션이 실제로 받게
   * 될 회차명이다 — 맨 앞은 새 회차, 그다음부터는 바로 앞 세션이 원래 갖고
   * 있던 회차로 한 칸씩 밀린다(insert_additional_study_unit의 재연결 순서와
   * 정확히 같다). */
  affectedFutureSessions: { sessionId: string; startsAt: string; currentUnitTitle: string; resultingUnitTitle: string }[];
  unaffectedStartedOrCompletedCount: number;
};

export async function previewAdditionalStudyUnitInsert(
  subjectEnrollmentId: string,
  sourceOverlayUnitId: string
): Promise<{ ok: true; preview: AdditionalStudyUnitPreview } | { ok: false; error: string }> {
  let user: { id: string };
  try {
    ({ user } = await requireAssignedTeacherOrAdmin(subjectEnrollmentId));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "이 학생의 커리큘럼을 열 권한이 없습니다." };
  }
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("preview_additional_study_unit_insert", {
    p_source_overlay_unit_id: sourceOverlayUnitId,
    p_actor_id: user.id,
  });
  if (error) return { ok: false, error: error.message };
  const raw = data as { newUnitTitle: string; affectedFutureSessions: { sessionId: string; startsAt: string; currentUnitTitle: string }[]; unaffectedStartedOrCompletedCount: number };
  const affectedFutureSessions = raw.affectedFutureSessions.map((s, i) => ({
    ...s,
    resultingUnitTitle: i === 0 ? raw.newUnitTitle : raw.affectedFutureSessions[i - 1].currentUnitTitle,
  }));
  return { ok: true, preview: { ...raw, affectedFutureSessions } };
}

export type AdditionalStudyUnitInsertResult = {
  newUnitId: string;
  newUnitTitle: string;
  reassigned: { sessionId: string; startsAt: string; overlayUnitId: string }[];
  leftPending: { sessionId: string; startsAt: string }[];
};

export async function insertAdditionalStudyUnit(
  subjectEnrollmentId: string,
  sourceOverlayUnitId: string
): Promise<{ ok: true; result: AdditionalStudyUnitInsertResult } | { ok: false; error: string }> {
  let user: { id: string };
  try {
    ({ user } = await requireAssignedTeacherOrAdmin(subjectEnrollmentId));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "이 학생의 커리큘럼을 조정할 권한이 없습니다." };
  }
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("insert_additional_study_unit", {
    p_source_overlay_unit_id: sourceOverlayUnitId,
    p_actor_id: user.id,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, result: data as AdditionalStudyUnitInsertResult };
}

/** 추가 학습 회차 삽입 뒤 카드 목록·예정 수업 연결을 새로 읽는다. */
export async function reloadCurriculumUnits(subjectEnrollmentId: string): Promise<StudentCurriculum> {
  const { supabase } = await requireAssignedTeacherOrAdmin(subjectEnrollmentId);
  return loadStudentCurriculum(supabase, subjectEnrollmentId);
}
