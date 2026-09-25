"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/app/login/actions";
import TimezoneSettingsModal from "@/app/components/TimezoneSettingsModal";
import MobileBottomNav from "@/app/components/MobileBottomNav";
import UnderlineSubTabs from "@/app/components/UnderlineSubTabs";
import ParentMockExamTab from "./ParentMockExamTab";
import { loadChildBoardCardsAction } from "./board-actions";
import PlannerOverviewView from "@/app/student/PlannerOverviewView";
import BoardColumnsView from "@/app/components/BoardColumnsView";
import TimelineView from "@/app/components/TimelineView";
import FamilyReviewCard from "@/app/components/FamilyReviewCard";
import type { BoardCard } from "@/lib/board/types";
import PageFrame from "@/app/components/PageFrame";
import NavIcon from "@/app/components/NavIcon";
import type { DashboardData } from "@/app/student/dashboard-data";
import { UpcomingWidget } from "@/app/student/HomeDashboard";
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
import ConsultationRequestTab from "./ConsultationRequestTab";
import ConsultationHistoryTab from "./ConsultationHistoryTab";
import MessengerTab from "./MessengerTab";
import { getMessengerUnreadCount } from "./inquiry-actions";
import { getAllFamilyLessonReviews, getHomeConsultationReviews, type HomeConsultationReview } from "./home-reviews-actions";
import type { FamilyLessonReview } from "./lesson-review-family-actions";
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
  listPendingLessonRescheduleRequestsForChild,
  respondToLessonRescheduleRequestForChild,
} from "./booking-actions";
import RoadmapView from "@/app/components/RoadmapView";
import type { RoadmapData } from "@/lib/roadmap/types";
import { getRoadmapForStudent } from "@/lib/roadmap/actions";

// 2026-09-17/18 — 학부모 포털 IA 재구성(R13 상담 마일스톤). 메인 내비는 아래
// 순서 고정: 홈/수업권/수강 과목/수업/상담/단어장/과제. "가족"(신규 자녀 상담
// 신청 흐름은 2026-09-18 통합 지시로 완전히 폐기됨 — ConsultationRequestTab
// 단일 흐름으로 통합), "예약"(수업 탭 안의 예정 수업 흐름으로 편입), "교재"
// (기존 세션·수강 과목 화면의 /materials/[id] 진입점은 그대로 유지, 별도
// 라이브러리 탭만 제거), "통계"(홈 서브탭으로 이동), "지인 추천"/"동의"
// (프로필 드롭다운으로 이동)는 메인 내비에서 제거한다. "문의/상담신청/메신저"는
// "상담" 탭 산하 서브탭(상담 신청/상담 내역/메신저)으로 통합한다.
// 2026-09-19(UI 통일화) — 좌측 네비게이션 라벨은 전부 영어로 통일한다(Acely
// 레퍼런스). 탭 안 본문의 한국어 텍스트는 유지, 라벨만 영어로 바꾼다.
const NAV_ITEMS = [
  // 2026-09-22(사용자 지시) — 별도 "Planner" nav 대신 Home 탭 서브탭
  // (Overview/TODO/Done)으로 흡수한다 — 학생 포털과 같은 구조("뷰 통일").
  { id: "home", label: "홈", icon: "home" },
  { id: "roadmap", label: "로드맵", icon: "roadmap" },
  { id: "entitlements", label: "수강권", icon: "credits" },
  { id: "enrollment", label: "수강 과목", icon: "courses" },
  { id: "lessons", label: "수업", icon: "classes" },
  // 2026-09-19(UAT 반영, 제품 오너 결정) — 2026-09-17 R13에서 "예약 독립 탭
  // 제거 → 수업 탭 안 버튼으로 흡수"로 정리했던 것을 이번에 다시 되돌린다.
  // 독립 탭으로 예약 화면(LessonBookingTab)을 그대로 연다.
  { id: "bookings", label: "예약", icon: "bookings" },
  // 2026-09-22(사용자 지시) — 홈 서브탭에서 빼서 독립 좌측 nav로 옮긴다(읽기 전용).
  { id: "mockExam", label: "모의고사", icon: "mockExam" },
  { id: "consult", label: "상담", icon: "consultations" },
  { id: "vocab", label: "단어장", icon: "vocabulary" },
  { id: "homework", label: "과제", icon: "assignments" },
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
  dashboard: _dashboard,
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
  // 2026-09-19(UAT 반영) — "수업" 탭의 예정/지난 서브탭을 PageFrame 서브탭
  // 자리로 끌어올려, "예정 수업 예약하기" 버튼이 그 옆에 나란히(같은 줄) 있게
  // 한다(전에는 LessonsTab 내부 서브탭 위에 따로 떠 있었다).
  const [lessonsSubTab, setLessonsSubTab] = useState<"upcoming" | "past">("upcoming");
  const [creditsModalOpen, setCreditsModalOpen] = useState(false);
  // 2026-09-18 — 홈 재설계: "일정 확인"에서 "리뷰 확인"으로 목적이 바뀌어
  // 종합 리뷰(기본)/수업 리뷰(시간순)/상담 리뷰/통계 4개 읽기 전용 서브탭으로
  // 구성한다. 상담 리뷰는 종합 리뷰에 합치지 않는다(사용자 결정, 2026-09-18).
  const [homeSubTab, setHomeSubTab] = useState<"overview" | "todo" | "review">("overview");
  const [homeBoardView, setHomeBoardView] = useState<"board" | "timeline">("board");
  const [familyReviews, setFamilyReviews] = useState<FamilyLessonReview[] | null>(null);
  const [consultReviews, setConsultReviews] = useState<HomeConsultationReview[] | null>(null);
  // 2026-09-22(사용자 지시) — Home+Planner 통합, Overview/TODO/Done 서브탭용.
  const [childBoardCards, setChildBoardCards] = useState<BoardCard[] | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapData | null>(null);

  // R12 — 메신저 안 읽은 관리자 메시지 수를 내비게이션 배지로 보여준다.
  // 메신저 탭을 직접 열면 MessengerTab이 읽음 처리를 하므로, 탭을 떠날 때
  // 다시 조회해 배지를 갱신한다. 2026-09-18 — 메신저는 이제 "상담" 탭 산하
  // 서브탭이라 activeTab만으로는 진입/이탈을 못 잡는다 — consultSubTab도
  // 의존성에 넣어 서브탭 전환마다(메신저를 열 때·떠날 때 모두) 다시 조회한다.
  useEffect(() => {
    getMessengerUnreadCount().then(setMessengerUnread).catch(() => {});
  }, [activeTab, consultSubTab]);

  // 2026-09-18 — 홈 서브탭 데이터는 탭에 처음 들어갈 때(또는 자녀 전환 시)
  // 지연 로딩한다.
  // 2026-09-18(사용자 결정, 2차) — "종합 리뷰"는 수업/상담 리뷰를 합쳐 보여주는
  // 목록이 아니라, 향후 AI OS가 월 단위로 만들 "월간 종합 리뷰" 전용 자리다.
  // 이번 범위에서는 AI 생성 로직·데이터 모델을 만들지 않으므로 이 탭은 아무
  // 데이터도 불러오지 않는다(정적 준비 중 문구만). "수업 리뷰"는 그대로
  // getAllFamilyLessonReviews를 쓴다.
  useEffect(() => {
    if (activeTab !== "home") return;
    if (homeSubTab === "overview" || homeSubTab === "todo") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 데이터 로드 시작 시 상태 초기화(관용적 패턴)
      setChildBoardCards(null);
      loadChildBoardCardsAction(currentChildId).then(setChildBoardCards).catch(() => setChildBoardCards([]));
      return;
    }
    if (homeSubTab === "review") {
      // 2026-09-22(사용자 지시) — 종합/수업/상담 리뷰를 하나의 "Review" 탭으로
      // 합친다. 세 데이터를 함께 불러온다.
      getHomeConsultationReviews().then(setConsultReviews).catch(() => setConsultReviews([]));
      const enrollmentIds =
        childrenSubjectEnrollments.find((c) => c.childId === currentChildId)?.enrollments.map((e) => e.id) ?? [];
      getAllFamilyLessonReviews(enrollmentIds).then(setFamilyReviews).catch(() => setFamilyReviews([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, homeSubTab, currentChildId]);

  // 로드맵 탭도 홈 "통계" 서브탭과 같은 자녀 전환 시 지연 로딩 패턴.
  useEffect(() => {
    if (activeTab !== "roadmap") return;
    getRoadmapForStudent(currentChildId).then(setRoadmap).catch(() => setRoadmap(null));
  }, [activeTab, currentChildId]);

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
    <div className="min-h-screen bg-cream flex">
      <aside className="hidden md:flex w-56 shrink-0 bg-navy flex-col py-5 px-3 gap-0.5">
        <div className="flex items-center gap-2 px-2.5 mb-4">
          <svg width="22" height="22" viewBox="0 0 30 30" fill="none" aria-hidden="true" className="shrink-0">
            <rect x="3" y="15" width="24" height="9" rx="2.5" fill="#fff" opacity="0.9" />
            <rect x="6" y="7" width="18" height="9" rx="2.5" fill="#fff" opacity="0.55" />
            <rect x="9" y="1" width="12" height="7.5" rx="2.5" fill="#C8102E" />
          </svg>
          <span className="text-[13.5px] font-extrabold text-white tracking-[-0.01em]">ALTON</span>
        </div>
        {childrenList.length > 1 && (
          <div className="flex flex-wrap gap-1.5 px-2.5 mb-4">
            {childrenList.map((c) => (
              <button
                key={c.studentId}
                onClick={() => selectChild(c.studentId)}
                className={
                  "text-[12px] font-bold px-3 py-1 rounded-full border " +
                  (c.studentId === currentChildId
                    ? "bg-brand-red text-white border-brand-red"
                    : "border-white/20 text-[#97A9C8]")
                }
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => selectTab(item.id)}
            aria-current={activeTab === item.id ? "page" : undefined}
            className={
              "w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[13px] font-semibold transition-colors " +
              (activeTab === item.id ? "bg-brand-red text-white" : "text-[#97A9C8] hover:bg-white/10 hover:text-white")
            }
          >
            <span className="relative shrink-0">
              <NavIcon name={item.icon} className="w-[18px] h-[18px]" />
              {item.id === "consult" && messengerUnread > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-[3px] rounded-full bg-brand-red text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-navy">
                  {messengerUnread > 9 ? "9+" : messengerUnread}
                </span>
              )}
            </span>
            {item.label}
          </button>
        ))}

        {/* 2026-09-19(UAT 반영) — Acely 레퍼런스: 계정 메뉴를 상단 헤더바가
            아니라 사이드바 맨 아래(프로필)로 옮긴다. 상단 헤더바 자체를
            없앤다. 위로 펼쳐지는 드롭다운(bottom-full). */}
        <div className="mt-auto pt-2 relative">
          <button
            onClick={() => setAccountMenuOpen((v) => !v)}
            className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[13px] font-semibold text-white hover:bg-white/10"
          >
            <div className="w-7 h-7 rounded-full bg-white/10 text-white font-extrabold text-[12px] flex items-center justify-center shrink-0">
              {parentName.charAt(0)}
            </div>
            <span className="flex-1 text-left truncate">{parentName} 학부모님</span>
            <NavIcon name="settings" className="w-4 h-4 shrink-0 text-[#97A9C8]" />
          </button>
          {accountMenuOpen && (
            <div className="absolute bottom-full left-0 mb-1 w-full bg-white border border-brand-border rounded-xl shadow-lg py-1.5 z-30">
              <button
                onClick={() => {
                  setAccountMenuOpen(false);
                  selectTab("consent");
                }}
                className="w-full flex items-center justify-between px-3.5 py-2 text-[13px] font-semibold text-navy"
              >
                동의
                {consentBadgeCount > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-brand-red text-white text-[10.5px] font-bold flex items-center justify-center">
                    {consentBadgeCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  setAccountMenuOpen(false);
                  setCreditsModalOpen(true);
                }}
                className="w-full text-left px-3.5 py-2 text-[13px] font-semibold text-navy"
              >
                지인 추천
              </button>
              <div className="h-px bg-brand-border my-1" />
              <button
                onClick={() => {
                  setTimezoneModalOpen(true);
                  setAccountMenuOpen(false);
                }}
                className="w-full text-left px-3.5 py-2 text-[13px] font-semibold text-navy"
              >
                시간대 설정
              </button>
              <div className="h-px bg-brand-border my-1" />
              <form action={logout}>
                <button className="w-full text-left px-3.5 py-2 text-[13px] font-semibold text-brand-red">
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
          showHouseholdDefault={true}
          onClose={() => setTimezoneModalOpen(false)}
        />
      )}
      {creditsModalOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border">
              <span className="text-[14px] font-bold text-navy">지인 추천</span>
              <button
                onClick={() => setCreditsModalOpen(false)}
                className="text-[13px] font-semibold text-brand-body"
              >
                닫기
              </button>
            </div>
            <CreditsTab data={credits} />
          </div>
        </div>
      )}

      <MobileBottomNav
        primary={mobilePrimary}
        more={mobileMore}
        activeId={activeTab}
        onSelect={(id) => selectTab(id as TabId)}
        badgeCounts={{ consult: messengerUnread }}
      />

      <div className="flex-1 flex flex-col pb-16 md:pb-0">
        {/* 2026-09-19(UAT 반영) — 데스크톱은 계정 메뉴·자녀 전환이 사이드바로
            옮겨져 상단 헤더바가 없다. 모바일은 사이드바가 숨겨지므로 자녀
            전환·계정 메뉴만 담은 얇은 바를 여기 남긴다. */}
        <div className="md:hidden flex items-center justify-between gap-4 border-b border-brand-border bg-white px-4 py-2.5 relative">
          <div className="flex items-center gap-2">
            {childrenList.map((c) => (
              <button
                key={c.studentId}
                onClick={() => selectChild(c.studentId)}
                className={
                  "text-[13px] font-bold px-3.5 py-1.5 rounded-full border " +
                  (c.studentId === currentChildId
                    ? "bg-navy text-white border-navy"
                    : "border-brand-border text-brand-body")
                }
              >
                {c.name}
              </button>
            ))}
          </div>

          <div className="relative">
            <button
              onClick={() => setAccountMenuOpen((v) => !v)}
              className="text-[13px] font-semibold text-navy"
            >
              {parentName} 학부모님 ▾
            </button>
            {accountMenuOpen && (
              <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-brand-border rounded-xl shadow-lg py-1.5 z-30">
                <button
                  onClick={() => {
                    setAccountMenuOpen(false);
                    selectTab("consent");
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2 text-[13px] font-semibold text-navy"
                >
                  동의
                  {consentBadgeCount > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-brand-red text-white text-[10.5px] font-bold flex items-center justify-center">
                      {consentBadgeCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => {
                    setAccountMenuOpen(false);
                    setCreditsModalOpen(true);
                  }}
                  className="w-full text-left px-3.5 py-2 text-[13px] font-semibold text-navy"
                >
                  지인 추천
                </button>
                <div className="h-px bg-brand-border my-1" />
                <button
                  onClick={() => {
                    setTimezoneModalOpen(true);
                    setAccountMenuOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2 text-[13px] font-semibold text-navy"
                >
                  시간대 설정
                </button>
                <div className="h-px bg-brand-border my-1" />
                <form action={logout}>
                  <button className="w-full text-left px-3.5 py-2 text-[13px] font-semibold text-brand-red">
                    로그아웃
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* 2026-09-19(UI 통일화) — 모든 탭이 같은 프레임(영어 제목 + 가운데
            정렬 고정폭 컬럼) 안에서 렌더링된다. 탭 내부 정렬·서브탭은 그대로
            두고, 제목 위치·컬럼 폭·서브탭 스타일만 통일한다. */}
        <div className="flex-1">
        <PageFrame
          title={activeLabel}
          subtabs={
            activeTab === "home" ? (
              // 2026-09-19(UAT 반영) — "모의고사"를 서브탭 옆 별도 버튼으로
              // 띄우지 않고, 홈 서브탭 목록의 마지막 항목으로 편입한다(같은
              // UnderlineSubTabs 스타일).
              // 2026-09-21(UAT 재지적) — 독립 라우트로 이동하지 않고 탭 안에서
              // 자녀 응시 목록을 바로 보여준다(좌측 네비게이션 유지).
              <UnderlineSubTabs
                items={[
                  { id: "overview", label: "Overview" },
                  { id: "todo", label: "Board" },
                  { id: "review", label: "Review" },
                ]}
                activeId={homeSubTab}
                onSelect={(id) => setHomeSubTab(id as typeof homeSubTab)}
              />
            ) : activeTab === "consult" ? (
              <UnderlineSubTabs
                items={[
                  { id: "messenger", label: "메신저" },
                  { id: "request", label: "상담 신청" },
                  { id: "history", label: "상담 내역" },
                ]}
                activeId={consultSubTab}
                onSelect={setConsultSubTab}
                badgeCounts={{ messenger: messengerUnread }}
              />
            ) : activeTab === "lessons" ? (
              // 2026-09-19(UAT 반영) — 예약 진입은 이제 독립 "Bookings" 탭으로
              // 옮겼다(예약 탭 부활, 제품 오너 결정). 여기는 예정/지난 조회만.
              <UnderlineSubTabs
                items={[
                  { id: "upcoming", label: "예정 수업" },
                  { id: "past", label: "지난 수업" },
                ]}
                activeId={lessonsSubTab}
                onSelect={setLessonsSubTab}
              />
            ) : undefined
          }
        >
          {/* 2026-09-17/18 — 홈 재설계: "일정 확인"에서 "리뷰 확인"으로 목적
              전환. 상단 동의 배너는 제거(프로필 드롭다운 배지로만 노출), 캘린더·
              예정 수업(HomeDashboard)도 더 이상 쓰지 않는다 — 종합 리뷰/수업
              리뷰/상담 리뷰/통계 4개 읽기 전용 서브탭으로 대체한다(상담 리뷰는
              종합 리뷰에 합치지 않는다, 사용자 결정 2026-09-18). 데이터 없을
              때는 일정·캘린더로 되돌아가지 않고 빈 상태 문구만 보여준다(요구사항). */}
          {activeTab === "home" ? (
            <div>
              {homeSubTab === "overview" ? (
                childBoardCards === null ? (
                  <p className="p-8 text-[14px] text-grey-500">불러오는 중...</p>
                ) : (
                  <div className="px-6 py-5">
                    <PlannerOverviewView cards={childBoardCards} />
                  </div>
                )
              ) : homeSubTab === "todo" ? (
                // 2026-09-22(사용자 지시) — "Done"을 별도 서브탭으로 두지 않고
                // 다시 Board(구 TODO) 하나로 합친다(전체 칼럼: 기한 경과/백로그/
                // 진행중/완료).
                childBoardCards === null ? (
                  <p className="p-8 text-[14px] text-grey-500">불러오는 중...</p>
                ) : (
                  <div className="px-6 py-5">
                    <div className="flex gap-1.5 mb-3">
                      <button
                        type="button"
                        onClick={() => setHomeBoardView("board")}
                        className={`text-[12px] font-bold px-3 py-1.5 rounded-lg ${homeBoardView === "board" ? "bg-ink text-white" : "bg-grey-100 text-grey-500"}`}
                      >
                        보드
                      </button>
                      <button
                        type="button"
                        onClick={() => setHomeBoardView("timeline")}
                        className={`text-[12px] font-bold px-3 py-1.5 rounded-lg ${homeBoardView === "timeline" ? "bg-ink text-white" : "bg-grey-100 text-grey-500"}`}
                      >
                        타임라인
                      </button>
                    </div>
                    {homeBoardView === "board" ? (
                      <BoardColumnsView cards={childBoardCards} disableLinks />
                    ) : (
                      <TimelineView cards={childBoardCards} disableLinks />
                    )}
                    {/* 2026-09-22(사용자 지시) — 보드 아래에 예정 수업 리스트(학생 포털과 동일 컴포넌트). */}
                    <div className="max-w-[420px] mt-6">
                      <UpcomingWidget
                        upcoming={lessonBooking.upcomingBookings.map((b) => ({
                          sessionId: b.sessionId,
                          subjectName: b.subjectName,
                          teacherName: b.teacherName,
                          sessionNumber: null,
                          unitTitle: null,
                          scheduledAt: b.startsAt,
                          durationMinutes: Math.round((new Date(b.endsAt).getTime() - new Date(b.startsAt).getTime()) / 60000),
                        }))}
                        onShowAll={() => selectTab("bookings")}
                        timezone={lessonBooking.timezone}
                      />
                    </div>
                  </div>
                )
              ) : (
                // 2026-09-22(사용자 지시) — 종합/수업/상담 리뷰를 "Review" 탭
                // 하나로 합친다.
                <div className="px-6 py-5 space-y-8">
                  <div>
                    <h2 className="text-[14px] font-bold text-ink mb-1.5">월간 종합 리뷰</h2>
                    <p className="text-[13px] text-grey-500">아직 생성된 월간 종합 리뷰가 없습니다. 준비 중입니다.</p>
                  </div>

                  <div>
                    <h2 className="text-[14px] font-bold text-ink mb-3">수업 리뷰</h2>
                    {familyReviews === null ? (
                      <p className="text-[13px] text-grey-500">불러오는 중...</p>
                    ) : familyReviews.filter((r) => r.meetingRecordLink).length === 0 ? (
                      <p className="text-[13px] text-grey-500">확정된 미팅록이 있는 수업이 아직 없습니다.</p>
                    ) : (
                      <div className="space-y-3">
                        {familyReviews
                          .filter((r) => r.meetingRecordLink)
                          .sort((a, b) => (a.finalizedAt > b.finalizedAt ? 1 : -1))
                          .map((r) => (
                            <FamilyReviewCard key={r.reviewId} review={r} />
                          ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h2 className="text-[14px] font-bold text-ink mb-3">상담 리뷰</h2>
                    {consultReviews === null ? (
                      <p className="text-[13px] text-grey-500">불러오는 중...</p>
                    ) : consultReviews.length === 0 ? (
                      <p className="text-[13px] text-grey-500">아직 확정된 상담 리뷰가 없습니다.</p>
                    ) : (
                      <div className="space-y-3">
                        {consultReviews.map((r) => (
                          <ConsultationReviewCard key={r.meetingRequestId} review={r} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === "mockExam" ? (
            <ParentMockExamTab studentId={currentChildId} />
          ) : activeTab === "roadmap" ? (
            roadmap && roadmap.studentId === currentChildId ? (
              <RoadmapView data={roadmap} />
            ) : (
              <div className="p-8 text-[14px] text-grey-500">불러오는 중…</div>
            )
          ) : activeTab === "enrollment" ? (
            <ParentEnrollmentTab childrenEnrollments={childrenSubjectEnrollments} />
          ) : activeTab === "lessons" ? (
            // 2026-09-19(UAT 반영) — 예약 진입은 독립 "Bookings" 탭으로
            // 옮겼다. 서브탭은 위 PageFrame subtabs 자리로 옮겨졌다(hideHeader).
            <LessonsTab
              key={currentChildId}
              upcoming={upcoming}
              past={past}
              curricula={curricula}
              memosByEnrollment={memosByEnrollment}
              reviews={reviews}
              myFeedback={myFeedback}
              readOnly
              hideHeader
              forcedSubtab={lessonsSubTab}
            />
          ) : activeTab === "bookings" ? (
            // 2026-09-19(UAT 반영, 제품 오너 결정) — 2026-09-17 R13에서
            // 제거했던 독립 "예약" 탭을 다시 만든다(정책 되돌림 확인됨).
            <LessonBookingTab
              key={currentChildId}
              hideHeader
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
              onListPendingReschedule={() => listPendingLessonRescheduleRequestsForChild(currentChildId)}
              onRespondToReschedule={(requestId, accept) => respondToLessonRescheduleRequestForChild(requestId, currentChildId, accept)}
            />
          ) : activeTab === "entitlements" ? (
            <EntitlementsTab data={entitlements} purchaseStatus={purchaseStatus} />
          ) : activeTab === "consent" ? (
            <ConsentTab
              activePolicy={activeConsentPolicy}
              trialSmartNotesChildren={trialSmartNotesChildren}
              childrenSubjectEnrollments={childrenSubjectEnrollments}
              progressedTrialEnrollmentIds={progressedTrialEnrollmentIds}
              focusSubjectEnrollmentId={focusSubjectEnrollmentId}
            >
              {consentChildren}
            </ConsentTab>
          ) : activeTab === "credits" ? (
            <CreditsTab data={credits} />
          ) : activeTab === "vocab" ? (
            <ParentVocabTab data={vocabData} />
          ) : activeTab === "homework" ? (
            <ParentHomeworkTab childrenHomework={homeworkByChild} />
          ) : activeTab === "consult" ? (
            consultSubTab === "request" ? (
              <ConsultationRequestTab />
            ) : consultSubTab === "history" ? (
              <ConsultationHistoryTab />
            ) : (
              <MessengerTab />
            )
          ) : (
            <div className="p-8 text-[14px] text-grey-500">
              {activeLabel} 탭은 준비 중입니다.
            </div>
          )}
        </PageFrame>
        </div>
      </div>
    </div>
  );
}

// 2026-09-18 — 홈 "상담 리뷰" 서브탭 카드. household 범위(상담 신청/내역 탭과
// 동일 RLS)의 확정된 meeting_request_reviews만 다룬다 — 미팅록이 없으면
// "미팅록이 없습니다"만 보여주고 링크를 지어내지 않는다.
function ConsultationReviewCard({ review }: { review: HomeConsultationReview }) {
  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold text-ink">상담 리뷰</span>
        <span className="text-[11px] text-grey-500">
          {review.startsAt ? new Date(review.startsAt).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" }) : "-"}
        </span>
      </div>
      <p className="text-[12.5px] text-ink whitespace-pre-wrap mt-1.5">{review.finalText}</p>
      {review.meetingRecordLink ? (
        <a
          href={review.meetingRecordLink}
          target="_blank"
          rel="noreferrer"
          className="inline-block mt-2 text-[12px] font-semibold text-ink underline"
        >
          미팅록 보기
        </a>
      ) : (
        <p className="mt-2 text-[11px] text-grey-500">미팅록이 없습니다.</p>
      )}
    </div>
  );
}
