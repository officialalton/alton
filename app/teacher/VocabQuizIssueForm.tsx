"use client";

import { useState } from "react";
import type { LibraryBook } from "@/app/student/vocab-library-data";
import { assignVocabQuizAction } from "@/app/student/vocab-library-actions";

export type VocabStudentOption = { id: string; name: string };

/** 교사가 학생(들)에게 즉석으로 단어 시험을 발급하는 공통 폼 — 교사 포털(다중 학생 선택)과
 * 수업 화면(그 세션의 학생 하나로 고정) 양쪽에서 쓴다. */
export default function VocabQuizIssueForm({
  students, books, sessionId = null, fixedStudentId, onIssued,
}: {
  students: VocabStudentOption[];
  books: LibraryBook[];
  sessionId?: string | null;
  /** 수업 화면에서 호출할 때 — 학생 선택 UI 없이 이 학생으로 고정. */
  fixedStudentId?: string;
  onIssued?: () => void;
}) {
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set(fixedStudentId ? [fixedStudentId] : []));
  const [bookIds, setBookIds] = useState<Set<string>>(new Set());
  const [difficultyMin, setDifficultyMin] = useState(1);
  const [difficultyMax, setDifficultyMax] = useState(5);
  const [count, setCount] = useState(10);
  const [dueAt, setDueAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ studentId: string; ok: boolean; error?: string }[] | null>(null);

  function toggle(set: Set<string>, setSet: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSet(next);
  }

  async function issue() {
    setBusy(true);
    setResults(null);
    const targets = fixedStudentId ? [fixedStudentId] : [...selectedStudents];
    const outcomes = await Promise.all(
      targets.map(async (studentId) => {
        const r = await assignVocabQuizAction({
          sessionId, studentId, customWords: false, bookIds: [...bookIds], count,
          difficultyMin, difficultyMax, dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        });
        return { studentId, ok: r.ok, error: r.ok ? undefined : r.error };
      })
    );
    setBusy(false);
    setResults(outcomes);
    if (outcomes.some((o) => o.ok)) onIssued?.();
  }

  const nameOf = (id: string) => students.find((s) => s.id === id)?.name ?? id;
  const canSubmit = (fixedStudentId ? true : selectedStudents.size > 0) && bookIds.size > 0 && count > 0;

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3.5">
      <p className="text-[13px] font-bold text-ink mb-3">즉석 단어 시험 발급</p>

      {!fixedStudentId && (
        <div className="mb-3">
          <p className="text-[12px] font-bold text-grey-500 mb-1.5">학생 선택</p>
          <div className="flex flex-wrap gap-2">
            {students.map((s) => (
              <label key={s.id} className="text-[12.5px] flex items-center gap-1.5">
                <input type="checkbox" checked={selectedStudents.has(s.id)} onChange={() => toggle(selectedStudents, setSelectedStudents, s.id)} /> {s.name}
              </label>
            ))}
            {students.length === 0 && <p className="text-[12px] text-grey-400">담당 학생이 없습니다.</p>}
          </div>
        </div>
      )}

      <div className="mb-3">
        <p className="text-[12px] font-bold text-grey-500 mb-1.5">단어 범위(권)</p>
        <div className="flex flex-wrap gap-2">
          {books.map((b) => (
            <label key={b.id} className="text-[12.5px] flex items-center gap-1.5">
              <input type="checkbox" checked={bookIds.has(b.id)} onChange={() => toggle(bookIds, setBookIds, b.id)} /> {b.title}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-3">
        <label className="text-[12.5px] flex items-center gap-2">
          난이도
          <select value={difficultyMin} onChange={(e) => setDifficultyMin(Number(e.target.value))} className="border-[1.5px] border-grey-200 rounded-lg px-1.5 py-1">
            {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          ~
          <select value={difficultyMax} onChange={(e) => setDifficultyMax(Number(e.target.value))} className="border-[1.5px] border-grey-200 rounded-lg px-1.5 py-1">
            {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label className="text-[12.5px] flex items-center gap-2">
          문항 수
          <input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Number(e.target.value) || 10)} className="w-16 border-[1.5px] border-grey-200 rounded-lg px-2 py-1" />
        </label>
        <label className="text-[12.5px] flex items-center gap-2">
          마감(선택)
          <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1" />
        </label>
      </div>

      {results && (
        <div className="mb-3 space-y-1">
          {results.map((r) => (
            <p key={r.studentId} className={"text-[12px] " + (r.ok ? "text-green" : "text-red")}>
              {nameOf(r.studentId)} — {r.ok ? "발급 완료" : r.error}
            </p>
          ))}
        </div>
      )}

      <button
        disabled={!canSubmit || busy}
        onClick={() => void issue()}
        className="text-[12.5px] font-bold px-3.5 py-2 rounded-lg bg-ink text-white disabled:opacity-40"
      >
        {busy ? "발급 중…" : "시험 발급"}
      </button>
    </div>
  );
}
