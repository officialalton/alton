import type { SupabaseClient } from "@supabase/supabase-js";

export type MatchingTeacherCandidate = {
  id: string;
  name: string;
};

function extractOne<T>(rel: unknown): T | null {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as T | undefined) ?? null;
}

export async function loadTeacherCandidatesBySubject(
  supabase: SupabaseClient
): Promise<Record<string, MatchingTeacherCandidate[]>> {
  const { data: links } = await supabase
    .from("teacher_curriculum_templates")
    .select("subject_id, teacher:teachers(id, status, profile:profiles(name))");

  const bySubject: Record<string, MatchingTeacherCandidate[]> = {};
  for (const l of (links ?? []) as {
    subject_id: string;
    teacher: unknown;
  }[]) {
    const teacher = extractOne<{
      id: string;
      status: string;
      profile: unknown;
    }>(l.teacher);
    if (!teacher || teacher.status !== "active") continue;
    const profile = extractOne<{ name?: string }>(teacher.profile);

    const list = bySubject[l.subject_id] ?? [];
    if (!list.some((c) => c.id === teacher.id)) {
      list.push({ id: teacher.id, name: profile?.name ?? "" });
    }
    bySubject[l.subject_id] = list;
  }
  return bySubject;
}
