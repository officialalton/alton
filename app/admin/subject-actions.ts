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

export async function deleteSubject(subjectId: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("subjects").delete().eq("id", subjectId);
  if (error) {
    if (error.code === "23503") {
      throw new Error(
        "이 과목은 이미 선생님 커리큘럼/매칭/교재 등에서 사용 중이라 삭제할 수 없습니다."
      );
    }
    throw new Error(error.message);
  }
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

export async function createSubjectKeyword(
  subjectId: string,
  label: string
): Promise<SubjectKeyword> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("subject_keywords")
    .insert({ subject_id: subjectId, label })
    .select("id, label, status")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("이미 존재하는 키워드입니다.");
    throw new Error(error.message);
  }
  return { id: data.id, label: data.label, status: data.status };
}

export async function assignUnitKeyword(unitId: string, keywordId: string): Promise<void> {
  const { supabase } = await requireAdmin();

  // 앱 레벨에서 먼저 과목 불일치를 확인해 DB 트리거의 원문 에러보다 명확한
  // 메시지를 준다(트리거는 방어선으로 그대로 유지 — 다른 경로로 들어오는
  // 쓰기도 막아야 하므로 여기서 검증한다고 트리거를 없애지 않는다).
  const [{ data: unit }, { data: keyword }] = await Promise.all([
    supabase.from("subject_template_units").select("subject_id").eq("id", unitId).single(),
    supabase.from("subject_keywords").select("subject_id").eq("id", keywordId).single(),
  ]);
  if (!unit || !keyword) throw new Error("존재하지 않는 단원 또는 키워드입니다.");
  if (unit.subject_id !== keyword.subject_id) {
    throw new Error("단원과 키워드는 같은 과목이어야 합니다.");
  }

  const { error } = await supabase
    .from("subject_template_unit_keywords")
    .insert({ unit_id: unitId, keyword_id: keywordId });
  if (error) {
    if (error.code === "23505") return; // 이미 태그됨 — 멱등 처리
    throw new Error(error.message);
  }
}

export async function removeUnitKeyword(unitId: string, keywordId: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("subject_template_unit_keywords")
    .delete()
    .eq("unit_id", unitId)
    .eq("keyword_id", keywordId);
  if (error) throw new Error(error.message);
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
