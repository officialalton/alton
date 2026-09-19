"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/app/login/actions";
import TimezoneSettingsModal from "@/app/components/TimezoneSettingsModal";
import MobileBottomNav from "@/app/components/MobileBottomNav";
import HomeDashboard from "./HomeDashboard";
import type { DashboardData } from "./dashboard-data";
import VocabLibraryTab from "./VocabLibraryTab";
import type { MyVocabWord, LibraryBook, VocabQuiz, VocabFolder } from "./vocab-library-data";
import ProblemHistoryTab from "./ProblemHistoryTab";
import type { ProblemHistoryEntry } from "./problem-history-data";
import type { LessonItem } from "./lessons-data";
import type { CurriculumData } from "./curriculum-data";
import type { Memo } from "./memo-data";
import type { ReviewData, StudentFeedback } from "./review-data";
import StudentHomeworkTab from "./StudentHomeworkTab";
import type { HomeworkBatch } from "@/lib/homework-batch-data";
import MaterialsLibraryTab from "./MaterialsLibraryTab";
import type { LibrarySubjectTree } from "@/lib/subject-material-library";
import CreditsTab from "./CreditsTab";
import type { CreditsData } from "./credits-data";
import StatsTab from "./StatsTab";
import type { StatsData } from "./stats-data";
import TeacherTab from "./TeacherTab";
import type {
  TeacherListItem,
  TeacherProfileData,
  TeacherSessionHistoryItem,
} from "./teacher-data";
import type { ChatMessage } from "./chat-data";
import EnrollmentTab from "./EnrollmentTab";
import type { SubjectEnrollmentView } from "./enrollment-data";
import ClassesTab from "./ClassesTab";
import type { LessonBookingData } from "./lesson-booking-data";
import {
  listAvailableSlotsForBooking,
  createMyLessonBooking,
  createMyWeeklyLessonSeries,
  cancelMyLessonBooking,
  updateMyTimezone,
} from "./booking-actions";
import { reportTeacherIssue } from "./incident-report-actions";
import RoadmapView from "@/app/components/RoadmapView";
import type { RoadmapData } from "@/lib/roadmap/types";
import PageFrame from "@/app/components/PageFrame";

// 2026-09-19(UI 통일화) — 좌측 네비게이션 라벨은 전부 영어로 통일한다(Acely
// 레퍼런스). 탭 안 본문의 한국어 텍스트는 유지, 라벨만 영어로 바꾼다.
const NAV_ITEMS = [
  { id: "home", label: "Home", icon: "🏠" },
  { id: "roadmap", label: "Roadmap", icon: "🧭" },
  { id: "enrollment", label: "Courses", icon: "🎓" },
  // 2026-09-06(A안 UI 정리) — "예약"(v3 예약/캘린더)과 "레슨"(레거시 커리큘럼·리뷰)이
  // 기능 중복이라는 지적에 따라 하나의 "수업" 탭으로 합쳤다(ClassesTab, 예정/지난
  // 두 서브탭). 자세한 내용은 ClassesTab.tsx 상단 주석 참고.
  { id: "classes", label: "Classes", icon: "📅" },
  { id: "teacher", label: "My Teacher", icon: "👤" },
  { id: "homework", label: "Assignments", icon: "📝" },
  { id: "problemlog", label: "Practice", icon: "📋" },
  { id: "vocab", label: "Vocabulary", icon: "📖" },
  { id: "materials", label: "Materials", icon: "📚" },
  { id: "credits", label: "Credits", icon: "💳" },
  { id: "stats", label: "Performance", icon: "📊" },
] as const;

type TabId = (typeof NAV_ITEMS)[number]["id"];

// 2026-09-18(고정형 모의고사 V1) — /student/mock-exam은 StudentShell 탭이 아니라
// 독립 라우트다. NAV_ITEMS/TabId를 건드리지 않고 router.push로 이동하는 링크
// 전용 항목을 별도로 둔다.
const MOCK_EXAM_NAV_ITEM = { id: "mock-exam", label: "Mock Exams", icon: "📝" } as const;

export default function StudentShell({
  studentName,
  initialTab,
  dashboard,
  myVocabWords,
  vocabLibraryBooks,
  vocabQuizzes,
  vocabFolders,
  problemHistory,
  upcoming,
  past,
  curricula,
  memosByEnrollment,
  reviews,
  myFeedback,
  studentId,
  homeworkBatches,
  materialsLibraryTree,
  credits,
  stats,
  teacherList,
  teacherProfiles,
  teacherSessionHistory,
  chatThreads,
  subjectEnrollments,
  lessonBooking,
  roadmap,
}: {
  studentName: string;
  initialTab?: string;
  dashboard: DashboardData;
  myVocabWords: MyVocabWord[];
  vocabLibraryBooks: LibraryBook[];
  vocabQuizzes: VocabQuiz[];
  vocabFolders: VocabFolder[];
  problemHistory: ProblemHistoryEntry[];
  upcoming: LessonItem[];
  past: LessonItem[];
  curricula: CurriculumData[];
  memosByEnrollment: Record<string, Memo[]>;
  reviews: Record<string, ReviewData>;
  myFeedback: Record<string, StudentFeedback>;
  /** 학생 본인 id(2026-09-14 과제 v3 통일 — 과제 패널이 쓴다). */
  studentId: string;
  homeworkBatches: HomeworkBatch[];
  materialsLibraryTree: LibrarySubjectTree[];
  credits: CreditsData;
  stats: StatsData;
  teacherList: TeacherListItem[];
  teacherProfiles: Record<string, TeacherProfileData | null>;
  teacherSessionHistory: Record<string, TeacherSessionHistoryItem[]>;
  chatThreads: Record<string, { threadId: string; messages: ChatMessage[] }>;
  subjectEnrollments: SubjectEnrollmentView[];
  lessonBooking: LessonBookingData;
  roadmap: RoadmapData;
}) {
  const router = useRouter();
  const validTabIds = useMemo(() => NAV_ITEMS.map((n) => n.id), []);
  const [activeTab, setActiveTab] = useState<TabId>(
    validTabIds.includes(initialTab as TabId) ? (initialTab as TabId) : "home"
  );
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [timezoneModalOpen, setTimezoneModalOpen] = useState(false);

  // 2026-09-10(P0-3 2차) — 공용 포털 내비게이션 결함: activeTab이 마운트
  // 시점의 initialTab으로만 초기화돼, 브라우저 뒤로가기/앞으로가기로 URL이
  // 바뀌어도(그래서 새 initialTab prop이 내려와도) 다시 반영되지 않았다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveTab(validTabIds.includes(initialTab as TabId) ? (initialTab as TabId) : "home");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);

  function selectTab(id: TabId) {
    setActiveTab(id);
    // 2026-09-10(P0-3 2차) — replace→push: 탭 전환마다 되돌아갈 수 있는
    // 히스토리 항목을 만들어, 뒤로가기 한 번이 포털 밖(로그인/OAuth)까지
    // 건너뛰지 않고 직전 탭으로만 이동하게 한다.
    router.push(`?tab=${id}`, { scroll: false });
    // 이 화면(및 부모용 ParentShell)은 모든 탭 데이터를 최초 서버 렌더 시점에
    // props로 한 번에 받아와 클라이언트에서 탭만 전환한다 — 탭 전환 자체는
    // 새 서버 요청을 만들지 않으므로, 그 사이(예: Stripe 결제 완료) 바뀐 서버
    // 상태가 있어도 다른 탭에서 돌아왔을 때 예전 값이 그대로 보인다(실사용
    // 확인 — 수업권 구매 직후 "수업권" 탭이 0장으로 보이던 문제). router.refresh()로
    // 탭을 누를 때마다 서버 데이터를 다시 받아온다.
    router.refresh();
  }

  const activeLabel = NAV_ITEMS.find((n) => n.id === activeTab)?.label ?? "";

  // 2026-09-10(UI/UX 정리 1차, 배치4) — 모바일 하단 탭: 홈·수업·과제·교재 +
  // 더보기(나머지). 데스크톱 사이드바는 그대로 두고 모바일에서만 숨긴다.
  const MOBILE_PRIMARY_IDS: TabId[] = ["home", "classes", "homework", "materials"];
  const mobilePrimary = NAV_ITEMS.filter((n) => MOBILE_PRIMARY_IDS.includes(n.id));
  const mobileMore = NAV_ITEMS.filter((n) => !MOBILE_PRIMARY_IDS.includes(n.id));

  return (
    <div className="min-h-screen bg-white flex">
      <aside className="hidden md:flex w-[88px] shrink-0 border-r border-grey-200 flex-col items-center py-5 gap-1">
        <div className="w-9 h-9 rounded-full bg-red text-white font-extrabold text-[15px] flex items-center justify-center mb-4">
          A
        </div>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => selectTab(item.id)}
            className={
              "w-full flex flex-col items-center gap-0.5 py-2.5 text-[10.5px] font-semibold " +
              (activeTab === item.id ? "text-ink" : "text-grey-300")
            }
          >
            <span className="text-[17px] grayscale">{item.icon}</span>
            {item.label}
          </button>
        ))}
        <button
          onClick={() => router.push("/student/mock-exam")}
          className="w-full flex flex-col items-center gap-0.5 py-2.5 text-[10.5px] font-semibold text-grey-300"
        >
          <span className="text-[17px] grayscale">{MOCK_EXAM_NAV_ITEM.icon}</span>
          {MOCK_EXAM_NAV_ITEM.label}
        </button>
      </aside>

      <MobileBottomNav
        primary={mobilePrimary}
        more={[...mobileMore, MOCK_EXAM_NAV_ITEM]}
        activeId={activeTab}
        onSelect={(id) => (id === MOCK_EXAM_NAV_ITEM.id ? router.push("/student/mock-exam") : selectTab(id as TabId))}
      />

      <div className="flex-1 flex flex-col pb-16 md:pb-0">
        <div className="flex items-center justify-end gap-4 border-b border-grey-200 px-6 py-3 relative">
          <button
            onClick={() => setAccountMenuOpen((v) => !v)}
            className="text-[13px] font-semibold text-ink"
          >
            {studentName} 학생님 ▾
          </button>
          {accountMenuOpen && (
            <div className="absolute top-full right-6 mt-1 w-40 bg-white border-[1.5px] border-grey-200 rounded-lg shadow-sm py-1.5 z-30">
              <button
                onClick={() => {
                  setTimezoneModalOpen(true);
                  setAccountMenuOpen(false);
                }}
                className="w-full text-left px-3.5 py-2 text-[13px] font-semibold text-ink"
              >
                시간대 설정
              </button>
              <div className="h-px bg-grey-200 my-1" />
              <form action={logout}>
                <button className="w-full text-left px-3.5 py-2 text-[13px] font-semibold text-red">
                  로그아웃
                </button>
              </form>
            </div>
          )}
          {timezoneModalOpen && (
            <TimezoneSettingsModal
              showHouseholdDefault={false}
              onClose={() => setTimezoneModalOpen(false)}
            />
          )}
        </div>

        {/* 2026-09-19(UI 통일화) — Acely 레퍼런스: 홈(개인화된 인사말 헤더를
            이미 가지고 있음)을 뺀 나머지 탭은 전부 같은 프레임(영어 제목 +
            가운데 정렬 고정폭 컬럼) 안에서 렌더링된다. 탭 내부 정렬은 그대로
            (왼쪽 정렬 텍스트 등) 두고, 제목 위치·컬럼 폭만 통일한다. */}
        <div className="flex-1">
        {activeTab === "home" ? (
          <HomeDashboard
            studentName={studentName}
            data={dashboard}
            onShowLessons={() => selectTab("classes")}
            onShowStats={() => selectTab("stats")}
            timezone={lessonBooking.timezone}
          />
        ) : (
        <PageFrame title={activeLabel}>
          {activeTab === "roadmap" ? (
            <RoadmapView data={roadmap} />
          ) : activeTab === "enrollment" ? (
            <EnrollmentTab enrollments={subjectEnrollments} />
          ) : activeTab === "classes" ? (
            <ClassesTab
              upcoming={upcoming}
              past={past}
              curricula={curricula}
              memosByEnrollment={memosByEnrollment}
              reviews={reviews}
              myFeedback={myFeedback}
              bookableEnrollments={lessonBooking.bookableEnrollments}
              pendingActivationSubjects={lessonBooking.pendingActivationSubjects}
              upcomingBookings={lessonBooking.upcomingBookings}
              pastSessionsForReport={lessonBooking.pastSessionsForReport}
              timezone={lessonBooking.timezone}
              onListSlots={(teacherId, durationMinutes) => listAvailableSlotsForBooking({ teacherId, durationMinutes })}
              onCreateBooking={createMyLessonBooking}
              onCreateWeeklySeries={createMyWeeklyLessonSeries}
              onCancelBooking={(reservationId, reason) => cancelMyLessonBooking({ reservationId, reason })}
              onUpdateTimezone={updateMyTimezone}
              onReportTeacherIssue={reportTeacherIssue}
            />
          ) : activeTab === "vocab" ? (
            <VocabLibraryTab myWords={myVocabWords} books={vocabLibraryBooks} quizzes={vocabQuizzes} folders={vocabFolders} />
          ) : activeTab === "problemlog" ? (
            <ProblemHistoryTab entries={problemHistory} />
          ) : activeTab === "homework" ? (
            <StudentHomeworkTab batches={homeworkBatches} />
          ) : activeTab === "materials" ? (
            <MaterialsLibraryTab tree={materialsLibraryTree} />
          ) : activeTab === "credits" ? (
            <CreditsTab data={credits} />
          ) : activeTab === "stats" ? (
            <StatsTab data={stats} />
          ) : activeTab === "teacher" ? (
            <TeacherTab
              teachers={teacherList}
              profiles={teacherProfiles}
              sessionHistory={teacherSessionHistory}
              chatThreads={chatThreads}
            />
          ) : (
            <div className="p-8 text-[14px] text-grey-500">
              {activeLabel} 탭은 준비 중입니다.
            </div>
          )}
        </PageFrame>
        )}
        </div>
      </div>
    </div>
  );
}
