"use client";

import { useState } from "react";
import { assignMockExamAction, finalizeMockExamGradingAction } from "@/lib/mock-exam/attempt-actions";
import type { TeacherMockExamStudent } from "./mock-exam-assign-data";
import type { MockExamAttemptSummary } from "@/lib/mock-exam/attempt-data";

const STATUS_LABEL: Record<string, string> = {
  assigned: "시작 전",
  in_progress: "진행 중",
  submitted: "제출됨 — 채점 대기",
  graded: "채점 완료",
};

/** 교사 흐름 — 담당 학생에게 공개된 시험 세트를 배정하고, 제출된 응시를 채점 확정한다
 * (사양 3절 교사 흐름 1~4). 수업 화면 `모의고사` 탭 배선은 이번 패스 범위 밖(SessionShell 은
 * 다른 브랜치가 동시에 작업 중이라 표면적을 최소화) — 우선 학생 단위 독립 화면으로 제공한다. */
export default function MockExamAssignPanel({
  students,
  examSets,
  attemptsByStudent,
  onChanged,
}: {
  students: TeacherMockExamStudent[];
  examSets: { id: string; name: string; difficultyTier: string }[];
  attemptsByStudent: Record<string, MockExamAttemptSummary[]>;
  /** 배정·채점 확정이 성공한 뒤 호출 — 탭 안에서 쓸 때 목록을 다시 읽는다. */
  onChanged?: () => void;
}) {
  const [selectedStudent, setSelectedStudent] = useState(students[0]?.studentId ?? "");
  const [selectedSet, setSelectedSet] = useState(examSets[0]?.id ?? "");
  const [dueAt, setDueAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function assign() {
    if (!selectedStudent || !selectedSet) return;
    setBusy(true);
    setMessage(null);
    const result = await assignMockExamAction({ studentId: selectedStudent, examSetId: selectedSet, dueAt: dueAt || null });
    setBusy(false);
    setMessage(result.ok ? "배정했습니다." : result.error);
    if (result.ok) onChanged?.();
  }

  async function finalize(attemptId: string) {
    setBusy(true);
    const result = await finalizeMockExamGradingAction(attemptId);
    setBusy(false);
    setMessage(result.ok ? "채점을 확정했습니다." : result.error);
    if (result.ok) onChanged?.();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-grey-200 bg-white p-4">
        <h3 className="mb-3 text-[13.5px] font-bold">모의고사 배정</h3>
        <div className="flex flex-wrap gap-2">
          <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)} className="rounded border border-grey-300 px-2 py-1.5 text-[13px]">
            {students.map((s) => (
              <option key={s.studentId} value={s.studentId}>
                {s.studentName ?? s.studentId}
              </option>
            ))}
          </select>
          <select value={selectedSet} onChange={(e) => setSelectedSet(e.target.value)} className="rounded border border-grey-300 px-2 py-1.5 text-[13px]">
            {examSets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.difficultyTier})
              </option>
            ))}
          </select>
          <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="rounded border border-grey-300 px-2 py-1.5 text-[13px]" />
          <button type="button" disabled={busy || !selectedStudent || !selectedSet} onClick={assign} className="rounded bg-ink px-4 py-1.5 text-[13px] font-bold text-white disabled:opacity-50">
            배정
          </button>
        </div>
        {message && <p className="mt-2 text-[12.5px] text-grey-600">{message}</p>}
      </div>

      <div className="rounded-lg border border-grey-200 bg-white p-4">
        <h3 className="mb-3 text-[13.5px] font-bold">배정 현황</h3>
        {students.map((s) => {
          const attempts = attemptsByStudent[s.studentId] ?? [];
          if (attempts.length === 0) return null;
          return (
            <div key={s.studentId} className="mb-3">
              <p className="mb-1 text-[12.5px] font-bold text-grey-500">{s.studentName ?? s.studentId}</p>
              <ul className="flex flex-col gap-1">
                {attempts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between text-[13px]">
                    <span>
                      {a.examSetName} — {STATUS_LABEL[a.status] ?? a.status}
                      {a.status === "graded" && a.correctCount !== null && ` (${a.correctCount}/${a.totalCount})`}
                    </span>
                    {a.status === "submitted" && (
                      <button type="button" disabled={busy} onClick={() => finalize(a.id)} className="rounded bg-green px-3 py-1 text-[12px] font-bold text-white">
                        채점 확정
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
