"use client";

// R5 — 과목 수강/선생님 배정 관리자 패널. 기존 "매칭"(MatchingTab) 탭 안에
// 추가 섹션으로 얹는다(spec: 큰 신규 최상위 화면을 만들지 않는다). 학생 ID로
// 조회해 과목 수강 목록/상태/현재 선생님/배정 이력/미래 예약 영향/문서 권한
// 재처리 큐를 보여주고, 활성화·배정·변경·종료를 처리한다.
//
// C-2(2차, 2026-09-11, 제품 오너 지시) — 세 가지를 한 번에 정리했다.
// 1. "새 과목 수강 계획" 드롭다운이 종료(terminated)된 과목까지 후보에서
//    막고 있던 필터 버그 수정 — 활성 수강 중복 방지는 유지하되, 종료된
//    과목은 다시 배정 후보로 나와야 한다(재등록 정책, decideReturningSubjectEnrollment
//    와 동일한 "live" 정의를 여기서도 그대로 쓴다).
// 2. "수강 계획 생성 → 활성화 → 교사 배정" 3단계였던 관리자 흐름을 "과목
//    선택 → 선생님 선택 → 배정 확인" 한 번으로 통합했다(AssignTeacherForm) —
//    신규 매칭(MatchingTab의 MatchForm)과 동일하게 matching-common-actions.ts
//    의 confirmMatch() 하나만 호출한다(내부 subject_enrollment 생성/재사용·
//    선생님 배정·학생 활성화·커리큘럼 시딩을 전부 시스템이 처리). "활성화"
//    버튼은 그대로 유지한다 — 계약 active + 결제완료 수업권이라는 별도
//    조건이라 배정과 분리된 채로 있어야 한다.
// 3. "배정 종료"를 요청 생성→목록에서 재조회해 처리하는 두 단계가 아니라,
//    영향 확인 화면을 거쳐 한 번에 실행하는 단일 흐름(TerminateAssignmentPanel)
//    으로 추가했다. 내부적으로 기존 요청·감사·재시도 경로(teacher-assignment-
//    termination-actions.ts::adminTerminateAssignmentNow)를 그대로 재사용한다.
//    교사·보호자가 접수한 요청을 관리자가 처리하는 기존 흐름
//    (TeacherAssignmentTerminationPanel)은 손대지 않았다.

import { useEffect, useState } from "react";
import { confirmMatch } from "./matching-actions";
import {
  activateSubjectEnrollment,
  changeTeacherAssignment,
  checkSubjectEnrollmentActivationReadiness,
  listDocumentPermissionRetries,
  listFutureBookingImpact,
  listSubjectEnrollmentsForChild,
  listTeacherAssignmentHistory,
  type DocumentPermissionRetryItem,
  type FutureBookingImpactItem,
  type SubjectEnrollmentListItem,
  type TeacherAssignmentHistoryItem,
} from "./subject-enrollment-actions";
import {
  adminTerminateAssignmentNow,
  previewTerminationImpactAction,
} from "./teacher-assignment-termination-actions";
import type { TerminationImpactReservation } from "@/lib/enrollment/teacher-assignment-termination";
import { selectableSubjects, type AdminSubject } from "./subject-data";
import type { MatchingTeacherCandidate, MatchingStudentItem } from "./matching-data";

export default function SubjectEnrollmentPanel({
  students,
  subjects,
  teacherCandidatesBySubject,
}: {
  // 2026-09-10(P1) — id·name만 쓰므로 매칭 전용 경량 타입으로 충분하다.
  students: MatchingStudentItem[];
  subjects: AdminSubject[];
  teacherCandidatesBySubject: Record<string, MatchingTeacherCandidate[]>;
}) {
  const [childId, setChildId] = useState<string>("");
  const [enrollments, setEnrollments] = useState<SubjectEnrollmentListItem[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [history, setHistory] = useState<TeacherAssignmentHistoryItem[]>([]);
  const [impact, setImpact] = useState<FutureBookingImpactItem[]>([]);
  const [retries, setRetries] = useState<DocumentPermissionRetryItem[] | null>(null);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadForChild(id: string) {
    setChildId(id);
    setBusy(true);
    setMessage(null);
    try {
      setEnrollments(await listSubjectEnrollmentsForChild(id));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "조회 실패");
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    if (childId) setEnrollments(await listSubjectEnrollmentsForChild(childId));
  }

  async function expand(enrollmentId: string) {
    if (expandedId === enrollmentId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(enrollmentId);
    setBusy(true);
    try {
      const [h, i] = await Promise.all([
        listTeacherAssignmentHistory(enrollmentId),
        listFutureBookingImpact(enrollmentId),
      ]);
      setHistory(h);
      setImpact(i);
    } finally {
      setBusy(false);
    }
  }

  async function handleActivate(enrollmentId: string) {
    setBusy(true);
    setMessage(null);
    try {
      const readiness = await checkSubjectEnrollmentActivationReadiness(enrollmentId);
      if (!readiness.canActivate) {
        setMessage(
          readiness.blockedBy === "contract_not_active"
            ? "기본계약이 아직 active 상태가 아닙니다."
            : readiness.blockedBy === "no_paid_entitlement"
              ? "결제완료된 수업권 부여가 아직 없습니다."
              : "기본계약도 active가 아니고 결제완료된 수업권도 없습니다."
        );
        return;
      }
      await activateSubjectEnrollment(enrollmentId);
      setMessage("활성화되었습니다.");
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "활성화 실패");
    } finally {
      setBusy(false);
    }
  }

  async function handleAssign(teacherId: string, subjectId: string) {
    setBusy(true);
    setMessage(null);
    try {
      const result = await confirmMatch(childId, teacherId, subjectId);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage(
        result.curriculumWarning ?? result.activationWarning ?? "선생님이 배정되었습니다."
      );
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "배정 실패");
    } finally {
      setBusy(false);
    }
  }

  async function handleChangeTeacher(
    enrollmentId: string,
    newTeacherId: string,
    reason: string,
    effectiveFromDate: string
  ) {
    if (!reason.trim()) {
      setMessage("변경 사유를 입력해주세요.");
      return;
    }
    if (!effectiveFromDate) {
      setMessage("적용일을 입력해주세요.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      // "적용일" 입력은 날짜만 받는데(<input type="date">), 그대로 new Date(dateOnly)로
      // 바꾸면 그날 자정(UTC)이 된다 — 오늘 날짜를 고른 "당일 변경"의 흔한 경우, 방금
      // 만들어진 기존 활성 배정의 effective_from(오늘, 자정 이후 특정 시각)보다 자정이
      // 항상 앞서서 change_teacher_assignment()의 "새 effective_from은 기존 활성 배정보다
      // 이후여야 한다" 가드에 100% 걸린다(실제 버그로 발견됨 — 경쟁 상태가 아니라
      // 결정론적으로 항상 실패). 오늘 날짜를 고르면 "지금"으로 취급하고, 미래 날짜를
      // 고르면 그날 자정(예약된 변경)으로 취급한다.
      const todayDateOnly = new Date().toISOString().slice(0, 10);
      const effectiveFromIso =
        effectiveFromDate === todayDateOnly
          ? new Date().toISOString()
          : new Date(`${effectiveFromDate}T00:00:00.000Z`).toISOString();
      await changeTeacherAssignment({
        subjectEnrollmentId: enrollmentId,
        newTeacherId,
        effectiveFrom: effectiveFromIso,
        reason,
      });
      setMessage("선생님이 변경되었습니다. 확정된 미래 예약은 자동 이전되지 않으니 안내가 필요합니다.");
      await refresh();
      await expand(enrollmentId);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "변경 실패");
    } finally {
      setBusy(false);
    }
  }

  async function handleTerminate(enrollmentId: string, teacherAssignmentId: string, reason: string) {
    setBusy(true);
    setMessage(null);
    try {
      const result = await adminTerminateAssignmentNow({
        subjectEnrollmentId: enrollmentId,
        teacherAssignmentId,
        reason,
      });
      if (result.status === "failed") {
        setMessage(result.error ?? "종료 처리 중 오류가 발생했습니다.");
        return;
      }
      setMessage("배정이 종료되었습니다.");
      setTerminatingId(null);
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "종료 실패");
    } finally {
      setBusy(false);
    }
  }

  async function loadRetries() {
    setBusy(true);
    try {
      setRetries(await listDocumentPermissionRetries());
    } finally {
      setBusy(false);
    }
  }

  // 활성 배정이 있는 과목만 새 배정 후보에서 제외한다 — 'planned'인데
  // 아직 미배정이거나 종료(terminated/completed)된 과목은 다시 선택할 수
  // 있어야 한다(재등록 정책). confirmMatch(=confirm_student_teacher_subject_
  // match)가 살아있는 subject_enrollment는 재사용하고, 없으면(종료된 것만
  // 있거나 아예 없으면) 새로 만든다 — 여기서 상태를 더 세밀히 나눌 필요가
  // 없다.
  const subjectIdsWithActiveTeacher = new Set(
    (enrollments ?? []).filter((e) => e.currentTeacherId).map((e) => e.subjectId)
  );

  return (
    <div className="max-w-[720px] px-8 py-8 border-t border-grey-200 mt-6">
      <h2 className="text-[16px] font-extrabold text-ink mb-1.5">과목 수강 · 선생님 배정 (R5)</h2>
      <p className="text-[12.5px] text-grey-500 mb-4">
        학생 ID로 과목 수강 상태·현재 선생님·배정 이력을 조회하고, 활성화·배정·변경·종료를 처리합니다.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {students.map((s) => (
          <button
            key={s.id}
            onClick={() => loadForChild(s.id)}
            className={
              "text-[12px] font-semibold px-3 py-1.5 rounded-full border-[1.5px] " +
              (childId === s.id ? "bg-ink text-white border-ink" : "border-grey-200 text-ink")
            }
          >
            {s.name}
          </button>
        ))}
      </div>

      {message && <p className="text-[12.5px] text-red mb-3">{message}</p>}
      {busy && <p className="text-[12.5px] text-grey-500 mb-3">처리 중...</p>}

      {childId && (
        <AssignTeacherForm
          subjects={subjects}
          teacherCandidatesBySubject={teacherCandidatesBySubject}
          blockedSubjectIds={subjectIdsWithActiveTeacher}
          onAssign={handleAssign}
        />
      )}

      {enrollments && enrollments.length === 0 && (
        <p className="text-[12.5px] text-grey-500">이 학생의 과목 수강이 없습니다.</p>
      )}

      {enrollments?.map((en) => (
        <div key={en.id} className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3 mb-2.5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-bold text-ink">
                {en.subjectName ?? en.subjectId} — {en.status}
              </div>
              <div className="text-[12px] text-grey-500 mt-0.5">
                현재 선생님: {en.currentTeacherName ?? "미배정"}
              </div>
            </div>
            <div className="flex gap-2">
              {en.status === "planned" && (
                <button
                  onClick={() => handleActivate(en.id)}
                  className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200"
                >
                  활성화
                </button>
              )}
              {en.currentTeacherId && en.currentTeacherAssignmentId && (
                <button
                  onClick={() =>
                    setTerminatingId(terminatingId === en.id ? null : en.id)
                  }
                  className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-red text-red"
                >
                  {terminatingId === en.id ? "닫기" : "배정 종료"}
                </button>
              )}
              <button
                onClick={() => expand(en.id)}
                className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200"
              >
                {expandedId === en.id ? "닫기" : "이력·예약영향"}
              </button>
            </div>
          </div>

          {en.currentTeacherId && (
            <TeacherChangeForm
              enrollmentId={en.id}
              candidates={(teacherCandidatesBySubject[en.subjectId] ?? []).filter(
                (c) => c.id !== en.currentTeacherId
              )}
              onSubmit={handleChangeTeacher}
            />
          )}

          {terminatingId === en.id && en.currentTeacherAssignmentId && (
            <TerminateAssignmentConfirm
              childName={en.childName}
              subjectName={en.subjectName}
              teacherName={en.currentTeacherName}
              teacherAssignmentId={en.currentTeacherAssignmentId}
              busy={busy}
              onCancel={() => setTerminatingId(null)}
              onConfirm={(reason) => handleTerminate(en.id, en.currentTeacherAssignmentId!, reason)}
            />
          )}

          {expandedId === en.id && (
            <div className="mt-3 bg-grey-100 rounded-lg p-3">
              <div className="text-[12px] font-bold text-ink mb-1">배정 이력</div>
              {history.length === 0 ? (
                <p className="text-[11.5px] text-grey-500">이력 없음</p>
              ) : (
                <ul className="text-[11.5px] text-grey-500 space-y-1">
                  {history.map((h) => (
                    <li key={h.id}>
                      {h.teacherName ?? h.teacherId} · {h.status} · {h.effectiveFrom}
                      {h.effectiveUntil ? ` ~ ${h.effectiveUntil}` : " ~ 진행중"}
                      {h.reason ? ` · 사유: ${h.reason}` : ""}
                    </li>
                  ))}
                </ul>
              )}
              <div className="text-[12px] font-bold text-ink mt-3 mb-1">
                영향받는 확정 미래 예약 (자동 취소·이전되지 않음)
              </div>
              {impact.length === 0 ? (
                <p className="text-[11.5px] text-grey-500">없음</p>
              ) : (
                <ul className="text-[11.5px] text-grey-500 space-y-1">
                  {impact.map((i) => (
                    <li key={i.reservationId}>
                      {i.scheduledStart} · {i.status} — 선생님 변경 후 학생/보호자에게 별도 예약 안내 필요
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      ))}

      <button onClick={loadRetries} className="text-[12px] font-bold text-grey-500 underline mt-4">
        문서 권한 재처리 큐 보기
      </button>
      {retries && (
        <div className="mt-2 bg-grey-100 rounded-lg p-3">
          {retries.length === 0 ? (
            <p className="text-[11.5px] text-grey-500">대기 중인 재처리 항목 없음</p>
          ) : (
            <ul className="text-[11.5px] text-grey-500 space-y-1">
              {retries.map((r) => (
                <li key={r.id}>
                  {r.action} · {r.status} · 시도 {r.attemptCount}회{r.lastError ? ` · ${r.lastError}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function AssignTeacherForm({
  subjects,
  teacherCandidatesBySubject,
  blockedSubjectIds,
  onAssign,
}: {
  subjects: AdminSubject[];
  teacherCandidatesBySubject: Record<string, MatchingTeacherCandidate[]>;
  blockedSubjectIds: Set<string>;
  onAssign: (teacherId: string, subjectId: string) => void;
}) {
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");

  // 2026-09-09(UAT 지적, 제품 오너 승인): 보관(archived) 처리된 과목은 신규
  // 배정 후보에서 제외한다. 여기에 더해 "이미 활성 배정이 있는 과목"만
  // blockedSubjectIds로 제외한다 — 종료(terminated)된 과목은 다시 뜬다.
  const available = selectableSubjects(subjects).filter((s) => !blockedSubjectIds.has(s.subjectId));
  const candidates = subjectId ? teacherCandidatesBySubject[subjectId] ?? [] : [];
  if (available.length === 0) return null;

  function handleSubjectChange(next: string) {
    setSubjectId(next);
    setTeacherId("");
  }

  function handleConfirm() {
    if (!subjectId || !teacherId) return;
    const teacherName = candidates.find((c) => c.id === teacherId)?.name ?? "";
    if (!window.confirm(`${teacherName} 선생님을 이 과목에 배정할까요?`)) return;
    onAssign(teacherId, subjectId);
    setSubjectId("");
    setTeacherId("");
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <select
        value={subjectId}
        onChange={(e) => handleSubjectChange(e.target.value)}
        className="text-[12px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5"
      >
        <option value="">+ 새 배정: 과목 선택...</option>
        {available.map((s) => (
          <option key={s.subjectId} value={s.subjectId}>
            {s.subjectName}
          </option>
        ))}
      </select>
      {subjectId && (
        <select
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
          className="text-[12px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5"
        >
          <option value="">선생님 선택...</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      {subjectId && candidates.length === 0 && (
        <span className="text-[11.5px] text-grey-500">
          이 과목을 가르치는 선생님이 없습니다. 먼저 선생님의 담당 과목을 등록해주세요.
        </span>
      )}
      <button
        disabled={!subjectId || !teacherId}
        onClick={handleConfirm}
        className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 disabled:opacity-50"
      >
        배정 확인
      </button>
    </div>
  );
}

function TeacherChangeForm({
  enrollmentId,
  candidates,
  onSubmit,
}: {
  enrollmentId: string;
  candidates: MatchingTeacherCandidate[];
  onSubmit: (enrollmentId: string, newTeacherId: string, reason: string, effectiveFromDate: string) => void;
}) {
  const [teacherId, setTeacherId] = useState("");
  const [reason, setReason] = useState("");
  const [effectiveFromDate, setEffectiveFromDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );

  if (candidates.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <select
        value={teacherId}
        onChange={(e) => setTeacherId(e.target.value)}
        className="text-[11.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1"
      >
        <option value="">선생님 변경...</option>
        {candidates.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1 text-[11.5px]">
        적용일
        <input
          type="date"
          value={effectiveFromDate}
          onChange={(e) => setEffectiveFromDate(e.target.value)}
          className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1"
        />
      </label>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="변경 사유"
        className="text-[11.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1"
      />
      <button
        disabled={!teacherId}
        onClick={() => onSubmit(enrollmentId, teacherId, reason, effectiveFromDate)}
        className="text-[11.5px] font-bold px-2.5 py-1 rounded-full border-[1.5px] border-grey-200 disabled:opacity-50"
      >
        변경 확정
      </button>
    </div>
  );
}

// C-2(2차, 2026-09-11) — 관리자 직접 종료: "배정 종료 → 영향 확인 및 최종
// 확인 → 실행" 한 흐름. 대상 학생·과목·선생님을 보여주고, 영향받는 미래
// 예약을 미리보기로 확인한 뒤에만 실행 버튼이 활성화된다.
function TerminateAssignmentConfirm({
  childName,
  subjectName,
  teacherName,
  teacherAssignmentId,
  busy,
  onCancel,
  onConfirm,
}: {
  childName: string | null;
  subjectName: string | null;
  teacherName: string | null;
  teacherAssignmentId: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [impact, setImpact] = useState<TerminationImpactReservation[] | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    let cancelled = false;
    previewTerminationImpactAction(teacherAssignmentId).then((data) => {
      if (!cancelled) setImpact(data);
    });
    return () => {
      cancelled = true;
    };
  }, [teacherAssignmentId]);

  return (
    <div className="mt-3 bg-red/5 border border-red/20 rounded-lg p-3">
      <div className="text-[12.5px] font-bold text-ink mb-1">
        {childName ?? "이 학생"} · {subjectName ?? "이 과목"} · {teacherName ?? "이 선생님"} 배정을
        정말 종료할까요?
      </div>
      {impact === null ? (
        <p className="text-[11.5px] text-grey-500 mb-2">영향 확인 중...</p>
      ) : (
        <p className="text-[11.5px] text-grey-600 mb-2">
          영향받는 미래 예약 {impact.length}건
          {impact.some((i) => i.hasActiveHold) && " (보유분 있음 — 정식 취소 처리되며 수업권은 해제됩니다)"}
          {impact.length > 0 && " — 취소된 예약은 자동 복원되지 않습니다."}
        </p>
      )}
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="종료 사유"
        className="text-[11.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1 w-full mb-2"
      />
      <div className="flex gap-2">
        <button
          disabled={busy || !reason.trim() || impact === null}
          onClick={() => onConfirm(reason.trim())}
          className="text-[11.5px] font-bold px-3 py-1.5 rounded-lg bg-red text-white disabled:opacity-50"
        >
          {busy ? "처리 중..." : "종료 실행"}
        </button>
        <button
          onClick={onCancel}
          className="text-[11.5px] font-semibold text-grey-500 px-3 py-1.5"
        >
          취소
        </button>
      </div>
    </div>
  );
}
