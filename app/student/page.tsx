import { requireUser } from "@/lib/auth";
import StudentShell from "./StudentShell";
import { loadDashboardData } from "./dashboard-data";
import { loadVocabWords } from "@/app/session/[id]/vocab-data";
import { loadProblemLog } from "@/app/session/[id]/problemlog-data";
import { loadLessons } from "./lessons-data";
import { loadCurricula } from "./curriculum-data";
import { loadMemos } from "./memo-data";
import { loadReviews, loadStudentFeedback } from "./review-data";
import { loadStudentHomework } from "./homework-data";
import { loadMaterialsLibrary } from "./materials-data";
import { loadCreditsData } from "./credits-data";
import { loadStats } from "./stats-data";
import {
  loadTeacherList,
  loadTeacherProfile,
  loadTeacherSessionHistory,
} from "./teacher-data";
import { ensureThreadAndLoadMessages } from "./chat-data";
import { loadStudentSubjectEnrollments } from "./enrollment-data";
import { loadLessonBookingData } from "./lesson-booking-data";

export default async function StudentHomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { user, supabase } = await requireUser();
  const { tab } = await searchParams;
  const dashboard = await loadDashboardData(supabase, user.id);
  const vocabWords = await loadVocabWords(supabase, user.id);
  const problemLog = await loadProblemLog(supabase, user.id);
  const { upcoming, past } = await loadLessons(supabase, user.id);
  const curricula = await loadCurricula(supabase, user.id);

  const memosByEnrollment: Record<string, Awaited<ReturnType<typeof loadMemos>>> = {};
  for (const c of curricula) {
    memosByEnrollment[c.enrollmentId] = await loadMemos(supabase, c.enrollmentId);
  }

  const pastSessionIds = past.map((l) => l.sessionId);
  const reviews = await loadReviews(supabase, pastSessionIds);
  const myFeedback = await loadStudentFeedback(supabase, user.id, pastSessionIds);
  const homework = await loadStudentHomework(supabase, user.id);
  const materialsLibrary = await loadMaterialsLibrary(supabase, user.id);
  const credits = await loadCreditsData(supabase, user.id);
  const stats = await loadStats(supabase, user.id);
  const subjectEnrollments = await loadStudentSubjectEnrollments(supabase, user.id);
  const lessonBooking = await loadLessonBookingData(supabase, user.id);

  const teacherList = await loadTeacherList(supabase, user.id);
  const teacherProfiles: Record<string, Awaited<ReturnType<typeof loadTeacherProfile>>> = {};
  const teacherSessionHistory: Record<
    string,
    Awaited<ReturnType<typeof loadTeacherSessionHistory>>
  > = {};
  const chatThreads: Record<string, Awaited<ReturnType<typeof ensureThreadAndLoadMessages>>> = {};
  for (const t of teacherList) {
    teacherProfiles[t.teacherId] = await loadTeacherProfile(supabase, user.id, t.teacherId);
    teacherSessionHistory[t.teacherId] = await loadTeacherSessionHistory(
      supabase,
      user.id,
      t.teacherId
    );
    chatThreads[t.teacherId] = await ensureThreadAndLoadMessages(
      supabase,
      user.id,
      t.teacherId
    );
  }

  return (
    <StudentShell
      studentName={dashboard.studentName}
      initialTab={tab}
      dashboard={dashboard}
      vocabWords={vocabWords}
      problemLog={problemLog}
      upcoming={upcoming}
      past={past}
      curricula={curricula}
      memosByEnrollment={memosByEnrollment}
      reviews={reviews}
      myFeedback={myFeedback}
      homeworkTodo={homework.todo}
      homeworkDone={homework.done}
      materialsLibrary={materialsLibrary}
      credits={credits}
      stats={stats}
      teacherList={teacherList}
      teacherProfiles={teacherProfiles}
      teacherSessionHistory={teacherSessionHistory}
      chatThreads={chatThreads}
      subjectEnrollments={subjectEnrollments}
      lessonBooking={lessonBooking}
    />
  );
}
