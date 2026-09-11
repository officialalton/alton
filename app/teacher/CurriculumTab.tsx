"use client";

import { useEffect, useState } from "react";
import CurriculumView from "@/app/student/CurriculumView";
import ReviewPanel from "@/app/student/ReviewPanel";
import type { Memo } from "@/app/student/memo-data";
import type { ReviewData, StudentFeedback } from "@/app/student/review-data";
import MySubjectsTab from "./MySubjectsTab";
import type { MySubject } from "./mysubjects-data";
import type { RosterStudent, RosterSubject } from "./roster-data";
import { formatCurriculumProgressLabel } from "@/lib/curriculum-overlay-progress";
import type { TeacherCurriculumData } from "./curriculum-data";
import StudentCurriculumPanel from "./StudentCurriculumPanel";
import SessionPrepPanel from "./SessionPrepPanel";
import { loadStudentCurriculumPanelData } from "./student-curriculum-actions";
import type { StudentCurriculum, EligibleLibrary } from "./student-curriculum-data";

type SubView =
  | { type: "list" }
  | { type: "curriculum"; enrollmentId: string }
  | { type: "review"; sessionId: string }
  | { type: "operating-curriculum"; subjectEnrollmentId: string; subjectId: string; studentName: string; subjectName: string }
  | { type: "session-prep"; subjectEnrollmentId: string; subjectId: string; studentName: string; subjectName: string };

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
  // C-1(2026-09-10) — 이 점프는 예전에 "배정" 탭의 레거시 "커리큘럼 보기"
  // 버튼이 트리거했는데, 그 버튼을 제거하면서 실제 호출부가 없어졌다("학생별"
  // 탭 안의 레거시 과목 클릭은 이 prop과 무관한 로컬 subView 상태를 쓴다).
  // 다른 진입점이 생길 수 있어 타입은 남겨두되 선택적으로 바꾼다.
  jumpTo?: { studentId: string; subjectId: string } | null;
  onJumpConsumed?: () => void;
  operatingCurriculumJumpTo?: {
    subjectEnrollmentId: string;
    subjectId: string;
    studentName: string;
    subjectName: string;
  } | null;
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
    onJumpConsumed?.();
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
        studentName={subView.studentName}
        subjectName={subView.subjectName}
        onBack={() => setSubView({ type: "list" })}
        onOpenSessionPrep={() => setSubView({ ...subView, type: "session-prep" })}
      />
    );
  }

  if (subView.type === "session-prep") {
    return (
      <SessionPrepView
        subjectEnrollmentId={subView.subjectEnrollmentId}
        subjectId={subView.subjectId}
        studentName={subView.studentName}
        subjectName={subView.subjectName}
        onBack={() => setSubView({ ...subView, type: "operating-curriculum" })}
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
          onOpenSubject={(subject) =>
            subject.source === "v3"
              ? setSubView({
                  type: "operating-curriculum",
                  subjectEnrollmentId: subject.enrollmentId,
                  subjectId: subject.subjectId,
                  // 2026-09-10(P0-2) — "세션 준비"까지 이어지는 화면에서 "이번
                  // 수업"이 어느 학생 것인지 식별할 수 있게 이름을 함께 들고 간다.
                  studentName:
                    students.find((s) => s.studentId === selectedStudentId)?.studentName ?? "",
                  subjectName: subject.subjectName,
                })
              : setSubView({ type: "curriculum", enrollmentId: subject.enrollmentId })
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
  studentName,
  subjectName,
  onBack,
  onOpenSessionPrep,
}: {
  subjectEnrollmentId: string;
  subjectId: string;
  studentName: string;
  subjectName: string;
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
      {/* 2026-09-10(P0-2) — "이 세션"이 어느 학생·과목인지 화면 상단에서 바로
          알 수 있게 표시(내부 용어 대신 식별 정보). */}
      <div className="px-6 text-[12px] text-grey-500 font-semibold mt-1">
        {studentName} 학생 · {subjectName}
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
  studentName,
  subjectName,
  onBack,
}: {
  subjectEnrollmentId: string;
  subjectId: string;
  studentName: string;
  subjectName: string;
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
      studentName={studentName}
      subjectName={subjectName}
      onBack={onBack}
    />
  );
}

function StatusLabel(s: RosterSubject) {
  // C-1(2026-09-10) — v3 배정은 curriculum_overlay_units 기준 진도로 통일한다
  // ("0/0회차"·단순 "운영 커리큘럼" 표기 금지). legacy는 기존 회차 실적 표기
  // 그대로 둔다(단원 오버레이 개념 자체가 없는 별도 데이터 모델).
  return s.source === "v3"
    ? formatCurriculumProgressLabel({ totalUnits: s.totalSessions, doneUnits: s.currentSession, sourceLabel: null })
    : `${s.currentSession}/${s.totalSessions}회차`;
}

function StudentSubjectPicker({
  students,
  selectedStudentId,
  onSelectStudent,
  onOpenSubject,
}: {
  students: RosterStudent[];
  selectedStudentId: string | null;
  onSelectStudent: (id: string) => void;
  onOpenSubject: (subject: RosterSubject) => void;
}) {
  if (students.length === 0) {
    return (
      <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
        담당 중인 학생이 없습니다.
      </div>
    );
  }

  // 2026-09-09(UAT 정정) — 레거시 전용 `curricula`(TeacherCurriculumData[])로
  // 필터링하면 v3(teacher_assignments+subject_enrollments)로만 배정된 학생은
  // 여기서 늘 0건이 되어 "아직 배정된 커리큘럼이 없습니다"만 보였다(실제
  // 배정이 있어도 빈 화면). `students`(roster-data.ts::loadRoster())가 이미
  // legacy+v3를 합쳐 담고 있으므로 그걸 그대로 쓴다 — 별도 조회 없음.
  const subjectsForStudent =
    students.find((s) => s.studentId === selectedStudentId)?.subjects ?? [];

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
        subjectsForStudent.map((s) => (
          <button
            key={s.enrollmentId}
            onClick={() => onOpenSubject(s)}
            className="w-full text-left border-[1.5px] border-grey-200 rounded-xl px-5 py-3.5 mb-2.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13.5px] font-bold text-ink">
                {s.subjectName}
              </span>
              <span className="text-[12px] font-bold px-3 py-1 rounded-full bg-grey-100 text-ink">
                {StatusLabel(s)}
              </span>
            </div>
            {s.curriculumSourceLabel && (
              <div className="text-[11px] text-grey-400 mt-1">{s.curriculumSourceLabel}</div>
            )}
          </button>
        ))
      )}
    </div>
  );
}
