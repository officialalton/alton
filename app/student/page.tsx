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
import { loadStudentHomeworkV3 } from "./homework-v3-data";
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
  const [
    dashboard,
    vocabWords,
    problemLog,
    { upcoming, past },
    curricula,
    homework,
    homeworkV3,
    materialsLibrary,
    credits,
    stats,
    subjectEnrollments,
    lessonBooking,
    teacherList,
  ] = await Promise.all([
    loadDashboardData(supabase, user.id),
    loadVocabWords(supabase, user.id),
    loadProblemLog(supabase, user.id),
    loadLessons(supabase, user.id),
    loadCurricula(supabase, user.id),
    loadStudentHomework(supabase, user.id),
    loadStudentHomeworkV3(supabase, user.id),
    loadMaterialsLibrary(supabase, user.id),
    loadCreditsData(supabase, user.id),
    loadStats(supabase, user.id),
    loadStudentSubjectEnrollments(supabase, user.id),
    loadLessonBookingData(supabase, user.id),
    loadTeacherList(supabase, user.id),
  ]);

  const pastSessionIds = past.map((l) => l.sessionId);

  const [memosEntries, reviews, myFeedback, teacherEntries] = await Promise.all([
    Promise.all(
      curricula.map(
        async (c) => [c.enrollmentId, await loadMemos(supabase, c.enrollmentId)] as const
      )
    ),
    loadReviews(supabase, pastSessionIds),
    loadStudentFeedback(supabase, user.id, pastSessionIds),
    Promise.all(
      teacherList.map(async (t) => {
        const [profile, sessionHistory, chatThread] = await Promise.all([
          loadTeacherProfile(supabase, user.id, t.teacherId),
          loadTeacherSessionHistory(supabase, user.id, t.teacherId),
          ensureThreadAndLoadMessages(supabase, user.id, t.teacherId),
        ]);
        return { teacherId: t.teacherId, profile, sessionHistory, chatThread };
      })
    ),
  ]);
  const memosByEnrollment = Object.fromEntries(memosEntries) as Record<
    string,
    Awaited<ReturnType<typeof loadMemos>>
  >;
  const teacherProfiles: Record<string, Awaited<ReturnType<typeof loadTeacherProfile>>> = {};
  const teacherSessionHistory: Record<
    string,
    Awaited<ReturnType<typeof loadTeacherSessionHistory>>
  > = {};
  const chatThreads: Record<string, Awaited<ReturnType<typeof ensureThreadAndLoadMessages>>> = {};
  for (const entry of teacherEntries) {
    teacherProfiles[entry.teacherId] = entry.profile;
    teacherSessionHistory[entry.teacherId] = entry.sessionHistory;
    chatThreads[entry.teacherId] = entry.chatThread;
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
      homeworkV3={homeworkV3}
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
