import Link from "next/link";
import { requireStudentFeature } from "@/lib/feature-access";
import PageFrame from "@/app/components/PageFrame";

// 2026-10-05 무료 회원 S2 — 과외 안내 + "상담 준비 중" 자리표시자(브리프 §3.6 "선생님과 이야기하기").
// 관심 등록·보호자 초대 폼은 S4에서 이 페이지에 붙는다. 학생이면 tutoring_info 키 필요(무료·과외 모두 보유).
export default async function StudentTutoringPage() {
  await requireStudentFeature("tutoring_info", { redirectTo: "/student" });
  return (
    <div className="min-h-screen bg-cream">
      <PageFrame title="1:1 Tutoring">
        <div className="rounded-xl bg-white border border-brand-border p-6 mb-4">
          <p className="text-[12px] font-bold text-brand-red mb-1">ALTON 1:1 과외</p>
          <h2 className="text-[20px] font-extrabold text-navy mb-3">선생님과 이야기하기</h2>
          <ul className="text-[13.5px] text-grey-500 leading-[1.8] list-disc pl-5 mb-2">
            <li>한국 명문대 대학원생 선생님과 1:1 비대면 SAT/AP 수업</li>
            <li>모의고사 결과·약점 영역을 바탕으로 한 맞춤 커리큘럼과 과제</li>
            <li>컨설턴트 상담 → 체험 수업 → 정규 수업 순서로 진행됩니다</li>
          </ul>
        </div>
        <div className="rounded-xl bg-white border border-brand-border p-6">
          <p className="text-[13px] font-bold text-navy mb-1">상담 준비 중</p>
          <p className="text-[13px] text-grey-500 leading-[1.7]">
            보호자 연결과 상담 예약 기능을 준비하고 있습니다. 준비가 끝나면 이 화면에서 바로 상담을 신청할 수 있습니다.
          </p>
          <Link href="/student" className="inline-block mt-4 px-4 py-2.5 rounded-lg border border-brand-border text-navy text-[13px] font-bold">
            홈으로
          </Link>
        </div>
      </PageFrame>
    </div>
  );
}
