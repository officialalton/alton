"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/app/login/actions";
import HomeDashboard from "./HomeDashboard";
import type { DashboardData } from "./dashboard-data";
import VocabTab from "@/app/session/[id]/VocabTab";
import type { VocabEntry } from "@/app/session/[id]/vocab-data";
import ProblemLogTab from "@/app/session/[id]/ProblemLogTab";
import type { ProblemLogEntry } from "@/app/session/[id]/problemlog-data";
import LessonsTab from "./LessonsTab";
import type { LessonItem } from "./lessons-data";
import type { CurriculumData } from "./curriculum-data";
import type { Memo } from "./memo-data";
import type { ReviewData, StudentFeedback } from "./review-data";
import type { BookableEnrollment } from "./booking-data";
import StudentHomeworkTab from "./StudentHomeworkTab";
import type { StudentHomeworkItem } from "./homework-data";
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

const NAV_ITEMS = [
  { id: "home", label: "홈", icon: "🏠" },
  { id: "enrollment", label: "수강 과목", icon: "🎓" },
  { id: "lessons", label: "레슨", icon: "📅" },
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
  bookableEnrollments,
  homeworkTodo,
  homeworkDone,
  materialsLibrary,
  credits,
  stats,
  teacherList,
  teacherProfiles,
  teacherSessionHistory,
  chatThreads,
  subjectEnrollments,
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
  bookableEnrollments: BookableEnrollment[];
  homeworkTodo: StudentHomeworkItem[];
  homeworkDone: StudentHomeworkItem[];
  materialsLibrary: LibrarySubject[];
  credits: CreditsData;
  stats: StatsData;
  teacherList: TeacherListItem[];
  teacherProfiles: Record<string, TeacherProfileData | null>;
  teacherSessionHistory: Record<string, TeacherSessionHistoryItem[]>;
  chatThreads: Record<string, { threadId: string; messages: ChatMessage[] }>;
  subjectEnrollments: SubjectEnrollmentView[];
}) {
  const router = useRouter();
  const validTabIds = useMemo(() => NAV_ITEMS.map((n) => n.id), []);
  const [activeTab, setActiveTab] = useState<TabId>(
    validTabIds.includes(initialTab as TabId) ? (initialTab as TabId) : "home"
  );
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  function selectTab(id: TabId) {
    setActiveTab(id);
    router.replace(`?tab=${id}`, { scroll: false });
  }

  const activeLabel = NAV_ITEMS.find((n) => n.id === activeTab)?.label ?? "";

  return (
    <div className="min-h-screen bg-white flex">
      <aside className="w-[88px] shrink-0 border-r border-grey-200 flex flex-col items-center py-5 gap-1">
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

      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-end gap-4 border-b border-grey-200 px-6 py-3 relative">
          <button
            onClick={() => setAccountMenuOpen((v) => !v)}
            className="text-[13px] font-semibold text-ink"
          >
            {studentName} 학생님 ▾
          </button>
          {accountMenuOpen && (
            <div className="absolute top-full right-6 mt-1 w-40 bg-white border-[1.5px] border-grey-200 rounded-lg shadow-sm py-1.5 z-30">
              <form action={logout}>
                <button className="w-full text-left px-3.5 py-2 text-[13px] font-semibold text-red">
                  로그아웃
                </button>
              </form>
            </div>
          )}
        </div>

        <div className="flex-1">
          {activeTab === "home" ? (
            <HomeDashboard
              studentName={studentName}
              data={dashboard}
              onShowLessons={() => selectTab("lessons")}
              onShowStats={() => selectTab("stats")}
            />
          ) : activeTab === "enrollment" ? (
            <EnrollmentTab enrollments={subjectEnrollments} />
          ) : activeTab === "vocab" ? (
            <VocabTab
              initialWords={vocabWords}
              isTeacher={false}
              canManage={true}
              studentName={studentName}
            />
          ) : activeTab === "problemlog" ? (
            <ProblemLogTab initialEntries={problemLog} viewerRole="student" />
          ) : activeTab === "lessons" ? (
            <LessonsTab
              upcoming={upcoming}
              past={past}
              curricula={curricula}
              memosByEnrollment={memosByEnrollment}
              reviews={reviews}
              myFeedback={myFeedback}
              bookableEnrollments={bookableEnrollments}
            />
          ) : activeTab === "homework" ? (
            <StudentHomeworkTab
              initialTodo={homeworkTodo}
              initialDone={homeworkDone}
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
