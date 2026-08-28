"use client";

import type { RosterStudent } from "./roster-data";

export default function RosterTab({
  students,
  onOpenCurriculum,
}: {
  students: RosterStudent[];
  onOpenCurriculum: (studentId: string, subjectId: string) => void;
}) {
  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-5">학생</h1>

      {students.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          담당 중인 학생이 없습니다.
        </div>
      ) : (
        students.map((s) => (
          <div
            key={s.studentId}
            className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5"
          >
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-[14px] font-bold text-ink">
                {s.studentName}
              </span>
              {s.grade && (
                <span className="text-[11px] font-semibold text-grey-500">
                  {s.grade}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {s.subjects.map((subj) => (
                <button
                  key={subj.enrollmentId}
                  onClick={() => onOpenCurriculum(s.studentId, subj.subjectId)}
                  className="text-[12px] font-semibold px-3 py-1.5 rounded-full bg-grey-100 text-ink"
                >
                  {subj.subjectName} · {subj.currentSession}/{subj.totalSessions}회차
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
