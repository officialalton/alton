"use client";

import { useState } from "react";
import { removeVocabWord } from "./vocab-actions";
import type { SessionVocabData } from "./vocab-data";
import type { LibraryWord } from "@/app/student/vocab-library-data";
import { assignLibraryWordsToStudentAction, searchLibraryWordsAction, submitVocabQuizAction } from "@/app/student/vocab-library-actions";
import { loadLibraryBookWordsAction } from "@/app/student/vocab-library-client-data";
import VocabQuizIssueForm from "@/app/teacher/VocabQuizIssueForm";

/** 2026-09-15(제품 오너 정정) — 수업 화면 단어장 탭. 이 수업에 연결된 일부만 보여주는 게
 * 아니라 학생 단어장을 그대로 보여준다(따로 복제·저장하지 않고 그대로 참조). 교사는 여기서
 * 바로 "즉석 시험"으로 시험보기를 선택할 수 있다. */
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
  const [quizzes, setQuizzes] = useState(data.quizzes);
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [libWords, setLibWords] = useState<Record<string, LibraryWord[]>>({});
  const [showAssign, setShowAssign] = useState(false);
  const [showQuizForm, setShowQuizForm] = useState(false);
  const [active, setActive] = useState<(typeof quizzes)[number] | null>(null);

  async function handleRemove(id: string) {
    setMyWords((prev) => prev.filter((w) => w.id !== id));
    await removeVocabWord(id);
  }

  async function openBook(bookId: string) {
    setSelectedBook(bookId);
    if (libWords[bookId]) return;
    const words = await loadLibraryBookWordsAction(bookId);
    setLibWords((prev) => ({ ...prev, [bookId]: words }));
  }

  if (active) {
    return (
      <div className="max-w-[640px] px-8 py-8">
        <QuizRunnerInline
          quiz={active}
          onDone={(updated) => { setQuizzes((prev) => prev.map((q) => (q.id === updated.id ? updated : q))); setActive(null); }}
          onExit={() => setActive(null)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">
        {isTeacher ? `${studentName} 학생의 단어장` : "단어장"}
      </h1>
      <p className="text-[13px] text-grey-500 mb-5">
        {isTeacher
          ? "학생 단어장을 그대로 보여줍니다. 여기서 바로 즉석 시험을 낼 수 있습니다."
          : "선생님이 배정했거나 직접 추가한 단어입니다."}
      </p>

      {isTeacher && canManage && (
        <div className="flex gap-2 mb-5">
          <button onClick={() => setShowAssign((v) => !v)} className="text-[12.5px] font-bold px-3.5 py-2 rounded-lg border-[1.5px] border-ink text-ink">
            단어 배정
          </button>
          <button onClick={() => setShowQuizForm((v) => !v)} className="text-[12.5px] font-bold px-3.5 py-2 rounded-lg bg-ink text-white">
            즉석 시험(시험보기)
          </button>
        </div>
      )}

      {showAssign && (
        <LibraryAssign
          studentId={studentId}
          onAssigned={(words) => { setMyWords((prev) => [...words, ...prev]); setShowAssign(false); }}
        />
      )}

      {showQuizForm && (
        <div className="mb-5">
          <VocabQuizIssueForm students={[{ id: studentId, name: studentName }]} books={data.books} sessionId={null} fixedStudentId={studentId} onIssued={() => window.location.reload()} />
        </div>
      )}

      {quizzes.length > 0 && (
        <div className="mb-5">
          <p className="text-[12px] font-bold text-grey-500 mb-2">시험 이력</p>
          {quizzes.map((q) => (
            <div key={q.id} className="border border-grey-200 rounded-xl px-4 py-3 mb-2 flex items-center justify-between">
              <span className="text-[13px] text-ink">{q.wordCount}문항</span>
              {q.status === "completed" ? (
                <span className="text-[12.5px] font-bold text-ink">{q.score}/{q.total}점</span>
              ) : !isTeacher ? (
                <button onClick={() => setActive(q)} className="text-[12px] font-bold text-green">응시하기</button>
              ) : (
                <span className="text-[12px] text-grey-500">응시 대기</span>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-[12px] font-bold text-grey-500 mb-2">내 단어장 ({myWords.length})</p>
      {myWords.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center mb-6">
          아직 저장한 단어가 없습니다.
        </div>
      ) : (
        myWords.map((v) => (
          <div key={v.id} className="border border-grey-200 rounded-xl px-4 py-3.5 mb-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-ink">{v.word}</h3>
              {!isTeacher && canManage && (
                <button onClick={() => handleRemove(v.id)} className="text-[12px] font-semibold text-red">삭제</button>
              )}
            </div>
            <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mt-2.5">뜻</div>
            <div className="text-[13px] text-ink">{v.definition}</div>
            {(v.example || v.example2) && (
              <div className="text-[12.5px] text-grey-500 mt-2 space-y-0.5">
                {v.example && <p>· {v.example}</p>}
                {v.example2 && <p>· {v.example2}</p>}
              </div>
            )}
          </div>
        ))
      )}

      {data.books.length > 0 && (
        <>
          <p className="text-[12px] font-bold text-grey-500 mb-2 mt-6">ALTON SAT 공용 단어장</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {data.books.map((b) => (
              <button
                key={b.id}
                onClick={() => void openBook(b.id)}
                className={"text-[12.5px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] " + (selectedBook === b.id ? "border-ink bg-ink text-white" : "border-grey-200 text-ink")}
              >
                {b.title} ({b.wordCount})
              </button>
            ))}
          </div>
          {selectedBook && (
            (libWords[selectedBook] ?? []).map((w) => (
              <div key={w.id} className="border border-grey-200 rounded-xl px-4 py-3.5 mb-3">
                <h3 className="text-[15px] font-bold text-ink">{w.word}</h3>
                <div className="text-[13px] text-ink mt-1">{w.definitionKo}</div>
                {(w.example1 || w.example2) && (
                  <div className="text-[12.5px] text-grey-500 mt-2 space-y-0.5">
                    {w.example1 && <p>· {w.example1}</p>}
                    {w.example2 && <p>· {w.example2}</p>}
                  </div>
                )}
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}

function LibraryAssign({ studentId, onAssigned }: { studentId: string; onAssigned: (words: { id: string; word: string; definition: string | null; example: string | null; example2: string | null; synonymWords: string[] | null; antonymWords: string[] | null; createdAt: string }[]) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchLibraryWordsAction>>>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  async function search() {
    setResults(await searchLibraryWordsAction(query));
  }

  async function assign() {
    setBusy(true);
    const ok = await assignLibraryWordsToStudentAction(studentId, [...selected]);
    setBusy(false);
    if (ok.ok) {
      const now = new Date().toISOString();
      onAssigned(
        results.filter((r) => selected.has(r.id)).map((r) => ({
          id: r.id, word: r.word, definition: r.definitionKo, example: null, example2: null, synonymWords: null, antonymWords: null, createdAt: now,
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

type SessionQuiz = SessionVocabData["quizzes"][number];

function QuizRunnerInline({ quiz, onDone, onExit }: { quiz: SessionQuiz; onDone: (q: SessionQuiz) => void; onExit: () => void }) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => quiz.items.map(() => null));
  const [i, setI] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const item = quiz.items[i];
  const allAnswered = answers.every((a) => a !== null);

  async function submit() {
    setSubmitting(true);
    const finalAnswers = answers.map((a) => a ?? -1);
    const r = await submitVocabQuizAction(quiz.id, finalAnswers);
    setSubmitting(false);
    if (r.ok) onDone({ ...quiz, status: "completed", score: r.value.score, total: r.value.total, answers: finalAnswers });
  }

  if (!item) return null;
  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[12px] font-bold text-grey-500">{i + 1} / {quiz.items.length}</span>
        <button onClick={onExit} className="text-[12px] text-grey-500">나가기</button>
      </div>
      <h3 className="text-[18px] font-extrabold text-ink mb-4">{item.definitionShown}</h3>
      <div className="flex flex-col gap-2 mb-4">
        {item.options.map((opt, idx) => (
          <button
            key={idx}
            onClick={() => setAnswers((prev) => prev.map((a, j) => (j === i ? idx : a)))}
            className={"text-left text-[13.5px] px-3.5 py-2.5 rounded-[10px] border-[1.5px] " + (answers[i] === idx ? "border-ink bg-grey-100" : "border-grey-200")}
          >
            {opt}
          </button>
        ))}
      </div>
      <div className="flex justify-between">
        <button disabled={i === 0} onClick={() => setI((v) => v - 1)} className="text-[12px] font-semibold text-grey-500 disabled:opacity-30">이전</button>
        {i < quiz.items.length - 1 ? (
          <button onClick={() => setI((v) => v + 1)} className="text-[12px] font-bold text-ink">다음</button>
        ) : (
          <button disabled={!allAnswered || submitting} onClick={() => void submit()} className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-green text-white disabled:opacity-50">제출</button>
        )}
      </div>
    </div>
  );
}
