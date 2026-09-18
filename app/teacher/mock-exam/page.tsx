import { requireUser } from "@/lib/auth";
import { loadTeacherMockExamStudents } from "../mock-exam-assign-data";
import { loadPublishedMockExamSetsForAssignment, loadTeacherMockExamAttemptsForStudent } from "@/lib/mock-exam/attempt-data";
import MockExamAssignPanel from "../MockExamAssignPanel";

export default async function TeacherMockExamPage() {
  const { user, supabase } = await requireUser();
  const [students, examSets] = await Promise.all([
    loadTeacherMockExamStudents(supabase, user.id),
    loadPublishedMockExamSetsForAssignment(supabase),
  ]);
  const attemptsByStudent: Record<string, Awaited<ReturnType<typeof loadTeacherMockExamAttemptsForStudent>>> = {};
  for (const s of students) attemptsByStudent[s.studentId] = await loadTeacherMockExamAttemptsForStudent(supabase, s.studentId);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-[18px] font-extrabold">모의고사 배정</h1>
      {students.length === 0 || examSets.length === 0 ? (
        <p className="text-[13px] text-grey-500">
          {students.length === 0 ? "담당 학생이 없습니다." : "공개된 시험 세트가 없습니다."}
        </p>
      ) : (
        <MockExamAssignPanel students={students} examSets={examSets} attemptsByStudent={attemptsByStudent} />
      )}
    </main>
  );
}
