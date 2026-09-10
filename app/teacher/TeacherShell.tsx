"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/app/login/actions";
import TimezoneSettingsModal from "@/app/components/TimezoneSettingsModal";
import TeacherHomeDashboard from "./TeacherHomeDashboard";
import type { TeacherDashboardData } from "./dashboard-data";
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
import TeacherMaterialsLibraryTab from "./MaterialsLibraryTab";
import type { LibrarySubject } from "@/app/student/materials-data";
import {
  listMyLessonSchedule,
  cancelMyLessonScheduleBooking,
  listMyExternalBusyBlocks,
  startMyLessonSession,
  finalizeMyLessonSession,
  resolveMyLessonLateness,
  type TeacherLessonScheduleItem,
} from "./lesson-schedule-actions";

const NAV_ITEMS = [
  { id: "home", label: "홈", icon: "🏠" },
  { id: "assignments", label: "배정", icon: "🎯" },
  { id: "lesson-schedule", label: "수업", icon: "📆" },
  { id: "availability", label: "가능시간", icon: "🗓" },
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
  materialsSubjects,
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
  materialsSubjects: LibrarySubject[];
}) {
  const router = useRouter();
  const [lessons, setLessons] = useState<TeacherLessonScheduleItem[]>(lessonSchedule);
  const validTabIds = useMemo(() => NAV_ITEMS.map((n) => n.id), []);
  const [activeTab, setActiveTab] = useState<TabId>(
    validTabIds.includes(initialTab as TabId) ? (initialTab as TabId) : "home"
  );
  // M4 골든패스 실사용 버그 #5 — 선생님 포털 "수업"(레거시 legacy_sessions 뷰) 탭과
  // "수업 일정"(v3 sessions/reservations, Calendar/Meet 연동) 탭이 기능 중복이라는
  // 지적에 따라 하나의 "수업" 네비게이션 항목으로 합쳤다.
  // 2026-09-06(A안 UI 정리) — "예정/지난 수업"과 "지난 수업 기록·신고"라는 두 서브탭이
  // 여전히 기능이 겹친다는 지적에 따라, 딱 두 개의 서브탭("예정 수업"/"지난 수업")으로
  // 다시 정리했다. 레거시 지각·노쇼 신고 기능은 별도 탭이 아니라 "지난 수업" 서브탭의
  // 각 카드 안으로 완전히 흡수했다(TeacherLessonScheduleTab의 mode="past" +
  // onReportSessionIssue).
  const [lessonSubtab, setLessonSubtab] = useState<"upcoming" | "past">("upcoming");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [timezoneModalOpen, setTimezoneModalOpen] = useState(false);
  const [curriculumJump, setCurriculumJump] = useState<{
    studentId: string;
    subjectId: string;
  } | null>(null);
  const [operatingCurriculumJump, setOperatingCurriculumJump] = useState<{
    subjectEnrollmentId: string;
    subjectId: string;
  } | null>(null);

  function selectTab(id: TabId) {
    setActiveTab(id);
    router.replace(`?tab=${id}`, { scroll: false });
  }

  function openCurriculumFromAssignment(studentId: string, subjectId: string) {
    setCurriculumJump({ studentId, subjectId });
    selectTab("curriculum");
  }

  function openOperatingCurriculumFromAssignment(subjectEnrollmentId: string, subjectId: string) {
    setOperatingCurriculumJump({ subjectEnrollmentId, subjectId });
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
            <TeacherHomeDashboard
              data={dashboard}
              onShowSchedule={() => selectTab("lesson-schedule")}
            />
          ) : activeTab === "assignments" ? (
            <AssignmentsTab
              current={currentAssignments}
              past={pastAssignments}
              onOpenCurriculum={openCurriculumFromAssignment}
              onOpenOperatingCurriculum={openOperatingCurriculumFromAssignment}
            />
          ) : activeTab === "lesson-schedule" ? (
            <div>
              <div className="px-8 pt-8 flex gap-1.5">
                {(["upcoming", "past"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setLessonSubtab(s)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                      lessonSubtab === s ? "bg-ink text-white" : "bg-grey-100 text-grey-500"
                    }`}
                  >
                    {s === "upcoming" ? "예정 수업" : "지난 수업"}
                  </button>
                ))}
              </div>
              <TeacherLessonScheduleTab
                lessons={lessons}
                exceptions={availabilityExceptions}
                timezone={availabilityTimezone}
                mode={lessonSubtab}
                onCancel={async (reservationId, reason) => {
                  const result = await cancelMyLessonScheduleBooking({ reservationId, reason });
                  if (!result.ok) throw new Error(result.error);
                }}
                onLoadExternalBusy={listMyExternalBusyBlocks}
                onRefresh={() => listMyLessonSchedule().then(setLessons)}
                onStartSession={startMyLessonSession}
                onFinalizeSession={finalizeMyLessonSession}
                onResolveLateness={resolveMyLessonLateness}
                onReportSessionIssue={reportSessionIssue}
              />
            </div>
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
              operatingCurriculumJumpTo={operatingCurriculumJump}
              onOperatingCurriculumJumpConsumed={() => setOperatingCurriculumJump(null)}
            />
          ) : activeTab === "materials" ? (
            <TeacherMaterialsLibraryTab subjects={materialsSubjects} />
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
