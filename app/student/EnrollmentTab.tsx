"use client";

import type { SubjectEnrollmentView } from "./enrollment-data";

const STATUS_LABEL: Record<SubjectEnrollmentView["status"], string> = {
  planned: "예정",
  active: "수강중",
  paused: "일시중지",
  ended: "종료",
};

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function EnrollmentTab({
  enrollments,
}: {
  enrollments: SubjectEnrollmentView[];
}) {
  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">
        수강 과목
      </h1>
      <p className="text-[13px] text-grey-500 mb-5">
        현재 수강 중인 과목과 담당 선생님, 예정된 선생님 변경 일정을 확인할 수
        있습니다.
      </p>

      {enrollments.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          등록된 과목 수강이 없습니다.
        </div>
      ) : (
        enrollments.map((e) => (
          <div
            key={e.id}
            className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-[14px] font-bold text-ink">
                {e.subjectName}
              </div>
              <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-grey-100 text-grey-500">
                {STATUS_LABEL[e.status]}
              </span>
            </div>

            <div className="text-[13px] text-ink mb-1">
              담당 선생님:{" "}
              <span className="font-semibold">
                {e.currentTeacher ? e.currentTeacher.teacherName : "배정 전"}
              </span>
            </div>
            {e.currentTeacher && (
              <div className="text-[12px] text-grey-500">
                {formatDate(e.currentTeacher.effectiveFrom)}부터
              </div>
            )}

            {e.upcomingTeacherChange && (
              <div className="mt-2 text-[12px] font-semibold text-red bg-red/5 rounded-lg px-3 py-2">
                {formatDate(e.upcomingTeacherChange.effectiveFrom)}부터{" "}
                {e.upcomingTeacherChange.teacherName} 선생님으로 변경 예정
              </div>
            )}

            {e.history.length > 0 && (
              <details className="mt-2.5">
                <summary className="text-[12px] font-semibold text-grey-500 cursor-pointer">
                  이전 선생님 변경 이력 ({e.history.length})
                </summary>
                <div className="mt-1.5 space-y-1.5">
                  {e.history.map((h) => (
                    <div
                      key={h.id}
                      className="text-[12px] text-grey-500 border-l-2 border-grey-200 pl-2.5"
                    >
                      {h.teacherName} — {formatDate(h.effectiveFrom)} ~{" "}
                      {formatDate(h.effectiveUntil)}
                      {h.reason ? ` (${h.reason})` : ""}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        ))
      )}
    </div>
  );
}
