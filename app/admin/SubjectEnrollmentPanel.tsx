"use client";

// R5 — 과목 수강/선생님 배정 관리자 패널. 기존 "매칭"(MatchingTab) 탭 안에
// 추가 섹션으로 얹는다(spec: 큰 신규 최상위 화면을 만들지 않는다). 학생 ID로
// 조회해 과목 수강 목록/상태/현재 선생님/배정 이력/미래 예약 영향/문서 권한
// 재처리 큐를 보여주고, 활성화·최초 배정·선생님 변경 액션을 제공한다.

import { useState } from "react";
import {
  activateSubjectEnrollment,
  assignTeacherToSubjectEnrollment,
  changeTeacherAssignment,
  checkSubjectEnrollmentActivationReadiness,
  checkTrialTeacherSuccession,
  getContractIdForChild,
  listDocumentPermissionRetries,
  listFutureBookingImpact,
  listSubjectEnrollmentsForChild,
  listTeacherAssignmentHistory,
  planSubjectEnrollment,
  type DocumentPermissionRetryItem,
  type FutureBookingImpactItem,
  type SubjectEnrollmentListItem,
  type TeacherAssignmentHistoryItem,
} from "./subject-enrollment-actions";
import type { StudentListItem } from "./users-data";
import type { AdminSubject } from "./subject-data";
import type { MatchingTeacherCandidate } from "./matching-data";

export default function SubjectEnrollmentPanel({
  students,
  subjects,
  teacherCandidatesBySubject,
}: {
  students: StudentListItem[];
  subjects: AdminSubject[];
  teacherCandidatesBySubject: Record<string, MatchingTeacherCandidate[]>;
}) {
  const [childId, setChildId] = useState<string>("");
  const [enrollments, setEnrollments] = useState<SubjectEnrollmentListItem[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [history, setHistory] = useState<TeacherAssignmentHistoryItem[]>([]);
  const [impact, setImpact] = useState<FutureBookingImpactItem[]>([]);
  const [retries, setRetries] = useState<DocumentPermissionRetryItem[] | null>(null);
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
      if (childId) setEnrollments(await listSubjectEnrollmentsForChild(childId));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "활성화 실패");
    } finally {
      setBusy(false);
    }
  }

  async function handleAssignInitial(enrollmentId: string, teacherId: string, subjectId: string) {
    setBusy(true);
    setMessage(null);
    try {
      const check = await checkTrialTeacherSuccession({ teacherId, subjectId });
      if (!check.proposal.canPropose) {
        setMessage(check.blockMessages.join(" "));
        return;
      }
      await assignTeacherToSubjectEnrollment({
        subjectEnrollmentId: enrollmentId,
        teacherId,
        effectiveFrom: new Date().toISOString(),
      });
      setMessage("선생님이 배정되었습니다.");
      if (childId) setEnrollments(await listSubjectEnrollmentsForChild(childId));
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
      await changeTeacherAssignment({
        subjectEnrollmentId: enrollmentId,
        newTeacherId,
        effectiveFrom: new Date(effectiveFromDate).toISOString(),
        reason,
      });
      setMessage("선생님이 변경되었습니다. 확정된 미래 예약은 자동 이전되지 않으니 안내가 필요합니다.");
      if (childId) setEnrollments(await listSubjectEnrollmentsForChild(childId));
      await expand(enrollmentId);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "변경 실패");
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

  return (
    <div className="max-w-[720px] px-8 py-8 border-t border-grey-200 mt-6">
      <h2 className="text-[16px] font-extrabold text-ink mb-1.5">과목 수강 · 선생님 배정 (R5)</h2>
      <p className="text-[12.5px] text-grey-500 mb-4">
        학생 ID로 과목 수강 상태·현재 선생님·배정 이력을 조회하고, 활성화·배정·변경을 처리합니다.
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
        <NewEnrollmentForm
          childId={childId}
          subjects={subjects}
          existingSubjectIds={new Set((enrollments ?? []).map((e) => e.subjectId))}
          onPlanned={async () => setEnrollments(await listSubjectEnrollmentsForChild(childId))}
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
              <button
                onClick={() => expand(en.id)}
                className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200"
              >
                {expandedId === en.id ? "닫기" : "이력·예약영향"}
              </button>
            </div>
          </div>

          {!en.currentTeacherId && (
            <div className="mt-2 flex flex-wrap gap-2">
              {(teacherCandidatesBySubject[en.subjectId] ?? []).map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleAssignInitial(en.id, c.id, en.subjectId)}
                  className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full border-[1.5px] border-grey-200"
                >
                  {c.name} 배정
                </button>
              ))}
            </div>
          )}

          {en.currentTeacherId && (
            <TeacherChangeForm
              enrollmentId={en.id}
              candidates={(teacherCandidatesBySubject[en.subjectId] ?? []).filter(
                (c) => c.id !== en.currentTeacherId
              )}
              onSubmit={handleChangeTeacher}
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

function NewEnrollmentForm({
  childId,
  subjects,
  existingSubjectIds,
  onPlanned,
}: {
  childId: string;
  subjects: AdminSubject[];
  existingSubjectIds: Set<string>;
  onPlanned: () => void;
}) {
  const [subjectId, setSubjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const available = subjects.filter((s) => !existingSubjectIds.has(s.subjectId));
  if (available.length === 0) return null;

  async function handlePlan() {
    if (!subjectId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const contractId = await getContractIdForChild(childId);
      if (!contractId) {
        setError("이 학생의 기본계약이 아직 없습니다. 계약을 먼저 생성해주세요.");
        return;
      }
      await planSubjectEnrollment({ childId, subjectId, contractId });
      setSubjectId("");
      onPlanned();
    } catch (e) {
      setError(e instanceof Error ? e.message : "과목 수강 생성 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <select
        value={subjectId}
        onChange={(e) => setSubjectId(e.target.value)}
        className="text-[12px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5"
      >
        <option value="">+ 새 과목 수강 계획...</option>
        {available.map((s) => (
          <option key={s.subjectId} value={s.subjectId}>
            {s.subjectName}
          </option>
        ))}
      </select>
      <button
        disabled={!subjectId || busy}
        onClick={handlePlan}
        className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 disabled:opacity-50"
      >
        수강 계획 생성
      </button>
      {error && <span className="text-[11.5px] text-red">{error}</span>}
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
