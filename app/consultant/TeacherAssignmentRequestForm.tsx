"use client";

// R15-A(3/3) — 컨설턴트가 담당 학생(실제 계정 또는 가입 대기)에게 선생님
// 배정을 "요청"하는 구조화된 폼. 직접 배정(SubjectTeacherAssignForm, 관리자
// 전용)과 달리 여기서는 즉시 teacher_assignments가 생기지 않는다 — 선생님이
// 수락해야 확정된다(request_teacher_assignment/respond_teacher_assignment_request RPC).

import { useState } from "react";
import { requestTeacherAssignmentAction } from "./teacher-assignment-request-actions";
import type { AdminSubject } from "@/app/admin/subject-data";
import type { MatchingTeacherCandidate } from "@/app/admin/matching-data";

export default function TeacherAssignmentRequestForm({
  studentId,
  linkStudentId,
  studentName,
  defaultGrade,
  subjects,
  teacherCandidatesBySubject,
  onSent,
}: {
  studentId?: string;
  linkStudentId?: string;
  studentName: string;
  defaultGrade?: string;
  subjects: AdminSubject[];
  teacherCandidatesBySubject: Record<string, MatchingTeacherCandidate[]>;
  onSent?: () => void;
}) {
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [grade, setGrade] = useState(defaultGrade ?? "");
  const [currentScore, setCurrentScore] = useState("");
  const [goal, setGoal] = useState("");
  const [isNewStudent, setIsNewStudent] = useState(true);
  const [preferredSchedule, setPreferredSchedule] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (sent) {
    return <p className="text-[12.5px] text-green bg-green/5 rounded-lg px-3 py-2">Assignment request sent — waiting for the teacher to accept.</p>;
  }

  return (
    <div className="mb-3 border border-grey-200 rounded-lg p-3" data-testid="teacher-assignment-request-form">
      <div className="text-[11.5px] font-bold text-grey-500 mb-1.5">Teacher Assignment Request</div>
      {error && <p className="text-[12px] text-red mb-2">{error}</p>}
      {!subjectId ? (
        <div className="flex flex-wrap gap-1.5">
          {subjects.map((s) => (
            <button
              key={s.subjectId}
              className="text-[12px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5"
              onClick={() => setSubjectId(s.subjectId)}
            >
              {s.subjectName}
            </button>
          ))}
        </div>
      ) : !teacherId ? (
        <div>
          <div className="text-[11px] text-grey-500 mb-1.5">
            {subjects.find((s) => s.subjectId === subjectId)?.subjectName ?? subjectId} — Select a teacher
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(teacherCandidatesBySubject[subjectId] ?? []).map((t) => (
              <button
                key={t.id}
                className="text-[12px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5"
                onClick={() => setTeacherId(t.id)}
              >
                {t.name}
              </button>
            ))}
            {(teacherCandidatesBySubject[subjectId] ?? []).length === 0 && (
              <p className="text-[11.5px] text-grey-400">No teachers available for this subject.</p>
            )}
          </div>
          <button className="text-[11px] text-grey-500 underline mt-1.5" onClick={() => setSubjectId(null)}>
            Choose another subject
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="text-[12px] font-bold text-ink">
            {subjects.find((s) => s.subjectId === subjectId)?.subjectName} ·{" "}
            {teacherCandidatesBySubject[subjectId]?.find((t) => t.id === teacherId)?.name} — Send request
          </div>
          <input
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            placeholder="Grade"
            className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]"
          />
          <input
            value={currentScore}
            onChange={(e) => setCurrentScore(e.target.value)}
            placeholder="Current score (optional)"
            className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]"
          />
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Goal (optional)"
            className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]"
          />
          <label className="flex items-center gap-1.5 text-[12px]">
            <input type="checkbox" checked={isNewStudent} onChange={(e) => setIsNewStudent(e.target.checked)} />
            New student
          </label>
          <input
            value={preferredSchedule}
            onChange={(e) => setPreferredSchedule(e.target.value)}
            placeholder="Preferred schedule (optional)"
            className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]"
          />
          <textarea
            value={requestNote}
            onChange={(e) => setRequestNote(e.target.value)}
            placeholder="Notes (optional)"
            className="w-full border border-grey-200 rounded px-2 py-1.5 text-[12px]"
          />
          <div className="flex gap-2">
            <button
              className="text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await requestTeacherAssignmentAction({
                    studentId,
                    linkStudentId,
                    subjectId,
                    teacherId,
                    studentName,
                    grade: grade || undefined,
                    currentScore: currentScore || undefined,
                    goal: goal || undefined,
                    isNewStudent,
                    preferredSchedule: preferredSchedule || undefined,
                    requestNote: requestNote || undefined,
                  });
                  setSent(true);
                  onSent?.();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Couldn't send the request.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Sending..." : "Send request"}
            </button>
            <button className="text-[12px] font-semibold text-grey-500" disabled={busy} onClick={() => setTeacherId(null)}>
              Choose another teacher
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
