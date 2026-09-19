"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/app/login/actions";
import MobileBottomNav from "@/app/components/MobileBottomNav";
import TimezoneSettingsModal from "@/app/components/TimezoneSettingsModal";
import TeacherHomeDashboard from "./TeacherHomeDashboard";
import type { TeacherDashboardData } from "./dashboard-data";
import CurriculumTab from "./CurriculumTab";
import type { RosterStudent } from "./roster-data";
import type { MySubject } from "./mysubjects-data";
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
import PageFrame from "@/app/components/PageFrame";
import NavIcon from "@/app/components/NavIcon";
import UnderlineSubTabs from "@/app/components/UnderlineSubTabs";
import TeacherMaterialsLibraryTab from "./MaterialsLibraryTab";
import VocabAssignTab from "./VocabAssignTab";
import type { TeacherVocabOverview } from "./vocab-assign-data";
import HomeworkAssignTab from "./HomeworkAssignTab";
import SettlementTab from "./SettlementTab";
import type { LibrarySubjectTree } from "@/lib/subject-material-library";
import {
  listMyLessonSchedule,
  cancelMyLessonScheduleBooking,
  listMyExternalBusyBlocks,
  startMyLessonSession,
  finalizeMyLessonSession,
  resolveMyLessonLateness,
  type TeacherLessonScheduleItem,
} from "./lesson-schedule-actions";

// 2026-09-19(UI 통일화) — 좌측 네비게이션 라벨은 전부 영어로 통일한다(Acely
// 레퍼런스). 탭 안 본문의 한국어 텍스트는 유지, 라벨만 영어로 바꾼다.
const NAV_ITEMS = [
  { id: "home", label: "Home", icon: "home" },
  { id: "assignments", label: "My Students", icon: "students" },
  { id: "homework", label: "Assignments", icon: "assignments" },
  { id: "lesson-schedule", label: "Schedule", icon: "schedule" },
  { id: "availability", label: "Availability", icon: "availability" },
  { id: "curriculum", label: "Curriculum", icon: "curriculum" },
  { id: "materials", label: "Materials", icon: "materials" },
  { id: "vocab", label: "Vocabulary", icon: "vocabulary" },
  // P4-2(2026-09-12) — 교사가 본인 정산 내역·지급 예정액·수취 계좌·제출 서류를
  // 한 곳에서 찾을 수 있게 하는 진입점.
  { id: "settlement", label: "Payouts", icon: "payouts" },
] as const;

type TabId = (typeof NAV_ITEMS)[number]["id"];

// 2026-09-18(고정형 모의고사 V1) — /teacher/mock-exam은 TeacherShell 탭이 아니라
// 독립 라우트다. NAV_ITEMS/TabId를 건드리지 않고 router.push로 이동하는 링크
// 전용 항목을 별도로 둔다.
const MOCK_EXAM_NAV_ITEM = { id: "mock-exam", label: "Mock Exams", icon: "mockExam" } as const;

export default function TeacherShell({
  initialTab,
  dashboard,
  roster,
  mySubjects,
  currentAssignments,
  pastAssignments,
  availabilityRules,
  availabilityExceptions,
  availabilityTimezone,
  lessonSchedule,
  materialsLibraryTree,
  vocabOverview,
  initialHomeworkStudentId,
}: {
  initialTab?: string;
  dashboard: TeacherDashboardData;
  roster: RosterStudent[];
  mySubjects: MySubject[];
  currentAssignments: TeacherAssignedSubject[];
  pastAssignments: TeacherAssignedSubject[];
  availabilityRules: TeacherAvailabilityRuleRow[];
  availabilityExceptions: AvailabilityExceptionRow[];
  availabilityTimezone: string;
  lessonSchedule: TeacherLessonScheduleItem[];
  materialsLibraryTree: LibrarySubjectTree[];
  vocabOverview: TeacherVocabOverview;
  initialHomeworkStudentId?: string;
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
  const [operatingCurriculumJump, setOperatingCurriculumJump] = useState<{
    subjectEnrollmentId: string;
    subjectId: string;
    studentName: string;
    subjectName: string;
  } | null>(null);

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
  }

  function openOperatingCurriculumFromAssignment(
    subjectEnrollmentId: string,
    subjectId: string,
    studentName: string,
    subjectName: string
  ) {
    setOperatingCurriculumJump({ subjectEnrollmentId, subjectId, studentName, subjectName });
    selectTab("curriculum");
  }

  const activeLabel = NAV_ITEMS.find((n) => n.id === activeTab)?.label ?? "";

  // 2026-09-10(UI/UX 정리 1차, 배치4) — 모바일 하단 탭: 홈·수업·담당 학생·
  // 커리큘럼 + 더보기(가능시간·교재).
  const MOBILE_PRIMARY_IDS: TabId[] = ["home", "lesson-schedule", "assignments", "curriculum"];
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
            className={
              "w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[13px] font-semibold transition-colors " +
              (activeTab === item.id ? "bg-red text-white" : "text-grey-500 hover:bg-grey-100 hover:text-ink")
            }
          >
            <NavIcon name={item.icon} className="w-[18px] h-[18px] shrink-0" />
            {item.label}
          </button>
        ))}
        <button
          onClick={() => router.push("/teacher/mock-exam")}
          className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[13px] font-semibold text-grey-500 hover:bg-grey-100 hover:text-ink transition-colors"
        >
          <NavIcon name={MOCK_EXAM_NAV_ITEM.icon} className="w-[18px] h-[18px] shrink-0" />
          {MOCK_EXAM_NAV_ITEM.label}
        </button>

        {/* 2026-09-19(UAT 반영) — Acely 레퍼런스: 계정 메뉴를 상단 헤더바가
            아니라 사이드바 맨 아래(프로필)로 옮긴다. 상단 헤더바 자체를
            없앤다. 위로 펼쳐지는 드롭다운(bottom-full). */}
        <div className="mt-auto pt-2 relative">
          <button
            onClick={() => setAccountMenuOpen((v) => !v)}
            className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[13px] font-semibold text-ink hover:bg-grey-100"
          >
            <div className="w-7 h-7 rounded-full bg-grey-100 text-ink font-extrabold text-[12px] flex items-center justify-center shrink-0">
              {dashboard.teacherName.charAt(0)}
            </div>
            <span className="flex-1 text-left truncate">{dashboard.teacherName} 선생님</span>
            <NavIcon name="settings" className="w-4 h-4 shrink-0 text-grey-400" />
          </button>
          {accountMenuOpen && (
            <div className="absolute bottom-full left-0 mb-1 w-full bg-white border-[1.5px] border-grey-200 rounded-lg shadow-sm py-1.5 z-30">
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

      <MobileBottomNav
        primary={mobilePrimary}
        more={[...mobileMore, MOCK_EXAM_NAV_ITEM]}
        activeId={activeTab}
        onSelect={(id) => (id === MOCK_EXAM_NAV_ITEM.id ? router.push("/teacher/mock-exam") : selectTab(id as TabId))}
      />

      <div className="flex-1 flex flex-col pb-16 md:pb-0">
        {/* 2026-09-19(UAT 반영) — 데스크톱은 계정 메뉴가 사이드바 맨 아래로
            옮겨져 상단 헤더바가 없다. 모바일은 사이드바가 숨겨지므로 계정
            메뉴만 담은 얇은 바를 여기 남긴다. */}
        <div className="md:hidden flex items-center justify-end gap-4 border-b border-grey-200 px-4 py-2.5 relative">
          <button
            onClick={() => setAccountMenuOpen((v) => !v)}
            className="text-[13px] font-semibold text-ink"
          >
            {dashboard.teacherName} 선생님 ▾
          </button>
          {accountMenuOpen && (
            <div className="absolute top-full right-4 mt-1 w-40 bg-white border-[1.5px] border-grey-200 rounded-lg shadow-sm py-1.5 z-30">
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

        {/* 2026-09-19(UI 통일화) — 홈(자체 인사말 헤더)을 뺀 나머지 탭은
            전부 같은 프레임(영어 제목 + 가운데 정렬 고정폭 컬럼) 안에서
            렌더링된다. 제목 위치·컬럼 폭·서브탭 스타일만 통일한다. */}
        <div className="flex-1">
        {activeTab === "home" ? (
          <TeacherHomeDashboard
            data={dashboard}
            currentAssignments={currentAssignments}
            onShowSchedule={() => selectTab("lesson-schedule")}
            onShowAssignments={() => selectTab("assignments")}
            onShowCurriculum={() => selectTab("curriculum")}
          />
        ) : (
        <PageFrame
          title={activeLabel}
          subtabs={
            activeTab === "lesson-schedule" ? (
              <UnderlineSubTabs
                items={[
                  { id: "upcoming", label: "예정 수업" },
                  { id: "past", label: "지난 수업" },
                ]}
                activeId={lessonSubtab}
                onSelect={setLessonSubtab}
              />
            ) : undefined
          }
        >
          {activeTab === "assignments" ? (
            <AssignmentsTab
              current={currentAssignments}
              past={pastAssignments}
              onOpenOperatingCurriculum={openOperatingCurriculumFromAssignment}
            />
          ) : activeTab === "lesson-schedule" ? (
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
              operatingCurriculumJumpTo={operatingCurriculumJump}
              onOperatingCurriculumJumpConsumed={() => setOperatingCurriculumJump(null)}
            />
          ) : activeTab === "materials" ? (
            <TeacherMaterialsLibraryTab tree={materialsLibraryTree} />
          ) : activeTab === "vocab" ? (
            <VocabAssignTab overview={vocabOverview} />
          ) : activeTab === "homework" ? (
            <HomeworkAssignTab
              students={Array.from(new Map(currentAssignments.map((a) => [a.studentId, a.studentName])).entries()).map(([id, name]) => ({ id, name }))}
              initialStudentId={initialHomeworkStudentId}
            />
          ) : activeTab === "settlement" ? (
            <SettlementTab />
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
