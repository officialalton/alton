"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/app/login/actions";
import TeacherHomeDashboard from "./TeacherHomeDashboard";
import type { TeacherDashboardData } from "./dashboard-data";
import ScheduleTab from "./ScheduleTab";
import RosterTab from "./RosterTab";
import CurriculumTab from "./CurriculumTab";
import type { RosterStudent } from "./roster-data";
import type { MySubject } from "./mysubjects-data";
import type { TeacherCurriculumData } from "./curriculum-data";
import type { Memo } from "@/app/student/memo-data";
import type { ReviewData, StudentFeedback } from "@/app/student/review-data";
import AssignmentsTab from "./AssignmentsTab";
import type { TeacherAssignedSubject } from "./assignments-data";
import TeacherAvailabilityTab from "./TeacherAvailabilityTab";
import type { TeacherAvailabilityRuleRow, AvailabilityExceptionRow } from "./availability-actions";
import {
  addTeacherAvailabilityRule,
  removeTeacherAvailabilityRule,
  addTeacherAvailabilityException,
  removeTeacherAvailabilityException,
} from "./availability-actions";
import { reportSessionIssue } from "./incident-report-actions";
import TeacherLessonScheduleTab from "./TeacherLessonScheduleTab";
import {
  listMyLessonSchedule,
  cancelMyLessonScheduleBooking,
  listMyExternalBusyBlocks,
  type TeacherLessonScheduleItem,
} from "./lesson-schedule-actions";

const NAV_ITEMS = [
  { id: "home", label: "홈", icon: "🏠" },
  { id: "assignments", label: "배정", icon: "🎯" },
  { id: "lesson-schedule", label: "정규수업", icon: "📆" },
  { id: "availability", label: "가능시간", icon: "🗓" },
  { id: "schedule", label: "수업", icon: "📅" },
  { id: "roster", label: "학생", icon: "👥" },
  { id: "curriculum", label: "커리큘럼", icon: "📘" },
  { id: "materials", label: "교재", icon: "📚" },
  { id: "settlement", label: "정산", icon: "💰" },
] as const;

type TabId = (typeof NAV_ITEMS)[number]["id"];

export default function TeacherShell({
  initialTab,
  dashboard,
  roster,
  mySubjects,
  curricula,
  memosByEnrollment,
  reviews,
  studentFeedback,
  reviewedSessionIds,
  currentAssignments,
  pastAssignments,
  availabilityRules,
  availabilityExceptions,
  availabilityTimezone,
  lessonSchedule,
}: {
  initialTab?: string;
  dashboard: TeacherDashboardData;
  roster: RosterStudent[];
  mySubjects: MySubject[];
  curricula: TeacherCurriculumData[];
  memosByEnrollment: Record<string, Memo[]>;
  reviews: Record<string, ReviewData>;
  studentFeedback: Record<string, StudentFeedback>;
  reviewedSessionIds: string[];
  currentAssignments: TeacherAssignedSubject[];
  pastAssignments: TeacherAssignedSubject[];
  availabilityRules: TeacherAvailabilityRuleRow[];
  availabilityExceptions: AvailabilityExceptionRow[];
  availabilityTimezone: string;
  lessonSchedule: TeacherLessonScheduleItem[];
}) {
  const router = useRouter();
  const [lessons, setLessons] = useState<TeacherLessonScheduleItem[]>(lessonSchedule);
  const validTabIds = useMemo(() => NAV_ITEMS.map((n) => n.id), []);
  const [activeTab, setActiveTab] = useState<TabId>(
    validTabIds.includes(initialTab as TabId) ? (initialTab as TabId) : "home"
  );
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [curriculumJump, setCurriculumJump] = useState<{
    studentId: string;
    subjectId: string;
  } | null>(null);

  function selectTab(id: TabId) {
    setActiveTab(id);
    router.replace(`?tab=${id}`, { scroll: false });
  }

  function openCurriculumFromRoster(studentId: string, subjectId: string) {
    setCurriculumJump({ studentId, subjectId });
    selectTab("curriculum");
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
            {dashboard.teacherName} 선생님 ▾
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
            <TeacherHomeDashboard
              data={dashboard}
              onShowSchedule={() => selectTab("schedule")}
            />
          ) : activeTab === "assignments" ? (
            <AssignmentsTab current={currentAssignments} past={pastAssignments} />
          ) : activeTab === "schedule" ? (
            <ScheduleTab
              upcoming={dashboard.upcoming}
              past={dashboard.past}
              reviewedSessionIds={reviewedSessionIds}
              onReportSessionIssue={reportSessionIssue}
            />
          ) : activeTab === "lesson-schedule" ? (
            <TeacherLessonScheduleTab
              lessons={lessons}
              exceptions={availabilityExceptions}
              timezone={availabilityTimezone}
              onCancel={(reservationId, reason) => cancelMyLessonScheduleBooking({ reservationId, reason })}
              onLoadExternalBusy={listMyExternalBusyBlocks}
              onRefresh={() => listMyLessonSchedule().then(setLessons)}
            />
          ) : activeTab === "availability" ? (
            <TeacherAvailabilityTab
              initialRules={availabilityRules}
              initialExceptions={availabilityExceptions}
              timezone={availabilityTimezone}
              onAddRule={addTeacherAvailabilityRule}
              onRemoveRule={removeTeacherAvailabilityRule}
              onAddException={addTeacherAvailabilityException}
              onRemoveException={removeTeacherAvailabilityException}
              onLoadExternalBusy={listMyExternalBusyBlocks}
            />
          ) : activeTab === "roster" ? (
            <RosterTab students={roster} onOpenCurriculum={openCurriculumFromRoster} />
          ) : activeTab === "curriculum" ? (
            <CurriculumTab
              mySubjects={mySubjects}
              students={roster}
              curricula={curricula}
              memosByEnrollment={memosByEnrollment}
              reviews={reviews}
              studentFeedback={studentFeedback}
              jumpTo={curriculumJump}
              onJumpConsumed={() => setCurriculumJump(null)}
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
