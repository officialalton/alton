"use client";

import { useEffect, useState } from "react";
import { confirmMatch } from "./matching-actions";
import type { MatchingTeacherCandidate, MatchingStudentItem } from "./matching-data";
import { selectableSubjects, type AdminSubject } from "./subject-data";
import SubjectEnrollmentPanel from "./SubjectEnrollmentPanel";
import TeacherAssignmentTerminationPanel from "./TeacherAssignmentTerminationPanel";
import { countPendingTerminationRequests } from "./teacher-assignment-termination-actions";

type MatchingSubtab = "waiting" | "manage" | "closure";

const SUBTABS: { id: MatchingSubtab; label: string }[] = [
  { id: "waiting", label: "매칭 대기" },
  { id: "manage", label: "매칭 관리" },
  { id: "closure", label: "종료 요청" },
];

// 2026-09-11(제품 오너 지시) — 기존엔 "매칭 대기 목록 + 과목 수강·매칭(R5)
// + 종료 요청"을 한 화면에 전부 쌓아 보여줬다(탭이 없어 세 영역 모두 항상
// 마운트·조회됨). 세 영역을 서브탭으로 분리해 선택한 탭의 데이터만
// 조회하도록 바꾼다 — 기존 매칭·종료 처리 로직(confirmMatch,
// SubjectEnrollmentPanel/TeacherAssignmentTerminationPanel 내부 서버
// 액션)은 그대로 재사용하고 화면 구조·문구만 정리한다.
export default function MatchingTab({
  students,
  subjects,
  teacherCandidatesBySubject,
}: {
  // 2026-09-10(P1) — 사용자 탭용 무거운 StudentListItem 대신 매칭 전용 경량
  // 타입을 쓴다(id·name·grade·parentNames·status만).
  students: MatchingStudentItem[];
  subjects: AdminSubject[];
  teacherCandidatesBySubject: Record<string, MatchingTeacherCandidate[]>;
}) {
  const [subtab, setSubtab] = useState<MatchingSubtab>("waiting");
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [openStudentId, setOpenStudentId] = useState<string | null>(null);
  const [pendingClosureCount, setPendingClosureCount] = useState<number | null>(null);

  // "종료 요청" 탭을 아직 열지 않아도 배지 숫자는 보여야 하므로, 개수만
  // 가볍게 한 번 조회한다(상세 목록은 그 탭을 열 때만 TeacherAssignmentTerminationPanel이
  // 직접 조회 — 아래 onPendingCountChange로 이 값을 최신으로 덮어쓴다).
  useEffect(() => {
    countPendingTerminationRequests()
      .then(setPendingClosureCount)
      .catch(() => setPendingClosureCount(null));
  }, []);

  const pending = students.filter(
    (s) => s.status === "pending" && !matchedIds.includes(s.id)
  );
  const open = pending.find((s) => s.id === openStudentId);

  if (open) {
    return (
      <MatchForm
        student={open}
        subjects={subjects}
        teacherCandidatesBySubject={teacherCandidatesBySubject}
        onBack={() => setOpenStudentId(null)}
        onMatched={() => {
          setMatchedIds((prev) => [...prev, open.id]);
          setOpenStudentId(null);
        }}
      />
    );
  }

  return (
    <div className="max-w-[720px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">매칭</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        학생·선생님 매칭 확정, 진행 중인 매칭 관리, 종료 요청 처리를 다룹니다.
      </p>

      <div className="flex gap-1.5 mb-6 border-b border-grey-200">
        {SUBTABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubtab(t.id)}
            className={
              "text-[13px] font-bold px-3.5 py-2 -mb-px border-b-2 " +
              (subtab === t.id
                ? "border-ink text-ink"
                : "border-transparent text-grey-400")
            }
          >
            {t.label}
            {t.id === "closure" && pendingClosureCount != null && pendingClosureCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center text-[11px] font-bold text-white bg-red rounded-full min-w-[18px] h-[18px] px-1">
                {pendingClosureCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {subtab === "waiting" && (
        <>
          <p className="text-[12.5px] text-grey-500 mb-4">
            매칭 대기 중인 학생을 과목별로 선생님과 연결합니다.
          </p>
          {pending.length === 0 ? (
            <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
              매칭 대기 중인 학생이 없습니다.
            </div>
          ) : (
            pending.map((s) => (
              <div
                key={s.id}
                className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5 flex items-center justify-between"
              >
                <div>
                  <div className="text-[13.5px] font-bold text-ink">{s.name}</div>
                  <div className="text-[12px] text-grey-500 mt-0.5">
                    {s.grade ?? "학년 미입력"}
                    {s.parentNames.length > 0 ? ` · 보호자 ${s.parentNames.join(", ")}` : ""}
                  </div>
                </div>
                <button
                  onClick={() => setOpenStudentId(s.id)}
                  className="text-[12px] font-bold px-3.5 py-2 rounded-lg border-[1.5px] border-grey-200 text-ink shrink-0"
                >
                  매칭하기
                </button>
              </div>
            ))
          )}
        </>
      )}

      {subtab === "manage" && (
        <SubjectEnrollmentPanel
          students={students}
          subjects={subjects}
          teacherCandidatesBySubject={teacherCandidatesBySubject}
        />
      )}

      {subtab === "closure" && (
        <TeacherAssignmentTerminationPanel
          teacherCandidatesBySubject={teacherCandidatesBySubject}
          onPendingCountChange={setPendingClosureCount}
        />
      )}
    </div>
  );
}

function MatchForm({
  student,
  subjects,
  teacherCandidatesBySubject,
  onBack,
  onMatched,
}: {
  student: MatchingStudentItem;
  subjects: AdminSubject[];
  teacherCandidatesBySubject: Record<string, MatchingTeacherCandidate[]>;
  onBack: () => void;
  onMatched: () => void;
}) {
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 2026-09-10 — 배정 자체는 성공했지만 학생 활성화·커리큘럼 시딩이
  // best-effort로 실패했을 때의 경고. null이면 경고 없음(정상 종료).
  const [warnings, setWarnings] = useState<{ activation: string | null; curriculum: string | null } | null>(null);

  const candidates = subjectId ? teacherCandidatesBySubject[subjectId] ?? [] : [];
  const canSubmit = !!subjectId && !!teacherId;

  // 2026-09-10(P0 결함 수정) — "총 회차 수" 수동 입력을 제거했다. 매칭 확정은
  // 이제 실패 시 {ok,error}를 반환하므로(React error #441로 마스킹되던 문제
  // 수정) throw/catch 대신 result.ok를 확인한다.
  //
  // 2026-09-10(커리큘럼 시딩 실패 가시성) — confirmMatch는 배정 자체가 실패한
  // 경우에만 {ok:false}를 반환한다. 배정은 성공했지만 학생 활성화·커리큘럼
  // 시딩이 실패했으면 {ok:true, activationWarning/curriculumWarning}로
  // 돌아온다 — 이 경우 바로 onMatched()로 넘어가지 않고 경고와 "다시 시도"
  // 버튼을 보여준다. confirmMatch(=confirm_student_teacher_subject_match)는
  // 이미 같은 조합에 대해 멱등이므로(과목 수강 계획·선생님 배정은 재사용,
  // 커리큘럼 시딩도 활성 오버레이가 없을 때만 다시 시도) 같은 버튼을 다시
  // 누르는 것 자체가 안전한 재시도 경로다 — 중복 배정·중복 단원이 생기지
  // 않는다.
  async function handleConfirm() {
    if (!subjectId || !teacherId || submitting) return;
    setError(null);
    setSubmitting(true);
    const result = await confirmMatch(student.id, teacherId, subjectId);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.activationWarning || result.curriculumWarning) {
      setWarnings({ activation: result.activationWarning, curriculum: result.curriculumWarning });
      return;
    }
    setWarnings(null);
    onMatched();
  }

  return (
    <div className="max-w-[640px] px-8 py-8">
      <button onClick={onBack} className="text-[13px] text-grey-500 font-semibold mb-4">
        ← 뒤로
      </button>
      <h1 className="text-[20px] font-extrabold text-ink mb-5">{student.name} 매칭</h1>

      <div className="mb-4">
        <label className="text-[12.5px] font-bold text-ink mb-1.5 block">과목</label>
        <div className="flex flex-wrap gap-2">
          {/* 2026-09-09(UAT 지적, 제품 오너 승인): 보관된 과목은 신규 매칭
              후보에서 제외한다. */}
          {selectableSubjects(subjects).map((s) => (
            <button
              key={s.subjectId}
              onClick={() => {
                setSubjectId(s.subjectId);
                setTeacherId(null);
              }}
              className={
                "text-[12.5px] font-semibold px-3 py-1.5 rounded-full border-[1.5px] " +
                (subjectId === s.subjectId
                  ? "bg-ink text-white border-ink"
                  : "border-grey-200 text-ink")
              }
            >
              {s.subjectName}
            </button>
          ))}
        </div>
      </div>

      {subjectId && (
        <div className="mb-4">
          <label className="text-[12.5px] font-bold text-ink mb-1.5 block">선생님</label>
          {candidates.length === 0 ? (
            <p className="text-[12.5px] text-grey-500">
              이 과목을 가르치는 선생님이 없습니다. 먼저 선생님의 담당 과목을 등록해주세요.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {candidates.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setTeacherId(c.id)}
                  className={
                    "text-[12.5px] font-semibold px-3 py-1.5 rounded-full border-[1.5px] " +
                    (teacherId === c.id
                      ? "bg-ink text-white border-ink"
                      : "border-grey-200 text-ink")
                  }
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-[13px] text-red mb-4">{error}</p>}

      {warnings && (
        <div
          className="mb-4 border-[1.5px] border-amber-300 bg-amber-50 rounded-xl px-4 py-3.5"
          data-testid="match-partial-warning"
        >
          <p className="text-[13px] font-bold text-ink mb-1.5">
            배정은 완료됐지만 후속 처리가 끝나지 않았습니다
          </p>
          {warnings.curriculum && (
            <p className="text-[12.5px] text-grey-600 mb-1">
              학생별 커리큘럼 준비에 실패했습니다 — {warnings.curriculum}
            </p>
          )}
          {warnings.activation && (
            <p className="text-[12.5px] text-grey-600 mb-1">{warnings.activation}</p>
          )}
          <div className="flex gap-2 mt-2.5">
            <button
              disabled={submitting}
              onClick={handleConfirm}
              className="text-[12.5px] font-bold px-3.5 py-2 rounded-lg bg-ink text-white disabled:opacity-50"
            >
              {submitting ? "다시 시도 중..." : "다시 시도"}
            </button>
            <button
              onClick={onMatched}
              className="text-[12.5px] font-semibold text-grey-500 px-3.5 py-2"
            >
              나중에 처리(매칭 완료로 넘어가기)
            </button>
          </div>
        </div>
      )}

      <button
        disabled={!canSubmit || submitting}
        onClick={handleConfirm}
        className="text-[13px] font-bold px-4 py-2.5 rounded-lg bg-ink text-white disabled:opacity-50"
      >
        {submitting ? "매칭 중..." : "매칭 확정"}
      </button>
    </div>
  );
}
