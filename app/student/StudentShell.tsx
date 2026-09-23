"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/app/login/actions";
import TimezoneSettingsModal from "@/app/components/TimezoneSettingsModal";
import MobileBottomNav from "@/app/components/MobileBottomNav";
import HomeTab from "./HomeTab";
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
import TeacherTab from "./TeacherTab";
import StudentMockExamTab from "./StudentMockExamTab";
import type { MockExamAttemptSummary } from "@/lib/mock-exam/attempt-data";
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
  listMyPendingLessonRescheduleRequestsAction,
  respondToMyLessonRescheduleRequestAction,
} from "./booking-actions";
import { reportTeacherIssue } from "./incident-report-actions";
import StudentConsultantTab from "./StudentConsultantTab";
import RoadmapView from "@/app/components/RoadmapView";
import type { RoadmapData } from "@/lib/roadmap/types";
import PageFrame from "@/app/components/PageFrame";
import NavIcon from "@/app/components/NavIcon";

// 2026-09-19(UI 통일화) — 좌측 네비게이션 라벨은 전부 영어로 통일한다(Acely
// 레퍼런스). 탭 안 본문의 한국어 텍스트는 유지, 라벨만 영어로 바꾼다.
const NAV_ITEMS = [
  // 2026-09-22(사용자 지시) — 기존 Home과 Student Success Planner(Board)를
  // 합쳐 Home 탭 하나 안에서 Overview/Lesson/TODO/Done 서브탭으로 나눈다
  // (HomeTab.tsx). 별도 "Planner" nav 항목은 없앤다.
  { id: "home", label: "Home", icon: "home" },
  { id: "roadmap", label: "Roadmap", icon: "roadmap" },
  { id: "enrollment", label: "Courses", icon: "courses" },
  // 2026-09-06(A안 UI 정리) — "예약"(v3 예약/캘린더)과 "레슨"(레거시 커리큘럼·리뷰)이
  // 기능 중복이라는 지적에 따라 하나의 "수업" 탭으로 합쳤다(ClassesTab, 예정/지난
  // 두 서브탭). 자세한 내용은 ClassesTab.tsx 상단 주석 참고.
  { id: "classes", label: "Classes", icon: "classes" },
  { id: "teacher", label: "My Teacher", icon: "teacher" },
  // 2026-09-22(사용자 지시 — "컨설턴트는 학생이랑도 메신저 필요하긴 하겠네") —
  // household 메신저(부모·컨설턴트가 쓰던 것)를 학생도 접근할 수 있게.
  { id: "consultant", label: "Consultant", icon: "consultations" },
  // 2026-09-21(UAT 지적) — 모의고사 목록은 독립 라우트가 아니라 일반 탭이다(좌측 네비 유지).
  // 실제 응시/결과 화면(/student/mock-exam/[attemptId])만 전체 화면 독립 라우트로 남긴다.
  // 2026-09-22(사용자 지시) — Assignments보다 위로.
  { id: "mock-exam", label: "Mock Exams", icon: "mockExam" },
  { id: "homework", label: "Assignments", icon: "assignments" },
  { id: "problemlog", label: "Practice", icon: "practice" },
  { id: "vocab", label: "Vocabulary", icon: "vocabulary" },
  { id: "materials", label: "Materials", icon: "materials" },
  // 2026-09-22(사용자 지시) — Credits는 계정 팝업으로, Performance는 Home에 이미
  // 있어 제거(NAV_ITEMS에서 뺐다 — CreditsTab은 계정 팝업에서 계속 쓴다).
] as const;

type TabId = (typeof NAV_ITEMS)[number]["id"];

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
  teacherList,
  teacherProfiles,
  teacherSessionHistory,
  chatThreads,
  subjectEnrollments,
  lessonBooking,
  roadmap,
  mockExamAttempts,
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
  teacherList: TeacherListItem[];
  teacherProfiles: Record<string, TeacherProfileData | null>;
  teacherSessionHistory: Record<string, TeacherSessionHistoryItem[]>;
  chatThreads: Record<string, { threadId: string; messages: ChatMessage[] }>;
  subjectEnrollments: SubjectEnrollmentView[];
  lessonBooking: LessonBookingData;
  roadmap: RoadmapData;
  mockExamAttempts?: MockExamAttemptSummary[];
}) {
  const router = useRouter();
  const validTabIds = useMemo(() => NAV_ITEMS.map((n) => n.id), []);
  const [activeTab, setActiveTab] = useState<TabId>(
    validTabIds.includes(initialTab as TabId) ? (initialTab as TabId) : "home"
  );
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [timezoneModalOpen, setTimezoneModalOpen] = useState(false);
  // 2026-09-22(사용자 지시) — Credits는 별도 탭 대신 계정 메뉴 팝업으로 옮긴다.
  const [creditsModalOpen, setCreditsModalOpen] = useState(false);

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
      <aside className="hidden md:flex w-56 shrink-0 border-r border-grey-200 flex-col py-5 px-3 gap-0.5">
        <div className="flex items-center gap-2 px-2.5 mb-5">
          <div className="w-8 h-8 rounded-full bg-red text-white font-extrabold text-[14px] flex items-center justify-center shrink-0">
            A
          </div>
          <span className="text-[13.5px] font-extrabold text-ink">ALTON</span>
        </div>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => selectTab(item.id)}
            aria-current={activeTab === item.id ? "page" : undefined}
            className={
              "w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[13px] font-semibold transition-colors " +
              (activeTab === item.id ? "bg-red text-white" : "text-grey-500 hover:bg-grey-100 hover:text-ink")
            }
          >
            <NavIcon name={item.icon} className="w-[18px] h-[18px] shrink-0" />
            {item.label}
          </button>
        ))}

        {/* 2026-09-19(UAT 반영) — Acely 레퍼런스: 계정 메뉴를 상단 헤더바가
            아니라 사이드바 맨 아래(프로필)로 옮긴다. 상단 헤더바 자체를
            없앤다. 위로 펼쳐지는 드롭다운(bottom-full). */}
        <div className="mt-auto pt-2 relative">
          <button
            onClick={() => setAccountMenuOpen((v) => !v)}
            className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[13px] font-semibold text-ink hover:bg-grey-100"
          >
            <div className="w-7 h-7 rounded-full bg-grey-100 text-ink font-extrabold text-[12px] flex items-center justify-center shrink-0">
              {studentName.charAt(0)}
            </div>
            <span className="flex-1 text-left truncate">{studentName} 학생님</span>
            <NavIcon name="settings" className="w-4 h-4 shrink-0 text-grey-400" />
          </button>
          {accountMenuOpen && (
            <div className="absolute bottom-full left-0 mb-1 w-full bg-white border-[1.5px] border-grey-200 rounded-lg shadow-sm py-1.5 z-30">
              <button
                onClick={() => {
                  setCreditsModalOpen(true);
                  setAccountMenuOpen(false);
                }}
                className="w-full text-left px-3.5 py-2 text-[13px] font-semibold text-ink"
              >
                수강권(Credits)
              </button>
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
        </div>
      </aside>

      {/* 2026-09-19 — aside는 모바일에서 hidden(display:none)이라, 그 안에
          두면 모바일 계정 메뉴에서 연 모달이 함께 숨어 안 보인다. aside
          바깥(항상 렌더링되는 자리)에 둔다. */}
      {timezoneModalOpen && (
        <TimezoneSettingsModal
          showHouseholdDefault={false}
          onClose={() => setTimezoneModalOpen(false)}
        />
      )}

      {creditsModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={() => setCreditsModalOpen(false)}>
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-grey-200 bg-white px-5 py-3">
              <span className="text-[14px] font-bold text-ink">수강권(Credits)</span>
              <button type="button" onClick={() => setCreditsModalOpen(false)} className="text-[12px] font-bold text-grey-500 underline">
                닫기
              </button>
            </div>
            <div className="p-5">
              <CreditsTab data={credits} />
            </div>
          </div>
        </div>
      )}

      <MobileBottomNav primary={mobilePrimary} more={mobileMore} activeId={activeTab} onSelect={(id) => selectTab(id as TabId)} />

      <div className="flex-1 flex flex-col pb-16 md:pb-0">
        {/* 2026-09-19(UAT 반영) — 데스크톱은 계정 메뉴가 사이드바 맨 아래로
            옮겨져 상단 헤더바가 없다. 모바일은 사이드바 자체가 숨겨지므로
            계정 메뉴만 담은 얇은 바를 여기 남긴다. */}
        <div className="md:hidden flex items-center justify-end gap-4 border-b border-grey-200 px-4 py-2.5 relative">
          <button
            onClick={() => setAccountMenuOpen((v) => !v)}
            className="text-[13px] font-semibold text-ink"
          >
            {studentName} 학생님 ▾
          </button>
          {accountMenuOpen && (
            <div className="absolute top-full right-4 mt-1 w-40 bg-white border-[1.5px] border-grey-200 rounded-lg shadow-sm py-1.5 z-30">
              <button
                onClick={() => {
                  setCreditsModalOpen(true);
                  setAccountMenuOpen(false);
                }}
                className="w-full text-left px-3.5 py-2 text-[13px] font-semibold text-ink"
              >
                수강권(Credits)
              </button>
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
        </div>

        {/* 2026-09-19(UI 통일화) — Acely 레퍼런스: 홈(개인화된 인사말 헤더를
            이미 가지고 있음)을 뺀 나머지 탭은 전부 같은 프레임(영어 제목 +
            가운데 정렬 고정폭 컬럼) 안에서 렌더링된다. 탭 내부 정렬은 그대로
            (왼쪽 정렬 텍스트 등) 두고, 제목 위치·컬럼 폭만 통일한다. */}
        <div className="flex-1">
        {activeTab === "home" ? (
          <HomeTab studentName={studentName} dashboard={dashboard} />
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
              dashboard={dashboard}
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
              onListPendingReschedule={listMyPendingLessonRescheduleRequestsAction}
              onRespondToReschedule={respondToMyLessonRescheduleRequestAction}
            />
          ) : activeTab === "vocab" ? (
            <VocabLibraryTab myWords={myVocabWords} books={vocabLibraryBooks} quizzes={vocabQuizzes} folders={vocabFolders} />
          ) : activeTab === "problemlog" ? (
            <ProblemHistoryTab entries={problemHistory} />
          ) : activeTab === "homework" ? (
            <StudentHomeworkTab batches={homeworkBatches} />
          ) : activeTab === "materials" ? (
            <MaterialsLibraryTab tree={materialsLibraryTree} />
          ) : activeTab === "teacher" ? (
            <TeacherTab
              teachers={teacherList}
              profiles={teacherProfiles}
              sessionHistory={teacherSessionHistory}
              chatThreads={chatThreads}
            />
          ) : activeTab === "mock-exam" ? (
            <StudentMockExamTab initialAttempts={mockExamAttempts} />
          ) : activeTab === "consultant" ? (
            <StudentConsultantTab />
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
