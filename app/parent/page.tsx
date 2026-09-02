import { requireUser } from "@/lib/auth";
import { loadChildren } from "./children-data";
import { loadDashboardData } from "@/app/student/dashboard-data";
import { loadLessons } from "@/app/student/lessons-data";
import { loadCurricula } from "@/app/student/curriculum-data";
import { loadBookableEnrollments } from "@/app/student/booking-data";
import { loadMemos } from "@/app/student/memo-data";
import { loadReviews, loadStudentFeedback } from "@/app/student/review-data";
import { loadParentCreditsData } from "./credits-data";
import { loadParentEntitlementsData } from "./entitlements-data";
import { loadChildrenConsentStatus, loadActiveConsentPolicy } from "./consent-data";
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
          연결된 자녀 계정이 없습니다.
        </p>
      </div>
    );
  }

  const currentChildId =
    (child && children.some((c) => c.studentId === child) ? child : null) ??
    children[0].studentId;

  const dashboard = await loadDashboardData(supabase, currentChildId);
  const { upcoming, past } = await loadLessons(supabase, currentChildId);
  const curricula = await loadCurricula(supabase, currentChildId);
  const bookableEnrollments = await loadBookableEnrollments(supabase, currentChildId);

  const memosByEnrollment: Record<string, Awaited<ReturnType<typeof loadMemos>>> = {};
  for (const c of curricula) {
    memosByEnrollment[c.enrollmentId] = await loadMemos(supabase, c.enrollmentId);
  }

  const pastSessionIds = past.map((l) => l.sessionId);
  const reviews = await loadReviews(supabase, pastSessionIds);
  const myFeedback = await loadStudentFeedback(supabase, currentChildId, pastSessionIds);
  const credits = await loadParentCreditsData(supabase, user.id, currentChildId);
  const entitlements = await loadParentEntitlementsData(supabase, user.id, children);
  const consentChildren = await loadChildrenConsentStatus(supabase, user.id);
  const activeConsentPolicy = await loadActiveConsentPolicy(supabase);

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
      bookableEnrollments={bookableEnrollments}
      memosByEnrollment={memosByEnrollment}
      reviews={reviews}
      myFeedback={myFeedback}
      credits={credits}
      entitlements={entitlements}
      purchaseStatus={purchase === "success" || purchase === "cancelled" ? purchase : undefined}
      consentChildren={consentChildren}
      activeConsentPolicy={activeConsentPolicy}
    />
  );
}
