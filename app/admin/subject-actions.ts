"use server";

import { createClient } from "@/utils/supabase/server";
import type { SubjectUnit } from "./subject-data";

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
