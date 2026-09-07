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
  const perStudent = await Promise.all(
    students.map(async (s) => {
      const curricula = await loadCurricula(supabase, s.studentId);
      return curricula.map((c) => ({ ...c, studentId: s.studentId, studentName: s.studentName }));
    })
  );
  return perStudent.flat();
}
