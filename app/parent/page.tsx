import { requireUser } from "@/lib/auth";
import { loadChildren } from "./children-data";
import { loadDashboardData } from "@/app/student/dashboard-data";
import ParentShell from "./ParentShell";

export default async function ParentHomePage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string; tab?: string }>;
}) {
  const { user, profile, supabase } = await requireUser();
  const { child, tab } = await searchParams;

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

  return (
    <ParentShell
      parentName={profile?.name ?? "학부모"}
      childrenList={children}
      currentChildId={currentChildId}
      initialTab={tab}
      dashboard={dashboard}
    />
  );
}
