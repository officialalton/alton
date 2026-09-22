"use client";

import { useEffect, useState } from "react";
import { addVocabWord, createSessionVocabFolder, loadSessionVocabFolders, type SessionVocabFolder } from "./vocab-actions";

const WORD_CHAR = /[A-Za-z0-9'\-가-힣ㄱ-ㆎ]/;
const NEW_FOLDER = "__new__";

type Popup = { word: string; x: number; y: number };

/**
 * 교재 본문에서 단어를 클릭하면(functional-spec §5 — 드래그가 아니라 클릭) 팝업이
 * 뜨고, 확인하면 AI가 뜻/예문/비슷한 단어를 만들어 단어장(고른 폴더, 없으면 새로
 * 만들어)에 저장한다. 2026-09-21(사용자 지시) — 실수로 계속 팝업이 뜨지 않게
 * on/off 스위치를 두고, 기본은 꺼진 상태로 시작한다.
 */
export default function VocabClickLayer({
  sessionId,
  studentId,
  enabled,
  children,
}: {
  sessionId: string;
  studentId: string;
  enabled: boolean;
  children: React.ReactNode;
}) {
  const [saveMode, setSaveMode] = useState(false);
  const [popup, setPopup] = useState<Popup | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [folders, setFolders] = useState<SessionVocabFolder[] | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  useEffect(() => {
    if (!enabled || !saveMode || folders) return;
    loadSessionVocabFolders(studentId).then((f) => {
      setFolders(f);
      setFolderId(f.find((x) => x.isDefault)?.id ?? f[0]?.id ?? null);
    });
  }, [enabled, saveMode, folders, studentId]);

  async function handleFolderChange(value: string) {
    if (value === NEW_FOLDER) {
      setAddingFolder(true);
      return;
    }
    setFolderId(value || null);
  }

  async function confirmNewFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    const folder = await createSessionVocabFolder(studentId, name);
    setFolders((prev) => [...(prev ?? []), folder]);
    setFolderId(folder.id);
    setAddingFolder(false);
    setNewFolderName("");
  }

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!enabled || !saveMode || busy) return;
    const target = e.target as HTMLElement;
    if (
      target.closest(
        "button, textarea, input, canvas, a, .prob-choice, .save-btn, .pick-btn"
      )
    ) {
      setPopup(null);
      return;
    }

    const docWithCaret = document as Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
      caretPositionFromPoint?: (
        x: number,
        y: number
      ) => { offsetNode: Node; offset: number } | null;
    };

    let range: Range | null = null;
    if (docWithCaret.caretRangeFromPoint) {
      range = docWithCaret.caretRangeFromPoint(e.clientX, e.clientY);
    } else if (docWithCaret.caretPositionFromPoint) {
      const pos = docWithCaret.caretPositionFromPoint(e.clientX, e.clientY);
      if (pos) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
      }
    }

    if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) {
      setPopup(null);
      return;
    }

    const textNode = range.startContainer;
    const text = textNode.textContent ?? "";
    let start = range.startOffset;
    let end = range.startOffset;
    while (start > 0 && WORD_CHAR.test(text[start - 1])) start--;
    while (end < text.length && WORD_CHAR.test(text[end])) end++;
    const word = text.slice(start, end).trim();
    if (!word || word.length < 2) {
      setPopup(null);
      return;
    }

    const wordRange = document.createRange();
    wordRange.setStart(textNode, start);
    wordRange.setEnd(textNode, end);
    const rect = wordRange.getBoundingClientRect();
    setStatus(null);
    setPopup({ word, x: rect.left, y: rect.top });
  }

  async function confirmAdd() {
    if (!popup) return;
    const word = popup.word;
    setBusy(true);
    setPopup(null);
    setStatus(`"${word}" — AI가 뜻을 정리하는 중...`);
    try {
      const result = await addVocabWord(studentId, sessionId, word, folderId);
      setStatus(
        result.alreadyExisted
          ? `"${word}"는 이미 단어장에 있어요.`
          : `✓ "${word}" 단어장에 추가됨`
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "저장 중 오류가 발생했어요.");
    } finally {
      setBusy(false);
      setTimeout(() => setStatus(null), 2500);
    }
  }

  return (
    <div onClick={handleClick} className="relative">
      {enabled && (
        <div className="sticky top-0 z-[150] mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-grey-200 bg-white px-3 py-1.5 text-[12px]">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSaveMode((v) => !v);
              setPopup(null);
            }}
            aria-pressed={saveMode}
            className={`rounded-full border px-2.5 py-1 text-[11.5px] font-bold ${
              saveMode ? "border-ink bg-ink text-white" : "border-grey-300 text-grey-600"
            }`}
          >
            {saveMode ? "단어 저장 켜짐" : "📖 단어 저장 켜기"}
          </button>
          {saveMode && folders && (
            <>
              <span className="text-grey-500">저장할 폴더</span>
              {addingFolder ? (
                <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <input
                    autoFocus
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && confirmNewFolder()}
                    placeholder="새 폴더 이름"
                    className="rounded border border-grey-300 px-2 py-1 text-[12px]"
                  />
                  <button type="button" onClick={confirmNewFolder} className="font-bold text-ink underline">
                    만들기
                  </button>
                </span>
              ) : (
                <select
                  value={folderId ?? ""}
                  onChange={(e) => {
                    void handleFolderChange(e.target.value);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded border border-grey-300 px-2 py-1 text-[12px]"
                >
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                  <option value={NEW_FOLDER}>+ 새 폴더 만들기</option>
                </select>
              )}
            </>
          )}
        </div>
      )}

      {children}

      {popup && (
        <div
          className="fixed z-[200] bg-ink text-white text-[12.5px] font-bold px-3.5 py-2 rounded-lg cursor-pointer shadow-lg"
          style={{ top: Math.max(8, popup.y - 42), left: popup.x }}
          onClick={(e) => {
            e.stopPropagation();
            confirmAdd();
          }}
        >
          + &quot;{popup.word}&quot; 단어장에 추가
        </div>
      )}

      {status && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] bg-ink text-white text-[12.5px] font-semibold px-4 py-2 rounded-full shadow-lg">
          {status}
        </div>
      )}
    </div>
  );
}
