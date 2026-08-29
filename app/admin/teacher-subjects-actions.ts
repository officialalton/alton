"use server";

import { createClient } from "@/utils/supabase/server";

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

export async function assignTeacherSubject(
  teacherId: string,
  subjectId: string
): Promise<void> {
  const { supabase } = await requireAdmin();

  const { data: template, error } = await supabase
    .from("teacher_curriculum_templates")
    .insert({ teacher_id: teacherId, subject_id: subjectId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { data: catalogUnits } = await supabase
    .from("subject_template_units")
    .select("position, unit_title, note")
    .eq("subject_id", subjectId)
    .order("position", { ascending: true });

  if (!catalogUnits || catalogUnits.length === 0) return;

  const { error: unitsError } = await supabase
    .from("teacher_curriculum_template_units")
    .insert(
      catalogUnits.map((u) => ({
        template_id: template.id,
        position: u.position,
        unit_title: u.unit_title,
        note: u.note,
      }))
    );
  if (unitsError) throw new Error(unitsError.message);
}

export async function unassignTeacherSubject(
  teacherId: string,
  subjectId: string
): Promise<void> {
  const { supabase } = await requireAdmin();

  const { data: activeEnrollments } = await supabase
    .from("enrollments")
    .select("id")
    .eq("teacher_id", teacherId)
    .eq("subject_id", subjectId)
    .eq("status", "active");
  if (activeEnrollments && activeEnrollments.length > 0) {
    throw new Error(
      "이 과목으로 매칭된 학생이 있어 담당 과목에서 제거할 수 없습니다. 먼저 매칭을 해제해주세요."
    );
  }

  const { error } = await supabase
    .from("teacher_curriculum_templates")
    .delete()
    .eq("teacher_id", teacherId)
    .eq("subject_id", subjectId);
  if (error) throw new Error(error.message);
}
