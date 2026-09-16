"use client";

import { useState } from "react";
import type { SessionVocabData } from "./vocab-data";
import { assignLibraryWordsToStudentAction, searchLibraryWordsAction } from "@/app/student/vocab-library-actions";
import VocabQuizIssueForm from "@/app/teacher/VocabQuizIssueForm";
import VocabLibraryTab from "@/app/student/VocabLibraryTab";

/** 2026-09-16(제품 오너 지적) — 단어 배정/즉석 시험 버튼이 서로 독립된 토글이라 둘 다 동시에
 * 열려 있을 수 있었다(버그) — 하나만 열리는 탭으로 바꾼다. 또한 단어 목록·시험 이력·응시
 * 화면은 임의로 다시 만들지 않고 학생 포털과 완전히 같은 VocabLibraryTab을 그대로 쓴다
 * (교사는 읽기 전용 — 개인 단어 직접 수정은 지원하지 않고, 배정·즉석 시험 발급은 위 전용
 * 도구로 한다). 이 수업에 연결된 일부만 보여주는 게 아니라 학생 단어장을 그대로 보여준다. */
export default function SessionVocabTab({
  studentId, studentName, isTeacher, canManage, data,
}: {
  studentId: string;
  studentName: string;
  isTeacher: boolean;
  canManage: boolean;
  data: SessionVocabData;
}) {
  const [myWords, setMyWords] = useState(data.myWords);
  const [tool, setTool] = useState<"assign" | "quiz" | null>(null);

  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">단어장</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        {isTeacher
          ? "학생 단어장을 그대로 보여줍니다. 여기서 바로 즉석 시험을 낼 수 있습니다."
          : "선생님이 배정했거나 직접 추가한 단어입니다."}
      </p>

      {isTeacher && canManage && (
        <>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setTool((v) => (v === "assign" ? null : "assign"))}
              className={"text-[12.5px] font-bold px-3.5 py-2 rounded-lg border-[1.5px] " + (tool === "assign" ? "border-ink bg-ink text-white" : "border-ink text-ink")}
            >
              단어 배정
            </button>
            <button
              onClick={() => setTool((v) => (v === "quiz" ? null : "quiz"))}
              className={"text-[12.5px] font-bold px-3.5 py-2 rounded-lg border-[1.5px] " + (tool === "quiz" ? "border-ink bg-ink text-white" : "border-grey-200 text-ink")}
            >
              즉석 시험(시험보기)
            </button>
          </div>

          {tool === "assign" && (
            <LibraryAssign
              studentId={studentId}
              onAssigned={(words) => { setMyWords((prev) => [...words, ...prev]); setTool(null); }}
            />
          )}

          {tool === "quiz" && (
            <div className="mb-5">
              <VocabQuizIssueForm
                students={[{ id: studentId, name: studentName }]} books={data.books} folders={data.folders}
                sessionId={null} fixedStudentId={studentId} onIssued={() => window.location.reload()}
              />
            </div>
          )}
        </>
      )}

      <VocabLibraryTab
        myWords={myWords}
        books={data.books}
        quizzes={data.quizzes}
        folders={data.folders}
        readOnly={isTeacher}
      />
    </div>
  );
}

function LibraryAssign({ studentId, onAssigned }: { studentId: string; onAssigned: (words: { id: string; word: string; definition: string | null; example: string | null; example2: string | null; synonymWords: string[] | null; antonymWords: string[] | null; createdAt: string; folderId: string | null }[]) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchLibraryWordsAction>>>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  async function search() {
    setResults(await searchLibraryWordsAction(query));
  }

  async function assign() {
    setBusy(true);
    const ok = await assignLibraryWordsToStudentAction(studentId, [...selected], null);
    setBusy(false);
    if (ok.ok) {
      const now = new Date().toISOString();
      onAssigned(
        results.filter((r) => selected.has(r.id)).map((r) => ({
          id: r.id, word: r.word, definition: r.definitionKo, example: null, example2: null, synonymWords: null, antonymWords: null, createdAt: now, folderId: null,
        }))
      );
    }
  }

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3.5 mb-5">
      <p className="text-[12.5px] font-bold text-grey-500 mb-2">공용 단어장에서 검색해 학생 단어장에 배정</p>
      <div className="flex gap-2 mb-3">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="영단어 검색" className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[13px] flex-1" />
        <button onClick={() => void search()} className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white">검색</button>
      </div>
      {results.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-3 max-h-[220px] overflow-y-auto">
          {results.map((r) => (
            <label key={r.id} className="text-[12.5px] flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.has(r.id)}
                onChange={() => setSelected((prev) => { const next = new Set(prev); if (next.has(r.id)) next.delete(r.id); else next.add(r.id); return next; })}
              />
              <span className="font-bold text-ink">{r.word}</span>
              <span className="text-grey-500">{r.definitionKo}</span>
              <span className="text-[10.5px] text-grey-400 ml-auto">{r.bookTitle}</span>
            </label>
          ))}
        </div>
      )}
      <button disabled={selected.size === 0 || busy} onClick={() => void assign()} className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-green text-white disabled:opacity-40">
        {busy ? "배정 중…" : `${selected.size}개 배정`}
      </button>
    </div>
  );
}
