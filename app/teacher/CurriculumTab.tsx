"use client";

import { useEffect, useState } from "react";
import CurriculumView from "@/app/student/CurriculumView";
import ReviewPanel from "@/app/student/ReviewPanel";
import MySubjectsTab from "./MySubjectsTab";
import type { MySubject } from "./mysubjects-data";
import type { RosterStudent, RosterSubject } from "./roster-data";
import { formatCurriculumProgressLabel } from "@/lib/curriculum-overlay-progress";
import type { TeacherCurriculumData } from "./curriculum-data";
import StudentCurriculumPanel from "./StudentCurriculumPanel";
import SessionPrepPanel from "./SessionPrepPanel";
import { loadStudentCurriculumPanelData } from "./student-curriculum-actions";
import type { StudentCurriculum, EligibleLibrary } from "./student-curriculum-data";
import { loadLegacyCurriculumDetail, loadReviewDetail } from "./legacy-curriculum-actions";
import type { Memo } from "@/app/student/memo-data";
import type { ReviewData, StudentFeedback } from "@/app/student/review-data";

type SubView =
  | { type: "list" }
  | { type: "curriculum"; enrollmentId: string }
  | { type: "review"; sessionId: string }
  | { type: "operating-curriculum"; subjectEnrollmentId: string; subjectId: string; studentName: string; subjectName: string }
  | { type: "session-prep"; subjectEnrollmentId: string; subjectId: string; studentName: string; subjectName: string };

export default function CurriculumTab({
  mySubjects,
  students,
  jumpTo,
  onJumpConsumed,
  operatingCurriculumJumpTo,
  onOperatingCurriculumJumpConsumed,
}: {
  mySubjects: MySubject[];
  students: RosterStudent[];
  // 2026-09-11(제품 오너 UAT — 첫 진입 지연 재지적) — 예전엔 담당 학생
  // 전체의 커리큘럼 상세(curricula)를 이 화면 진입 시점에 미리 다 읽어서
  // studentId+subjectId로 그 안에서 enrollmentId를 찾았다. 이제 상세는
  // legacy-curriculum-actions.ts가 enrollmentId 하나로만 온디맨드
  // 조회하므로, 점프 호출자가 이미 알고 있는 enrollmentId를 직접 받는다
  // (현재 실제 호출부는 없음 — 다른 진입점이 생길 수 있어 타입만 남김).
  jumpTo?: { studentId: string; enrollmentId: string } | null;
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
  // 2026-09-11(응답 속도 개선) — "운영 커리큘럼 관리"↔"세션 준비"를 오갈 때
  // 같은 subjectEnrollmentId의 데이터를 매번 새로 불러오지 않도록 부모에서
  // 캐시한다(둘 다 loadStudentCurriculumPanelData의 같은 결과를 쓴다).
  const [curriculumPanelCache, setCurriculumPanelCache] = useState<
    Record<string, { initial: StudentCurriculum; library: EligibleLibrary }>
  >({});

  useEffect(() => {
    if (!jumpTo) return;
    setSubtab("students");
    setSelectedStudentId(jumpTo.studentId);
    setSubView({ type: "curriculum", enrollmentId: jumpTo.enrollmentId });
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
        cached={curriculumPanelCache[subView.subjectEnrollmentId]}
        onLoaded={(data) =>
          setCurriculumPanelCache((prev) => ({ ...prev, [subView.subjectEnrollmentId]: data }))
        }
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
        cached={curriculumPanelCache[subView.subjectEnrollmentId]}
        onLoaded={(data) =>
          setCurriculumPanelCache((prev) => ({ ...prev, [subView.subjectEnrollmentId]: data }))
        }
        onBack={() => setSubView({ ...subView, type: "operating-curriculum" })}
      />
    );
  }

  if (subView.type === "curriculum") {
    return (
      <LegacyCurriculumView
        enrollmentId={subView.enrollmentId}
        onBack={() => setSubView({ type: "list" })}
        onReview={(sessionId) => setSubView({ type: "review", sessionId })}
      />
    );
  }

  if (subView.type === "review") {
    return <LegacyReviewView sessionId={subView.sessionId} onBack={() => setSubView({ type: "list" })} />;
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
// 2026-09-11(제품 오너 지적 — 캐시 정확성) — "부모 캐시가 있으면 서버 요청을
// 아예 건너뛴다"는 처음 접근은 두 가지 문제가 있었다: (1) 이전 방문에서 저장한
// 편집 내용이 로컬 state(StudentCurriculumPanel의 useState(initial...))에만
// 있고 부모 캐시에는 반영되지 않아, 같은 화면을 다시 열면 편집 전 캐시된
// 내용을 보여줄 수 있었다(신선도 버그). (2) 캐시로 서버 요청 자체를 건너뛰면
// requireAssignedTeacherOrAdmin() 재검증도 건너뛰어, 선생님 변경·매칭 종료
// 이후에도 예전 화면이 그대로 보일 수 있었다(권한 재검증 회피).
// stale-while-revalidate로 바꾼다 — 캐시가 있으면 화면은 즉시 그 내용으로
// 그리되(재진입 체감 속도 유지), 항상 서버에 다시 요청해(권한 재검증 포함)
// 최신 값으로 캐시·state를 갱신한다. 재검증이 실패하면(권한 상실 등) 오래된
// 내용을 계속 보여주지 않고 에러로 전환한다.
function useStudentCurriculumPanelData(
  subjectEnrollmentId: string,
  subjectId: string,
  cached: { initial: StudentCurriculum; library: EligibleLibrary } | undefined,
  onLoaded: (data: { initial: StudentCurriculum; library: EligibleLibrary }) => void
) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; initial: StudentCurriculum; library: EligibleLibrary }
  >(cached ? { status: "ready", ...cached } : { status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadStudentCurriculumPanelData(subjectEnrollmentId, subjectId)
      .then(({ initial, library }) => {
        if (!cancelled) {
          setState({ status: "ready", initial, library });
          onLoaded({ initial, library });
        }
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
    // cached는 최초 렌더의 즉시 표시 여부만 결정한다(위 useState 초기값) —
    // 여기서 의존성으로 넣으면 캐시 갱신 때마다 재요청이 다시 발동해 무한
    // 루프가 된다. 재검증 자체는 subjectEnrollmentId/subjectId가 바뀔 때만
    // (=이 컴포넌트가 다른 학생·과목으로 다시 마운트될 때만) 실행하면 된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectEnrollmentId, subjectId]);

  return state;
}

function StudentCurriculumOperatingView({
  subjectEnrollmentId,
  subjectId,
  studentName,
  subjectName,
  cached,
  onLoaded,
  onBack,
  onOpenSessionPrep,
}: {
  subjectEnrollmentId: string;
  subjectId: string;
  studentName: string;
  subjectName: string;
  cached?: { initial: StudentCurriculum; library: EligibleLibrary };
  onLoaded: (data: { initial: StudentCurriculum; library: EligibleLibrary }) => void;
  onBack: () => void;
  onOpenSessionPrep: () => void;
}) {
  const state = useStudentCurriculumPanelData(subjectEnrollmentId, subjectId, cached, onLoaded);

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
  cached,
  onLoaded,
  onBack,
}: {
  subjectEnrollmentId: string;
  subjectId: string;
  studentName: string;
  subjectName: string;
  cached?: { initial: StudentCurriculum; library: EligibleLibrary };
  onLoaded: (data: { initial: StudentCurriculum; library: EligibleLibrary }) => void;
  onBack: () => void;
}) {
  const state = useStudentCurriculumPanelData(subjectEnrollmentId, subjectId, cached, onLoaded);

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

// 2026-09-11(제품 오너 UAT — 첫 진입 지연 재지적) — 레거시 과목의 커리큘럼
// 상세(단원별 제목·메모·코멘트·세션 일정)는 이 화면을 실제로 열 때만
// 조회한다(legacy-curriculum-actions.ts::loadLegacyCurriculumDetail).
// 예전엔 "학생별" 목록에 진입하는 시점에 담당 학생 전체의 이 데이터를
// 이미 다 읽어와서 curricula prop으로 들고 있었다.
function LegacyCurriculumView({
  enrollmentId,
  onBack,
  onReview,
}: {
  enrollmentId: string;
  onBack: () => void;
  onReview: (sessionId: string) => void;
}) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; data: TeacherCurriculumData; memos: Memo[] }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    loadLegacyCurriculumDetail(enrollmentId)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setState({ status: "error", message: "커리큘럼을 찾을 수 없습니다." });
          return;
        }
        setState({ status: "ready", data: result.curriculum, memos: result.memos });
      })
      .catch((e) => {
        if (!cancelled) {
          setState({ status: "error", message: e instanceof Error ? e.message : "불러오지 못했습니다." });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enrollmentId]);

  if (state.status === "loading") {
    return <div className="max-w-[640px] px-8 py-8 text-[13px] text-grey-500">불러오는 중...</div>;
  }
  if (state.status === "error") {
    return (
      <div className="max-w-[640px] px-8 py-8">
        <button onClick={onBack} className="text-[13px] text-grey-500 font-semibold mb-4">
          ← 뒤로
        </button>
        <p className="text-[13px] text-red">{state.message}</p>
      </div>
    );
  }
  return (
    <CurriculumView
      data={state.data}
      initialMemos={state.memos}
      onBack={onBack}
      onReview={onReview}
    />
  );
}

function LegacyReviewView({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; review: ReviewData | null; myFeedback: StudentFeedback | null }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    loadReviewDetail(sessionId)
      .then(({ review, myFeedback }) => {
        if (!cancelled) setState({ status: "ready", review, myFeedback });
      })
      .catch((e) => {
        if (!cancelled) {
          setState({ status: "error", message: e instanceof Error ? e.message : "불러오지 못했습니다." });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (state.status === "loading") {
    return <div className="max-w-[640px] px-8 py-8 text-[13px] text-grey-500">불러오는 중...</div>;
  }
  if (state.status === "error") {
    return (
      <div className="max-w-[640px] px-8 py-8">
        <button onClick={onBack} className="text-[13px] text-grey-500 font-semibold mb-4">
          ← 뒤로
        </button>
        <p className="text-[13px] text-red">{state.message}</p>
      </div>
    );
  }
  return (
    <ReviewPanel
      sessionId={sessionId}
      review={state.review}
      myFeedback={state.myFeedback}
      onBack={onBack}
      readOnly
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
