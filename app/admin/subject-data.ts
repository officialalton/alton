import type { SupabaseClient } from "@supabase/supabase-js";

export type SubjectUnit = {
  id: string;
  position: number;
  unitTitle: string;
  note: string | null;
};

export type AdminSubject = {
  subjectId: string;
  subjectName: string;
  units: SubjectUnit[];
};

export async function loadSubjectCatalog(
  supabase: SupabaseClient
): Promise<AdminSubject[]> {
  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name")
    .order("name", { ascending: true });
  if (!subjects || subjects.length === 0) return [];

  const { data: units } = await supabase
    .from("subject_template_units")
    .select("id, subject_id, position, unit_title, note")
    .in(
      "subject_id",
      subjects.map((s) => s.id)
    )
    .order("position", { ascending: true });

  const unitsBySubject = new Map<string, SubjectUnit[]>();
  for (const u of units ?? []) {
    const list = unitsBySubject.get(u.subject_id) ?? [];
    list.push({ id: u.id, position: u.position, unitTitle: u.unit_title, note: u.note });
    unitsBySubject.set(u.subject_id, list);
  }

  return subjects.map((s) => ({
    subjectId: s.id,
    subjectName: s.name,
    units: unitsBySubject.get(s.id) ?? [],
  }));
}
