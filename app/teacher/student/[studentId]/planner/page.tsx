import Link from "next/link";
import { requireUser } from "@/lib/auth";
import TeacherPlannerBoard from "@/app/teacher/TeacherPlannerBoard";

// Student Success Planner — 교사 진입점(2026-09-22 확정 스펙, My Students·수업
// 세션뷰의 "오버뷰"/"로드맵"/"일정"/"커리큘럼" 진입 버튼 중 오버뷰·일정).
// 보드(2026-09-24 연결, 학부모 홈 보드와 동일하게 읽기 전용)는 실제 데이터를
// 보여준다. 오버뷰(학습 통계·점수·리뷰)·일정 탭은 아직 구현 전이라 자리만
// 잡아 둔다(빈 화면 대신 "준비 중" 안내).
const TABS = [
  { id: "board", label: "보드" },
  { id: "schedule", label: "일정" },
  { id: "overview", label: "오버뷰" },
] as const;
type TabId = (typeof TABS)[number]["id"];

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
        접근 권한이 없습니다.
      </div>
    );
  }

  const { data: student } = await supabase.from("profiles").select("name").eq("id", studentId).maybeSingle();
  const activeTab: TabId = TABS.some((t) => t.id === tab) ? (tab as TabId) : "board";
  const backHref = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/teacher?tab=assignments";

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[720px] mx-auto px-6 pt-6">
        <Link
          href={backHref}
          className="text-[13px] text-grey-600 font-semibold border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 hover:bg-grey-100 active:scale-95 transition-transform inline-block"
        >
          ← 뒤로
        </Link>
        <h1 className="text-[18px] font-extrabold text-ink mt-2">{student?.name ?? "학생"} 학습 플래너</h1>

        <div className="flex gap-1.5 mt-4 border-b border-grey-200">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={`/teacher/student/${studentId}/planner?tab=${t.id}${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ""}`}
              className={
                "text-[13px] font-semibold px-3 py-2 -mb-px border-b-2 " +
                (activeTab === t.id ? "border-ink text-ink" : "border-transparent text-grey-500")
              }
            >
              {t.label}
            </Link>
          ))}
        </div>

        {activeTab === "board" && <TeacherPlannerBoard studentId={studentId} />}
        {activeTab !== "board" && (
          <div className="py-10 text-center text-[13px] text-grey-500">
            {activeTab === "schedule" && "일정 탭은 준비 중입니다 — 곧 제공됩니다."}
            {activeTab === "overview" && "오버뷰 탭은 준비 중입니다 — 곧 제공됩니다."}
          </div>
        )}
      </div>
    </div>
  );
}
