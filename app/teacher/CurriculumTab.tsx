"use client";

import { useEffect, useState } from "react";
import CurriculumView from "@/app/student/CurriculumView";
import ReviewPanel from "@/app/student/ReviewPanel";
import type { Memo } from "@/app/student/memo-data";
import type { ReviewData, StudentFeedback } from "@/app/student/review-data";
import MySubjectsTab from "./MySubjectsTab";
import type { MySubject } from "./mysubjects-data";
import type { RosterStudent } from "./roster-data";
import type { TeacherCurriculumData } from "./curriculum-data";

type SubView =
  | { type: "list" }
  | { type: "curriculum"; enrollmentId: string }
  | { type: "review"; sessionId: string };

export default function CurriculumTab({
  mySubjects,
  students,
  curricula,
  memosByEnrollment,
  reviews,
  studentFeedback,
  jumpTo,
  onJumpConsumed,
}: {
  mySubjects: MySubject[];
  students: RosterStudent[];
  curricula: TeacherCurriculumData[];
  memosByEnrollment: Record<string, Memo[]>;
  reviews: Record<string, ReviewData>;
  studentFeedback: Record<string, StudentFeedback>;
  jumpTo: { studentId: string; subjectId: string } | null;
  onJumpConsumed: () => void;
}) {
  const [subtab, setSubtab] = useState<"mine" | "students">("mine");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    students[0]?.studentId ?? null
  );
  const [subView, setSubView] = useState<SubView>({ type: "list" });

  useEffect(() => {
    if (!jumpTo) return;
    const match = curricula.find(
      (c) => c.studentId === jumpTo.studentId && c.subjectId === jumpTo.subjectId
    );
    setSubtab("students");
    setSelectedStudentId(jumpTo.studentId);
    setSubView(
      match ? { type: "curriculum", enrollmentId: match.enrollmentId } : { type: "list" }
    );
    onJumpConsumed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTo]);

  if (subView.type === "curriculum") {
    const data = curricula.find((c) => c.enrollmentId === subView.enrollmentId);
    if (!data) return null;
    return (
      <CurriculumView
        data={data}
        initialMemos={memosByEnrollment[data.enrollmentId] ?? []}
        onBack={() => setSubView({ type: "list" })}
        onReview={(sessionId) => setSubView({ type: "review", sessionId })}
      />
    );
  }

  if (subView.type === "review") {
    return (
      <ReviewPanel
        sessionId={subView.sessionId}
        review={reviews[subView.sessionId] ?? null}
        myFeedback={studentFeedback[subView.sessionId] ?? null}
        onBack={() => setSubView({ type: "list" })}
        readOnly
      />
    );
  }

  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-5">커리큘럼</h1>

      <div className="flex gap-4 mb-5 border-b border-grey-200">
        {(
          [
            { id: "mine", label: "내 과목" },
            { id: "students", label: "학생별" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setSubtab(t.id)}
            className={
              "text-[13.5px] font-semibold pb-2.5 -mb-px border-b-2 " +
              (subtab === t.id
                ? "text-ink border-ink"
                : "text-grey-500 border-transparent")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {subtab === "mine" ? (
        <MySubjectsTab initialSubjects={mySubjects} />
      ) : (
        <StudentSubjectPicker
          students={students}
          selectedStudentId={selectedStudentId}
          onSelectStudent={setSelectedStudentId}
          curricula={curricula}
          onOpenCurriculum={(enrollmentId) =>
            setSubView({ type: "curriculum", enrollmentId })
          }
        />
      )}
    </div>
  );
}

function StatusLabel(c: TeacherCurriculumData) {
  return `${c.currentSession}/${c.totalSessions}회차`;
}

function StudentSubjectPicker({
  students,
  selectedStudentId,
  onSelectStudent,
  curricula,
  onOpenCurriculum,
}: {
  students: RosterStudent[];
  selectedStudentId: string | null;
  onSelectStudent: (id: string) => void;
  curricula: TeacherCurriculumData[];
  onOpenCurriculum: (enrollmentId: string) => void;
}) {
  if (students.length === 0) {
    return (
      <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
        담당 중인 학생이 없습니다.
      </div>
    );
  }

  const subjectsForStudent = curricula.filter(
    (c) => c.studentId === selectedStudentId
  );

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {students.map((s) => (
          <button
            key={s.studentId}
            onClick={() => onSelectStudent(s.studentId)}
            className={
              "text-[13px] font-bold px-3.5 py-1.5 rounded-full border-[1.5px] " +
              (s.studentId === selectedStudentId
                ? "bg-ink text-white border-ink"
                : "border-grey-200 text-grey-500")
            }
          >
            {s.studentName}
          </button>
        ))}
      </div>

      {subjectsForStudent.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          아직 배정된 커리큘럼이 없습니다.
        </div>
      ) : (
        subjectsForStudent.map((c) => (
          <button
            key={c.enrollmentId}
            onClick={() => onOpenCurriculum(c.enrollmentId)}
            className="w-full text-left border-[1.5px] border-grey-200 rounded-xl px-5 py-3.5 mb-2.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13.5px] font-bold text-ink">
                {c.subjectName}
              </span>
              <span className="text-[12px] font-bold px-3 py-1 rounded-full bg-grey-100 text-ink">
                {StatusLabel(c)}
              </span>
            </div>
          </button>
        ))
      )}
    </div>
  );
}
