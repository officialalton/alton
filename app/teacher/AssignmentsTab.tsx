"use client";

import type { TeacherAssignedSubject } from "./assignments-data";

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function AssignmentsTab({
  current,
  past,
}: {
  current: TeacherAssignedSubject[];
  past: TeacherAssignedSubject[];
}) {
  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">
        내 배정 학생
      </h1>
      <p className="text-[13px] text-grey-500 mb-5">
        현재 배정되어 있는 학생·과목과 담당 기간입니다.
      </p>

      {current.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          현재 배정된 학생이 없습니다.
        </div>
      ) : (
        current.map((a) => (
          <div
            key={a.assignmentId}
            className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13.5px] font-bold text-ink">
                  {a.studentName} · {a.subjectName}
                </div>
                <div className="text-[12px] text-grey-500 mt-0.5">
                  {formatDate(a.effectiveFrom)}부터
                </div>
              </div>
              <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-grey-100 text-grey-500">
                {a.status === "active" ? "배정중" : "예정"}
              </span>
            </div>
          </div>
        ))
      )}

      {past.length > 0 && (
        <details className="mt-4">
          <summary className="text-[12.5px] font-semibold text-grey-500 cursor-pointer">
            이전 배정 이력 ({past.length})
          </summary>
          <div className="mt-2 space-y-1.5">
            {past.map((a) => (
              <div
                key={a.assignmentId}
                className="text-[12px] text-grey-500 border-l-2 border-grey-200 pl-2.5"
              >
                {a.studentName} · {a.subjectName} — {formatDate(a.effectiveFrom)} ~{" "}
                {formatDate(a.effectiveUntil)}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
