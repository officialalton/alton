"use client";

import { useState } from "react";
import { confirmMatch } from "./matching-actions";
import type { MatchingTeacherCandidate } from "./matching-data";
import type { StudentListItem } from "./users-data";
import type { AdminSubject } from "./subject-data";

export default function MatchingTab({
  students,
  subjects,
  teacherCandidatesBySubject,
}: {
  students: StudentListItem[];
  subjects: AdminSubject[];
  teacherCandidatesBySubject: Record<string, MatchingTeacherCandidate[]>;
}) {
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [openStudentId, setOpenStudentId] = useState<string | null>(null);

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
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">매칭</h1>
      <p className="text-[13px] text-grey-500 mb-5">
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
  student: StudentListItem;
  subjects: AdminSubject[];
  teacherCandidatesBySubject: Record<string, MatchingTeacherCandidate[]>;
  onBack: () => void;
  onMatched: () => void;
}) {
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [totalSessions, setTotalSessions] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidates = subjectId ? teacherCandidatesBySubject[subjectId] ?? [] : [];
  const sessionsNumber = Number(totalSessions);
  const canSubmit =
    !!subjectId && !!teacherId && Number.isFinite(sessionsNumber) && sessionsNumber >= 1;

  async function handleConfirm() {
    if (!subjectId || !teacherId || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await confirmMatch(student.id, teacherId, subjectId, sessionsNumber);
      onMatched();
    } catch (e) {
      setError(e instanceof Error ? e.message : "매칭에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
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
          {subjects.map((s) => (
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

      <div className="mb-4">
        <label className="text-[12.5px] font-bold text-ink mb-1.5 block">총 회차 수</label>
        <input
          type="number"
          min={1}
          value={totalSessions}
          onChange={(e) => setTotalSessions(e.target.value)}
          placeholder="예: 20"
          className="w-full px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
        />
      </div>

      {error && <p className="text-[13px] text-red mb-4">{error}</p>}

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
