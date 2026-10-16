"use client";

import EnrollmentTab from "@/app/student/EnrollmentTab";
import type { ChildSubjectEnrollments } from "./enrollment-data";

// 2026-09-10(P0-5) — "정규 진행 희망" 선택(TrialConversionPanel)은 이 탭에서
// 빠졌다. 부모 홈 알림이 "수강 과목" 탭이 아니라 동의 탭(ConsentTab.tsx)의
// 해당 항목으로 정확히 이동해야 한다는 지적에 따라, 그 섹션을 동의 탭으로
// 옮겼다 — 두 탭에서 같은 액션이 중복 노출되지 않게 이 탭에서는 완전히 제거.
//
// 2026-09-18(UI 폴리싱) — 자녀별로 위에 떠 있던 이름 행을 제거했다(다른
// 탭들과 마찬가지로 상단에 큰 제목/보조 정보를 두지 않는다). 자녀가 둘 이상일
// 때 어떤 과목이 누구 것인지 구분할 정보가 없어지면 안 되므로, 그 정보는
// 잃지 않고 각 과목 카드 안(EnrollmentTab의 childName prop)으로 옮겼다.
export default function ParentEnrollmentTab({
  childrenEnrollments,
}: {
  childrenEnrollments: ChildSubjectEnrollments[];
}) {
  return (
    <div>
      {childrenEnrollments.map((c) => (
        <div key={c.childId} className="border-b border-grey-200 last:border-0">
          <EnrollmentTab
            enrollments={c.enrollments}
            childName={childrenEnrollments.length > 1 ? c.childName : undefined}
          />
        </div>
      ))}
    </div>
  );
}
