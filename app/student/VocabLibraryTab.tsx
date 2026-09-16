"use client";

import { useMemo, useState } from "react";
import type { MyVocabWord, LibraryBook, LibraryWord, VocabQuiz, VocabQuizItem } from "./vocab-library-data";
import {
  addMyVocabWordAction, updateMyVocabWordAction, deleteMyVocabWordAction,
  createVocabQuizAction, submitVocabQuizAction,
} from "./vocab-library-actions";

type SourceKey = "custom" | `book:${string}`;

export default function VocabLibraryTab({
  myWords: initialMyWords, books, quizzes: initialQuizzes,
}: {
  myWords: MyVocabWord[]; books: LibraryBook[]; quizzes: VocabQuiz[];
}) {
  const [tab, setTab] = useState<"words" | "quiz">("words");
  return (
    <div className="max-w-[720px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">단어장</h1>
      <div className="flex gap-1 border-b border-grey-200 mb-5">
        {([["words", "단어장"], ["quiz", "시험"]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={"text-[13px] font-bold px-3.5 py-2 -mb-px border-b-2 " + (tab === id ? "border-ink text-ink" : "border-transparent text-grey-500")}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "words" ? <WordsPanel initialMyWords={initialMyWords} books={books} /> : <QuizPanel books={books} initialQuizzes={initialQuizzes} />}
    </div>
  );
}

function WordsPanel({ initialMyWords, books }: { initialMyWords: MyVocabWord[]; books: LibraryBook[] }) {
  const [myWords, setMyWords] = useState(initialMyWords);
  const [selected, setSelected] = useState<"custom" | string>("custom");
  const [showKorean, setShowKorean] = useState(false);
  const [hideMode, setHideMode] = useState<"none" | "definition" | "word">("none");
  const [libWords, setLibWords] = useState<Record<string, LibraryWord[]>>({});
  const [loadingBook, setLoadingBook] = useState(false);
  const [adding, setAdding] = useState(false);

  async function openBook(bookId: string) {
    setSelected(bookId);
    if (libWords[bookId]) return;
    setLoadingBook(true);
    const { loadLibraryBookWordsAction } = await import("./vocab-library-client-data");
    const words = await loadLibraryBookWordsAction(bookId);
    setLibWords((prev) => ({ ...prev, [bookId]: words }));
    setLoadingBook(false);
  }

  const currentWords = selected === "custom" ? null : libWords[selected];

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setSelected("custom")}
          className={"text-[12.5px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] " + (selected === "custom" ? "border-ink bg-ink text-white" : "border-grey-200 text-ink")}
        >
          내 단어장 ({myWords.length})
        </button>
        {books.map((b) => (
          <button
            key={b.id}
            onClick={() => void openBook(b.id)}
            className={"text-[12.5px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] " + (selected === b.id ? "border-ink bg-ink text-white" : "border-grey-200 text-ink")}
          >
            {b.title} ({b.wordCount})
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button onClick={() => setShowKorean((v) => !v)} className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink">
          {showKorean ? "한글 뜻 숨기기" : "한글 뜻 보기"}
        </button>
        <button
          onClick={() => setHideMode((m) => (m === "definition" ? "none" : "definition"))}
          className={"text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] " + (hideMode === "definition" ? "border-ink bg-ink text-white" : "border-grey-200 text-ink")}
        >
          뜻 가리기
        </button>
        <button
          onClick={() => setHideMode((m) => (m === "word" ? "none" : "word"))}
          className={"text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] " + (hideMode === "word" ? "border-ink bg-ink text-white" : "border-grey-200 text-ink")}
        >
          단어 가리기
        </button>
        {selected === "custom" && (
          <button onClick={() => setAdding(true)} className="ml-auto text-[12px] font-bold px-3 py-1.5 rounded-lg bg-green text-white">
            + 단어 추가
          </button>
        )}
      </div>

      {adding && (
        <AddWordForm
          onCancel={() => setAdding(false)}
          onAdded={(w) => { setMyWords((prev) => [w, ...prev]); setAdding(false); }}
        />
      )}

      {selected === "custom" ? (
        myWords.length === 0 ? (
          <Empty text="아직 추가한 단어가 없어요. '+ 단어 추가'를 눌러보세요." />
        ) : (
          myWords.map((w) => (
            <WordCard
              key={w.id} word={w.word} definition={w.definition} example={w.example} example2={w.example2}
              synonymWords={w.synonymWords} antonymWords={w.antonymWords}
              showKorean={showKorean} hideMode={hideMode} editable
              onEdit={(patch) => { void updateMyVocabWordAction(w.id, patch); setMyWords((prev) => prev.map((x) => (x.id === w.id ? { ...x, definition: patch.definition ?? x.definition, example: patch.example ?? x.example } : x))); }}
              onDelete={() => { void deleteMyVocabWordAction(w.id); setMyWords((prev) => prev.filter((x) => x.id !== w.id)); }}
            />
          ))
        )
      ) : loadingBook && !currentWords ? (
        <p className="text-[13px] text-grey-500">불러오는 중…</p>
      ) : !currentWords?.length ? (
        <Empty text="이 권에는 아직 등록된 단어가 없어요." />
      ) : (
        currentWords.map((w) => (
          <WordCard
            key={w.id} word={w.word} definition={w.definitionKo} example={w.example1} example2={w.example2}
            synonymWords={w.synonymWords} antonymWords={w.antonymWords} showKorean={showKorean} hideMode={hideMode}
          />
        ))
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">{text}</div>;
}

function WordCard({
  word, definition, example, example2, synonymWords, antonymWords, showKorean, hideMode, editable, onEdit, onDelete,
}: {
  word: string; definition: string | null; example: string | null; example2: string | null;
  synonymWords: string[] | null; antonymWords: string[] | null;
  showKorean: boolean; hideMode: "none" | "definition" | "word";
  editable?: boolean;
  onEdit?: (patch: { definition?: string; example?: string }) => void;
  onDelete?: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const wordHidden = hideMode === "word" && !revealed;
  const defHidden = hideMode === "definition" && !revealed;
  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
      <div className="flex items-center justify-between">
        <h3
          className={"text-[16px] font-bold text-ink " + (wordHidden ? "blur-sm select-none cursor-pointer" : "")}
          onClick={() => wordHidden && setRevealed(true)}
        >
          {wordHidden ? "●●●●●" : word}
        </h3>
        {editable && onDelete && (
          <button onClick={onDelete} className="text-[12px] font-semibold text-red">삭제</button>
        )}
      </div>
      {showKorean && (
        <p
          className={"text-[13.5px] text-ink mt-1.5 " + (defHidden ? "blur-sm select-none cursor-pointer" : "")}
          onClick={() => defHidden && setRevealed(true)}
        >
          {defHidden ? "가려짐 (클릭해서 보기)" : definition || "(뜻 없음)"}
        </p>
      )}
      {(example || example2) && (
        <div className="text-[12.5px] text-grey-500 mt-2 space-y-0.5">
          {example && <p>· {example}</p>}
          {example2 && <p>· {example2}</p>}
        </div>
      )}
      <div className="flex flex-wrap gap-3 mt-2.5">
        {synonymWords?.length ? (
          <div className="flex flex-wrap gap-1 items-center">
            <span className="text-[10.5px] font-bold text-grey-300 uppercase">유사어</span>
            {synonymWords.map((s) => <span key={s} className="text-[10.5px] font-bold px-2 py-0.5 rounded-lg bg-grey-100 text-grey-500">{s}</span>)}
          </div>
        ) : null}
        {antonymWords?.length ? (
          <div className="flex flex-wrap gap-1 items-center">
            <span className="text-[10.5px] font-bold text-grey-300 uppercase">반의어</span>
            {antonymWords.map((s) => <span key={s} className="text-[10.5px] font-bold px-2 py-0.5 rounded-lg bg-red-bg text-red">{s}</span>)}
          </div>
        ) : null}
      </div>
      {editable && onEdit && (
        <details className="mt-2.5 text-[12px]">
          <summary className="cursor-pointer text-grey-500">고치기</summary>
          <div className="flex flex-col gap-1.5 mt-1.5">
            <textarea defaultValue={definition ?? ""} placeholder="뜻" onBlur={(e) => onEdit({ definition: e.target.value })} className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[12.5px]" />
            <textarea defaultValue={example ?? ""} placeholder="예문 1" onBlur={(e) => onEdit({ example: e.target.value })} className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[12.5px]" />
          </div>
        </details>
      )}
    </div>
  );
}

function AddWordForm({ onCancel, onAdded }: { onCancel: () => void; onAdded: (w: MyVocabWord) => void }) {
  const [word, setWord] = useState("");
  const [definition, setDefinition] = useState("");
  const [example, setExample] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    if (!word.trim()) { setError("단어를 입력하세요."); return; }
    setBusy(true);
    const r = await addMyVocabWordAction({ word, definition, example });
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    onAdded({ id: r.value, word: word.trim(), definition: definition.trim() || null, example: example.trim() || null, example2: null, synonymWords: null, antonymWords: null, createdAt: new Date().toISOString() });
  }
  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3.5 mb-4">
      <div className="flex flex-col gap-2">
        <input value={word} onChange={(e) => setWord(e.target.value)} placeholder="단어" className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[13px]" />
        <input value={definition} onChange={(e) => setDefinition(e.target.value)} placeholder="뜻(선택)" className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[13px]" />
        <input value={example} onChange={(e) => setExample(e.target.value)} placeholder="예문(선택)" className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[13px]" />
        {error && <p className="text-[12px] text-red">{error}</p>}
        <div className="flex gap-2">
          <button disabled={busy} onClick={() => void submit()} className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50">추가</button>
          <button onClick={onCancel} className="text-[12px] font-semibold text-grey-500">취소</button>
        </div>
      </div>
    </div>
  );
}

function QuizPanel({ books, initialQuizzes }: { books: LibraryBook[]; initialQuizzes: VocabQuiz[] }) {
  const [quizzes, setQuizzes] = useState(initialQuizzes);
  const [creating, setCreating] = useState(false);
  const [sources, setSources] = useState<Set<SourceKey>>(new Set(["custom"]));
  const [count, setCount] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<VocabQuiz | null>(null);

  function toggleSource(key: SourceKey) {
    setSources((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  }

  async function makeQuiz() {
    setError(null);
    const bookIds = [...sources].filter((s) => s.startsWith("book:")).map((s) => s.slice(5));
    const r = await createVocabQuizAction({ customWords: sources.has("custom"), bookIds, count });
    if (!r.ok) { setError(r.error); return; }
    const quiz: VocabQuiz = { id: r.value.id, status: "pending", wordCount: r.value.items.length, items: r.value.items, score: null, total: null, answers: null, createdAt: new Date().toISOString(), assignedByTeacher: false };
    setQuizzes((prev) => [quiz, ...prev]);
    setCreating(false);
    setActive(quiz);
  }

  if (active) return <QuizRunner quiz={active} onDone={(updated) => { setQuizzes((prev) => prev.map((q) => (q.id === updated.id ? updated : q))); setActive(null); }} onExit={() => setActive(null)} />;

  return (
    <div>
      {!creating ? (
        <button onClick={() => setCreating(true)} className="text-[12.5px] font-bold px-3.5 py-2 rounded-lg bg-ink text-white mb-4">시험 만들기</button>
      ) : (
        <div className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3.5 mb-4">
          <p className="text-[12px] font-bold text-grey-500 mb-2">시험 볼 단어장 선택</p>
          <div className="flex flex-wrap gap-2 mb-3">
            <label className="text-[12.5px] flex items-center gap-1.5">
              <input type="checkbox" checked={sources.has("custom")} onChange={() => toggleSource("custom")} /> 내 단어장
            </label>
            {books.map((b) => (
              <label key={b.id} className="text-[12.5px] flex items-center gap-1.5">
                <input type="checkbox" checked={sources.has(`book:${b.id}`)} onChange={() => toggleSource(`book:${b.id}`)} /> {b.title}
              </label>
            ))}
          </div>
          <label className="text-[12.5px] flex items-center gap-2 mb-3">
            문항 수
            <input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Number(e.target.value) || 10)} className="w-16 border-[1.5px] border-grey-200 rounded-lg px-2 py-1" />
          </label>
          {error && <p className="text-[12px] text-red mb-2">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => void makeQuiz()} className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white">만들기</button>
            <button onClick={() => setCreating(false)} className="text-[12px] font-semibold text-grey-500">취소</button>
          </div>
        </div>
      )}

      <p className="text-[12px] font-bold text-grey-500 mb-2">이력</p>
      {quizzes.length === 0 ? (
        <Empty text="아직 본 시험이 없어요." />
      ) : (
        quizzes.map((q) => (
          <div key={q.id} className="border border-grey-200 rounded-xl px-4 py-3 mb-2 flex items-center justify-between">
            <span className="text-[13px] text-ink">
              {q.wordCount}문항 {q.assignedByTeacher && <span className="text-[11px] text-grey-500">(선생님이 냄)</span>}
            </span>
            {q.status === "completed" ? (
              <span className="text-[12.5px] font-bold text-ink">{q.score}/{q.total}점</span>
            ) : (
              <button onClick={() => setActive(q)} className="text-[12px] font-bold text-green">응시하기</button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function QuizRunner({ quiz, onDone, onExit }: { quiz: VocabQuiz; onDone: (q: VocabQuiz) => void; onExit: () => void }) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => quiz.items.map(() => null));
  const [i, setI] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const item: VocabQuizItem | undefined = quiz.items[i];
  const allAnswered = useMemo(() => answers.every((a) => a !== null), [answers]);

  async function submit() {
    setSubmitting(true);
    const r = await submitVocabQuizAction(quiz.id, answers.map((a) => a ?? -1));
    setSubmitting(false);
    if (r.ok) onDone({ ...quiz, status: "completed", score: r.value.score, total: r.value.total, answers: answers.map((a) => a ?? -1) });
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
