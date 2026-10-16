"use client";

import StaffStudentViews, { type ViewId } from "@/app/components/StaffStudentViews";

// Student Success Planner — 선생님용 학생 열람. 역할 공통 화면(StaffStudentViews)을 쓴다:
// 현재 활성 배정 학생만(서버 검사), 할 일 추가 가능·이동/삭제 불가. 탭(오버뷰/보드/통계)은 공통 화면 하나만 쓴다.
export default function TeacherPlannerBoard({ studentId, initialTab }: { studentId: string; initialTab?: ViewId }) {
  return (
    <div className="py-4">
      <StaffStudentViews studentId={studentId} initialTab={initialTab} />
    </div>
  );
}
