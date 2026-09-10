"use client";

import EnrollmentTab from "@/app/student/EnrollmentTab";
import type { ChildSubjectEnrollments } from "./enrollment-data";

// 2026-09-10(P0-5) — "정규 진행 희망" 선택(TrialConversionPanel)은 이 탭에서
// 빠졌다. 부모 홈 알림이 "수강 과목" 탭이 아니라 동의 탭(ConsentTab.tsx)의
// 해당 항목으로 정확히 이동해야 한다는 지적에 따라, 그 섹션을 동의 탭으로
// 옮겼다 — 두 탭에서 같은 액션이 중복 노출되지 않게 이 탭에서는 완전히 제거.
export default function ParentEnrollmentTab({
  childrenEnrollments,
}: {
  childrenEnrollments: ChildSubjectEnrollments[];
}) {
  return (
    <div>
      {childrenEnrollments.map((c) => (
        <div key={c.childId} className="border-b border-grey-200 last:border-0">
          <div className="px-8 pt-6 text-[13px] font-bold text-grey-500">
            {c.childName}
          </div>
          <EnrollmentTab enrollments={c.enrollments} />
        </div>
      ))}
    </div>
  );
}
