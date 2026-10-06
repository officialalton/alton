import Link from "next/link";
import { requireUser } from "@/lib/auth";
import TeacherPlannerBoard from "@/app/teacher/TeacherPlannerBoard";
import type { ViewId } from "@/app/components/StaffStudentViews";

// Student Success Planner — 교사 진입점(2026-09-22 확정 스펙, My Students·수업
// 세션뷰의 "오버뷰"/"로드맵"/"일정"/"커리큘럼" 진입 버튼 중 오버뷰·일정).
// 2026-09-30(UAT) — 바깥 보드/일정/오버뷰 탭(오버뷰·일정은 '준비 중' 자리표시)을 없애고
// 역할 공통 화면(StaffStudentViews: 오버뷰·보드, 보드에서 할 일 추가만 가능) 하나만 쓴다.
// ?tab= 은 처음 열 안쪽 탭만 고른다(overview/board/stats, 그 외 값은 오버뷰).
const VIEW_IDS: ViewId[] = ["overview", "board", "stats"];

export default async function TeacherStudentPlannerPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ tab?: string; returnTo?: string }>;
}) {
  const { studentId } = await params;
  const { tab, returnTo } = await searchParams;
  const { supabase, profile } = await requireUser();
  if (profile?.role !== "teacher" && profile?.role !== "admin") {
    return (
      <div className="max-w-[640px] mx-auto px-6 py-8 text-[13px] text-grey-500">
        You don&apos;t have permission to view this.
      </div>
    );
  }

  const { data: student } = await supabase.from("profiles").select("name").eq("id", studentId).maybeSingle();
  const initialTab: ViewId = VIEW_IDS.includes(tab as ViewId) ? (tab as ViewId) : "overview";
  const backHref = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/teacher?tab=assignments";

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[720px] mx-auto px-6 pt-6">
        <Link
          href={backHref}
          className="text-[13px] text-grey-600 font-semibold border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 hover:bg-grey-100 active:scale-95 transition-transform inline-block"
        >
          ← Back
        </Link>
        <h1 className="text-[18px] font-extrabold text-ink mt-2">{student?.name ?? "Student"} — Study Planner</h1>

        <TeacherPlannerBoard studentId={studentId} initialTab={initialTab} />
      </div>
    </div>
  );
}
