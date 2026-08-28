import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCurricula, type CurriculumData } from "@/app/student/curriculum-data";

export type TeacherCurriculumData = CurriculumData & {
  studentId: string;
  studentName: string;
};

export async function loadAllStudentCurricula(
  supabase: SupabaseClient,
  students: { studentId: string; studentName: string }[]
): Promise<TeacherCurriculumData[]> {
  const results: TeacherCurriculumData[] = [];
  for (const s of students) {
    const curricula = await loadCurricula(supabase, s.studentId);
    for (const c of curricula) {
      results.push({ ...c, studentId: s.studentId, studentName: s.studentName });
    }
  }
  return results;
}
