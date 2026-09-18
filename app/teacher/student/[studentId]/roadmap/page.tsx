import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { loadRoadmapData } from "@/lib/roadmap/data";
import RoadmapView from "@/app/components/RoadmapView";

// P9 로드맵 V1 — 교사 읽기전용 진입점(CurriculumTab의 "학생 프로필·로드맵
// 보기" 링크, 수업 화면 상단 링크). 담당 학생이 아니면 RLS(_roadmap_can_read)가
// 조회 자체를 막으므로, 여기서는 로그인만 확인하고 나머지는 RLS에 맡긴다.
export default async function TeacherStudentRoadmapPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const { supabase, profile } = await requireUser();
  if (profile?.role !== "teacher" && profile?.role !== "admin") {
    return (
      <div className="max-w-[640px] mx-auto px-6 py-8 text-[13px] text-grey-500">
        접근 권한이 없습니다.
      </div>
    );
  }

  const data = await loadRoadmapData(supabase, studentId);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[720px] mx-auto px-6 pt-6">
        <Link href="/teacher?tab=curriculum" className="text-[13px] text-grey-500 font-semibold">
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
