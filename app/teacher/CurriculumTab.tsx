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
import StudentCurriculumPanel from "./StudentCurriculumPanel";
import SessionPrepPanel from "./SessionPrepPanel";
import { loadStudentCurriculumPanelData } from "./student-curriculum-actions";
import type { StudentCurriculum, EligibleLibrary } from "./student-curriculum-data";

type SubView =
  | { type: "list" }
  | { type: "curriculum"; enrollmentId: string }
  | { type: "review"; sessionId: string }
  | { type: "operating-curriculum"; subjectEnrollmentId: string; subjectId: string }
  | { type: "session-prep"; subjectEnrollmentId: string; subjectId: string };

export default function CurriculumTab({
  mySubjects,
  students,
  curricula,
  memosByEnrollment,
  reviews,
  studentFeedback,
  jumpTo,
  onJumpConsumed,
  operatingCurriculumJumpTo,
  onOperatingCurriculumJumpConsumed,
}: {
  mySubjects: MySubject[];
  students: RosterStudent[];
  curricula: TeacherCurriculumData[];
  memosByEnrollment: Record<string, Memo[]>;
  reviews: Record<string, ReviewData>;
  studentFeedback: Record<string, StudentFeedback>;
  jumpTo: { studentId: string; subjectId: string } | null;
  onJumpConsumed: () => void;
  operatingCurriculumJumpTo?: { subjectEnrollmentId: string; subjectId: string } | null;
  onOperatingCurriculumJumpConsumed?: () => void;
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

  useEffect(() => {
    if (!operatingCurriculumJumpTo) return;
    setSubtab("students");
    setSubView({ type: "operating-curriculum", ...operatingCurriculumJumpTo });
    onOperatingCurriculumJumpConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operatingCurriculumJumpTo]);

  if (subView.type === "operating-curriculum") {
    return (
      <StudentCurriculumOperatingView
        subjectEnrollmentId={subView.subjectEnrollmentId}
        subjectId={subView.subjectId}
        onBack={() => setSubView({ type: "list" })}
        onOpenSessionPrep={() =>
          setSubView({ type: "session-prep", subjectEnrollmentId: subView.subjectEnrollmentId, subjectId: subView.subjectId })
        }
      />
    );
  }

  if (subView.type === "session-prep") {
    return (
      <SessionPrepView
        subjectEnrollmentId={subView.subjectEnrollmentId}
        subjectId={subView.subjectId}
        onBack={() =>
          setSubView({ type: "operating-curriculum", subjectEnrollmentId: subView.subjectEnrollmentId, subjectId: subView.subjectId })
        }
      />
    );
  }

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

// R9(Task 3 UI 배선) — "배정" 탭에서 특정 담당 학생·과목으로 진입한 "운영
// 커리큘럼 관리" 화면. 데이터는 여기서 직접 조회하지 않고 student-curriculum-
// actions.ts의 loadStudentCurriculumPanelData()(서버 액션)를 통해서만 가져온다
// — 담당 배정 검사(requireAssignedTeacherOrAdmin)와 RLS가 그대로 적용되므로,
// 이 화면은 새 인가 로직을 추가하지 않는다. 담당이 아닌 학생의 subjectEnrollmentId로
// 진입을 시도하면(예: 잘못된 딥링크) 로더가 에러를 던지고 화면에 그 메시지만 보여준다.
function StudentCurriculumOperatingView({
  subjectEnrollmentId,
  subjectId,
  onBack,
  onOpenSessionPrep,
}: {
  subjectEnrollmentId: string;
  subjectId: string;
  onBack: () => void;
  onOpenSessionPrep: () => void;
}) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; initial: StudentCurriculum; library: EligibleLibrary }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    loadStudentCurriculumPanelData(subjectEnrollmentId, subjectId)
      .then(({ initial, library }) => {
        if (!cancelled) setState({ status: "ready", initial, library });
      })
      .catch((e) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: e instanceof Error ? e.message : "불러오지 못했습니다.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [subjectEnrollmentId, subjectId]);

  return (
    <div className="max-w-[640px] px-8 pt-8">
      <div className="flex items-center justify-between px-6">
        <button onClick={onBack} className="text-[13px] text-grey-500 font-semibold">
          ← 뒤로
        </button>
        {state.status === "ready" && (
          <button onClick={onOpenSessionPrep} className="text-[12.5px] font-bold text-ink underline">
            세션 준비 하기 →
          </button>
        )}
      </div>
      {state.status === "loading" && (
        <div className="px-6 py-8 text-[13px] text-grey-500">불러오는 중...</div>
      )}
      {state.status === "error" && (
        <div className="px-6 py-8 text-[13px] text-red">{state.message}</div>
      )}
      {state.status === "ready" && (
        <StudentCurriculumPanel
          subjectEnrollmentId={subjectEnrollmentId}
          initial={state.initial}
          library={state.library}
        />
      )}
    </div>
  );
}

// 2026-09-09(UAT 지적, 제품 오너 승인) — "운영 커리큘럼 관리"와 동일한 데이터
// 소스(loadStudentCurriculumPanelData)를 그대로 재사용해 오버레이 단원·키워드
// 사전을 불러온 뒤 SessionPrepPanel에 넘긴다. sessionId 없이(운영 커리큘럼
// 화면에서 바로 진입) 열리면 "지금 세션에 고정할 준비" 대신 "다음 수업에 쓸
// 준비"를 임시보관함(staged)에 만들어 두는 흐름이 된다 — 세션에 실제로
// 고정하려면 실제 예정 수업의 sessionId가 있는 경로(추후 "수업" 탭 연동)로
// 다시 들어와야 한다. 이번 라운드는 세션 준비 자체의 최초 구현이 목표라 그
// 두 번째 진입 경로 배선은 범위 밖으로 남긴다.
function SessionPrepView({
  subjectEnrollmentId,
  subjectId,
  onBack,
}: {
  subjectEnrollmentId: string;
  subjectId: string;
  onBack: () => void;
}) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; initial: StudentCurriculum; library: EligibleLibrary }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    loadStudentCurriculumPanelData(subjectEnrollmentId, subjectId)
      .then(({ initial, library }) => {
        if (!cancelled) setState({ status: "ready", initial, library });
      })
      .catch((e) => {
        if (!cancelled) {
          setState({ status: "error", message: e instanceof Error ? e.message : "불러오지 못했습니다." });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [subjectEnrollmentId, subjectId]);

  if (state.status === "loading") {
    return <div className="px-8 py-8 text-[13px] text-grey-500">불러오는 중...</div>;
  }
  if (state.status === "error") {
    return <div className="px-8 py-8 text-[13px] text-red">{state.message}</div>;
  }
  return (
    <SessionPrepPanel
      subjectEnrollmentId={subjectEnrollmentId}
      overlayUnits={state.initial.units}
      keywords={state.library.keywords}
      sessionId={null}
      onBack={onBack}
    />
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
