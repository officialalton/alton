"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/app/login/actions";
import TimezoneSettingsModal from "@/app/components/TimezoneSettingsModal";
import MobileBottomNav from "@/app/components/MobileBottomNav";
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
import ConsultRequestTab from "./ConsultRequestTab";
import ConsultationRequestTab from "./ConsultationRequestTab";
import ConsultationHistoryTab from "./ConsultationHistoryTab";
import MessengerTab from "./MessengerTab";
import { getMessengerUnreadCount } from "./inquiry-actions";
import ParentEnrollmentTab from "./EnrollmentTab";
import type { ChildSubjectEnrollments } from "./enrollment-data";
import LessonBookingTab from "@/app/student/LessonBookingTab";
import ParentVocabTab from "./ParentVocabTab";
import type { ParentVocabData } from "./vocab-data";
import ParentHomeworkTab from "./ParentHomeworkTab";
import type { ParentChildHomework } from "./homework-data";
import type { LessonBookingData } from "@/app/student/lesson-booking-data";
import {
  listAvailableSlotsForBooking,
  createLessonBookingForChild,
  createWeeklyLessonSeriesForChild,
  cancelLessonBookingForChild,
  updateChildTimezone,
  reportTeacherIssueForChild,
} from "./booking-actions";

// 2026-09-17 — 학부모 포털 IA 재구성(R13 상담 마일스톤). 메인 내비는 아래
// 순서 고정: 홈/수업권/수강 과목/수업/상담/단어장/과제. "가족"(신규 자녀 상담
// CTA는 상담→상담신청 안으로 이동), "예약"(수업 탭 안의 예정 수업 흐름으로
// 편입), "교재"(기존 세션·수강 과목 화면의 /materials/[id] 진입점은 그대로
// 유지, 별도 라이브러리 탭만 제거), "통계"(죽은 placeholder였음, 홈 안
// 서브탭으로 이동 예정), "지인 추천"/"동의"(프로필 드롭다운으로 이동)는
// 메인 내비에서 제거한다. "문의/자녀상담/상담신청/메신저"는 "상담" 탭 산하
// 서브탭으로 통합한다.
const NAV_ITEMS = [
  { id: "home", label: "홈", icon: "🏠" },
  { id: "entitlements", label: "수업권", icon: "🎟️" },
  { id: "enrollment", label: "수강 과목", icon: "🎓" },
  { id: "lessons", label: "수업", icon: "📅" },
  { id: "consult", label: "상담", icon: "🗓️" },
  { id: "vocab", label: "단어장", icon: "🔤" },
  { id: "homework", label: "과제", icon: "📝" },
] as const;

// 메인 내비에는 더 이상 그리지 않지만(사이드바/모바일 목록에서 숨김),
// 딥링크·프로필 드롭다운에서 activeTab으로 계속 라우팅해야 하는 탭 id.
// - consent: 프로필 드롭다운 "동의" 메뉴 + 기존 ?focus= 딥링크
// - credits: 프로필 드롭다운 "지인 추천" 메뉴
// - materials: 기존 세션/수강 과목 화면에서 참조할 수 있는 잔여 딥링크 대비
const HIDDEN_TAB_IDS = ["consent", "credits", "materials"] as const;

type TabId = (typeof NAV_ITEMS)[number]["id"] | (typeof HIDDEN_TAB_IDS)[number];

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
  vocabData,
  homeworkByChild,
  progressedTrialEnrollmentIds,
  lessonBooking,
  focusSubjectEnrollmentId,
}: {
  parentName: string;
  childrenList: Child[];
  currentChildId: string;
  initialTab?: string;
  // 2026-09-10(P0-5) — 부모 홈 알림에서 특정 자녀·수강 정규 진행 동의로
  // 정확히 이동하기 위한 식별값. URL(`?focus=`)에서 그대로 온다 — 새로고침·
  // 뒤로가기·앞으로가기에도 유지되도록 로컬 state가 아니라 이 prop(서버가
  // searchParams에서 읽어 내려줌)을 그대로 ConsentTab까지 전달한다.
  focusSubjectEnrollmentId?: string;
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
  vocabData: ParentVocabData;
  homeworkByChild: ParentChildHomework[];
  progressedTrialEnrollmentIds: string[];
  lessonBooking: LessonBookingData;
}) {
  const router = useRouter();
  const validTabIds = useMemo(
    () => [...NAV_ITEMS.map((n) => n.id), ...HIDDEN_TAB_IDS],
    []
  );
  const [activeTab, setActiveTab] = useState<TabId>(
    validTabIds.includes(initialTab as TabId) ? (initialTab as TabId) : "home"
  );
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [timezoneModalOpen, setTimezoneModalOpen] = useState(false);
  const [messengerUnread, setMessengerUnread] = useState(0);
  // 상담 탭 산하 서브탭(신청/내역/메신저) — 메인 내비 항목 수를 늘리지 않고
  // 기존 3개 컴포넌트를 그대로 재사용한다.
  const [consultSubTab, setConsultSubTab] = useState<"request" | "history" | "messenger">("request");
  // "가족" 탭의 유일한 실사용 기능이던 "신규 자녀 상담 신청"(ConsultRequestTab,
  // 기존 자녀와는 다른 별도 DB 흐름)을 상담→상담신청 안에서 토글로 노출한다.
  const [showNewChildConsult, setShowNewChildConsult] = useState(false);
  const [creditsModalOpen, setCreditsModalOpen] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);

  // R12 — 메신저 안 읽은 관리자 메시지 수를 내비게이션 배지로 보여준다.
  // 메신저 탭을 직접 열면 MessengerTab이 읽음 처리를 하므로, 탭을 떠날 때
  // 다시 조회해 배지를 갱신한다.
  useEffect(() => {
    getMessengerUnreadCount().then(setMessengerUnread).catch(() => {});
  }, [activeTab]);

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
    router.push(`?child=${currentChildId}&tab=${id}`, { scroll: false });
    // 모든 탭 데이터를 최초 서버 렌더 시점에 props로 한 번에 받아오고 탭 전환
    // 자체는 새 서버 요청을 만들지 않는다 — 그 사이(예: Stripe 결제 완료) 바뀐
    // 서버 상태가 있어도 다른 탭에서 돌아왔을 때 예전 값이 그대로 보인다
    // (실사용 확인 — 수업권 구매 직후 "수업권" 탭이 0장으로 보이던 문제).
    router.refresh();
  }

  function selectChild(studentId: string) {
    setActiveTab("home");
    router.push(`?child=${studentId}&tab=home`, { scroll: false });
  }

  const activeLabel = NAV_ITEMS.find((n) => n.id === activeTab)?.label ?? "";

  // 자녀별 동의/정규진행 필요 여부 — 프로필 드롭다운 "동의" 배지에 쓴다.
  // 기존 ChildrenStatusRow가 쓰던 것과 동일한 계산이며 새 쿼리는 추가하지 않는다.
  const childrenNeedingAction = useMemo(() => {
    return childrenList.filter((child) => {
      const needsConsent =
        consentChildren.some(
          (c) => c.studentId === child.studentId && c.isUnder13 && c.dobKnown && !c.hasValidConsent
        ) || trialSmartNotesChildren.some((c) => c.studentId === child.studentId && !c.hasConsented);
      const needsRegularIntent = pendingRegularIntentChoices.some((p) => p.childId === child.studentId);
      return needsConsent || needsRegularIntent;
    });
  }, [childrenList, consentChildren, trialSmartNotesChildren, pendingRegularIntentChoices]);
  const consentBadgeCount = childrenNeedingAction.length;

  // 2026-09-17 — 모바일 하단 탭 1차: 홈·수업·상담. "예약"은 더 이상 독립
  // 탭이 아니라 "수업" 탭 안 예정 수업 흐름에서 진입하므로 하단 고정 슬롯의
  // 3번째 자리는 booking 대신 새 "상담"(consult)에 배정한다 — 상담 신청/내역/
  // 메신저를 한 곳에서 바로 찾을 수 있어야 한다는 요구사항과 가장 맞는다고
  // 판단했다(다른 후보였던 home/lessons는 이미 1·2번 슬롯에 있음).
  const MOBILE_PRIMARY_IDS: TabId[] = ["home", "lessons", "consult"];
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
            <span className="relative text-[17px]">
              {item.icon}
              {item.id === "consult" && messengerUnread > 0 && (
                <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] px-[3px] rounded-full bg-red text-white text-[9px] font-bold flex items-center justify-center">
                  {messengerUnread > 9 ? "9+" : messengerUnread}
                </span>
              )}
            </span>
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
              <div className="absolute top-full right-0 mt-1 w-48 bg-white border-[1.5px] border-grey-200 rounded-lg shadow-sm py-1.5 z-30">
                <button
                  onClick={() => {
                    setAccountMenuOpen(false);
                    selectTab("consent");
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2 text-[13px] font-semibold text-ink"
                >
                  동의
                  {consentBadgeCount > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red text-white text-[10.5px] font-bold flex items-center justify-center">
                      {consentBadgeCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => {
                    setAccountMenuOpen(false);
                    setCreditsModalOpen(true);
                  }}
                  className="w-full text-left px-3.5 py-2 text-[13px] font-semibold text-ink"
                >
                  지인 추천
                </button>
                <div className="h-px bg-grey-200 my-1" />
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
                showHouseholdDefault={true}
                onClose={() => setTimezoneModalOpen(false)}
              />
            )}
            {creditsModalOpen && (
              <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-grey-200">
                    <span className="text-[14px] font-bold text-ink">지인 추천</span>
                    <button
                      onClick={() => setCreditsModalOpen(false)}
                      className="text-[13px] font-semibold text-grey-500"
                    >
                      닫기
                    </button>
                  </div>
                  <CreditsTab data={credits} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1">
          {/* 2026-09-17 — 홈 상단 동의 배너 제거(명시적 요구사항). 동의
              긴급도는 프로필 드롭다운 "동의" 배지로만 노출한다. 자녀 선택
              전환용 pill만 남기고, 나머지 ChildrenStatusRow(캘린더/예정 수업)
              호출은 홈 재설계(종합 리뷰/수업 리뷰/통계, 별도 라운드) 전까지는
              보류한다. */}
          {activeTab === "home" ? (
            <HomeDashboard
              studentName={dashboard.studentName}
              data={dashboard}
              onShowLessons={() => selectTab("lessons")}
              onShowStats={() => {}}
              timezone={lessonBooking.timezone}
            />
          ) : activeTab === "enrollment" ? (
            <ParentEnrollmentTab childrenEnrollments={childrenSubjectEnrollments} />
          ) : activeTab === "lessons" ? (
            <div>
              {/* 2026-09-17 — "예약" 독립 탭 제거: 예약 기능이 필요하면 수업
                  탭 안 예정 수업 흐름에서 기존 LessonBookingTab(학생 포털과
                  공유, 동작 변경 없음)을 모달로 연다. */}
              <div className="px-6 pt-5 flex justify-end">
                <button
                  onClick={() => setBookingModalOpen(true)}
                  className="text-[12.5px] font-bold text-white bg-ink px-3.5 py-2 rounded-full"
                >
                  예정 수업 예약하기 →
                </button>
              </div>
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
              {bookingModalOpen && (
                <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-4">
                  <div className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-grey-200">
                      <span className="text-[14px] font-bold text-ink">예정 수업 예약</span>
                      <button
                        onClick={() => setBookingModalOpen(false)}
                        className="text-[13px] font-semibold text-grey-500"
                      >
                        닫기
                      </button>
                    </div>
                    <LessonBookingTab
                      key={currentChildId}
                      bookableEnrollments={lessonBooking.bookableEnrollments}
                      pendingActivationSubjects={lessonBooking.pendingActivationSubjects}
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
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === "entitlements" ? (
            <EntitlementsTab data={entitlements} purchaseStatus={purchaseStatus} />
          ) : activeTab === "consent" ? (
            <ConsentTab
              children={consentChildren}
              activePolicy={activeConsentPolicy}
              trialSmartNotesChildren={trialSmartNotesChildren}
              childrenSubjectEnrollments={childrenSubjectEnrollments}
              progressedTrialEnrollmentIds={progressedTrialEnrollmentIds}
              focusSubjectEnrollmentId={focusSubjectEnrollmentId}
            />
          ) : activeTab === "credits" ? (
            <CreditsTab data={credits} />
          ) : activeTab === "vocab" ? (
            <ParentVocabTab data={vocabData} />
          ) : activeTab === "homework" ? (
            <ParentHomeworkTab childrenHomework={homeworkByChild} />
          ) : activeTab === "consult" ? (
            <div>
              <div className="px-6 pt-5 flex gap-2 border-b border-grey-200 pb-3">
                {(
                  [
                    ["request", "상담 신청"],
                    ["history", "상담 내역"],
                    ["messenger", "메신저"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setConsultSubTab(id)}
                    className={
                      "text-[12.5px] font-bold px-3.5 py-1.5 rounded-full relative " +
                      (consultSubTab === id ? "bg-ink text-white" : "bg-grey-100 text-grey-500")
                    }
                  >
                    {label}
                    {id === "messenger" && messengerUnread > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-red text-white text-[9.5px] font-bold flex items-center justify-center">
                        {messengerUnread > 9 ? "9+" : messengerUnread}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {consultSubTab === "request" ? (
                <div>
                  {!showNewChildConsult ? (
                    <>
                      <ConsultationRequestTab />
                      <div className="px-6 pb-6">
                        <button
                          onClick={() => setShowNewChildConsult(true)}
                          className="text-[12.5px] font-semibold text-grey-500 underline"
                        >
                          새 자녀 상담이신가요? →
                        </button>
                      </div>
                    </>
                  ) : (
                    <div>
                      <div className="px-6 pt-4">
                        <button
                          onClick={() => setShowNewChildConsult(false)}
                          className="text-[12.5px] font-semibold text-grey-500"
                        >
                          ← 기존 자녀 상담으로
                        </button>
                      </div>
                      <ConsultRequestTab />
                    </div>
                  )}
                </div>
              ) : consultSubTab === "history" ? (
                <ConsultationHistoryTab />
              ) : (
                <MessengerTab />
              )}
            </div>
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
