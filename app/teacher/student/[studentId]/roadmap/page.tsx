import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { loadRoadmapData } from "@/lib/roadmap/data";
import RoadmapView from "@/app/components/RoadmapView";

// P9 로드맵 V1 — 교사 읽기전용 진입점(CurriculumTab의 "학생 프로필·로드맵
// 보기" 링크, 수업 화면 상단 링크). 담당 학생이 아니면 RLS(_roadmap_can_read)가
// 조회 자체를 막으므로, 여기서는 로그인만 확인하고 나머지는 RLS에 맡긴다.
export default async function TeacherStudentRoadmapPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { studentId } = await params;
  const { returnTo } = await searchParams;
  const { supabase, profile } = await requireUser();
  if (profile?.role !== "teacher" && profile?.role !== "admin") {
    return (
      <div className="max-w-[640px] mx-auto px-6 py-8 text-[13px] text-grey-500">
        접근 권한이 없습니다.
      </div>
    );
  }

  const data = await loadRoadmapData(supabase, studentId);
  // 2026-09-22(사용자 지시) — 이 페이지는 CurriculumTab과 수업 세션뷰 둘 다에서
  // 들어올 수 있는데 "뒤로"가 항상 커리큘럼 탭으로 고정돼 있었다. 세션에서 온
  // 경우 세션뷰로 돌아가게 returnTo를 쓴다(내부 경로가 아니면 무시 — 오픈 리다이렉트 방지).
  const backHref = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/teacher?tab=curriculum";

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[720px] mx-auto px-6 pt-6">
        <Link
          href={backHref}
          className="text-[13px] text-grey-600 font-semibold border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 hover:bg-grey-100 active:scale-95 transition-transform inline-block"
        >
          ← 뒤로
        </Link>
        <h1 className="text-[18px] font-extrabold text-ink mt-2">
          {data.studentName} 학생 프로필 · 로드맵
        </h1>
        <p className="text-[12.5px] text-grey-500 mt-1">읽기 전용입니다. 수정은 학생·보호자·관리자만 가능합니다.</p>
      </div>
      <RoadmapView data={data} readOnly />
    </div>
  );
}
