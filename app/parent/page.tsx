import { requireUser } from "@/lib/auth";
import { loadChildren } from "./children-data";
import { loadDashboardData } from "@/app/student/dashboard-data";
import { loadLessons } from "@/app/student/lessons-data";
import { loadCurricula } from "@/app/student/curriculum-data";
import { loadMemos } from "@/app/student/memo-data";
import { loadReviews, loadStudentFeedback } from "@/app/student/review-data";
import { loadParentCreditsData } from "./credits-data";
import { loadParentEntitlementsData } from "./entitlements-data";
import { loadChildrenConsentStatus, loadActiveConsentPolicy, loadTrialSmartNotesConsentStatus } from "./consent-data";
import { loadPendingRegularIntentChoices } from "./regular-intent-data";
import { loadChildrenSubjectEnrollments, loadProgressedTrialEnrollmentIds } from "./enrollment-data";
import { loadLessonBookingData } from "@/app/student/lesson-booking-data";
import ParentShell from "./ParentShell";

export default async function ParentHomePage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string; tab?: string; purchase?: string; focus?: string }>;
}) {
  const { user, profile, supabase } = await requireUser();
  const { child, tab, purchase, focus } = await searchParams;

  const children = await loadChildren(supabase, user.id);

  if (children.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <p className="text-[14px] text-grey-500">
          연결된 자녀 계정이 없습니다.
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
    trialSmartNotesChildren,
    pendingRegularIntentChoices,
    childrenSubjectEnrollments,
  ] = await Promise.all([
    dashboardPromise,
    lessonBookingPromise,
    lessonsPromise,
    loadCurricula(supabase, currentChildId),
    loadParentCreditsData(supabase, user.id),
    loadParentEntitlementsData(supabase, user.id, children),
    loadChildrenConsentStatus(supabase, user.id),
    loadActiveConsentPolicy(supabase),
    loadTrialSmartNotesConsentStatus(supabase, user.id),
    loadPendingRegularIntentChoices(supabase, user.id),
    loadChildrenSubjectEnrollments(supabase, children),
  ]);

  const pastSessionIds = past.map((l) => l.sessionId);

  const [memosEntries, reviews, myFeedback, progressedTrialEnrollmentIds] =
    await Promise.all([
      Promise.all(
        curricula.map(
          async (c) => [c.enrollmentId, await loadMemos(supabase, c.enrollmentId)] as const
        )
      ),
      loadReviews(supabase, pastSessionIds),
      loadStudentFeedback(supabase, currentChildId, pastSessionIds),
      loadProgressedTrialEnrollmentIds(supabase, childrenSubjectEnrollments),
    ]);
  const memosByEnrollment = Object.fromEntries(memosEntries) as Record<
    string,
    Awaited<ReturnType<typeof loadMemos>>
  >;

  return (
    <ParentShell
      parentName={profile?.name ?? "학부모"}
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
      trialSmartNotesChildren={trialSmartNotesChildren}
      pendingRegularIntentChoices={pendingRegularIntentChoices}
      childrenSubjectEnrollments={childrenSubjectEnrollments}
      progressedTrialEnrollmentIds={progressedTrialEnrollmentIds}
      lessonBooking={lessonBooking}
      focusSubjectEnrollmentId={focus}
    />
  );
}
