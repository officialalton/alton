"use server";

import { createClient } from "@/utils/supabase/server";
import type { SubjectKeyword, SubjectUnit } from "./subject-data";

async function requireAdmin() {
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
  if (profile?.role !== "admin") throw new Error("관리자만 사용할 수 있습니다.");
  return { supabase };
}

export async function createSubject(name: string): Promise<{ id: string; name: string }> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("subjects")
    .insert({ name })
    .select("id, name")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("이미 존재하는 과목명입니다.");
    throw new Error(error.message);
  }
  return data;
}

export async function renameSubject(subjectId: string, name: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("subjects").update({ name }).eq("id", subjectId);
  if (error) {
    if (error.code === "23505") throw new Error("이미 존재하는 과목명입니다.");
    throw new Error(error.message);
  }
}

// 2026-09-09(UAT 지적, 제품 오너 승인) — 실사용 참조가 있는 과목은 하드 삭제
// 대신 보관(archive) 처리한다. 참조 카운트·분기는 DB 함수
// attempt_delete_or_archive_subject()(20261266000000)가 담당 — 앱 레벨에서는
// 결과만 그대로 UI에 전달한다.
export type DeleteSubjectResult = { archived: boolean; reason: string | null };

export async function deleteSubject(subjectId: string): Promise<DeleteSubjectResult> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .rpc("attempt_delete_or_archive_subject", { p_subject_id: subjectId })
    .single<{ archived: boolean; reason: string | null }>();
  if (error) throw new Error(error.message);
  return { archived: data.archived, reason: data.reason };
}

export async function addSubjectUnit(
  subjectId: string,
  nextPosition: number
): Promise<SubjectUnit> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("subject_template_units")
    .insert({ subject_id: subjectId, position: nextPosition, unit_title: "새 회차" })
    .select("id, position, unit_title, note")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id, position: data.position, unitTitle: data.unit_title, note: data.note };
}

export async function updateSubjectUnit(
  unitId: string,
  fields: { unitTitle?: string; note?: string }
): Promise<void> {
  const { supabase } = await requireAdmin();
  const patch: Record<string, string | null> = {};
  if (fields.unitTitle !== undefined) patch.unit_title = fields.unitTitle;
  if (fields.note !== undefined) patch.note = fields.note || null;

  const { error } = await supabase
    .from("subject_template_units")
    .update(patch)
    .eq("id", unitId);
  if (error) throw new Error(error.message);
}

export async function removeSubjectUnit(unitId: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("subject_template_units")
    .delete()
    .eq("id", unitId);
  if (error) throw new Error(error.message);
}

// =========================================================================
// R9(Task 2) — 과목별 공용 키워드 사전 + 단원 태깅
// 콘텐츠 원본 생성·검수·공개는 관리자만 한다(스펙 §7) — 아래는 전부 requireAdmin을
// 거치고, DB 트리거(20261228000000_r9_curriculum_content_foundation.sql)가
// 과목 불일치·created_by 위조를 한 번 더 막는다.
// =========================================================================

// 2026-09-10(P0-2) — Minified React error #441 마스킹 버그: 이 파일의 키워드
// 관련 액션들이 검증 실패를 throw했는데, Next.js가 production에서 Server
// Action의 미처리 예외를 이 일반화된 문구로 마스킹해 화면에 그대로 노출시켰다
// (dev에서는 실제 한국어 메시지가 보여 재현이 늦었다 — app/teacher/
// lesson-schedule-actions.ts의 2026-09-06 동일 사례와 같은 원인). 항상
// { ok, error } 형태로 반환해 예외를 전파하지 않는다.
export type KeywordActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { value: T }))
  | { ok: false; error: string };

export async function createSubjectKeyword(
  subjectId: string,
  label: string
): Promise<KeywordActionResult<SubjectKeyword>> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("subject_keywords")
    .insert({ subject_id: subjectId, label })
    .select("id, label, status")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, error: "이미 존재하는 키워드입니다." };
    return { ok: false, error: error.message };
  }
  return { ok: true, value: { id: data.id, label: data.label, status: data.status } };
}

export async function assignUnitKeyword(
  unitId: string,
  keywordId: string
): Promise<KeywordActionResult> {
  const { supabase } = await requireAdmin();

  // 앱 레벨에서 먼저 과목 불일치를 확인해 DB 트리거의 원문 에러보다 명확한
  // 메시지를 준다(트리거는 방어선으로 그대로 유지 — 다른 경로로 들어오는
  // 쓰기도 막아야 하므로 여기서 검증한다고 트리거를 없애지 않는다).
  const [{ data: unit }, { data: keyword }] = await Promise.all([
    supabase.from("subject_template_units").select("subject_id").eq("id", unitId).single(),
    supabase.from("subject_keywords").select("subject_id").eq("id", keywordId).single(),
  ]);
  if (!unit || !keyword) return { ok: false, error: "존재하지 않는 단원 또는 키워드입니다." };
  if (unit.subject_id !== keyword.subject_id) {
    return { ok: false, error: "단원과 키워드는 같은 과목이어야 합니다." };
  }

  const { error } = await supabase
    .from("subject_template_unit_keywords")
    .insert({ unit_id: unitId, keyword_id: keywordId });
  if (error && error.code !== "23505") {
    // 23505(이미 태그됨)는 멱등 처리 — 에러 아님.
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function removeUnitKeyword(
  unitId: string,
  keywordId: string
): Promise<KeywordActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("subject_template_unit_keywords")
    .delete()
    .eq("unit_id", unitId)
    .eq("keyword_id", keywordId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function moveSubjectUnit(unitId: string, otherUnitId: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { data: rows, error } = await supabase
    .from("subject_template_units")
    .select("id, position")
    .in("id", [unitId, otherUnitId]);
  if (error) throw new Error(error.message);
  if (!rows || rows.length !== 2) return;

  const [a, b] = rows;
  const TEMP_OFFSET = -1000000;
  await supabase
    .from("subject_template_units")
    .update({ position: TEMP_OFFSET })
    .eq("id", a.id);
  await supabase
    .from("subject_template_units")
    .update({ position: a.position })
    .eq("id", b.id);
  await supabase
    .from("subject_template_units")
    .update({ position: b.position })
    .eq("id", a.id);
}
