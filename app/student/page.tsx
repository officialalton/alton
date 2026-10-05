import { requireUser } from "@/lib/auth";
import { ViewerTimezoneProvider } from "@/app/components/ViewerTimezoneProvider";
import StudentShell from "./StudentShell";
import { loadDashboardData } from "./dashboard-data";
import { loadMyVocabWords, loadLibraryBooks, loadVocabQuizzes, loadVocabFolders } from "./vocab-library-data";
import { loadProblemHistory } from "./problem-history-data";
import { loadLessons } from "./lessons-data";
import { loadCurricula } from "./curriculum-data";
import { loadMemos } from "./memo-data";
import { loadReviews, loadStudentFeedback } from "./review-data";
import { loadStudentHomeworkBatches } from "@/lib/homework-batch-data";
import { loadMaterialsLibraryTree } from "./materials-data";
import { loadCreditsData } from "./credits-data";
import {
  loadTeacherList,
  loadTeacherProfile,
  loadTeacherSessionHistory,
} from "./teacher-data";
import { ensureThreadAndLoadMessages } from "./chat-data";
import { loadStudentSubjectEnrollments } from "./enrollment-data";
import { loadLessonBookingData } from "./lesson-booking-data";
import { loadRoadmapData } from "@/lib/roadmap/data";
import { loadMockExamOverview } from "@/lib/mock-exam/attempt-data";
import { loadMockExamWeaknessSummary, topWeaknesses } from "@/lib/mock-exam/weakness";
import { hasFeature, loadStudentFeatureAccess } from "@/lib/feature-access";
import { resolveUserTimezone } from "@/lib/timezone";

export default async function StudentHomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { user, supabase, profile } = await requireUser();
  const { tab } = await searchParams;

  // 2026-10-05 무료 학습 회원(S1→S2) — 기능 권한은 student_feature_access 하나로 판정한다. 과외 키("class")가
  // 없는 학생(household·수강·선생님이 없는 무료 회원)은 그 전제를 깔고 있는 로더(대시보드/수업권/예약/
  // 선생님·채팅/수강/과제/로드맵)를 건너뛰고 무료 집합 데이터만 받는다.
  // 쿼리 수(데이터 0건 기준, 단어 라이브러리 책 수 N 제외): S1 13개 → S2 12개 — 약점 요약 RPC(+1)를 더하고
  // Practice 로더를 모의고사 저장분만으로 좁혀(-2) 상한(≤ S1)을 지킨다.
  const featureAccess = await loadStudentFeatureAccess(supabase, user.id);
  if (!hasFeature(featureAccess, "class")) {
    const safeListFree = async <T,>(label: string, p: Promise<T[]>): Promise<T[]> => {
      try {
        return await p;
      } catch (e) {
        console.error(JSON.stringify({ type: "student_home_loader_failed", label, error: e instanceof Error ? e.message : String(e) }));
        return [];
      }
    };
    const [myVocabWords, vocabLibraryBooks, vocabQuizzes, vocabFolders, problemHistory, materialsLibraryTree, mockExamOverview, weakness] =
      await Promise.all([
        safeListFree("vocab_words", loadMyVocabWords(supabase, user.id)),
        safeListFree("vocab_books", loadLibraryBooks(supabase)),
        safeListFree("vocab_quizzes", loadVocabQuizzes(supabase, user.id)),
        safeListFree("vocab_folders", loadVocabFolders(supabase, user.id)),
        safeListFree("problem_history", loadProblemHistory(user.id, { mockExamOnly: true })),
        // 무료 회원: 수강 관계가 없으므로 무료 공개 자료만(수강 조회 2회 생략).
        safeListFree("materials_library", loadMaterialsLibraryTree(supabase, user.id, { includeEnrolled: false })),
        loadMockExamOverview(supabase, user.id).catch((e) => {
          console.error(JSON.stringify({ type: "student_home_loader_failed", label: "mock_exam_overview", error: e instanceof Error ? e.message : String(e) }));
          return undefined;
        }),
        loadMockExamWeaknessSummary(supabase, user.id).catch((e) => {
          console.error(JSON.stringify({ type: "student_home_loader_failed", label: "mock_exam_weakness", error: e instanceof Error ? e.message : String(e) }));
          return null;
        }),
      ]);
    const timezone = resolveUserTimezone({ profileTimezone: profile?.timezone ?? null });
    const studentName = profile?.name ?? "";
    const now = new Date();
    return (
      <ViewerTimezoneProvider timezone={timezone}>
        <StudentShell
          studentName={studentName}
          initialTab={tab}
          featureAccess={featureAccess}
          dashboard={{ studentName, upcoming: [], calendarByDay: {}, calendarYear: now.getFullYear(), calendarMonth: now.getMonth(), attendanceRate: null }}
          myVocabWords={myVocabWords}
          vocabLibraryBooks={vocabLibraryBooks}
          vocabQuizzes={vocabQuizzes}
          vocabFolders={vocabFolders}
          problemHistory={problemHistory}
          upcoming={[]}
          past={[]}
          curricula={[]}
          memosByEnrollment={{}}
          reviews={{}}
          myFeedback={{}}
          studentId={user.id}
          homeworkBatches={[]}
          materialsLibraryTree={materialsLibraryTree}
          credits={{ balance: 0, guardianName: null, regularRemaining: 0, regularNearestExpiry: null, trialEntitlement: null }}
          teacherList={[]}
          teacherProfiles={{}}
          teacherSessionHistory={{}}
          chatThreads={{}}
          subjectEnrollments={[]}
          lessonBooking={{ bookableEnrollments: [], pendingActivationSubjects: [], upcomingBookings: [], pastSessionsForReport: [], timezone }}
          roadmap={null}
          mockExamOverview={mockExamOverview}
          freeHome={{ weaknesses: weakness ? topWeaknesses(weakness, 3) : [], gradedAttemptCount: weakness?.gradedAttemptCount ?? 0 }}
        />
      </ViewerTimezoneProvider>
    );
  }
  // 2026-09-09(UAT 정정) — 홈 대시보드가 레거시 legacy_sessions만 조회해
  // v3 전용 배정 학생의 예정 수업이 홈 캘린더/위젯에서 누락되던 문제 수정.
  // loadDashboardData()가 v3 예약(loadLessonBookingData 결과)을 병합하려면
  // 그 결과가 먼저 있어야 하므로, dashboard만 lessonBooking에 의존하는
  // 체인으로 분리하고 나머지 로더는 그대로 전부 병렬 유지한다.
  const lessonBookingPromise = loadLessonBookingData(supabase, user.id);
  const dashboardPromise = lessonBookingPromise.then((lb) =>
    loadDashboardData(supabase, user.id, lb)
  );
  // 2026-09-11 — "수업" 탭 예정 수업 목록도 홈과 동일하게 v3 예약을
  // 병합해야 한다(레거시 legacy_sessions만 조회하면 v3 전용 배정 학생의
  // 예정 수업이 "수업" 탭에서 누락된다).
  const lessonsPromise = lessonBookingPromise.then((lb) =>
    loadLessons(supabase, user.id, lb)
  );
  // 2026-09-21(기획자 리뷰 P2 "비활성 탭 하나의 실패가 /student 전체 500") — 목록형 탭 데이터는 실패해도
  // 홈 전체를 죽이지 않고 빈 목록으로 내려간다(해당 탭만 비어 보이고 서버 로그에 사유가 남는다).
  // 홈/수업/수업권/통계/로드맵처럼 모양이 필요한 데이터는 그대로 실패를 전파한다(잘못된 빈 화면보다 오류가 낫다).
  const safeList = async <T,>(label: string, p: Promise<T[]>): Promise<T[]> => {
    try {
      return await p;
    } catch (e) {
      console.error(JSON.stringify({ type: "student_home_loader_failed", label, error: e instanceof Error ? e.message : String(e) }));
      return [];
    }
  };

  const [
    dashboard,
    lessonBooking,
    myVocabWords,
    vocabLibraryBooks,
    vocabQuizzes,
    vocabFolders,
    problemHistory,
    { upcoming, past },
    curricula,
    homeworkBatches,
    materialsLibraryTree,
    credits,
    subjectEnrollments,
    teacherList,
    roadmap,
    mockExamOverview,
  ] = await Promise.all([
    dashboardPromise,
    lessonBookingPromise,
    safeList("vocab_words", loadMyVocabWords(supabase, user.id)),
    safeList("vocab_books", loadLibraryBooks(supabase)),
    safeList("vocab_quizzes", loadVocabQuizzes(supabase, user.id)),
    safeList("vocab_folders", loadVocabFolders(supabase, user.id)),
    safeList("problem_history", loadProblemHistory(user.id)),
    lessonsPromise,
    safeList("curricula", loadCurricula(supabase, user.id)),
    safeList("homework_batches", loadStudentHomeworkBatches(supabase, user.id)),
    safeList("materials_library", loadMaterialsLibraryTree(supabase, user.id)),
    loadCreditsData(supabase, user.id),
    safeList("subject_enrollments", loadStudentSubjectEnrollments(supabase, user.id)),
    safeList("teacher_list", loadTeacherList(supabase, user.id)),
    loadRoadmapData(supabase, user.id),
    // 2026-09-22(UAT "모의고사 탭 로딩이 길다") — 다른 탭처럼 SSR로 미리 받는다.
    loadMockExamOverview(supabase, user.id).catch((e) => {
      // 실패 시 undefined — 탭이 열릴 때 클라이언트에서 다시 시도하고 오류를 보여준다(홈 전체는 죽이지 않는다).
      console.error(JSON.stringify({ type: "student_home_loader_failed", label: "mock_exam_overview", error: e instanceof Error ? e.message : String(e) }));
      return undefined;
    }),
  ]);

  const pastSessionIds = past.map((l) => l.sessionId);

  const [memosEntries, reviews, myFeedback, teacherEntries] = await Promise.all([
    Promise.all(
      curricula.map(
        async (c) => [c.enrollmentId, await safeList(`memos:${c.enrollmentId}`, loadMemos(supabase, c.enrollmentId))] as const
      )
    ),
    loadReviews(supabase, pastSessionIds),
    loadStudentFeedback(supabase, user.id, pastSessionIds),
    Promise.all(
      teacherList.map(async (t) => {
        // 선생님 한 명의 프로필·기록·채팅 조회 실패가 홈 전체를 막지 않게 한다(그 선생님 카드만 비어 보인다).
        const [profile, sessionHistory, chatThread] = await Promise.all([
          loadTeacherProfile(supabase, user.id, t.teacherId).catch((e) => {
            console.error(JSON.stringify({ type: "student_home_loader_failed", label: `teacher_profile:${t.teacherId}`, error: e instanceof Error ? e.message : String(e) }));
            return null;
          }),
          safeList(`teacher_history:${t.teacherId}`, loadTeacherSessionHistory(supabase, user.id, t.teacherId)),
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
    <ViewerTimezoneProvider timezone={lessonBooking.timezone}>
    <StudentShell
      studentName={dashboard.studentName}
      initialTab={tab}
      featureAccess={featureAccess}
      dashboard={dashboard}
      myVocabWords={myVocabWords}
      vocabLibraryBooks={vocabLibraryBooks}
      vocabQuizzes={vocabQuizzes}
      vocabFolders={vocabFolders}
      problemHistory={problemHistory}
      upcoming={upcoming}
      past={past}
      curricula={curricula}
      memosByEnrollment={memosByEnrollment}
      reviews={reviews}
      myFeedback={myFeedback}
      studentId={user.id}
      homeworkBatches={homeworkBatches}
      materialsLibraryTree={materialsLibraryTree}
      credits={credits}
      teacherList={teacherList}
      teacherProfiles={teacherProfiles}
      teacherSessionHistory={teacherSessionHistory}
      chatThreads={chatThreads}
      subjectEnrollments={subjectEnrollments}
      lessonBooking={lessonBooking}
      roadmap={roadmap}
      mockExamOverview={mockExamOverview}
    />
    </ViewerTimezoneProvider>
  );
}
