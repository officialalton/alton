"use client";

import { useMemo, useState } from "react";
import UnderlineSubTabs from "@/app/components/UnderlineSubTabs";
import type { MyVocabWord, LibraryBook, LibraryWord, VocabQuiz, VocabQuizItem, VocabFolder } from "./vocab-library-data";
import {
  addMyVocabWordAction, deleteMyVocabWordAction,
  createVocabQuizAction, submitVocabQuizAction, createVocabFolderAction,
  setMyVocabWordFolderAction, toggleLibraryWordInMyVocabAction,
  saveVocabQuizProgressAction, retakeVocabQuizAction,
} from "./vocab-library-actions";

type SourceKey = "custom" | `book:${string}`;
const ALPHA_RANGES: [string, string][] = [["A", "C"], ["D", "F"], ["G", "I"], ["J", "L"], ["M", "O"], ["P", "R"], ["S", "U"], ["V", "Z"]];
const PAGE_SIZES = [10, 20] as const;

export default function VocabLibraryTab({
  myWords: initialMyWords, books, quizzes: initialQuizzes, folders: initialFolders, readOnly,
}: {
  myWords: MyVocabWord[]; books: LibraryBook[]; quizzes: VocabQuiz[]; folders: VocabFolder[];
  /** 보호자 등 읽기 전용 뷰어 — 단어 CRUD·폴더 생성·시험 만들기/응시 버튼이 전부 숨는다. */
  readOnly?: boolean;
}) {
  const [tab, setTab] = useState<"words" | "quiz">("words");
  const [myWords, setMyWords] = useState(initialMyWords);
  const [folders, setFolders] = useState(initialFolders);
  return (
    <div className="max-w-[760px]">
      <UnderlineSubTabs
        className="mb-5"
        items={[
          { id: "words", label: "단어장" },
          { id: "quiz", label: "시험" },
        ]}
        activeId={tab}
        onSelect={setTab}
      />
      {tab === "words" ? (
        <WordsPanel myWords={myWords} setMyWords={setMyWords} folders={folders} setFolders={setFolders} books={books} readOnly={readOnly} />
      ) : (
        <QuizPanel books={books} folders={folders} initialQuizzes={initialQuizzes} readOnly={readOnly} />
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">{text}</div>;
}

// --- 내 단어장 + 공용 단어장 화면 ---

type DisplayWord = {
  key: string;
  word: string;
  definitionEn: string;
  definitionKo: string | null;
  example1: string | null;
  example2: string | null;
  synonymWords: string[] | null;
  antonymWords: string[] | null;
  myWordId: string | null;
  libraryWordId: string | null;
  folderId: string | null;
};

function englishGloss(synonymWords: string[] | null): string {
  return synonymWords && synonymWords.length ? synonymWords.join(", ") : "(영어 뜻 없음)";
}

function WordsPanel({
  myWords, setMyWords, folders, setFolders, books, readOnly,
}: {
  myWords: MyVocabWord[]; setMyWords: (fn: (prev: MyVocabWord[]) => MyVocabWord[]) => void;
  folders: VocabFolder[]; setFolders: (fn: (prev: VocabFolder[]) => VocabFolder[]) => void;
  books: LibraryBook[];
  readOnly?: boolean;
}) {
  const [selected, setSelected] = useState<"custom" | string>("custom");
  const [folderFilter, setFolderFilter] = useState<"all" | string>("all");
  const [showKorean, setShowKorean] = useState(false);
  const [hideMode, setHideMode] = useState<"none" | "definition" | "word">("none");
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [libWords, setLibWords] = useState<Record<string, LibraryWord[]>>({});
  const [loadingBook, setLoadingBook] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addingFolder, setAddingFolder] = useState(false);
  const [alphaRange, setAlphaRange] = useState<[string, string] | null>(null);
  const [randomOrder, setRandomOrder] = useState(false);
  const [shuffleOrderKeys, setShuffleOrderKeys] = useState<string[] | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(10);

  async function openBook(bookId: string) {
    setSelected(bookId);
    setPage(0);
    if (libWords[bookId]) return;
    setLoadingBook(true);
    const { loadLibraryBookWordsAction } = await import("./vocab-library-client-data");
    const words = await loadLibraryBookWordsAction(bookId);
    setLibWords((prev) => ({ ...prev, [bookId]: words }));
    setLoadingBook(false);
  }

  const myWordByLowerWord = useMemo(() => new Map(myWords.map((w) => [w.word.toLowerCase(), w])), [myWords]);

  const allDisplay: DisplayWord[] = useMemo(() => {
    if (selected === "custom") {
      const filtered = folderFilter === "all" ? myWords : myWords.filter((w) => w.folderId === folderFilter);
      return filtered.map((w) => ({
        key: w.id, word: w.word, definitionEn: englishGloss(w.synonymWords), definitionKo: w.definition,
        example1: w.example, example2: w.example2, synonymWords: w.synonymWords, antonymWords: w.antonymWords,
        myWordId: w.id, libraryWordId: null, folderId: w.folderId,
      }));
    }
    const words = libWords[selected] ?? [];
    return words.map((w) => {
      const mine = myWordByLowerWord.get(w.word.toLowerCase());
      return {
        key: w.id, word: w.word, definitionEn: englishGloss(w.synonymWords), definitionKo: w.definitionKo,
        example1: w.example1, example2: w.example2, synonymWords: w.synonymWords, antonymWords: w.antonymWords,
        myWordId: mine?.id ?? null, libraryWordId: w.id, folderId: mine?.folderId ?? null,
      };
    });
  }, [selected, folderFilter, myWords, libWords, myWordByLowerWord]);

  const alphaFiltered = useMemo(() => {
    if (!alphaRange) return allDisplay;
    const [from, to] = alphaRange;
    return allDisplay.filter((w) => {
      const c = w.word[0]?.toUpperCase() ?? "";
      return c >= from && c <= to;
    });
  }, [allDisplay, alphaRange]);

  // 순서를 렌더 중에 매번 새로 섞으면(useMemo 안에서 Math.random) 렌더가 불순해진다 — "다시 섞기"를
  // 누를 때만 순서(키 배열)를 계산해 상태로 남기고, 화면에 보일 목록은 그 순서를 그대로 따르는
  // 순수한 매핑만 한다(필터가 바뀌어 빠진 키는 자동으로 걸러진다).
  function reshuffle() {
    const keys = alphaFiltered.map((w) => w.key);
    for (let i = keys.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [keys[i], keys[j]] = [keys[j], keys[i]];
    }
    setShuffleOrderKeys(keys);
  }

  const ordered = useMemo(() => {
    if (!randomOrder || !shuffleOrderKeys) return alphaFiltered;
    const byKey = new Map(alphaFiltered.map((w) => [w.key, w]));
    const fromShuffle = shuffleOrderKeys.map((k) => byKey.get(k)).filter((w): w is DisplayWord => !!w);
    const extra = alphaFiltered.filter((w) => !shuffleOrderKeys.includes(w.key));
    return [...fromShuffle, ...extra];
  }, [alphaFiltered, randomOrder, shuffleOrderKeys]);

  const totalPages = Math.max(1, Math.ceil(ordered.length / pageSize));
  const pageSafe = Math.min(page, totalPages - 1);
  const pageWords = ordered.slice(pageSafe * pageSize, pageSafe * pageSize + pageSize);

  function toggleReveal(key: string) {
    setRevealedKeys((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  }

  async function makeFolder() {
    const name = window.prompt("새 폴더 이름");
    if (!name?.trim()) return;
    const r = await createVocabFolderAction(name);
    if (r.ok) setFolders((prev) => [...prev, { id: r.value.id, name: r.value.name, isDefault: false }]);
    setAddingFolder(false);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={() => { setSelected("custom"); setPage(0); }}
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

      {selected === "custom" && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-[11px] font-bold text-grey-400 uppercase">폴더</span>
          <button
            onClick={() => setFolderFilter("all")}
            className={"text-[12px] font-bold px-2.5 py-1 rounded-lg border-[1.5px] " + (folderFilter === "all" ? "border-ink bg-ink text-white" : "border-grey-200 text-ink")}
          >
            전체
          </button>
          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => setFolderFilter(f.id)}
              className={"text-[12px] font-bold px-2.5 py-1 rounded-lg border-[1.5px] " + (folderFilter === f.id ? "border-ink bg-ink text-white" : f.isDefault ? "border-red text-red" : "border-grey-200 text-ink")}
            >
              {f.name}
            </button>
          ))}
          {!readOnly && (
            <button onClick={() => void makeFolder()} disabled={addingFolder} className="text-[12px] font-bold px-2.5 py-1 rounded-lg border-[1.5px] border-dashed border-grey-300 text-grey-500">
              + 새 폴더
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button onClick={() => setShowKorean((v) => !v)} className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink">
          {showKorean ? "한글 뜻 숨기기" : "한글 뜻 보기"}
        </button>
        <button
          onClick={() => setHideMode((m) => { const next = m === "definition" ? "none" : "definition"; if (next !== "none") setRevealedKeys(new Set()); return next; })}
          className={"text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] " + (hideMode === "definition" ? "border-ink bg-ink text-white" : "border-grey-200 text-ink")}
        >
          뜻 가리기
        </button>
        <button
          onClick={() => setHideMode((m) => { const next = m === "word" ? "none" : "word"; if (next !== "none") setRevealedKeys(new Set()); return next; })}
          className={"text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] " + (hideMode === "word" ? "border-ink bg-ink text-white" : "border-grey-200 text-ink")}
        >
          단어 가리기
        </button>
        <button
          onClick={() => setRandomOrder((v) => { const next = !v; if (next) reshuffle(); return next; })}
          className={"text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] " + (randomOrder ? "border-ink bg-ink text-white" : "border-grey-200 text-ink")}
        >
          랜덤 순서로 보기
        </button>
        {randomOrder && (
          <button onClick={reshuffle} className="text-[12px] font-semibold text-grey-500">다시 섞기</button>
        )}
        {selected === "custom" && !readOnly && (
          <button onClick={() => setAdding(true)} className="ml-auto text-[12px] font-bold px-3 py-1.5 rounded-lg bg-green text-white">
            + 단어 추가
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        <button onClick={() => { setAlphaRange(null); setPage(0); }} className={"text-[11.5px] font-bold px-2 py-1 rounded-md " + (!alphaRange ? "bg-ink text-white" : "bg-grey-100 text-grey-500")}>전체</button>
        {ALPHA_RANGES.map(([from, to]) => (
          <button
            key={from}
            onClick={() => { setAlphaRange([from, to]); setPage(0); }}
            className={"text-[11.5px] font-bold px-2 py-1 rounded-md " + (alphaRange?.[0] === from ? "bg-ink text-white" : "bg-grey-100 text-grey-500")}
          >
            {from}-{to}
          </button>
        ))}
      </div>

      {adding && selected === "custom" && !readOnly && (
        <AddWordForm
          folders={folders}
          onCancel={() => setAdding(false)}
          onAdded={(w) => { setMyWords((prev) => [w, ...prev]); setAdding(false); }}
        />
      )}

      {selected === "custom" && myWords.length === 0 ? (
        <Empty text="아직 추가한 단어가 없어요. '+ 단어 추가'를 눌러보세요." />
      ) : selected !== "custom" && loadingBook && !libWords[selected] ? (
        <p className="text-[13px] text-grey-500">불러오는 중…</p>
      ) : selected !== "custom" && !libWords[selected]?.length ? (
        <Empty text="이 권에는 아직 등록된 단어가 없어요." />
      ) : ordered.length === 0 ? (
        <Empty text="이 범위에는 단어가 없어요." />
      ) : (
        <>
          {pageWords.map((w) => (
            <WordRow
              key={w.key} w={w} showKorean={showKorean} hideMode={hideMode}
              revealed={revealedKeys.has(w.key)} onToggleReveal={() => toggleReveal(w.key)}
              folders={folders} readOnly={readOnly}
              onSetFolder={async (folderId) => {
                if (readOnly) return;
                if (w.myWordId) {
                  await setMyVocabWordFolderAction(w.myWordId, folderId);
                  setMyWords((prev) => prev.map((x) => (x.id === w.myWordId ? { ...x, folderId } : x)));
                } else if (w.libraryWordId) {
                  const r = await toggleLibraryWordInMyVocabAction(w.libraryWordId, folderId);
                  if (r.ok) {
                    if (folderId === null) {
                      setMyWords((prev) => prev.filter((x) => x.word.toLowerCase() !== w.word.toLowerCase()));
                    } else {
                      setMyWords((prev) => {
                        const exists = prev.some((x) => x.word.toLowerCase() === w.word.toLowerCase());
                        if (exists) return prev.map((x) => (x.word.toLowerCase() === w.word.toLowerCase() ? { ...x, folderId } : x));
                        return [
                          { id: `pending-${w.libraryWordId}`, word: w.word, definition: w.definitionKo, example: w.example1, example2: w.example2, synonymWords: w.synonymWords, antonymWords: w.antonymWords, createdAt: new Date().toISOString(), folderId },
                          ...prev,
                        ];
                      });
                    }
                  }
                }
              }}
              onDelete={selected === "custom" && !readOnly ? () => {
                if (!w.myWordId) return;
                void deleteMyVocabWordAction(w.myWordId);
                setMyWords((prev) => prev.filter((x) => x.id !== w.myWordId));
              } : undefined}
            />
          ))}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-1.5">
              {PAGE_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => { setPageSize(size); setPage(0); }}
                  className={"text-[11.5px] font-bold px-2 py-1 rounded-md " + (pageSize === size ? "bg-ink text-white" : "bg-grey-100 text-grey-500")}
                >
                  {size}개씩
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button disabled={pageSafe === 0} onClick={() => setPage((p) => p - 1)} className="text-[12px] font-semibold text-grey-500 disabled:opacity-30">이전</button>
              <span className="text-[12px] text-grey-500">{pageSafe + 1} / {totalPages}</span>
              <button disabled={pageSafe >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="text-[12px] font-semibold text-grey-500 disabled:opacity-30">다음</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function WordRow({
  w, showKorean, hideMode, revealed, onToggleReveal, folders, onSetFolder, onDelete, readOnly,
}: {
  w: DisplayWord; showKorean: boolean; hideMode: "none" | "definition" | "word";
  revealed: boolean; onToggleReveal: () => void;
  folders: VocabFolder[]; onSetFolder: (folderId: string | null) => void;
  onDelete?: () => void;
  readOnly?: boolean;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [folderMenuOpen, setFolderMenuOpen] = useState(false);
  const wordHidden = hideMode === "word" && !revealed;
  const defHidden = hideMode === "definition" && !revealed;
  const currentFolder = folders.find((f) => f.id === w.folderId);

  return (
    <div className="border-b border-grey-100 py-3">
      <div className="flex items-start gap-3">
        <div
          className={"w-[130px] shrink-0 text-[14.5px] font-bold text-ink " + (wordHidden ? "blur-sm select-none cursor-pointer" : "")}
          onClick={() => wordHidden && onToggleReveal()}
        >
          {wordHidden ? "●●●●●●" : w.word}
        </div>
        <div
          className={"flex-1 text-[13.5px] text-ink " + (defHidden ? "blur-sm select-none cursor-pointer" : "")}
          onClick={() => defHidden && onToggleReveal()}
        >
          {defHidden ? "가려짐 (클릭해서 보기)" : showKorean ? (w.definitionKo || "(한글 뜻 없음)") : w.definitionEn}
        </div>
        <div className="relative shrink-0">
          <button
            onClick={() => !readOnly && setFolderMenuOpen((v) => !v)}
            disabled={readOnly}
            title={currentFolder ? `저장됨: ${currentFolder.name}` : "내 단어장에 저장"}
            className={"text-[16px] leading-none " + (w.myWordId ? "text-yellow-500" : "text-grey-300")}
          >
            ★
          </button>
          {!readOnly && folderMenuOpen && (
            <div className="absolute right-0 top-6 z-10 bg-white border-[1.5px] border-grey-200 rounded-lg shadow-md py-1 w-[160px]">
              {folders.map((f) => (
                <button
                  key={f.id}
                  onClick={() => { onSetFolder(f.id); setFolderMenuOpen(false); }}
                  className={"block w-full text-left px-3 py-1.5 text-[12px] " + (w.folderId === f.id ? "font-bold text-ink" : "text-grey-500")}
                >
                  {f.name}{w.folderId === f.id ? " ✓" : ""}
                </button>
              ))}
              {w.myWordId && (
                <button
                  onClick={() => { onSetFolder(null); setFolderMenuOpen(false); }}
                  className="block w-full text-left px-3 py-1.5 text-[12px] text-red border-t border-grey-100 mt-1"
                >
                  {w.libraryWordId ? "저장 취소" : "폴더 없음으로"}
                </button>
              )}
            </div>
          )}
        </div>
        <button onClick={() => setDetailOpen((v) => !v)} className="shrink-0 text-[12px] font-semibold text-grey-500">
          {detailOpen ? "접기" : "상세"}
        </button>
        {onDelete && (
          <button onClick={onDelete} className="shrink-0 text-[12px] font-semibold text-red">삭제</button>
        )}
      </div>
      {detailOpen && (
        <div className="mt-2 pl-[142px] space-y-1.5">
          {showKorean && !defHidden && <p className="text-[12.5px] text-grey-500">한글 뜻: {w.definitionKo || "(없음)"}</p>}
          {(w.example1 || w.example2) && (
            <div className="text-[12.5px] text-grey-500 space-y-0.5">
              {w.example1 && <p>예문 1: {w.example1}</p>}
              {w.example2 && <p>예문 2: {w.example2}</p>}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            {w.synonymWords?.length ? (
              <div className="flex flex-wrap gap-1 items-center">
                <span className="text-[10.5px] font-bold text-grey-300 uppercase">유사어</span>
                {w.synonymWords.map((s) => <span key={s} className="text-[10.5px] font-bold px-2 py-0.5 rounded-lg bg-grey-100 text-grey-500">{s}</span>)}
              </div>
            ) : null}
            {w.antonymWords?.length ? (
              <div className="flex flex-wrap gap-1 items-center">
                <span className="text-[10.5px] font-bold text-grey-300 uppercase">반의어</span>
                {w.antonymWords.map((s) => <span key={s} className="text-[10.5px] font-bold px-2 py-0.5 rounded-lg bg-red-bg text-red">{s}</span>)}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function AddWordForm({ folders, onCancel, onAdded }: { folders: VocabFolder[]; onCancel: () => void; onAdded: (w: MyVocabWord) => void }) {
  const [word, setWord] = useState("");
  const [definition, setDefinition] = useState("");
  const [example, setExample] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    if (!word.trim()) { setError("단어를 입력하세요."); return; }
    setBusy(true);
    const r = await addMyVocabWordAction({ word, definition, example, folderId });
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    onAdded({ id: r.value, word: word.trim(), definition: definition.trim() || null, example: example.trim() || null, example2: null, synonymWords: null, antonymWords: null, createdAt: new Date().toISOString(), folderId });
  }
  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3.5 mb-4">
      <div className="flex flex-col gap-2">
        <input value={word} onChange={(e) => setWord(e.target.value)} placeholder="단어" className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[13px]" />
        <input value={definition} onChange={(e) => setDefinition(e.target.value)} placeholder="뜻(선택)" className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[13px]" />
        <input value={example} onChange={(e) => setExample(e.target.value)} placeholder="예문(선택)" className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[13px]" />
        <select value={folderId ?? ""} onChange={(e) => setFolderId(e.target.value || null)} className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[13px]">
          <option value="">폴더 없음</option>
          {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        {error && <p className="text-[12px] text-red">{error}</p>}
        <div className="flex gap-2">
          <button disabled={busy} onClick={() => void submit()} className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50">추가</button>
          <button onClick={onCancel} className="text-[12px] font-semibold text-grey-500">취소</button>
        </div>
      </div>
    </div>
  );
}

// --- 시험 만들기·채점 ---

function QuizPanel({
  books, folders, initialQuizzes, readOnly,
}: {
  books: LibraryBook[]; folders: VocabFolder[]; initialQuizzes: VocabQuiz[]; readOnly?: boolean;
}) {
  const [quizzes, setQuizzes] = useState(initialQuizzes);
  const [creating, setCreating] = useState(false);
  const [sources, setSources] = useState<Set<SourceKey>>(new Set(["custom"]));
  const [folderIds, setFolderIds] = useState<Set<string>>(new Set());
  const [count, setCount] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<VocabQuiz | null>(null);

  function toggleSource(key: SourceKey) {
    setSources((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  }
  function toggleFolder(id: string) {
    setFolderIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  async function makeQuiz() {
    setError(null);
    const bookIds = [...sources].filter((s) => s.startsWith("book:")).map((s) => s.slice(5));
    const r = await createVocabQuizAction({ customWords: sources.has("custom"), bookIds, count, folderIds: [...folderIds] });
    if (!r.ok) { setError(r.error); return; }
    const quiz: VocabQuiz = {
      id: r.value.id, status: "pending", wordCount: r.value.items.length, items: r.value.items, score: null, total: null, answers: null,
      source: { customWords: sources.has("custom"), bookIds, folderIds: [...folderIds] },
      createdAt: new Date().toISOString(), dueAt: null, sessionId: null, assignedByTeacher: false,
    };
    setQuizzes((prev) => [quiz, ...prev]);
    setCreating(false);
    setActive(quiz);
  }

  function handleQuizDone(updated: VocabQuiz) {
    setQuizzes((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
    setActive(null);
  }

  function handleQuizProgress(updated: VocabQuiz) {
    setQuizzes((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
  }

  async function retake(quiz: VocabQuiz) {
    const r = await retakeVocabQuizAction(quiz.id);
    if (!r.ok) return;
    const reset: VocabQuiz = { ...quiz, status: "pending", answers: null, score: null, total: null };
    setQuizzes((prev) => prev.map((q) => (q.id === quiz.id ? reset : q)));
    setActive(reset);
  }

  function sourceLabel(q: VocabQuiz): string {
    const parts: string[] = [];
    if (q.source.customWords) parts.push("내 단어장");
    for (const bid of q.source.bookIds) {
      const b = books.find((bk) => bk.id === bid);
      if (b) parts.push(b.title.split(" — ")[0]);
    }
    if (q.source.folderIds.length > 0) parts.push(`폴더 ${q.source.folderIds.length}개`);
    return parts.length > 0 ? parts.join(", ") : "전체";
  }

  if (!readOnly && active) return <QuizRunner quiz={active} onDone={handleQuizDone} onProgress={handleQuizProgress} onExit={() => setActive(null)} />;

  return (
    <div>
      {readOnly ? null : !creating ? (
        <button onClick={() => setCreating(true)} className="text-[12.5px] font-bold px-3.5 py-2 rounded-lg bg-ink text-white mb-4">시험 만들기</button>
      ) : (
        <div className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3.5 mb-4">
          <p className="text-[12px] font-bold text-grey-500 mb-2">시험 볼 단어장 선택(선택지는 전부 영어입니다)</p>
          <div className="flex flex-wrap gap-2 mb-2">
            <label className="text-[12.5px] flex items-center gap-1.5">
              <input type="checkbox" checked={sources.has("custom")} onChange={() => toggleSource("custom")} /> 내 단어장 전체
            </label>
            {books.map((b) => (
              <label key={b.id} className="text-[12.5px] flex items-center gap-1.5">
                <input type="checkbox" checked={sources.has(`book:${b.id}`)} onChange={() => toggleSource(`book:${b.id}`)} /> {b.title}
              </label>
            ))}
          </div>
          {folders.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="text-[11px] font-bold text-grey-400 uppercase self-center">폴더만</span>
              {folders.map((f) => (
                <label key={f.id} className="text-[12.5px] flex items-center gap-1.5">
                  <input type="checkbox" checked={folderIds.has(f.id)} onChange={() => toggleFolder(f.id)} /> {f.name}
                </label>
              ))}
            </div>
          )}
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
        quizzes.map((q) => {
          const answeredSoFar = q.answers?.filter((a) => a !== null).length ?? 0;
          return (
            <div key={q.id} className="border border-grey-200 rounded-xl px-4 py-3 mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[13px] font-bold text-ink">
                  {new Date(q.createdAt).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })} · {q.wordCount}문항 · {sourceLabel(q)}
                  {q.assignedByTeacher && <span className="text-[11px] text-grey-500 font-normal"> (선생님이 냄)</span>}
                </span>
                <span className="text-[12.5px] font-bold text-ink">
                  {/* 2026-09-21(UAT 지적) — "진행 중 1/4"가 맞은 개수/지금까지 답한 개수라 문항 수(10문항)와
                      안 맞아 보였다(분모가 전체가 아니라 그때그때 바뀌는 응답 수였다). 진행 중에는 정오
                      대신 "지금까지 답한 문항/전체 문항"으로 보여준다 — 정답 여부는 끝나야 의미가 있다. */}
                  {q.status === "completed"
                    ? `${q.score}/${q.total}점`
                    : q.status === "in_progress"
                      ? `${answeredSoFar}/${q.wordCount}문항 답함`
                      : "응시 전"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                {q.dueAt && q.status !== "completed" && (
                  <span className="text-[11px] text-red">마감 {new Date(q.dueAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                )}
                {!readOnly && (
                  <div className="ml-auto flex gap-2">
                    {q.status === "pending" && <button onClick={() => setActive(q)} className="text-[12px] font-bold text-green">응시하기</button>}
                    {q.status === "in_progress" && <button onClick={() => setActive(q)} className="text-[12px] font-bold text-green">계속 풀기</button>}
                    {q.status !== "pending" && <button onClick={() => void retake(q)} className="text-[12px] font-bold text-grey-500">다시 풀기</button>}
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

/** Quizlet 식 — 클릭 즉시 정답/오답이 색으로 표시된다(2026-09-16). 문항별 정오는 그 즉시 오답
 * 노트에도 반영된다(saveVocabQuizProgressAction) — 다 풀지 않고 나가도 그때까지 답은 남는다. */
export function QuizRunner({
  quiz, onDone, onProgress, onExit,
}: {
  quiz: VocabQuiz; onDone: (q: VocabQuiz) => void; onProgress: (q: VocabQuiz) => void; onExit: () => void;
}) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => quiz.items.map((_, idx) => quiz.answers?.[idx] ?? null));
  const [i, setI] = useState(() => {
    const firstUnanswered = quiz.items.findIndex((_, idx) => (quiz.answers?.[idx] ?? null) === null);
    return firstUnanswered === -1 ? 0 : firstUnanswered;
  });
  const [submitting, setSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [result, setResult] = useState<{ score: number; total: number; finalAnswers: number[] } | null>(null);
  const item: VocabQuizItem | undefined = quiz.items[i];
  const allAnswered = useMemo(() => answers.every((a) => a !== null), [answers]);
  const runningScore = answers.reduce((n: number, a, idx) => n + (a !== null && a === quiz.items[idx].correctIndex ? 1 : 0), 0);

  async function saveProgress(next: (number | null)[]) {
    setSaveStatus("saving");
    const r = await saveVocabQuizProgressAction(quiz.id, next);
    setSaveStatus(r.ok ? "saved" : "idle");
    const answeredCount = next.filter((a) => a !== null).length;
    const score = quiz.items.reduce((acc, it, idx) => acc + (next[idx] !== null && next[idx] === it.correctIndex ? 1 : 0), 0);
    onProgress({ ...quiz, status: answeredCount > 0 ? "in_progress" : "pending", answers: next, score, total: quiz.items.length });
  }

  function pickAnswer(idx: number) {
    setAnswers((prev) => {
      const next = prev.map((a, j) => (j === i ? idx : a));
      void saveProgress(next);
      return next;
    });
  }

  async function submit() {
    setSubmitting(true);
    const finalAnswers = answers.map((a) => a ?? -1);
    const r = await submitVocabQuizAction(quiz.id, finalAnswers);
    setSubmitting(false);
    if (r.ok) setResult({ score: r.value.score, total: r.value.total, finalAnswers });
  }

  if (result) {
    const wrongItems = quiz.items.filter((it, idx) => result.finalAnswers[idx] !== it.correctIndex);
    return (
      <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-5">
        <h3 className="text-[18px] font-extrabold text-ink mb-1">결과: {result.score} / {result.total}</h3>
        {wrongItems.length === 0 ? (
          <p className="text-[13px] text-green font-bold mt-2">전부 맞혔습니다.</p>
        ) : (
          <>
            <p className="text-[12.5px] text-grey-500 mt-1 mb-3">틀린 단어는 내 단어장의 “오답 노트” 폴더에 자동 저장됐습니다. 다시 맞히면 폴더에서 빠집니다.</p>
            {wrongItems.map((it) => (
              <div key={it.word} className="border border-grey-200 rounded-lg px-3.5 py-3 mb-2">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-bold text-ink">{it.word}</span>
                  <span className="text-[12.5px] text-ink">{it.options[it.correctIndex]}</span>
                </div>
                {(it.example1 || it.example2) && (
                  <div className="text-[12px] text-grey-500 mt-1.5 space-y-0.5">
                    {it.example1 && <p>예문 1: {it.example1}</p>}
                    {it.example2 && <p>예문 2: {it.example2}</p>}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
        <button
          onClick={() => onDone({ ...quiz, status: "completed", score: result.score, total: result.total, answers: result.finalAnswers })}
          className="text-[12.5px] font-bold px-3.5 py-2 rounded-lg bg-ink text-white mt-3"
        >
          확인
        </button>
      </div>
    );
  }

  if (!item) return null;
  const picked = answers[i];
  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[12px] font-bold text-grey-500">{i + 1} / {quiz.items.length} · 현재 {runningScore}점</span>
        <span className="flex items-center gap-2">
          {saveStatus === "saving" && <span className="text-[11px] text-grey-400">저장 중...</span>}
          {saveStatus === "saved" && <span className="text-[11px] text-grey-400">저장됨</span>}
          <button onClick={() => void saveProgress(answers)} className="text-[12px] font-semibold text-ink">저장하기</button>
          <button onClick={onExit} className="text-[12px] text-grey-500">나가기</button>
        </span>
      </div>
      <h3 className="text-[18px] font-extrabold text-ink mb-4">{item.definitionShown}</h3>
      <div className="flex flex-col gap-2 mb-4">
        {item.options.map((opt, idx) => {
          const isPicked = picked === idx;
          const isCorrect = idx === item.correctIndex;
          const showFeedback = picked !== null;
          const cls = !showFeedback
            ? "border-grey-200"
            : isCorrect ? "border-green bg-green/10"
            : isPicked ? "border-red bg-red-bg"
            : "border-grey-200 opacity-60";
          return (
            <button
              key={idx}
              disabled={showFeedback}
              onClick={() => pickAnswer(idx)}
              className={"text-left text-[13.5px] px-3.5 py-2.5 rounded-[10px] border-[1.5px] disabled:cursor-default " + cls}
            >
              {opt}
              {showFeedback && isCorrect && <span className="ml-2 text-green font-bold">✓ 정답</span>}
              {showFeedback && isPicked && !isCorrect && <span className="ml-2 text-red font-bold">✗ 오답</span>}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between">
        <button disabled={i === 0} onClick={() => setI((v) => v - 1)} className="text-[12px] font-semibold text-grey-500 disabled:opacity-30">이전</button>
        {i < quiz.items.length - 1 ? (
          <button disabled={picked === null} onClick={() => setI((v) => v + 1)} className="text-[12px] font-bold text-ink disabled:opacity-30">다음</button>
        ) : (
          <button disabled={!allAnswered || submitting} onClick={() => void submit()} className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-green text-white disabled:opacity-50">제출</button>
        )}
      </div>
    </div>
  );
}
