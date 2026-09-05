"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/app/login/actions";
import HomeDashboard from "@/app/student/HomeDashboard";
import type { DashboardData } from "@/app/student/dashboard-data";
import LessonsTab from "@/app/student/LessonsTab";
import type { LessonItem } from "@/app/student/lessons-data";
import type { CurriculumData } from "@/app/student/curriculum-data";
import type { Memo } from "@/app/student/memo-data";
import type { ReviewData, StudentFeedback } from "@/app/student/review-data";
import type { Child } from "./children-data";
import CreditsTab from "./CreditsTab";
import type { ParentCreditsData } from "./credits-data";
import EntitlementsTab from "./EntitlementsTab";
import type { ParentEntitlementsData } from "./entitlements-data";
import ConsentTab from "./ConsentTab";
import type { ChildConsentStatus, ConsentPolicyOption, TrialSmartNotesConsentStatus } from "./consent-data";
import type { PendingRegularIntentChoice } from "./regular-intent-data";
import FamilyTab from "./FamilyTab";
import ParentEnrollmentTab from "./EnrollmentTab";
import type { ChildSubjectEnrollments } from "./enrollment-data";
import LessonBookingTab from "@/app/student/LessonBookingTab";
import type { LessonBookingData } from "@/app/student/lesson-booking-data";
import {
  listAvailableSlotsForBooking,
  createLessonBookingForChild,
  createWeeklyLessonSeriesForChild,
  cancelLessonBookingForChild,
  updateChildTimezone,
  reportTeacherIssueForChild,
} from "./booking-actions";

const NAV_ITEMS = [
  { id: "home", label: "홈", icon: "🏠" },
  { id: "enrollment", label: "수강 과목", icon: "🎓" },
  { id: "booking", label: "예약", icon: "🗓️" },
  { id: "lessons", label: "레슨", icon: "📅" },
  { id: "credits", label: "수업권", icon: "💳" },
  { id: "entitlements", label: "수업권 구매", icon: "🎟️" },
  { id: "stats", label: "통계", icon: "📊" },
  { id: "consent", label: "동의", icon: "✅" },
  { id: "family", label: "가족", icon: "👨‍👩‍👧" },
] as const;

type TabId = (typeof NAV_ITEMS)[number]["id"];

export default function ParentShell({
  parentName,
  childrenList,
  currentChildId,
  initialTab,
  dashboard,
  upcoming,
  past,
  curricula,
  memosByEnrollment,
  reviews,
  myFeedback,
  credits,
  entitlements,
  purchaseStatus,
  consentChildren,
  activeConsentPolicy,
  trialSmartNotesChildren,
  pendingRegularIntentChoices,
  childrenSubjectEnrollments,
  lessonBooking,
}: {
  parentName: string;
  childrenList: Child[];
  currentChildId: string;
  initialTab?: string;
  dashboard: DashboardData;
  upcoming: LessonItem[];
  past: LessonItem[];
  curricula: CurriculumData[];
  memosByEnrollment: Record<string, Memo[]>;
  reviews: Record<string, ReviewData>;
  myFeedback: Record<string, StudentFeedback>;
  credits: ParentCreditsData;
  entitlements: ParentEntitlementsData;
  purchaseStatus?: "success" | "cancelled";
  consentChildren: ChildConsentStatus[];
  activeConsentPolicy: ConsentPolicyOption | null;
  trialSmartNotesChildren: TrialSmartNotesConsentStatus[];
  pendingRegularIntentChoices: PendingRegularIntentChoice[];
  childrenSubjectEnrollments: ChildSubjectEnrollments[];
  lessonBooking: LessonBookingData;
}) {
  const router = useRouter();
  const validTabIds = useMemo(() => NAV_ITEMS.map((n) => n.id), []);
  const [activeTab, setActiveTab] = useState<TabId>(
    validTabIds.includes(initialTab as TabId) ? (initialTab as TabId) : "home"
  );
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  function selectTab(id: TabId) {
    setActiveTab(id);
    router.replace(`?child=${currentChildId}&tab=${id}`, { scroll: false });
    // 모든 탭 데이터를 최초 서버 렌더 시점에 props로 한 번에 받아오고 탭 전환
    // 자체는 새 서버 요청을 만들지 않는다 — 그 사이(예: Stripe 결제 완료) 바뀐
    // 서버 상태가 있어도 다른 탭에서 돌아왔을 때 예전 값이 그대로 보인다
    // (실사용 확인 — 수업권 구매 직후 "수업권" 탭이 0장으로 보이던 문제).
    router.refresh();
  }

  function selectChild(studentId: string) {
    setActiveTab("home");
    router.replace(`?child=${studentId}&tab=home`, { scroll: false });
  }

  const activeLabel = NAV_ITEMS.find((n) => n.id === activeTab)?.label ?? "";

  const pendingConsentCount =
    consentChildren.filter((c) => c.isUnder13 && !c.hasValidConsent).length +
    trialSmartNotesChildren.filter((c) => !c.hasConsented).length;

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
        <div className="flex items-center justify-between gap-4 border-b border-grey-200 px-6 py-3 relative">
          <div className="flex items-center gap-2">
            {childrenList.map((c) => (
              <button
                key={c.studentId}
                onClick={() => selectChild(c.studentId)}
                className={
                  "text-[13px] font-bold px-3.5 py-1.5 rounded-full border-[1.5px] " +
                  (c.studentId === currentChildId
                    ? "bg-ink text-white border-ink"
                    : "border-grey-200 text-grey-500")
                }
              >
                {c.name}
              </button>
            ))}
          </div>

          <div className="relative">
            <button
              onClick={() => setAccountMenuOpen((v) => !v)}
              className="text-[13px] font-semibold text-ink"
            >
              {parentName} 학부모님 ▾
            </button>
            {accountMenuOpen && (
              <div className="absolute top-full right-0 mt-1 w-40 bg-white border-[1.5px] border-grey-200 rounded-lg shadow-sm py-1.5 z-30">
                <form action={logout}>
                  <button className="w-full text-left px-3.5 py-2 text-[13px] font-semibold text-red">
                    로그아웃
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1">
          {activeTab === "home" && pendingConsentCount > 0 && (
            <button
              onClick={() => selectTab("consent")}
              className="w-full text-left bg-red/10 text-red text-[13px] font-semibold px-6 py-3 border-b border-red/20"
            >
              동의가 필요한 문서가 {pendingConsentCount}건 있습니다. 눌러서 확인하기 →
            </button>
          )}
          {activeTab === "home" && pendingRegularIntentChoices.length > 0 && (
            <button
              onClick={() => selectTab("enrollment")}
              className="w-full text-left bg-ink/10 text-ink text-[13px] font-semibold px-6 py-3 border-b border-grey-200"
            >
              정규 진행 희망 선택이 필요한 과목이 {pendingRegularIntentChoices.length}건 있습니다. 눌러서 확인하기 →
            </button>
          )}
          {activeTab === "home" ? (
            <HomeDashboard
              studentName={dashboard.studentName}
              data={dashboard}
              onShowLessons={() => selectTab("lessons")}
              onShowStats={() => selectTab("stats")}
            />
          ) : activeTab === "enrollment" ? (
            <ParentEnrollmentTab childrenEnrollments={childrenSubjectEnrollments} />
          ) : activeTab === "booking" ? (
            <LessonBookingTab
              key={currentChildId}
              bookableEnrollments={lessonBooking.bookableEnrollments}
              upcomingBookings={lessonBooking.upcomingBookings}
              pastSessionsForReport={lessonBooking.pastSessionsForReport}
              timezone={lessonBooking.timezone}
              onListSlots={(teacherId, durationMinutes) => listAvailableSlotsForBooking({ teacherId, durationMinutes })}
              onCreateBooking={(params) => createLessonBookingForChild({ ...params, childId: currentChildId })}
              onCreateWeeklySeries={(params) => createWeeklyLessonSeriesForChild({ ...params, childId: currentChildId })}
              onCancelBooking={(reservationId, reason) => cancelLessonBookingForChild({ reservationId, childId: currentChildId, reason })}
              onUpdateTimezone={(timezone) => updateChildTimezone(currentChildId, timezone)}
              onReportTeacherIssue={(params) => reportTeacherIssueForChild({ ...params, childId: currentChildId })}
            />
          ) : activeTab === "lessons" ? (
            <LessonsTab
              key={currentChildId}
              upcoming={upcoming}
              past={past}
              curricula={curricula}
              memosByEnrollment={memosByEnrollment}
              reviews={reviews}
              myFeedback={myFeedback}
              readOnly
            />
          ) : activeTab === "credits" ? (
            <CreditsTab
              data={credits}
              studentId={currentChildId}
              purchaseStatus={purchaseStatus}
            />
          ) : activeTab === "entitlements" ? (
            <EntitlementsTab data={entitlements} purchaseStatus={purchaseStatus} />
          ) : activeTab === "consent" ? (
            <ConsentTab
              children={consentChildren}
              activePolicy={activeConsentPolicy}
              trialSmartNotesChildren={trialSmartNotesChildren}
            />
          ) : activeTab === "family" ? (
            <FamilyTab />
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
