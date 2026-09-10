"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/app/login/actions";
import TimezoneSettingsModal from "@/app/components/TimezoneSettingsModal";
import MobileBottomNav from "@/app/components/MobileBottomNav";
import HomeDashboard from "./HomeDashboard";
import type { DashboardData } from "./dashboard-data";
import VocabTab from "@/app/session/[id]/VocabTab";
import type { VocabEntry } from "@/app/session/[id]/vocab-data";
import ProblemLogTab from "@/app/session/[id]/ProblemLogTab";
import type { ProblemLogEntry } from "@/app/session/[id]/problemlog-data";
import type { LessonItem } from "./lessons-data";
import type { CurriculumData } from "./curriculum-data";
import type { Memo } from "./memo-data";
import type { ReviewData, StudentFeedback } from "./review-data";
import StudentHomeworkTab from "./StudentHomeworkTab";
import type { StudentHomeworkItem } from "./homework-data";
import type { StudentHomeworkV3Item } from "./homework-v3-data";
import MaterialsLibraryTab from "./MaterialsLibraryTab";
import type { LibrarySubject } from "./materials-data";
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

const NAV_ITEMS = [
  { id: "home", label: "홈", icon: "🏠" },
  { id: "enrollment", label: "수강 과목", icon: "🎓" },
  // 2026-09-06(A안 UI 정리) — "예약"(v3 예약/캘린더)과 "레슨"(레거시 커리큘럼·리뷰)이
  // 기능 중복이라는 지적에 따라 하나의 "수업" 탭으로 합쳤다(ClassesTab, 예정/지난
  // 두 서브탭). 자세한 내용은 ClassesTab.tsx 상단 주석 참고.
  { id: "classes", label: "수업", icon: "📅" },
  { id: "teacher", label: "선생님", icon: "👤" },
  { id: "homework", label: "과제", icon: "📝" },
  { id: "problemlog", label: "문제", icon: "📋" },
  { id: "vocab", label: "단어장", icon: "📖" },
  { id: "materials", label: "교재", icon: "📚" },
  { id: "credits", label: "수업권", icon: "💳" },
  { id: "stats", label: "통계", icon: "📊" },
] as const;

type TabId = (typeof NAV_ITEMS)[number]["id"];

export default function StudentShell({
  studentName,
  initialTab,
  dashboard,
  vocabWords,
  problemLog,
  upcoming,
  past,
  curricula,
  memosByEnrollment,
  reviews,
  myFeedback,
  homeworkTodo,
  homeworkDone,
  homeworkV3,
  materialsLibrary,
  credits,
  stats,
  teacherList,
  teacherProfiles,
  teacherSessionHistory,
  chatThreads,
  subjectEnrollments,
  lessonBooking,
}: {
  studentName: string;
  initialTab?: string;
  dashboard: DashboardData;
  vocabWords: VocabEntry[];
  problemLog: ProblemLogEntry[];
  upcoming: LessonItem[];
  past: LessonItem[];
  curricula: CurriculumData[];
  memosByEnrollment: Record<string, Memo[]>;
  reviews: Record<string, ReviewData>;
  myFeedback: Record<string, StudentFeedback>;
  homeworkTodo: StudentHomeworkItem[];
  homeworkDone: StudentHomeworkItem[];
  homeworkV3: StudentHomeworkV3Item[];
  materialsLibrary: LibrarySubject[];
  credits: CreditsData;
  stats: StatsData;
  teacherList: TeacherListItem[];
  teacherProfiles: Record<string, TeacherProfileData | null>;
  teacherSessionHistory: Record<string, TeacherSessionHistoryItem[]>;
  chatThreads: Record<string, { threadId: string; messages: ChatMessage[] }>;
  subjectEnrollments: SubjectEnrollmentView[];
  lessonBooking: LessonBookingData;
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
            <span className="text-[17px]">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </aside>

      <MobileBottomNav
        primary={mobilePrimary}
        more={mobileMore}
        activeId={activeTab}
        onSelect={(id) => selectTab(id as TabId)}
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

        <div className="flex-1">
          {activeTab === "home" ? (
            <HomeDashboard
              studentName={studentName}
              data={dashboard}
              onShowLessons={() => selectTab("classes")}
              onShowStats={() => selectTab("stats")}
              timezone={lessonBooking.timezone}
            />
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
            <VocabTab
              initialWords={vocabWords}
              isTeacher={false}
              canManage={true}
              studentName={studentName}
            />
          ) : activeTab === "problemlog" ? (
            <ProblemLogTab initialEntries={problemLog} viewerRole="student" />
          ) : activeTab === "homework" ? (
            <StudentHomeworkTab
              initialTodo={homeworkTodo}
              initialDone={homeworkDone}
              initialV3Items={homeworkV3}
            />
          ) : activeTab === "materials" ? (
            <MaterialsLibraryTab subjects={materialsLibrary} />
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
        </div>
      </div>
    </div>
  );
}
