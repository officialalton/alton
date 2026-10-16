import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { loadRoadmapData } from "@/lib/roadmap/data";
import RoadmapView from "@/app/components/RoadmapView";

// P9 로드맵 V1 — 관리자 전체 열람·수정 진입점(StudentDetailPanel "프로필·로드맵
// 전체 열람/수정" 링크). is_admin()이 RLS에서 전체 쓰기 권한을 이미 허용하므로
// 학생/보호자 화면과 동일한 RoadmapView를 readOnly=false로 그대로 쓴다.
export default async function AdminStudentRoadmapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, profile } = await requireUser();
  if (profile?.role !== "admin") {
    return (
      <div className="max-w-[640px] mx-auto px-6 py-8 text-[13px] text-grey-500">
        접근 권한이 없습니다.
      </div>
    );
  }

  const data = await loadRoadmapData(supabase, id);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[720px] mx-auto px-6 pt-6">
        <Link href="/admin?tab=users" className="text-[13px] text-grey-500 font-semibold">
          ← 학생 목록으로
        </Link>
        <h1 className="text-[18px] font-extrabold text-ink mt-2">{data.studentName} 프로필 · 로드맵 (관리자)</h1>
      </div>
      <RoadmapView data={data} />
    </div>
  );
}
