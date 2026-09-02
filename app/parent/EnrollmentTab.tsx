"use client";

import EnrollmentTab from "@/app/student/EnrollmentTab";
import type { ChildSubjectEnrollments } from "./enrollment-data";

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
