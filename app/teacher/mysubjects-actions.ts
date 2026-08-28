"use server";

import { createClient } from "@/utils/supabase/server";
import type { TemplateUnit } from "./mysubjects-data";

export async function createMyTemplate(subjectId: string): Promise<{
  templateId: string;
  units: TemplateUnit[];
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const { data: template, error } = await supabase
    .from("teacher_curriculum_templates")
    .insert({ teacher_id: user.id, subject_id: subjectId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { data: catalogUnits } = await supabase
    .from("subject_template_units")
    .select("position, unit_title, note")
    .eq("subject_id", subjectId)
    .order("position", { ascending: true });

  if (!catalogUnits || catalogUnits.length === 0) {
    return { templateId: template.id, units: [] };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("teacher_curriculum_template_units")
    .insert(
      catalogUnits.map((u) => ({
        template_id: template.id,
        position: u.position,
        unit_title: u.unit_title,
        note: u.note,
      }))
    )
    .select("id, position, unit_title, note, teacher_comment")
    .order("position", { ascending: true });
  if (insertError) throw new Error(insertError.message);

  return {
    templateId: template.id,
    units: (inserted ?? []).map((u) => ({
      id: u.id,
      position: u.position,
      unitTitle: u.unit_title,
      note: u.note,
      teacherComment: u.teacher_comment,
    })),
  };
}

export async function addTemplateUnit(
  templateId: string,
  nextPosition: number
): Promise<TemplateUnit> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teacher_curriculum_template_units")
    .insert({
      template_id: templateId,
      position: nextPosition,
      unit_title: "새 회차",
    })
    .select("id, position, unit_title, note, teacher_comment")
    .single();
  if (error) throw new Error(error.message);

  return {
    id: data.id,
    position: data.position,
    unitTitle: data.unit_title,
    note: data.note,
    teacherComment: data.teacher_comment,
  };
}

export async function updateTemplateUnit(
  unitId: string,
  fields: { unitTitle?: string; note?: string; teacherComment?: string }
): Promise<void> {
  const supabase = await createClient();
  const patch: Record<string, string | null> = {};
  if (fields.unitTitle !== undefined) patch.unit_title = fields.unitTitle;
  if (fields.note !== undefined) patch.note = fields.note || null;
  if (fields.teacherComment !== undefined)
    patch.teacher_comment = fields.teacherComment || null;

  const { error } = await supabase
    .from("teacher_curriculum_template_units")
    .update(patch)
    .eq("id", unitId);
  if (error) throw new Error(error.message);
}

export async function removeTemplateUnit(unitId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("teacher_curriculum_template_units")
    .delete()
    .eq("id", unitId);
  if (error) throw new Error(error.message);
}

export async function moveTemplateUnit(
  unitId: string,
  otherUnitId: string
): Promise<void> {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("teacher_curriculum_template_units")
    .select("id, position")
    .in("id", [unitId, otherUnitId]);
  if (error) throw new Error(error.message);
  if (!rows || rows.length !== 2) return;

  const [a, b] = rows;
  const TEMP_OFFSET = -1000000;
  await supabase
    .from("teacher_curriculum_template_units")
    .update({ position: TEMP_OFFSET })
    .eq("id", a.id);
  await supabase
    .from("teacher_curriculum_template_units")
    .update({ position: a.position })
    .eq("id", b.id);
  await supabase
    .from("teacher_curriculum_template_units")
    .update({ position: b.position })
    .eq("id", a.id);
}
