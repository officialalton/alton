import { requireUser } from "@/lib/auth";
import { loadChildren } from "./children-data";
import { loadFreeMemberFamilyStatus } from "./free-member-data";
import { loadDashboardData } from "@/app/student/dashboard-data";
import { loadLessons } from "@/app/student/lessons-data";
import { loadCurricula } from "@/app/student/curriculum-data";
import { loadMemos } from "@/app/student/memo-data";
import { loadReviews, loadStudentFeedback } from "@/app/student/review-data";
import { loadParentCreditsData } from "./credits-data";
import { loadParentEntitlementsData } from "./entitlements-data";
import { loadChildrenConsentStatus, loadActiveConsentPolicy } from "./consent-data";
import { loadChildrenSubjectEnrollments } from "./enrollment-data";
import { loadLessonBookingData } from "@/app/student/lesson-booking-data";
import { loadParentVocabData } from "./vocab-data";
import { loadParentHomeworkData } from "./homework-data";
import { ViewerTimezoneProvider } from "@/app/components/ViewerTimezoneProvider";
import ParentShell from "./ParentShell";

export default async function ParentHomePage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string; tab?: string; purchase?: string }>;
}) {
  const { user, profile, supabase } = await requireUser();
  const { child, tab, purchase } = await searchParams;

  const children = await loadChildren(supabase, user.id);

  if (children.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <p className="text-[14px] text-grey-500">
          No linked child account found.
        </p>
      </div>
    );
  }

  const currentChildId =
    (child && children.some((c) => c.studentId === child) ? child : null) ??
    children[0].studentId;

  // 2026-09-09(UAT 정정) — 학생 홈과 동일한 이유로 loadDashboardData()가
  // 이 자녀의 v3 예약(loadLessonBookingData 결과)을 병합해야 한다(app/student/page.tsx
  // 참고, 같은 함수를 그대로 재사용).
  const lessonBookingPromise = loadLessonBookingData(supabase, currentChildId);
  const dashboardPromise = lessonBookingPromise.then((lb) =>
    loadDashboardData(supabase, currentChildId, lb)
  );
  // 2026-09-11 — "수업" 탭 예정 수업 목록도 홈과 동일하게 v3 예약을
  // 병합해야 한다(레거시 legacy_sessions만 조회하면 v3 전용 배정 자녀의
  // 예정 수업이 학부모 "수업" 탭에서 누락된다).
  const lessonsPromise = lessonBookingPromise.then((lb) =>
    loadLessons(supabase, currentChildId, lb)
  );
  const [
    dashboard,
    lessonBooking,
    { upcoming, past },
    curricula,
    credits,
    entitlements,
    consentChildren,
    activeConsentPolicy,
    childrenSubjectEnrollments,
    vocabData,
    homeworkByChild,
    freeMemberStatus,
  ] = await Promise.all([
    dashboardPromise,
    lessonBookingPromise,
    lessonsPromise,
    loadCurricula(supabase, currentChildId),
    loadParentCreditsData(supabase, user.id),
    loadParentEntitlementsData(supabase, user.id, children),
    loadChildrenConsentStatus(supabase, user.id),
    loadActiveConsentPolicy(supabase),
    loadChildrenSubjectEnrollments(supabase, children),
    loadParentVocabData(supabase, user.id),
    loadParentHomeworkData(supabase, user.id),
    // 2026-10-05 무료 회원 S4 — 자녀 배지·상담 탭 배너(+2 쿼리, 실패해도 포털은 뜬다).
    loadFreeMemberFamilyStatus(supabase, children.map((c) => c.studentId)).catch((e) => {
      console.error(JSON.stringify({ type: "parent_free_member_status_failed", error: e instanceof Error ? e.message : String(e) }));
      return { freeMemberChildIds: [], consults: [] };
    }),
  ]);

  const pastSessionIds = past.map((l) => l.sessionId);

  const [memosEntries, reviews, myFeedback] = await Promise.all([
    Promise.all(
      curricula.map(
        async (c) => [c.enrollmentId, await loadMemos(supabase, c.enrollmentId)] as const
      )
    ),
    loadReviews(supabase, pastSessionIds),
    loadStudentFeedback(supabase, currentChildId, pastSessionIds),
  ]);
  const memosByEnrollment = Object.fromEntries(memosEntries) as Record<
    string,
    Awaited<ReturnType<typeof loadMemos>>
  >;

  return (
    <ViewerTimezoneProvider timezone={profile?.timezone || lessonBooking.timezone}>
    <ParentShell
      parentName={profile?.name ?? "Parent"}
      childrenList={children}
      currentChildId={currentChildId}
      initialTab={tab}
      dashboard={dashboard}
      upcoming={upcoming}
      past={past}
      curricula={curricula}
      memosByEnrollment={memosByEnrollment}
      reviews={reviews}
      myFeedback={myFeedback}
      credits={credits}
      entitlements={entitlements}
      purchaseStatus={purchase === "success" || purchase === "cancelled" ? purchase : undefined}
      consentChildren={consentChildren}
      activeConsentPolicy={activeConsentPolicy}
      childrenSubjectEnrollments={childrenSubjectEnrollments}
      vocabData={vocabData}
      homeworkByChild={homeworkByChild}
      lessonBooking={lessonBooking}
      freeMemberStatus={freeMemberStatus}
    />
    </ViewerTimezoneProvider>
  );
}
